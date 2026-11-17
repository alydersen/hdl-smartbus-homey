'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const vm = require('node:vm');
const { ModeObserver } = require('../hdl/mode-observer');
const { DlpHeaterService } = require('../hdl/dlp-heater-service');

function observer() {
  const events = [], errors = [];
  const o = new ModeObserver(async e => events.push(e), e => errors.push(e));
  const bus = {};
  return { o, events, errors, read: mode => o.observe({ mode }, bus, 'gateway|1|2') };
}
test('silent startup, polling duplicate suppression, and ordered rapid transitions', async () => {
  const f = observer();
  for (const mode of [1, 1, 2, 2, 3, 3, 1]) f.read(mode);
  await f.o.tail;
  assert.deepEqual(f.events, [{ previous: '1', mode: '2' }, { previous: '2', mode: '3' }, { previous: '3', mode: '1' }]);
});
test('Timer transitions are actual mode changes too', async () => {
  const f = observer(); for (const mode of [2, 5, 5, 2]) f.read(mode);
  await f.o.tail; assert.deepEqual(f.events, [{ previous: '2', mode: '5' }, { previous: '5', mode: '2' }]);
});
test('invalid modes do not erase last valid status', async () => {
  const f = observer(); f.read(1);
  for (const mode of [null, undefined, '2', 0, 6, NaN]) f.read(mode);
  f.read(2); await f.o.tail; assert.equal(f.events.length, 1);
});
test('restart starts a new baseline and cancels queued events', async () => {
  const f = observer(); f.read(1); f.read(2); f.o.reset(); f.read(3);
  await f.o.tail; assert.equal(f.events.length, 0);
});
test('connection and gateway identity changes reset baseline', async () => {
  const f = observer(); f.read(1);
  const other = {}; f.o.observe({ mode: 2 }, other, 'new');
  f.o.observe({ mode: 3 }, other, 'new'); await f.o.tail;
  assert.deepEqual(f.events, [{ previous: '2', mode: '3' }]);
});
test('trigger failure is logged once, never retried, and later transitions work', async () => {
  const events = [], errors = [], bus = {};
  const o = new ModeObserver(async e => { events.push(e); if (e.mode === '2') throw Error('flow failed'); }, e => errors.push(e));
  for (const mode of [1, 2, 2, 3]) o.observe({ mode }, bus, 'same');
  await o.tail; assert.equal(events.length, 2); assert.equal(errors.length, 1);
});

function fixture() {
  let bus = new EventEmitter();
  const state = Buffer.from([0, 22, 1, 1, 19, 24, 17, 12]);
  const events = [], packets = [];
  let reply = true, wrongSender = false, wrongTarget = false;
  const app = { log() {}, bus: () => bus, isBusConnected: () => true,
    controller: () => ({ subnet: 1, id: 2, send(packet, callback) {
      packets.push(packet); callback(null);
      if (!reply) return;
      const currentBus = bus;
      setImmediate(() => {
        const signal = { sender: { subnet: 1, id: wrongSender ? 104 : 103 },
          target: { subnet: 1, id: wrongTarget ? 3 : 2 } };
        if (packet.command === 0x1944) currentBus.emit('command', { ...signal, code: 0x1945, payload: Buffer.from(state) });
        else if (packet.command === 0xe3d8) {
          if (packet.payload[0] === 0x15) state[3] = packet.payload[1];
          else if (packet.payload[0] === 0x14) state[2] = packet.payload[1];
          currentBus.emit('command', { ...signal, code: 0xe3d9, payload: packet.payload });
        } else if (packet.command === 0x1946) {
          for (let i = 2; i < 8; i++) state[i] = packet.payload[i - 1];
          currentBus.emit('command', { ...signal, code: 0x1947, payload: Buffer.concat([Buffer.from([0xf8]), packet.payload]) });
        }
      });
    } }) };
  const service = new DlpHeaterService(app, 15, '1.103');
  const stop = service.watchMode(async e => events.push(e), e => { throw e; });
  return { app, service, state, events, packets, stop,
    setReply: v => { reply = v; }, wrongSender: () => { wrongSender = true; },
    wrongTarget: () => { wrongTarget = true; },
    replaceBus: () => { bus = new EventEmitter(); }, bus: () => bus };
}
async function drain(f) { await f.service._modeObserver?.tail; }
test('real service: first read, local change discovered by polling, and duplicate read', async () => {
  const f = fixture(); await f.service.readStatus(); f.state[3] = 2;
  await f.service.readStatus({ retry: true }); await f.service.readStatus(); await drain(f);
  assert.deepEqual(f.events, [{ previous: '1', mode: '2' }]);
  assert.deepEqual(f.packets.map(p => p.command), [0x1944, 0x1944, 0x1944]);
});
test('pre-write/readback observation works even when first operation is a mode write', async () => {
  const f = fixture(); await f.service.setMode('2'); await f.service.readStatus(); await drain(f);
  assert.deepEqual(f.events, [{ previous: '1', mode: '2' }]);
  assert.deepEqual(f.packets.map(p => p.command), [0x1944, 0xe3d8, 0x1944, 0x1944]);
});
test('same-mode selection, active setpoint, and legacy temperature/power writes add no mode event', async () => {
  const f = fixture(); await f.service.setMode('1');
  await f.service.setActiveTemperature(20, 1);
  await f.service.setTemperature(21); await f.service.setPower(false); await drain(f);
  assert.equal(f.events.length, 0);
});
test('timeout/retry keeps baseline and later successful read emits one delayed event', async () => {
  const f = fixture(); await f.service.readStatus(); f.setReply(false);
  await assert.rejects(f.service.readStatus({ retry: true }));
  f.setReply(true); f.state[3] = 2; await f.service.readStatus(); await drain(f);
  assert.equal(f.events.length, 1); assert.equal(f.bus().listenerCount('command'), 0);
});
for (const wrong of ['wrongSender', 'wrongTarget']) test(`${wrong} cannot establish a mode transition`, async () => {
  const f = fixture(); await f.service.readStatus(); f[wrong](); f.state[3] = 2;
  await assert.rejects(f.service.readStatus()); await drain(f); assert.equal(f.events.length, 0);
});
test('ACK without a full readback cannot emit a mode event', async () => {
  const f = fixture(); await f.service.readStatus();
  f.bus().emit('command', { sender: { subnet: 1, id: 103 }, code: 0x1947,
    payload: Buffer.from([0xf8, 0, 1, 2, 19, 24, 17, 12]) });
  await drain(f); assert.equal(f.events.length, 0);
});
test('replacement connection starts silently', async () => {
  const f = fixture(); await f.service.readStatus(); f.replaceBus(); f.state[3] = 2;
  await f.service.readStatus(); await drain(f); assert.equal(f.events.length, 0);
});
test('old connection response cannot establish a new baseline', async () => {
  const f = fixture();
  const pending = f.service.readStatus();
  f.replaceBus();
  await pending;
  f.state[3] = 2; await f.service.readStatus(); await drain(f);
  assert.equal(f.events.length, 0);
});
test('a cancelled read cannot emit and clears listeners', async () => {
  const f = fixture(); await f.service.readStatus(); f.setReply(false);
  const pending = assert.rejects(f.service.readStatus(), /closed/);
  f.state[3] = 2; f.service.cancelHeaterOperation(); await pending; await drain(f);
  assert.equal(f.events.length, 0); assert.equal(f.bus().listenerCount('command'), 0);
});
test('device lifecycle subscribes before initial read and unsubscribes on stop/delete', async () => {
  const filename = require.resolve('../drivers/dlpheater/device.js'), m = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module: m, Buffer, require: n => n === 'homey' ? { Device: class {} }
      : require(require('node:path').resolve(require('node:path').dirname(filename), n))
  });
  const f = fixture(), d = new m.exports(); let delivered = 0;
  d.homey = { app: f.app }; f.app.valueOK = (type, value) => type === 'temperature' && value >= -40 && value <= 80; f.app.dlpService = () => f.service;
  d.getData = () => ({ id: '1.103' }); d.hasCapability = () => true;
  d.getClass = () => 'thermostat'; d.registerCapabilityListener = () => {};
  d.setCapabilityOptions = d.setCapabilityValue = d.setUnavailable = d.setAvailable = async () => {};
  d.error = error => { throw error; };
  d.driver = { ready: async () => {}, triggerModeChange: async () => { delivered++; } };
  d.setSettings = async () => {}; d.removeCapability = async () => {};
  await d.onInit(); f.state[3] = 2; await d.requestUpdate(); await drain(f);
  assert.equal(delivered, 1);
  await d.onUninit(); assert.equal(f.service._modeObserver, null);
  await d.onInit(); assert.equal(delivered, 1);
  await d.onDeleted(); assert.equal(f.service._modeObserver, null);
});
test('unsubscribing cancels pending events and does not leave observer attached', async () => {
  const f = fixture(); await f.service.readStatus(); f.stop(); f.state[3] = 2;
  await f.service.readStatus(); assert.equal(f.events.length, 0); assert.equal(f.service._modeObserver, null);
});
test('driver registers the device trigger, filters selected mode, and supplies stable ID tokens', async () => {
  const m = { exports: {} }; let listener, call;
  vm.runInNewContext(fs.readFileSync(require.resolve('../drivers/dlpheater/driver.js'), 'utf8'), {
    module: m, require: n => n === 'homey' ? { Driver: class {} } : []
  });
  const driver = new m.exports(); driver.log = () => {};
  driver.homey = { flow: {
    getActionCard: () => ({ registerRunListener() {} }),
    getDeviceTriggerCard: id => {
      assert.equal(id, 'heater_mode_changed_to');
      return { registerRunListener: fn => { listener = fn; }, trigger: (...args) => { call = args; } };
    }
  } };
  await driver.onInit(); assert.equal(await listener({ mode: '2' }, { mode: '2' }), true);
  assert.equal(await listener({ mode: '1' }, { mode: '2' }), false);
  const device = {}; driver.triggerModeChange(device, { previous: '1', mode: '2' });
  assert.equal(call[0], device); assert.equal(call[1].previous_mode, '1'); assert.equal(call[1].new_mode, '2');
});
