'use strict';

const TempsensorDriver = require('../../drivers/tempsensor/driver');
const HdlDevicelist = require('../../hdl/hdl_devicelist');

describe('TempsensorDriver', () => {
  let driver;
  let mockHomeyDevice;

  beforeEach(() => {
    mockHomeyDevice = {
      hasCapability: jest.fn().mockReturnValue(true),
      addCapability: jest.fn().mockResolvedValue(),
      setCapabilityValue: jest.fn().mockResolvedValue()
    };

    driver = new TempsensorDriver();
    driver.homey = {
      app: {
        log: jest.fn(),
        isBusConnected: jest.fn().mockReturnValue(true),
        valueOK: jest.fn((type, value) => {
          if (typeof value !== 'number') return false;
          if (type === 'temperature') return value >= -40 && value <= 80;
          return false;
        }),
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
    driver.getDevice = jest.fn().mockReturnValue(mockHomeyDevice);
    driver.error = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('updateValues', () => {
    test('should return when temperature is undefined', async () => {
      const signal = {
        sender: { id: 42 },
        data: { channel: 1 }
      };
      await driver.updateValues(signal);
      expect(driver.getDevice).not.toHaveBeenCalled();
    });

    test('should return when channel is undefined', async () => {
      const signal = {
        sender: { id: 42 },
        data: { temperature: 21.5 }
      };
      await driver.updateValues(signal);
      expect(driver.getDevice).not.toHaveBeenCalled();
    });

    test('should return when temperature is out of range', async () => {
      const signal = {
        sender: { id: 42 },
        data: { channel: 1, temperature: 200 }
      };
      await driver.updateValues(signal);
      expect(driver.getDevice).not.toHaveBeenCalled();
    });

    test('should return when device not found', async () => {
      driver.getDevice.mockReturnValue(undefined);
      const signal = {
        sender: { id: 42 },
        data: { channel: 1, temperature: 21.5 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).not.toHaveBeenCalled();
    });

    test('should return when device is an Error', async () => {
      driver.getDevice.mockReturnValue(new Error('not found'));
      const signal = {
        sender: { id: 42 },
        data: { channel: 1, temperature: 21.5 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).not.toHaveBeenCalled();
    });

    test('should set temperature on valid signal', async () => {
      const signal = {
        sender: { id: 42 },
        data: { channel: 2, temperature: 21.5 }
      };
      await driver.updateValues(signal);
      expect(driver.homey.app.devSignChnld).toHaveBeenCalledWith(42, 2);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith(
        'measure_temperature',
        21.5
      );
    });

    test('should add capability when missing', async () => {
      mockHomeyDevice.hasCapability.mockReturnValue(false);
      const signal = {
        sender: { id: 42 },
        data: { channel: 1, temperature: 21.5 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.addCapability).toHaveBeenCalledWith('measure_temperature');
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith(
        'measure_temperature',
        21.5
      );
    });

    test('should not add capability when present', async () => {
      const signal = {
        sender: { id: 42 },
        data: { channel: 1, temperature: 21.5 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.addCapability).not.toHaveBeenCalled();
    });
  });

  describe('onPairListDevices', () => {
    test('should return error when bus is not connected', async () => {
      driver.homey.app.isBusConnected.mockReturnValue(false);
      const result = await driver.onPairListDevices();
      expect(result).toBeInstanceOf(Error);
    });

    test('should list one device per channel, sorted by name', async () => {
      jest.spyOn(HdlDevicelist.prototype, 'numberOfChannels').mockResolvedValue(2);
      driver.homey.app.getDevicesOfType.mockReturnValue({
        a: { id: 42, type: 100 },
        b: { id: 10, type: 100 }
      });
      const devices = await driver.onPairListDevices();
      expect(devices).toHaveLength(4);
      expect(devices[0].data.id).toBe('1.10.1');
      expect(devices[3].data.id).toBe('1.42.2');
      expect(devices[0].name).toBe('HDL Temp Sensor (1.10 ch 1)');
    });

    test('should return empty list when no devices found', async () => {
      const devices = await driver.onPairListDevices();
      expect(devices).toEqual([]);
    });
  });
});
