'use strict';

const PanelDriver = require('../../drivers/panel/driver');

describe('PanelDriver', () => {
  let driver;
  let mockHomeyDevice;

  beforeEach(() => {
    mockHomeyDevice = {
      setCapabilityValue: jest.fn().mockResolvedValue()
    };

    driver = new PanelDriver();
    driver.homey = {
      app: {
        log: jest.fn(),
        isBusConnected: jest.fn().mockReturnValue(true),
        valueOK: jest.fn((type, value) => {
          if (typeof value !== 'number') return false;
          if (type === 'temperature') return value >= -40 && value <= 80;
          return false;
        }),
        getDevicesOfType: jest.fn().mockReturnValue({})
      },
      settings: {
        get: jest.fn().mockReturnValue('1')
      }
    };
    driver.getDevice = jest.fn().mockReturnValue(mockHomeyDevice);
    driver.error = jest.fn();
  });

  describe('updateValues', () => {
    test('should return when signal has no data', async () => {
      const signal = { sender: { id: 42 } };
      await driver.updateValues(signal);
      expect(driver.getDevice).not.toHaveBeenCalled();
    });

    test('should return when sender id is undefined', async () => {
      const signal = { sender: {}, data: { temperature: 21.5 } };
      await driver.updateValues(signal);
      expect(driver.getDevice).not.toHaveBeenCalled();
    });

    test('should return when temperature is out of range', async () => {
      const signal = {
        sender: { id: 42 },
        data: { temperature: 200 }
      };
      await driver.updateValues(signal);
      expect(driver.getDevice).not.toHaveBeenCalled();
    });

    test('should return when device not found', async () => {
      driver.getDevice.mockReturnValue(undefined);
      const signal = {
        sender: { id: 42 },
        data: { temperature: 21.5 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).not.toHaveBeenCalled();
    });

    test('should return when device is an Error', async () => {
      driver.getDevice.mockReturnValue(new Error('not found'));
      const signal = {
        sender: { id: 42 },
        data: { temperature: 21.5 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).not.toHaveBeenCalled();
    });

    test('should set temperature on valid signal', async () => {
      const signal = {
        sender: { id: 42 },
        data: { temperature: 21.5 }
      };
      await driver.updateValues(signal);
      expect(driver.getDevice).toHaveBeenCalledWith({ id: '1.42' });
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith(
        'measure_temperature',
        21.5
      );
    });
  });

  describe('onPairListDevices', () => {
    test('should return error when bus is not connected', async () => {
      driver.homey.app.isBusConnected.mockReturnValue(false);
      const result = await driver.onPairListDevices();
      expect(result).toBeInstanceOf(Error);
    });

    test('should list available panels, sorted by name', async () => {
      driver.homey.app.getDevicesOfType.mockReturnValue({
        a: { id: 42 },
        b: { id: 7 }
      });
      const devices = await driver.onPairListDevices();
      expect(devices).toHaveLength(2);
      // Names sort lexicographically, so "1.42" sorts before "1.7"
      expect(devices[0].name).toBe('HDL DLP Panel (1.42)');
      expect(devices[0].capabilities).toEqual(['measure_temperature']);
      expect(devices[0].data).toEqual({ id: '1.42' });
      expect(devices[1].data).toEqual({ id: '1.7' });
    });

    test('should return empty list when no panels found', async () => {
      const devices = await driver.onPairListDevices();
      expect(devices).toEqual([]);
    });
  });

  describe('_compareHomeyDevice', () => {
    test('should sort devices by name', () => {
      const devices = [
        { name: 'HDL DLP Panel (1.42)' },
        { name: 'HDL DLP Panel (1.7)' }
      ];
      devices.sort(PanelDriver._compareHomeyDevice);
      // Lexicographic order: "1.42" sorts before "1.7"
      expect(devices[0].name).toBe('HDL DLP Panel (1.42)');
    });
  });
});
