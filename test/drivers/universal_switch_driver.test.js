'use strict';

const UniversalSwitchDriver = require('../../drivers/universal-switch/driver');

describe('UniversalSwitchDriver', () => {
  let driver;
  let mockHomeyDevice;

  beforeEach(() => {
    mockHomeyDevice = {
      setCapabilityValue: jest.fn().mockResolvedValue(),
      respondToSender: jest.fn()
    };

    driver = new UniversalSwitchDriver();
    driver.homey = {
      app: {
        log: jest.fn(),
        isBusConnected: jest.fn().mockReturnValue(true),
        getDevicesOfType: jest.fn().mockReturnValue({})
      },
      settings: {
        get: jest.fn((key) => {
          const settings = {
            hdl_subnet: '1',
            hdl_universal_motion: '10',
            hdl_id: '100'
          };
          return settings[key];
        })
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

    test('should return when switch is undefined', async () => {
      const signal = { sender: { id: 42 }, data: { status: true } };
      await driver.updateValues(signal);
      expect(driver.getDevice).not.toHaveBeenCalled();
    });

    test('should return when signal is for universal motion', async () => {
      const signal = {
        sender: { id: 42 },
        data: { switch: 10, status: true }
      };
      await driver.updateValues(signal);
      expect(driver.getDevice).not.toHaveBeenCalled();
    });

    test('should return when signal is from self', async () => {
      const signal = {
        sender: { id: 100 },
        data: { switch: 5, status: true }
      };
      await driver.updateValues(signal);
      expect(driver.getDevice).not.toHaveBeenCalled();
    });

    test('should return when device not found', async () => {
      driver.getDevice.mockReturnValue(undefined);
      const signal = {
        sender: { id: 42 },
        data: { switch: 5, status: true }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).not.toHaveBeenCalled();
    });

    test('should set onoff state and respond to sender', async () => {
      const signal = {
        sender: { id: 42 },
        data: { switch: 5, status: true }
      };
      await driver.updateValues(signal);
      expect(driver.getDevice).toHaveBeenCalledWith({
        id: '1.5',
        switch: 5
      });
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith('onoff', true);
      expect(mockHomeyDevice.respondToSender).toHaveBeenCalledWith(signal.sender);
    });

    test('should set onoff false for status false', async () => {
      const signal = {
        sender: { id: 42 },
        data: { switch: 5, status: false }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith('onoff', false);
    });
  });

  describe('onPairListDevices', () => {
    test('should return error when bus is not connected', async () => {
      driver.homey.app.isBusConnected.mockReturnValue(false);
      const result = await driver.onPairListDevices();
      expect(result).toBeInstanceOf(Error);
    });

    test('should list all switch numbers except universal motion', async () => {
      const devices = await driver.onPairListDevices();
      expect(devices).toHaveLength(253);
      expect(devices.some((d) => d.data.switch === 10)).toBe(false);
      expect(devices[0].name).toBe('HDL Universal Switch (1.1)');
      expect(devices[0].data).toEqual({ id: '1.1', switch: 1 });
    });
  });
});
