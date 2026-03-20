'use strict';

const RelayDriver = require('../../drivers/relay/driver');

describe('RelayDriver', () => {
  let driver;
  let mockHomeyDevice;

  beforeEach(() => {
    driver = new RelayDriver();
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

  describe('updateValues', () => {
    test('should handle single channel signal', async () => {
      driver.getDevice.mockReturnValue(mockHomeyDevice);
      const signal = {
        sender: { id: 42 },
        data: { channel: 1, level: 100 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.updateHomeyLevel).toHaveBeenCalledWith(100);
    });

    test('should handle multi-channel signal', async () => {
      driver.getDevice.mockReturnValue(mockHomeyDevice);
      const signal = {
        sender: { id: 42 },
        data: {
          channels: [
            { number: 1, level: 0 },
            { number: 2, level: 100 }
          ]
        }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.updateHomeyLevel).toHaveBeenCalledTimes(2);
      expect(mockHomeyDevice.updateHomeyLevel).toHaveBeenCalledWith(0);
      expect(mockHomeyDevice.updateHomeyLevel).toHaveBeenCalledWith(100);
    });

    test('should handle signal with both single and multi-channel data', async () => {
      driver.getDevice.mockReturnValue(mockHomeyDevice);
      const signal = {
        sender: { id: 42 },
        data: {
          channel: 1,
          level: 50,
          channels: [
            { number: 2, level: 75 }
          ]
        }
      };
      await driver.updateValues(signal);
      // Both single and multi should be processed
      expect(mockHomeyDevice.updateHomeyLevel).toHaveBeenCalledWith(50);
      expect(mockHomeyDevice.updateHomeyLevel).toHaveBeenCalledWith(75);
    });
  });

  describe('getDeviceFromSignal', () => {
    test('should return device when found', () => {
      driver.getDevice.mockReturnValue(mockHomeyDevice);
      const result = driver.getDeviceFromSignal(42, 1);
      expect(result).toBe(mockHomeyDevice);
    });

    test('should return undefined on error', () => {
      driver.getDevice.mockImplementation(() => { throw new Error('not found'); });
      const result = driver.getDeviceFromSignal(42, 1);
      expect(result).toBeUndefined();
    });
  });
});
