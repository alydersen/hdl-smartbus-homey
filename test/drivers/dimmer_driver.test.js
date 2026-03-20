'use strict';

const DimmerDriver = require('../../drivers/dimmer/driver');

describe('DimmerDriver', () => {
  let driver;
  let mockHomeyDevice;

  beforeEach(() => {
    driver = new DimmerDriver();
    mockHomeyDevice = {
      updateHomeyLevel: jest.fn()
    };
    driver.homey = {
      app: {
        log: jest.fn(),
        isBusConnected: jest.fn().mockReturnValue(true),
        devSignChnld: jest.fn((id, channel) => ({
          id: `1.${id}.${channel}`,
          address: `1.${id}`,
          channel: channel
        })),
        getDevicesOfType: jest.fn().mockReturnValue({})
      },
      settings: {
        get: jest.fn().mockReturnValue('1')
      }
    };
    driver.getDevice = jest.fn();
    driver.error = jest.fn();
  });

  describe('getDeviceFromSignal', () => {
    test('should return device when found', () => {
      driver.getDevice.mockReturnValue(mockHomeyDevice);
      const result = driver.getDeviceFromSignal(42, 1);
      expect(result).toBe(mockHomeyDevice);
      expect(driver.homey.app.devSignChnld).toHaveBeenCalledWith(42, 1);
    });

    test('should return undefined when device not found', () => {
      driver.getDevice.mockImplementation(() => { throw new Error('not found'); });
      const result = driver.getDeviceFromSignal(42, 1);
      expect(result).toBeUndefined();
    });
  });

  describe('updateDevice', () => {
    test('should update device with level', async () => {
      driver.getDevice.mockReturnValue(mockHomeyDevice);
      await driver.updateDevice(42, 1, 80);
      expect(mockHomeyDevice.updateHomeyLevel).toHaveBeenCalledWith(80);
    });

    test('should skip when level is undefined', async () => {
      await driver.updateDevice(42, 1, undefined);
      expect(mockHomeyDevice.updateHomeyLevel).not.toHaveBeenCalled();
    });

    test('should skip when channel is undefined', async () => {
      await driver.updateDevice(42, undefined, 80);
      expect(mockHomeyDevice.updateHomeyLevel).not.toHaveBeenCalled();
    });

    test('should skip when device is an Error', async () => {
      driver.getDevice.mockReturnValue(new Error('not found'));
      await driver.updateDevice(42, 1, 80);
      expect(mockHomeyDevice.updateHomeyLevel).not.toHaveBeenCalled();
    });

    test('should skip when device is undefined', async () => {
      driver.getDevice.mockImplementation(() => { throw new Error('not found'); });
      await driver.updateDevice(42, 1, 80);
      expect(mockHomeyDevice.updateHomeyLevel).not.toHaveBeenCalled();
    });
  });

  describe('updateValues', () => {
    test('should handle single channel signal', async () => {
      driver.getDevice.mockReturnValue(mockHomeyDevice);
      const signal = {
        sender: { id: 42 },
        data: { channel: 1, level: 80 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.updateHomeyLevel).toHaveBeenCalledWith(80);
    });

    test('should handle multi-channel signal', async () => {
      driver.getDevice.mockReturnValue(mockHomeyDevice);
      const signal = {
        sender: { id: 42 },
        data: {
          channels: [
            { number: 1, level: 50 },
            { number: 2, level: 75 },
            { number: 3, level: 100 }
          ]
        }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.updateHomeyLevel).toHaveBeenCalledTimes(3);
      expect(mockHomeyDevice.updateHomeyLevel).toHaveBeenCalledWith(50);
      expect(mockHomeyDevice.updateHomeyLevel).toHaveBeenCalledWith(75);
      expect(mockHomeyDevice.updateHomeyLevel).toHaveBeenCalledWith(100);
    });

    test('should skip channels with missing level in multi-channel', async () => {
      driver.getDevice.mockReturnValue(mockHomeyDevice);
      const signal = {
        sender: { id: 42 },
        data: {
          channels: [
            { number: 1, level: 50 },
            { number: 2 },
            { number: 3, level: 100 }
          ]
        }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.updateHomeyLevel).toHaveBeenCalledTimes(2);
    });

    test('should skip channels with missing number in multi-channel', async () => {
      driver.getDevice.mockReturnValue(mockHomeyDevice);
      const signal = {
        sender: { id: 42 },
        data: {
          channels: [
            { level: 50 },
            { number: 2, level: 75 }
          ]
        }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.updateHomeyLevel).toHaveBeenCalledTimes(1);
      expect(mockHomeyDevice.updateHomeyLevel).toHaveBeenCalledWith(75);
    });

    test('should handle signal with no channel or channels data', async () => {
      const signal = {
        sender: { id: 42 },
        data: {}
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.updateHomeyLevel).not.toHaveBeenCalled();
    });
  });
});
