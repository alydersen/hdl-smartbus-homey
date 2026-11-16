'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function device() {
  const file = require.resolve('../drivers/dlpheater/device.js');
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, Buffer,
    require: name => name === 'homey' ? { Device: class {} } : require(path.resolve(path.dirname(file), name)) });
  const d = new module.exports();
  const values = {}, listeners = {}, titles = [], errors = [];
  d.getData = () => ({ id: '2.103', heaterType: 188 });
  d.homey = { settings: { get: () => 2 }, app: { getDevicesOfType: () => ({}), valueOK: (type, value) => type === 'temperature' && value >= -40 && value <= 80 } };
  d.homey = { ...d.homey, i18n: { getLanguage: () => 'no' } };
  d.setCapabilityValue = async (key, value) => { values[key] = value; };
  d.setCapabilityOptions = async (key, options) => { if (options.title) titles.push(options.title.no); };
  d.setSettings = async () => {};
  d.setUnavailable = async () => { d.available = false; };
  d.setAvailable = async () => { d.available = true; };
  d.hasCapability = key => key !== 'target_temperature';
  d.getClass = () => 'thermostat';
  d.registerCapabilityListener = (key, fn) => { listeners[key] = fn; };
  d.error = error => errors.push(error);
  return { d, values, listeners, titles, errors };
}

test('mode title follows confirmed status, skips unchanged polls, ignores write ACK', async () => {
  const f = device();
  // Real parser supplies the preset field names.
  const status = mode => f.d.updateFromSignal({ code: 0x1945, payload: Buffer.from([0, 22, 1, mode, 19, 24, 17, 12]) });
  await status(1); await status(1); await status(2);
  await f.d.updateFromSignal({ code: 0x1947, payload: Buffer.from([0xf8, 0, 1, 3, 19, 24, 17, 12]) });
  assert.deepEqual(f.titles, ['Normal', 'Dag']);
  assert.equal(f.values.hdl_thermostat_mode, '2');
  assert.equal(f.values['target_temperature.active'], 24);
  await status(3); await status(4); await status(5);
  assert.deepEqual(f.titles, ['Normal', 'Dag', 'Natt', 'Borte', 'Timer']);
});

test('title update failure retains available panel status and retries later', async () => {
  const f = device(); let fail = true;
  f.d.setCapabilityOptions = async () => { if (fail) throw Error('metadata unavailable'); };
  const status = () => f.d.updateFromSignal({ code: 0x1945, payload: Buffer.from([0, 22, 1, 2, 19, 24, 17, 12]) });
  await status(); assert.equal(f.d.available, true); assert.equal(f.values.hdl_heating_mode, 'Dag');
  assert.equal(f.errors.length, 1); assert.notEqual(f.d._modeTitle, 2);
  fail = false; await status(); assert.equal(f.d._modeTitle, 2);
});

test('restored picker calls verified mode operation; failed operation leaves observed status', async () => {
  const f = device(); let fail = false, requested;
  const payload = mode => Buffer.from([0, 22, 1, mode, 19, 24, 17, 12]);
  f.d.service = () => ({ watchMode: () => () => {}, setMode: async value => {
    requested = value; if (fail) throw Error('no readback');
    return require('../hdl/dlp-heater-protocol').readState(payload(Number(value)), false);
  } });
  f.d.requestUpdate = async () => {};
  await f.d.onInit();
  await f.listeners.hdl_thermostat_mode('2');
  assert.equal(requested, '2'); assert.equal(f.values.hdl_thermostat_mode, '2');
  assert.equal(f.values['target_temperature.active'], 24);
  fail = true; await assert.rejects(f.listeners.hdl_thermostat_mode('3'), /no readback/);
  assert.equal(f.values.hdl_thermostat_mode, '2');
  assert.equal(f.values.target_temperature, undefined);
});

for (const [current, input, expected] of [[20, 20.5, 21], [20, 19.5, 19]])
test(`iOS half-step ${input} from ${current} writes whole-degree ${expected}`, async () => {
  const f = device(); const calls = [];
  const status = value => require('../hdl/dlp-heater-protocol').readState(Buffer.from([0,22,1,1,value,24,17,12]), false);
  f.d.service = () => ({ watchMode: () => () => {}, setActiveTemperature: async (...args) => {
    calls.push(args); return status(args[0]);
  } });
  f.d.requestUpdate = async () => {};
  await f.d.onInit(); await f.d.applyState(status(current));
  await f.listeners['target_temperature.active'](input);
  assert.deepEqual(calls, [[expected, 1, current]]);
  assert.equal(f.values['target_temperature.active'], expected);
});
test('Flow temperature calls keep strict fractional validation', async () => {
  const f = device(); const calls = [];
  f.d.service = () => ({ setActiveTemperature: async (...args) => {
    calls.push(args); if (!Number.isInteger(args[0])) throw Error('Choose a whole number');
  } });
  f.d._lastState = { mode: 1, normal: 20 };
  await assert.rejects(f.d.setActiveTemperature(20.5), /whole number/);
  assert.equal(calls[0][0], 20.5); assert.equal(calls[0][2], undefined);
});
test('Timer remains status only and is absent from writable picker', async () => {
  const f = device();
  await f.d.updateFromSignal({code:0x1945,payload:Buffer.from([0,22,1,5,19,24,17,12])});
  assert.equal(f.values.hdl_heating_mode, 'Timer');
  assert.equal(f.values.hdl_thermostat_mode, null);
  const capability = require('../.homeycompose/capabilities/hdl_thermostat_mode.json');
  assert.deepEqual(capability.values.map(v => v.id), ['1','2','3','4']);
});

test('every mode-title replacement retains whole-degree thermostat options', async () => {
  const f = device(); const options = {};
  f.d.setCapabilityOptions = async (key, value) => { options[key] = { ...value }; };
  for (const mode of [1,2,3,4,5,1]) {
    await f.d.updateFromSignal({code:0x1945,payload:Buffer.from([0,22,1,mode,19,24,17,12])});
    assert.equal(options['target_temperature.active'].step, 1);
    assert.equal(options['target_temperature.active'].decimals, 0);
    assert.equal(options['target_temperature.active'].min, 5);
    assert.equal(options['target_temperature.active'].max, 26);
  }
});
test('device queues initial status even when the bus is not ready', async () => {
  const f = device(); let queued = 0;
  f.d.homey.app.isBusConnected = () => false;
  f.d.homey.app.queueDlpRead = async d => {
    assert.equal(d, f.d); queued++;
    return {mode:2,power:1,normal:19,day:24,night:17,away:12};
  };
  await f.d.requestUpdate();
  assert.equal(queued, 1); assert.equal(f.d.available, true);
  assert.equal(f.values.hdl_heating_mode, 'Dag');
});

test('manual status refresh reports failure and a later read restores availability', async () => {
  const f = device();
  f.d.homey.app.queueDlpRead = async () => { throw Error('read timeout'); };
  await assert.rejects(f.d.requestUpdate({throwOnError:true}), /read timeout/);
  assert.equal(f.d.available, false);
  f.d.homey.app.queueDlpRead = async () => ({mode:1,power:1,normal:19,day:24,night:17,away:12});
  assert.equal(await f.d.requestUpdate({throwOnError:true}), true);
  assert.equal(f.d.available, true);
});
test('refresh Flow calls only the read method and propagates its error', async () => {
  const file = require.resolve('../drivers/dlpheater/driver.js');
  const module = {exports:{}}; const cards = {};
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,
    require: name => name === 'homey' ? {Driver:class{}} : require(path.resolve(path.dirname(file),name))});
  const driver = new module.exports(); driver.log = () => {};
  driver.homey = {flow:{
    getDeviceTriggerCard:()=>({registerRunListener(){}}),
    getActionCard:id=>({registerRunListener:fn=>{cards[id]=fn;}})
  }};
  await driver.onInit(); let reads = 0;
  const device = {requestUpdate: async options => {assert.equal(options.throwOnError,true);reads++;return true;}};
  assert.equal(await cards.heater_refresh_status({device}), true); assert.equal(reads,1);
  device.requestUpdate = async () => {throw Error('silent panel');};
  await assert.rejects(cards.heater_refresh_status({device}),/silent panel/);
});

test('active mode status follows Homey language without changing mode IDs', async () => {
  const { d, values } = device();
  for (const [language, expected] of [
    ['en', ['Normal', 'Day', 'Night', 'Away', 'Timer']],
    ['nb-NO', ['Normal', 'Dag', 'Natt', 'Borte', 'Timer']],
  ]) {
    d.homey.i18n.getLanguage = () => language;
    for (let mode = 1; mode <= expected.length; mode++) {
      await d.updateFromSignal({ code: 0x1945, payload: Buffer.from([0, 22, 1, mode, 19, 24, 17, 12]) });
      assert.equal(values.hdl_heating_mode, expected[mode - 1]);
      assert.equal(values.hdl_thermostat_mode, mode === 5 ? null : String(mode));
    }
  }
});
