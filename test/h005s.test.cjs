'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { DlpHeaterProtocol } = require('../hdl/dlp-heater-protocol');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(options = {}) {
  const bus = new EventEmitter();
  const commands = [];
  let state = Buffer.from(options.state || [0, 19, 0, 1, 26, 18, 17, 12, 0]);
  const app = {
    log() {}, bus: () => bus, isBusConnected: () => options.connected !== false,
    controller: () => ({ subnet: 1, id: 2, send(packet, callback) {
      commands.push(packet);
      if (options.sendError) { callback(new Error('send failed')); return; }
      callback(null);
      if ((options.skipFirstRead && commands.length === 1) || options.silent || (packet.command === 0x1946 && options.noAck)) return;
      setImmediate(() => {
        if (options.close) { bus.emit('close'); return; }
        const sender = options.wrongSender ? { subnet: 2, id: 103 } : { subnet: 1, id: 103 };
        if (packet.command === 0x1944) {
          const reply = Buffer.from(state);
          if (commands.length > 2 && (options.temperatureAlwaysStale || (options.temperatureOnceStale && commands.length === 3))) reply[4] = 26;
          if (options.foreignReply) {
            const stale = Buffer.from(state); stale[4] = 5; stale[5] = 35;
            bus.emit('command', { sender, target: {subnet:1,id:1}, code: 0x1945, payload: stale });
            bus.emit('command', { sender, target: {subnet:2,id:2}, code: 0x1945, payload: stale });
          }
          if (options.foreignOnly) return;
          if (commands.length > 2 && (options.powerAlwaysStale || (options.powerOnceStale && commands.length === 3))) reply[2] = 1 - state[2];
          if (commands.length > 2 && options.readbackMismatch) reply[5]++;
          bus.emit('command', { sender, target:{subnet:1,id:2}, code: 0x1945, payload: reply });
        } else if (packet.command === 0xe3d8) {
          state[2] = packet.payload[1];
          bus.emit('command', { sender, code: 0xe3d9, payload: Buffer.from([0x19, state[4]]) });
          bus.emit('command', { sender, code: 0xe3d9, payload: Buffer.from([0x14, options.ackMismatch ? 1-state[2] : state[2]]) });
        } else {
          state[4] = packet.payload[3];
          const reply = Buffer.concat([Buffer.from([options.reject ? 0xf5 : 0xf8]), packet.payload, Buffer.from([0, 0])]);
          if (options.ackMismatch) reply[6]++;
          if (options.extraByte !== undefined) reply[8] = options.extraByte;
          bus.emit('command', { sender, code: 0x1947, payload: reply });
        }
      });
    } }),
  };
  return { service: new DlpHeaterProtocol(app, 40), bus, commands };
}

test('reads fresh state, preserves power OFF and other presets, writes exact eight bytes and reads back', async () => {
  const h = harness();
  assert.equal(await h.service.setTemperature(10), true);
  assert.deepEqual(h.commands.map(c => c.command), [0x1944, 0x1946, 0x1944]);
  assert.equal(h.commands[1].payload.toString('hex'), '0000010a12110c00');
  assert.ok(h.commands.every(c => c.target === '1.103'));
  assert.equal(h.bus.listenerCount('command'), 0);
});
test('preserves power ON and reproduces T4b payload for 26 C', async () => {
  const h = harness({ state: [0, 19, 1, 1, 25, 20, 20, 20, 0] });
  await h.service.setTemperature(26);
  assert.equal(h.commands[1].payload.toString('hex'), '0001011a14141400');
});
test('power changes use key 14, ignore key 19, and preserve all temperatures', async () => {
  const h = harness();
  await h.service.setPower(true);
  assert.deepEqual(h.commands.map(c => c.command), [0x1944, 0xe3d8, 0x1944]);
  assert.equal(h.commands[1].payload.toString('hex'), '1401');
  await h.service.setPower(false);
  assert.equal(h.commands[4].payload.toString('hex'), '1400');
  const mismatch = harness({ readbackMismatch: true });
  await assert.rejects(mismatch.service.setPower(true), /Read-back mismatch/);
  const badAck = harness({ ackMismatch: true });
  await assert.rejects(badAck.service.setPower(true), /confirm/);
});
test('read polling shares lock with writes', async () => {
  const h = harness();
  const change = h.service.setTemperature(12);
  assert.equal(await h.service.readStatus(), null);
  await assert.rejects(h.service.setPower(true), /in progress/);
  await change;
  const state = await h.service.readStatus();
  assert.equal(state.normal, 12);
  assert.equal(state.power, 0);
});
test('ignores stale replies addressed to original app or another subnet', async () => {
  const h=harness({foreignReply:true});
  assert.equal(await h.service.setTemperature(12),true);
  assert.equal(h.commands[1].payload.toString('hex'),'0000010c12110c00');
});
test('foreign status alone cannot authorize a write', async () => {
  const h=harness({foreignReply:true,foreignOnly:true});
  await assert.rejects(h.service.setTemperature(12),/No acknowledgement/);
  assert.equal(h.commands.length,1);
});
test('real state mismatch identifies the affected field', async () => {
  const h=harness({readbackMismatch:true});
  await assert.rejects(h.service.setTemperature(12),/Day: expected 18, read 19/);
});

function loadDevice() {
  const moduleObject = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../drivers/dlpheater/device.js'), 'utf8'), {
    module: moduleObject, Buffer,
    require(name) {
      if (name === 'homey') return { Device: class {} };
      return require(path.resolve(__dirname,'../drivers/dlpheater',name));
    },
  });
  const device = new moduleObject.exports();
  device.values = {};
  device.setCapabilityOptions = async () => {};
  device.setSettings = async () => {}; device.removeCapability = async () => {};
  device.homey = { ...device.homey, app: {valueOK: (type, value) => type === 'temperature' && value >= -40 && value <= 80}, i18n: { getLanguage: () => 'no' } };
  device.setCapabilityValue = async (key, value) => { device.values[key] = value; };
  device.setAvailable = async () => { device.unavailable = null; };
  device.setUnavailable = async message => { device.unavailable = message; };
  return device;
}
test('DLP device maps full status, preserves temperature on ACK, keeps Day mode available', async () => {
  const d = loadDevice();
  await d.updateFromSignal({ code: 0x1945, payload: Buffer.from('001300010b12100c0100','hex') });
  assert.deepEqual(d.values, { measure_temperature:19, onoff:false, hdl_heating_mode:'Normal', hdl_active_setpoint:11, hdl_thermostat_mode:'1', 'target_temperature.active':11, 'measure_temperature.active':19 });
  await d.updateFromSignal({ code: 0x1947, payload: Buffer.from('f80000010c12100c010001','hex') });
  assert.equal(d.values['target_temperature.active'], 11);
  assert.equal(d.values.measure_temperature, 19);
  await d.updateFromSignal({ code: 0x1945, payload: Buffer.from('001300020b12100c0100','hex') });
  assert.equal(d.unavailable, null); assert.equal(d.values.hdl_heating_mode, 'Dag'); assert.equal(d.values.hdl_active_setpoint, 18);
  assert.equal(d.values.target_temperature, undefined);
});
test('DLP capabilities exclude valves and listeners use the shared service', async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname,'../drivers/dlpheater/driver.compose.json'),'utf8'));
  assert.deepEqual(manifest.capabilities, ['measure_temperature','onoff','hdl_heating_mode','hdl_active_setpoint','hdl_thermostat_mode','target_temperature.active','measure_temperature.active']);
  const d=loadDevice(); const calls=[]; const listeners={};
  d.getData=()=>({id:'1.103'});
  d.homey={app:{isBusConnected:()=>false, dlpService: address=>({
    watchMode:()=>()=>{},
    setTemperature:async value=>calls.push([address,'temperature',value]),
    setPower:async value=>calls.push([address,'power',value]),
  })}};
  d.hasCapability=()=>true; d.getClass=()=> 'thermostat';
  d.registerCapabilityListener=(key,fn)=>{listeners[key]=fn;};
  d.setCapabilityOptions=async()=>{};
  await d.onInit();
  assert.equal(listeners.target_temperature, undefined); assert.equal(typeof listeners.hdl_thermostat_mode, 'function'); await listeners.onoff(false);
  assert.deepEqual(calls,[['1.103','power',false]]);
});
test('existing panel gains only missing capabilities, changes class once, and retains identity', async () => {
  const d=loadDevice(); const capabilities=new Set(['measure_temperature']); const added=[];
  let cls='sensor'; let classChanges=0;
  d.hasCapability=key=>capabilities.has(key);
  d.addCapability=async key=>{added.push(key); capabilities.add(key);};
  d.getClass=()=>cls; d.setClass=async value=>{cls=value; classChanges++;};
  d.getData=()=>({id:'1.103'});
  d.homey={app:{isBusConnected:()=>false,dlpService:()=>({watchMode:()=>()=>{}})}};
  d.registerCapabilityListener=()=>{}; d.setCapabilityOptions=async()=>{};
  await d.onInit(); await d.onInit();
  assert.deepEqual(added,['onoff','hdl_heating_mode','hdl_active_setpoint','hdl_thermostat_mode','target_temperature.active','measure_temperature.active']);
  assert.equal(classChanges,1); assert.equal(d.getData().id,'1.103');
});

test('panel driver pairs thermostat capabilities and handles raw and legacy temperature updates', async () => {
  const moduleObject={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../drivers/dlpheater/driver.js'),'utf8'), {
    module:moduleObject, require:name=>name==='homey'?({Driver:class{}}):require(path.resolve(__dirname,'../drivers/dlpheater',name)),
  });
  const driver=new moduleObject.exports();
  driver.log=()=>{};
  driver.homey={settings:{get:()=>1},app:{isBusConnected:()=>true,
    getDevicesOfType:()=>({103:{id:103,type:188}}),valueOK:()=>true,log:()=>{}}};
  const paired=await driver.onPairListDevices();
  assert.equal(paired[0].data.id,'1.103');
  assert.equal(paired[0].capabilities.join(','),'measure_temperature,onoff,hdl_heating_mode,hdl_active_setpoint,hdl_thermostat_mode,target_temperature.active,measure_temperature.active');
  const calls=[];
  driver.getDevices=()=>[{getData:()=>({id:'1.103'}),
    hasCapability:()=>false,updateFromSignal:async s=>calls.push(s.code),setCapabilityValue:async(k,v)=>calls.push([k,v])}];
  await driver.updateValues({sender:{subnet:1,id:103},code:0x1945});
  await driver.updateValues({sender:{subnet:1,id:103},code:0xe3e8,data:{temperature:19}});
  await driver.updateValues({sender:{subnet:2,id:103},code:0x1945});
  assert.deepEqual(calls,[0x1945,['measure_temperature',19]]);
});
test('accepts unknown extra response byte only after successful full readback', async () => {
  const h = harness({ extraByte: 1 });
  assert.equal(await h.service.setTemperature(10), true);
  assert.deepEqual(h.commands.map(c => c.command), [0x1944, 0x1946, 0x1944]);
  const mismatch = harness({ extraByte: 1, readbackMismatch: true });
  await assert.rejects(mismatch.service.setTemperature(10), /Read-back mismatch/);
});
for (const temperature of [4, 27, 10.5, NaN, '10', null]) {
  test(`rejects invalid input ${temperature} before sending`, async () => {
    const h = harness();
    await assert.rejects(h.service.setTemperature(temperature));
    assert.equal(h.commands.length, 0);
  });
}
for (const state of [[1,19,1,1,20,20,20,20], [0,19,1,2,20,20,20,20],
  [0,19,2,1,20,20,20,20], [0,19,1,1,20,0,20,20], [0,19]]) {
  test(`rejects unsupported or malformed status ${state}`, async () => {
    const h = harness({ state });
    await assert.rejects(h.service.setTemperature(10));
    assert.equal(h.commands.length, 1);
  });
}
for (const option of ['silent', 'wrongSender', 'sendError', 'close', 'noAck', 'reject', 'ackMismatch', 'readbackMismatch']) {
  test(`fails cleanly for ${option} without retrying writes`, async () => {
    const h = harness({ [option]: true });
    await assert.rejects(h.service.setTemperature(10));
    assert.ok(h.commands.filter(c => c.command === 0x1946).length <= 1);
    assert.equal(h.bus.listenerCount('command'), 0);
    assert.equal(h.bus.listenerCount('close'), 0);
    assert.equal(h.bus.listenerCount('error'), 0);
    assert.equal(h.service.busy, false);
  });
}
test('blocks overlapping runs and disconnected bus', async () => {
  const h = harness({ silent: true });
  const pending = assert.rejects(h.service.setTemperature(10));
  await assert.rejects(h.service.setTemperature(11), /in progress/);
  await pending;
  assert.equal(h.commands.length, 1);
  const disconnected = harness({ connected: false });
  await assert.rejects(disconnected.service.setTemperature(10));
  assert.equal(disconnected.commands.length, 0);
});

test('app registers the Panel Flow without sending anything on unconfigured startup', async () => {
  const moduleObject = { exports: {} };
  const listeners = new Map();
  let busCreated = false;
  const sandbox = {
    module: moduleObject,
    require(name) {
      if (name === 'homey') return { App: class { log() {} } };
      if (name === 'smart-bus') return class { constructor() { busCreated = true; } };
      if (name === './hdl/hdl_devicelist') return class {};
      if (name === './hdl/dlp-heater-service') return require('../hdl/dlp-heater-service');
      if (name === './hdl/dlp-read-queue') return require('../hdl/dlp-read-queue');
      if (name === './hdl/dlp-buttons') return require('../hdl/dlp-buttons');
      if (name === './hdl/dlp-heater-protocol') return { DlpHeaterProtocol };
      throw new Error(`Unexpected import ${name}`);
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), sandbox);
  const app = new moduleObject.exports();
  app.homey = { app, settings: { get() {}, set() {} }, flow: {
    getActionCard(id) { return { registerRunListener(fn) { listeners.set(id, fn); } }; },
  } };
  await app.onInit();
  assert.equal(busCreated, false);
  assert.deepEqual([...listeners.keys()], ['panel_press_button']);
});

test('test app identity and Flow card agree in generated and source manifests', () => {
  const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, '..', name), 'utf8'));
  const composed = read('app.json');
  assert.ok(['no.ojnor.hdl-hanoy-shs', 'com.github.alydersen.hdl-smartbus-homey'].includes(composed.id));
  assert.equal(composed.id, read('.homeycompose/app.json').id);
  assert.equal(composed.version, read('package.json').version);
  assert.ok(composed.flow.actions.some(card => card.id === 'panel_press_button'));
  assert.ok(composed.drivers.some(driver=>driver.id==='dlpheater'));
  assert.equal(composed.drivers.find(driver=>driver.id==='dlpheater').class,'thermostat');
});

for (const value of [true, false]) {
  test(`isolated stale power read gets one read-only retry: ${value}`, async () => {
    const h = harness({ powerOnceStale: true, state: [0,19,value ? 0 : 1,1,12,18,16,12,0] });
    assert.equal(await h.service.setPower(value), true);
    assert.deepEqual(h.commands.map(c => c.command), [0x1944,0xe3d8,0x1944,0x1944]);
    assert.equal(h.bus.listenerCount('command'), 0);
    assert.equal(h.service.busy, false);
  });
}
test('persistent power mismatch still fails after one recheck', async () => {
  const h = harness({ powerAlwaysStale: true });
  await assert.rejects(h.service.setPower(true), /expected 1, read 0/);
  assert.deepEqual(h.commands.map(c => c.command), [0x1944,0xe3d8,0x1944,0x1944]);
  assert.equal(h.service.busy, false);
});
test('preset mismatch fails immediately without retry', async () => {
  const h = harness({ readbackMismatch: true });
  await assert.rejects(h.service.setPower(true), /Day/);
  assert.equal(h.commands.length, 3);
});

test('stale temperature read gets one read-only retry', async () => {
  const h = harness({ temperatureOnceStale: true });
  assert.equal(await h.service.setTemperature(23), true);
  assert.deepEqual(h.commands.map(c => c.command), [0x1944,0x1946,0x1944,0x1944]);
  assert.equal(h.service.busy, false);
  assert.equal(h.bus.listenerCount('command'), 0);
});
test('persistent temperature mismatch remains an error', async () => {
  const h = harness({ temperatureAlwaysStale: true });
  await assert.rejects(h.service.setTemperature(23), /expected 23, read 26/);
  assert.equal(h.commands.filter(c => c.command === 0x1946).length, 1);
  assert.equal(h.commands.length, 4);
  assert.equal(h.service.busy, false);
});
test('temperature and preset mismatch is not retried', async () => {
  const h = harness({ temperatureOnceStale: true, readbackMismatch: true });
  await assert.rejects(h.service.setTemperature(23), /Day/);
  assert.equal(h.commands.length, 3);
});

test('periodic read retries once after timeout and keeps write lock', async () => {
  const h = harness({ skipFirstRead: true });
  const pending = h.service.readStatus({ retry: true });
  await assert.rejects(h.service.setPower(true), /DLP operation/);
  const result = await pending;
  assert.equal(result.normal, 26);
  assert.deepEqual(h.commands.map(c => c.command), [0x1944, 0x1944]);
  assert.equal(h.service.busy, false);
  assert.equal(h.bus.listenerCount('command'), 0);
});
test('two failed background reads propagate error and clean up', async () => {
  const h = harness({ silent: true });
  await assert.rejects(h.service.readStatus({ retry: true }), /No acknowledgement/);
  assert.equal(h.commands.length, 2);
  assert.equal(h.service.busy, false);
  assert.equal(h.bus.listenerCount('command'), 0);
});
test('ordinary read still has no retry', async () => {
  const h = harness({ silent: true });
  await assert.rejects(h.service.readStatus(), /No acknowledgement/);
  assert.equal(h.commands.length, 1);
});
test('successful background read sends once', async () => {
  const h = harness();
  await h.service.readStatus({ retry: true });
  assert.equal(h.commands.length, 1);
});
test('panel enables retry only for periodic updates and marks failed reads unavailable', async () => {
  const d = loadDevice(); const options = [];
  d.homey = { app: { isBusConnected: () => true } };
  d.error = () => {};
  d.service = () => ({ readStatus: async o => { options.push(o); throw new Error('both failed'); } });
  await d.requestUpdate({ periodic: true });
  assert.equal(d.unavailable, 'both failed');
  await d.requestUpdate();
  assert.equal(options[0].retry, true);
  assert.equal(options[1].retry, false);
});
