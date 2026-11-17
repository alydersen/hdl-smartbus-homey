'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { DlpHeaterService, parseStatus, activeSetpoint } = require('../hdl/dlp-heater-service');
function fixture(options = {}) {
  const bus = new EventEmitter(), packets = [];
  const state = Buffer.from(options.state || [0, 22, 1, 1, 19, 24, 17, 12, 0]);
  let connected = true;
  const app = { log() {}, bus: () => bus, isBusConnected: () => connected,
    controller: () => ({ subnet: 1, id: 2, send(packet, cb) {
      packets.push(packet); cb(null);
      if (options.silent || (options.skipFirst && packets.length === 1)) return;
      setImmediate(() => {
        const sender = { subnet: 1, id: Number(packet.target.split('.')[1]) };
        const emit = (code, payload) => bus.emit('command', { sender, target: { subnet: 1, id: 2 }, code, payload });
        if (packet.command === 0x1944) {
          const reply = Buffer.from(state);
          if (options.stale && packets.length === 3) reply[3] = 1;
          if (options.otherPreset && packets.length >= 3) reply[7]++;
          emit(0x1945, reply);
        } else if (packet.command === 0x1946) {
          if (options.noAck) return;
          state[2] = packet.payload[1]; state[3] = packet.payload[2];
          for (let i = 4; i <= 7; i++) state[i] = packet.payload[i - 1];
          emit(0x1947, Buffer.concat([Buffer.from([0xf8]), packet.payload]));
        } else if (packet.payload[0] === 0x14) {
          if (options.noAck) return;
          if (!options.powerNoChange) state[2] = packet.payload[1];
          if (options.powerWrongMode) state[3] = 1;
          emit(0xe3d9, options.wrongPowerAck ? Buffer.from([0x14, 1 - packet.payload[1]]) : packet.payload);
        } else if (packet.payload[0] === 0x15) {
          if (options.noAck) return;
          state[3] = packet.payload[1]; emit(0xe3d9, packet.payload);
        } else if (packet.payload[0] === 0x12) {
          bus.emit('command', { sender, target: { subnet: 255, id: 255 }, code: 0xe3d9,
            payload: packet.payload.subarray(0, 3) });
        }
      });
    } }) };
  const service = new DlpHeaterService(app, 25, '1.103');
  return { app, bus, packets, state, service, disconnect: () => { connected = false; bus.emit('close'); } };
}
function device() {
  const module = { exports: {} };
  const file = path.resolve(__dirname, '../drivers/dlpheater/device.js');
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, Buffer,
    require: n => n === 'homey' ? { Device: class {} } : require(path.resolve(path.dirname(file), n)) });
  const d = new module.exports(); d.values = {}; d.homey = {app: {cancelDlpRead() {}, valueOK: (type, value) => type === 'temperature' && value >= -40 && value <= 80}}; d.setCapabilityOptions = async () => {};
  d.homey = { ...d.homey, i18n: { getLanguage: () => 'no' } };
  d.setCapabilityValue = async (k, v) => { d.values[k] = v; };
  d.setAvailable = async () => { d.available = true; }; d.setUnavailable = async () => { d.available = false; };
  return d;
}
for (const mode of [2, 3, 4]) test(`mode ${mode}: dedicated command preserves all presets`, async () => {
  const f = fixture(); const after = await f.service.setMode(String(mode));
  assert.equal(after.mode, mode); assert.deepEqual(Array.from(f.state.subarray(4, 8)), [19, 24, 17, 12]);
  assert.deepEqual(f.packets.map(p => p.command), [0x1944, 0xe3d8, 0x1944]);
  assert.equal(f.packets[1].payload.toString('hex'), `15${mode.toString(16).padStart(2, '0')}`);
  assert.equal(f.bus.listenerCount('command'), 0);
});
for (const mode of [1, 2, 3, 4]) test(`active setpoint in mode ${mode} preserves other presets/power/mode`, async () => {
  const f = fixture({ state: [0, 22, 0, mode, 19, 24, 17, 12, 0] });
  const before = Buffer.from(f.state); const after = await f.service.setActiveTemperature(21, mode);
  assert.equal(activeSetpoint(after), 21);
  for (let i = 0; i < 8; i++) assert.equal(f.state[i], i === mode + 3 ? 21 : before[i]);
  assert.deepEqual(f.packets.map(p => p.command), [0x1944, 0x1946, 0x1944]);
});
test('fresh local mode change rejects stale UI write without sending 1946', async () => {
  const f = fixture({ state: [0, 22, 1, 3, 19, 24, 17, 12] });
  await assert.rejects(f.service.setActiveTemperature(21, 2), /changed at the panel/);
  assert.deepEqual(f.packets.map(p => p.command), [0x1944]);
});
test('reported Timer remains readable but is excluded from selection and setpoint writes', async () => {
  assert.equal(activeSetpoint(parseStatus(Buffer.from([0, 22, 1, 5, 19, 24, 17, 12, 0]))), null);
  assert.equal(activeSetpoint(parseStatus(Buffer.from([0, 22, 1, 5, 19, 24, 17, 12, 1]))), null);
  assert.equal(activeSetpoint(parseStatus(Buffer.from([0, 22, 1, 5, 19, 24, 17, 12]))), null);
  const f = fixture({ state: [0, 22, 1, 5, 19, 24, 17, 12, 0] });
  await assert.rejects(f.service.setActiveTemperature(21, 5), /Timer/); assert.equal(f.packets.length, 1);
});
test('same mode/setpoint sends no unnecessary write', async () => {
  const f = fixture(); await f.service.setMode('1'); await f.service.setActiveTemperature(19, 1);
  assert.deepEqual(f.packets.map(p => p.command), [0x1944, 0x1944]);
});
test('cross-address poll/write/button operations share the actual app lock', async () => {
  const f = fixture({ silent: true }); const other = new DlpHeaterService(f.app, 25, '1.104');
  const p = assert.rejects(f.service.setMode('2'), /No acknowledgement/);
  assert.equal(await other.readStatus(), null);
  await assert.rejects(other.setMode('3'), /in progress/);
  await assert.rejects(require('../hdl/dlp-buttons').pressPanelButton(
    { ...f.app, dlpService: () => other }, { getData: () => ({ id: '1.104' }) }, '1', 25), /busy/);
  await p; assert.equal(other.busy, false); assert.equal(f.bus.listenerCount('command'), 0);
});
test('unchanged Panel button also blocks a Heater operation at another address', async () => {
  const f = fixture({ silent: true }); const other = new DlpHeaterService(f.app, 25, '1.104');
  const p = assert.rejects(require('../hdl/dlp-buttons').pressPanelButton(
    { ...f.app, dlpService: () => f.service }, { getData: () => ({ id: '1.103' }) }, '1', 25));
  await assert.rejects(other.setMode('2'), /in progress/); await p;
  assert.equal(other.busy, false);
});
test('mode verification retries reads once, never writes twice', async () => {
  const f = fixture({ stale: true }); await f.service.setMode('2');
  assert.deepEqual(f.packets.map(p => p.command), [0x1944, 0xe3d8, 0x1944, 0x1944]);
});
test('other preset changed during verification reports failure, never restores it', async () => {
  const f = fixture({ otherPreset: true }); await assert.rejects(f.service.setMode('2'), /Read-back mismatch/);
  assert.equal(f.packets.filter(p => p.command === 0xe3d8).length, 1);
});
test('write timeout releases lock/listeners and does not repeat write', async () => {
  const f = fixture({ noAck: true }); await assert.rejects(f.service.setMode('2'), /No acknowledgement/);
  assert.equal(f.packets.length, 2); assert.equal(f.service.busy, false);
  for (const name of ['command', 'close', 'error']) assert.equal(f.bus.listenerCount(name), 0);
});
test('periodic poll retries once and uses no extra timer', async () => {
  const f = fixture({ skipFirst: true }); assert.equal((await f.service.readStatus({ retry: true })).mode, 1);
  assert.equal(f.packets.length, 2); assert.equal(f.bus.listenerCount('command'), 0);
});
test('deletion cancels poll without retry and prevents later writes', async () => {
  const f = fixture({ silent: true }); const d = device(); d.service = () => f.service;
  const pending = assert.rejects(f.service.readStatus({ retry: true }), /closed/);
  await d.onDeleted(); await pending; assert.equal(f.packets.length, 1);
  assert.equal(f.service.busy, false); assert.equal(f.bus.listenerCount('command'), 0);
  assert.throws(() => d.assertWritableModel(), /deleted/);
});
test('deletion during write and button releases all resources immediately', async () => {
  for (const method of ['setMode', 'pressButton']) {
    const f = fixture({ silent: true });
    const pending = assert.rejects(f.service[method](method === 'setMode' ? '2' : '1'), /closed/);
    f.service.cancelHeaterOperation(); await pending;
    for (const name of ['command', 'close', 'error']) assert.equal(f.bus.listenerCount(name), 0);
    assert.equal(f.service.busy, false);
  }
});
test('socket stop cancels transaction and cannot send subsequent commands', async () => {
  const f = fixture({ silent: true }); const p = assert.rejects(f.service.setMode('2'), /closed/);
  f.disconnect(); await p; assert.equal(f.packets.length, 1);
  await assert.rejects(f.service.setMode('3'), /not ready/);
});
test('local status updates both UIs while preserving legacy Normal semantics', async () => {
  const d = device(); await d.updateFromSignal({ code: 0x1945, payload: Buffer.from([0, 22, 1, 2, 19, 24, 17, 12]) });
  assert.equal(d.values.target_temperature, undefined); assert.equal(d.values['target_temperature.active'], 24);
  assert.equal(d.values.hdl_thermostat_mode, '2'); assert.equal(d.values['measure_temperature.active'], 22);
  await d.updateFromSignal({ code: 0x1945, payload: Buffer.from([0, 21, 1, 3, 19, 24, 17, 12]) });
  assert.equal(d.values['target_temperature.active'], 17); assert.equal(d.values.hdl_heating_mode, 'Natt');
});
test('model whitelist excludes temperature-only/unknown/Enviro/Granite until protocol mapping', async () => {
  const m = { exports: {} }, file = path.resolve(__dirname, '../drivers/dlpheater/driver.js');
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module: m,
    require: n => n === 'homey' ? { Driver: class {} } : require(path.resolve(path.dirname(file), n)) });
  const d = new m.exports();
  d.homey = { settings: { get: () => 1 }, app: { isBusConnected: () => true, log() {},
    getDevicesOfType: () => Object.fromEntries([188, 186, 2062, 2064, 2065, 171, 2162, 99999]
      .map((type, i) => [i + 90, { id: i + 90, type }])) } };
  const paired = await d.onPairListDevices(); assert.deepEqual(Array.from(paired, p => p.data.heaterType), [188, 186]);
  assert.equal(paired[0].capabilities.length, 7);
});
test('known unsupported existing Heater keeps identity but rejects new writes', () => {
  const d = device(); d.getData = () => ({ id: '1.90', heaterType: 2065 });
  d.homey = { settings: { get: () => 1 }, app: { getDevicesOfType: () => ({}) } };
  assert.throws(() => d.assertWritableModel(), /not supported/); assert.equal(d.getData().id, '1.90');
});
test('invalid mode/temp and unsupported unit send no write', async () => {
  const f = fixture(); for (const value of ['0', '5', '6', 'bad']) await assert.rejects(f.service.setMode(value));
  for (const value of [4, 27, 10.5, NaN]) await assert.rejects(f.service.setActiveTemperature(value, 1));
  assert.equal(f.packets.length, 0);
  const unsupported = fixture({ state: [1, 22, 1, 1, 19, 24, 17, 12] });
  await assert.rejects(unsupported.service.setMode('2')); assert.equal(unsupported.packets.length, 1);
});

test('mode ACK to another app cannot complete this operation', async () => {
  const f = fixture({ noAck: true }); const p = assert.rejects(f.service.setMode('2'), /No acknowledgement/);
  await new Promise(resolve => setTimeout(resolve, 5));
  f.bus.emit('command', { sender: { subnet: 1, id: 103 }, target: { subnet: 1, id: 1 }, code: 0xe3d9, payload: Buffer.from([0x15, 2]) });
  await p; assert.equal(f.packets.length, 2); assert.equal(f.service.busy, false);
});

for(const active of [1,2,3,4,5]) for(const selected of [1,2,3,4])
test('mode-specific preset '+selected+' preserves active mode '+active, async()=>{
 const f=fixture({state:[0,22,1,active,19,24,17,12,0]});
 const before=Buffer.from(f.state); const after=await f.service.setModeTemperature(String(selected),21);
 assert.equal(after.mode,active);
 for(let i=0;i<8;i++) assert.equal(f.state[i],i===selected+3?21:before[i]);
 assert.deepEqual(f.packets.map(p=>p.command),[0x1944,0x1946,0x1944]);
 assert.equal(f.bus.listenerCount('command'),0);
});
test('invalid preset selection writes nothing',async()=>{
 const f=fixture(); for(const mode of [0,5,'bad']) await assert.rejects(f.service.setModeTemperature(mode,21));
 assert.equal(f.packets.length,0);
});

for (const mode of [1, 2, 3, 4]) for (const value of [false, true])
test(`power ${value} in mode ${mode} uses one dedicated write and preserves mode/presets`, async () => {
  const f = fixture({ state: [0, 22, value ? 0 : 1, mode, 19, 24, 17, 12, 0] });
  const before = Buffer.from(f.state);
  assert.equal(await f.service.setPower(value), true);
  assert.deepEqual(f.packets.map(p => p.command), [0x1944, 0xe3d8, 0x1944]);
  assert.equal(f.packets[1].payload.toString('hex'), value ? '1401' : '1400');
  for (let i = 0; i < 8; i++) assert.equal(f.state[i], i === 2 ? Number(value) : before[i]);
  assert.equal(f.bus.listenerCount('command'), 0);
});
test('Timer blocks power after reading status, including same-state request', async () => {
  for (const value of [true, false]) {
    const f = fixture({ state: [0, 22, 1, 5, 19, 24, 17, 12, 0] });
    await assert.rejects(f.service.setPower(value), /Timer/);
    assert.deepEqual(f.packets.map(p => p.command), [0x1944]);
  }
});
test('power rejects invalid inputs without bus access and skips redundant writes', async () => {
  const f = fixture();
  for (const value of [0, 1, 'true', null]) await assert.rejects(f.service.setPower(value), /boolean/);
  assert.equal(f.packets.length, 0);
  await f.service.setPower(true); assert.equal(f.packets.length, 1);
});
for (const option of ['noAck', 'wrongPowerAck', 'powerNoChange', 'powerWrongMode'])
test(`power failure ${option} never repeats or restores writes`, async () => {
  const f = fixture({ [option]: true, state: [0, 22, 1, 3, 19, 24, 17, 12, 0] });
  await assert.rejects(f.service.setPower(false));
  assert.equal(f.packets.filter(p => p.command === 0xe3d8).length, 1);
  assert.equal(f.bus.listenerCount('command'), 0); assert.equal(f.service.busy, false);
});
test('UI half-step rejects a changed setpoint before any write', async () => {
  const f = fixture();
  await assert.rejects(f.service.setActiveTemperature(21, 1, 20), /The setpoint changed/);
  assert.deepEqual(f.packets.map(p => p.command), [0x1944]);
});
