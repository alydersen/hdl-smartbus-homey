'use strict';

const FloorheaterDevice = require('../../drivers/floorheater/device');

const ALL_CAPABILITIES = [
  'target_temperature',
  'measure_temperature',
  'onoff',
  'meter_valve',
  'meter_valve_number'
];

const ZONE_ONLY_CAPABILITIES = [
  'target_temperature',
  'onoff',
  'meter_valve',
  'meter_valve_number'
];

function makeDevice(data, foundUnits = {}) {
  const device = new FloorheaterDevice(data, null);
  for (const capability of ALL_CAPABILITIES) {
    device.addCapability(capability);
  }
  device._sendCommand = jest.fn();
  device.homey = {
    app: {
      log: jest.fn(),
      isBusConnected: jest.fn().mockReturnValue(false),
      getDevicesOfType: jest.fn().mockReturnValue(foundUnits),
      controller: jest.fn().mockReturnValue(null)
    }
  };
  return device;
}

describe('FloorheaterDevice', () => {
  describe('onInit', () => {
    test('should keep all capabilities for heating zone channels', async () => {
      const device = makeDevice({ id: '1.10.2', address: '1.10', channel: 2 });
      await device.onInit();

      for (const capability of ALL_CAPABILITIES) {
        expect(device.hasCapability(capability)).toBe(true);
      }
      expect(device._isSensorChannel).toBe(false);
      expect(device._capabilityListeners.target_temperature).toBeDefined();
      expect(device._capabilityListeners.onoff).toBeDefined();
    });

    test('should show the HDL bus address in the device settings on init', async () => {
      const device = makeDevice({ id: '1.10.2', address: '1.10', channel: 2 });
      await device.onInit();

      expect(await device.getSettings()).toEqual({ hdl_address: '1.10.2' });
    });

    test('should remove zone capabilities on a sensor channel (13)', async () => {
      const foundUnits = { 10: { id: 10, subnet: 1, type: 213 } };
      const device = makeDevice(
        { id: '1.10.13', address: '1.10', channel: 13 },
        foundUnits
      );
      await device.onInit();

      expect(device._isSensorChannel).toBe(true);
      expect(device.hasCapability('measure_temperature')).toBe(true);
      for (const capability of ZONE_ONLY_CAPABILITIES) {
        expect(device.hasCapability(capability)).toBe(false);
      }
      expect(device._capabilityListeners.target_temperature).toBeUndefined();
      expect(device._capabilityListeners.onoff).toBeUndefined();
    });

    test('should remove zone capabilities on a digital sensor channel (51)', async () => {
      const foundUnits = { 10: { id: 10, subnet: 1, type: 207 } };
      const device = makeDevice(
        { id: '1.10.51', address: '1.10', channel: 51 },
        foundUnits
      );
      await device.onInit();

      expect(device._isSensorChannel).toBe(true);
      expect(device.hasCapability('measure_temperature')).toBe(true);
      for (const capability of ZONE_ONLY_CAPABILITIES) {
        expect(device.hasCapability(capability)).toBe(false);
      }
    });

    test('should fall back to channel heuristic when the module is not found on the bus', async () => {
      const sensorDevice = makeDevice({ id: '1.10.13', address: '1.10', channel: 13 }, {});
      await sensorDevice.onInit();
      expect(sensorDevice._isSensorChannel).toBe(true);

      const zoneDevice = makeDevice({ id: '1.10.5', address: '1.10', channel: 5 }, {});
      await zoneDevice.onInit();
      expect(zoneDevice._isSensorChannel).toBe(false);
    });

    test('should still request updates on a sensor channel when the bus is connected', async () => {
      const device = makeDevice({ id: '1.10.13', address: '1.10', channel: 13 });
      device.homey.app.isBusConnected.mockReturnValue(true);
      device.requestUpdate = jest.fn().mockResolvedValue(undefined);

      await device.onInit();
      expect(device.requestUpdate).toHaveBeenCalled();
    });
  });

  describe('update paths on sensor channels', () => {
    test('should ignore target temperature, power switch and valve updates', async () => {
      const device = makeDevice({ id: '1.10.13', address: '1.10', channel: 13 });
      device._isSensorChannel = true;

      device.updateLevel(21);
      device.updatePowerSwitch(true);
      device.updateValve(true);

      expect(await device.getCapabilityValue('target_temperature')).toBe(null);
      expect(await device.getCapabilityValue('onoff')).toBe(null);
      expect(await device.getCapabilityValue('meter_valve')).toBe(null);
    });

    test('should still update measured temperature', async () => {
      const device = makeDevice({ id: '1.10.13', address: '1.10', channel: 13 });
      device._isSensorChannel = true;

      device.updateTemperature(12.34);
      expect(await device.getCapabilityValue('measure_temperature')).toBe(12.3);
    });

    test('should not send write commands from sensor channels', async () => {
      const device = makeDevice({ id: '1.10.13', address: '1.10', channel: 13 });
      device._isSensorChannel = true;
      device.currentData = { temperature: { normal: 20 } };

      await device.onTemperatureChange(25);
      await device.onPowerSwitchChange(false);

      expect(device._sendCommand).not.toHaveBeenCalled();
    });
  });

  describe('_performPoll', () => {
    test('should only read temperature on sensor channels', async () => {
      const device = makeDevice({ id: '1.10.13', address: '1.10', channel: 13 });
      device._isSensorChannel = true;

      await device._performPoll();

      const commands = device._sendCommand.mock.calls.map((call) => call[0]);
      expect(commands).toEqual([0x1948, 0xE3E7]);
    });

    test('should poll status, temperature and valve on heating zones', async () => {
      const device = makeDevice({ id: '1.10.2', address: '1.10', channel: 2 });
      device._isSensorChannel = false;

      await device._performPoll();

      const commands = device._sendCommand.mock.calls.map((call) => call[0]);
      expect(commands).toEqual([0x1C5E, 0x1948, 0xE3E7, 0x7262]);
    });

    test('should send 0x7262 via the standard smart-bus encoder, not a raw payload', async () => {
      const device = makeDevice({ id: '1.10.2', address: '1.10', channel: 2 });
      device._isSensorChannel = false;

      await device._performPoll();

      const poll = device._sendCommand.mock.calls.find((call) => call[0] === 0x7262);
      expect(poll[1]).toEqual({ channel: 2 });
      expect(poll[2]).toBeUndefined();
    });
  });

  describe('measure_power (valve-driven energy approximation)', () => {
    test('should add measure_power and report the cable size when the valve opens', async () => {
      const device = makeDevice({ id: '1.10.2', address: '1.10', channel: 2 });
      await device.setSettings({ cable_wattage: 1500 });
      device._isSensorChannel = false;

      device.updateValve(true);
      await device._lastMeasurePowerSync;

      expect(device.hasCapability('measure_power')).toBe(true);
      expect(device.getCapabilityValue('measure_power')).toBe(1500);
      expect(device._capabilityOptions['measure_power']).toEqual({ approximated: true });
    });

    test('should report zero when the valve closes', async () => {
      const device = makeDevice({ id: '1.10.2', address: '1.10', channel: 2 });
      await device.setSettings({ cable_wattage: 1500 });
      device._isSensorChannel = false;

      device.updateValve(true);
      await device._lastMeasurePowerSync;
      device.updateValve(false);
      await device._lastMeasurePowerSync;

      expect(device.getCapabilityValue('measure_power')).toBe(0);
    });

    test('should not add measure_power without a configured cable size', async () => {
      const device = makeDevice({ id: '1.10.2', address: '1.10', channel: 2 });
      device._isSensorChannel = false;

      device.updateValve(true);
      await device._lastMeasurePowerSync;

      expect(device.hasCapability('measure_power')).toBe(false);
    });

    test('should refresh the value when the cable size changes in settings', async () => {
      const device = makeDevice({ id: '1.10.2', address: '1.10', channel: 2 });
      await device.setSettings({ cable_wattage: 1500 });
      device._isSensorChannel = false;

      device.updateValve(true);
      await device._lastMeasurePowerSync;
      // The SDK saves the new settings before onSettings fires
      await device.setSettings({ cable_wattage: 1200, hdl_address: '1.10.2' });
      await device.onSettings(
        { cable_wattage: 1500 },
        { cable_wattage: 1200, hdl_address: '1.10.2' },
        ['cable_wattage']
      );

      expect(device.getCapabilityValue('measure_power')).toBe(1200);
    });

    test('should remove measure_power when the cable size is cleared', async () => {
      const device = makeDevice({ id: '1.10.2', address: '1.10', channel: 2 });
      await device.setSettings({ cable_wattage: 1500 });
      device._isSensorChannel = false;

      device.updateValve(true);
      await device._lastMeasurePowerSync;
      // The SDK saves the new settings before onSettings fires
      await device.setSettings({ cable_wattage: 0, hdl_address: '1.10.2' });
      await device.onSettings(
        { cable_wattage: 1500 },
        { cable_wattage: 0, hdl_address: '1.10.2' },
        ['cable_wattage']
      );

      expect(device.hasCapability('measure_power')).toBe(false);
    });

    test('should restore the approximated value on init from the known valve state', async () => {
      const device = makeDevice({ id: '1.10.2', address: '1.10', channel: 2 });
      await device.setSettings({ cable_wattage: 1500 });
      await device.setCapabilityValue('meter_valve_number', 1);

      await device.onInit();

      expect(device.hasCapability('measure_power')).toBe(true);
      expect(device.getCapabilityValue('measure_power')).toBe(1500);
    });

    test('should never add measure_power on sensor channels', async () => {
      const device = makeDevice({ id: '1.10.13', address: '1.10', channel: 13 });
      await device.setSettings({ cable_wattage: 1500 });
      device._isSensorChannel = true;

      device.updateValve(true);
      await device.onSettings(
        { cable_wattage: 0 },
        { cable_wattage: 1500, hdl_address: '1.10.13' },
        ['cable_wattage']
      );

      expect(device.hasCapability('measure_power')).toBe(false);
    });
  });
});
