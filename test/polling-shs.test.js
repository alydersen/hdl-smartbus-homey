'use strict';
const App = require('../app');
describe('SHS shared scheduler', () => {
  let app, heater, panel, relay, devices;
  beforeEach(() => {
    jest.useFakeTimers(); app = new App(); app.log = jest.fn();
    app._bus = {}; app._busConnected = true; app._pollIntervalMs = 60000;
    app._updateTimeouts = []; app._driverlist = ['relay','panel','dlpheater'];
    heater = { requestUpdate: jest.fn() }; panel = { requestUpdate: jest.fn() };
    relay = { requestUpdate: jest.fn() }; devices = {relay:[relay],panel:[panel],dlpheater:[heater]};
    app.homey = { drivers: { getDriver: id => ({getDevices:()=>devices[id]}) } };
  });
  afterEach(() => { app._clearUpdateTimeouts(); jest.useRealTimers(); });
  test('Heater and Panel use the same evenly spaced schedule', async () => {
    await app.callForUpdate(); jest.advanceTimersByTime(1);
    expect(relay.requestUpdate).toHaveBeenCalledTimes(1);
    expect(panel.requestUpdate).not.toHaveBeenCalled();
    jest.advanceTimersByTime(20000); expect(panel.requestUpdate).toHaveBeenCalledTimes(1);
    expect(heater.requestUpdate).not.toHaveBeenCalled();
    jest.advanceTimersByTime(20000); expect(heater.requestUpdate).toHaveBeenCalledWith({periodic:true});
    expect(app._updateTimeouts).toHaveLength(0);
  });
  test('another tick cancels pending work instead of adding duplicate reads', async () => {
    await app.callForUpdate(); await app.callForUpdate(); jest.advanceTimersByTime(60000);
    for(const d of [relay,panel,heater]) expect(d.requestUpdate).toHaveBeenCalledTimes(1);
  });
  test('old connection cannot send scheduled requests', async () => {
    await app.callForUpdate(); app._bus={}; jest.advanceTimersByTime(60000);
    for(const d of [relay,panel,heater]) expect(d.requestUpdate).not.toHaveBeenCalled();
  });
  test('asynchronous failures are caught and do not stop the other devices', async () => {
    relay.requestUpdate.mockRejectedValue(new Error('test failure'));
    await app.callForUpdate(); await jest.advanceTimersByTimeAsync(60000);
    expect(app.log).toHaveBeenCalledWith('Could not request update: test failure');
    expect(heater.requestUpdate).toHaveBeenCalledTimes(1);
  });
  test('shutdown cancels all queued polling', async () => {
    app._bus.close=jest.fn(); await app.callForUpdate(); await app.onUninit();
    jest.advanceTimersByTime(60000);
    for(const d of [relay,panel,heater]) expect(d.requestUpdate).not.toHaveBeenCalled();
  });
});
