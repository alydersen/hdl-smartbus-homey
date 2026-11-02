'use strict';

const FloorHeaterDriver = require('../../drivers/floorheater/driver');

describe('FloorHeaterDriver', () => {
  let driver;
  let mockHomeyDevice;

  beforeEach(() => {
    mockHomeyDevice = {
      updateLevel: jest.fn(),
      updateTemperature: jest.fn(),
      updateValve: jest.fn(),
      updatePowerSwitch: jest.fn(),
      currentData: null
    };

    driver = new FloorHeaterDriver();
    driver._lastValveValue = new Map();
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

  describe('updateValues', () => {
    test('should return when channel is undefined and not 0x7263', async () => {
      const signal = {
        code: 0x1C5F,
        sender: { id: 42, type: 207 },
        data: {},
        payload: null
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.updateLevel).not.toHaveBeenCalled();
    });

    test('should return when device not found', async () => {
      driver.getDevice.mockReturnValue(new Error('not found'));
      const signal = {
        code: 0x1C5F,
        sender: { id: 42, type: 207 },
        data: { channel: 1 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.updateLevel).not.toHaveBeenCalled();
    });

    describe('0x1C5F - floor heating status', () => {
      test('should update target temperature', async () => {
        const signal = {
          code: 0x1C5F,
          sender: { id: 42, type: 207 },
          data: {
            channel: 1,
            temperature: { normal: 25 }
          },
          payload: null
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.updateLevel).toHaveBeenCalledWith(25);
      });

      test('should store signal data as currentData', async () => {
        const signalData = {
          channel: 1,
          temperature: { normal: 25 }
        };
        const signal = {
          code: 0x1C5F,
          sender: { id: 42, type: 207 },
          data: signalData,
          payload: null
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.currentData).toBe(signalData);
      });

      test('should update power switch from work status', async () => {
        const signal = {
          code: 0x1C5F,
          sender: { id: 42, type: 207 },
          data: {
            channel: 1,
            work: { status: true }
          },
          payload: null
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.updatePowerSwitch).toHaveBeenCalledWith(true);
      });

      test('should skip out-of-range temperature', async () => {
        const signal = {
          code: 0x1C5F,
          sender: { id: 42, type: 207 },
          data: {
            channel: 1,
            temperature: { normal: 200 }
          },
          payload: null
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.updateLevel).not.toHaveBeenCalled();
      });
    });

    describe('0xE3E8 - legacy temperature', () => {
      test('should update measured temperature', async () => {
        const signal = {
          code: 0xE3E8,
          sender: { id: 42, type: 207 },
          data: { channel: 1, temperature: 22.5 }
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.updateTemperature).toHaveBeenCalledWith(22.5, { command: 0xE3E8 });
      });

      test('should skip invalid temperature', async () => {
        const signal = {
          code: 0xE3E8,
          sender: { id: 42, type: 207 },
          data: { channel: 1, temperature: 'invalid' }
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.updateTemperature).not.toHaveBeenCalled();
      });
    });

    describe('0x1949 - extended temperature', () => {
      test('should update measured temperature with extended command', async () => {
        const signal = {
          code: 0x1949,
          sender: { id: 42, type: 207 },
          data: { channel: 1, temperature: 23.7 }
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.updateTemperature).toHaveBeenCalledWith(23.7, { command: 0x1949 });
      });
    });

    describe('0x7263 - channel from payload', () => {
      test('should extract channel from buffer payload when missing from data', async () => {
        const payload = Buffer.from([3]);
        const signal = {
          code: 0x7263,
          sender: { id: 42, type: 207 },
          data: {},
          payload: payload
        };
        await driver.updateValues(signal);
        expect(driver.homey.app.devSignChnld).toHaveBeenCalledWith(42, 3);
      });
    });

  describe('valve tracking', () => {
      test('should update valve on first signal', async () => {
        const signal = {
          code: 0x1C5F,
          sender: { id: 42, type: 207 },
          data: {
            channel: 1,
            work: { status: true }
          },
          payload: null
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.updateValve).toHaveBeenCalledWith(true);
      });

      test('should not update valve when value unchanged', async () => {
        driver._lastValveValue.set('1.42.1', true);
        const signal = {
          code: 0x1C5F,
          sender: { id: 42, type: 207 },
          data: {
            channel: 1,
            watering: { status: true }
          },
          payload: null
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.updateValve).not.toHaveBeenCalled();
      });
    });
  });

  describe('onPairListDevices', () => {
    beforeEach(() => {
      driver.homey.app.getDevicesOfType.mockReturnValue({
        42: { subnet: 1, id: 42, type: 213 }
      });
    });

    test('pairs heating zones without a capability override', async () => {
      const devices = await driver.onPairListDevices();
      const zones = devices.filter((d) => d.name.startsWith('HDL Floorheater'));
      expect(zones).toHaveLength(6);
      for (const zone of zones) {
        expect(zone.capabilities).toBeUndefined();
      }
    });

    test('pairs sensor channels with only the temperature capability', async () => {
      const devices = await driver.onPairListDevices();
      const sensors = devices.filter((d) => d.name.startsWith('HDL Floor Sensor'));
      expect(sensors).toHaveLength(13);
      for (const sensor of sensors) {
        expect(sensor.capabilities).toEqual(['measure_temperature']);
        expect(sensor.data.channel).toBeGreaterThanOrEqual(13);
      }
    });
  });

  describe('onPair', () => {
    let handlers;

    const startPairSession = async () => {
      handlers = {};
      const session = {
        setHandler: jest.fn((event, callback) => {
          handlers[event] = callback;
        })
      };
      await driver.onPair(session);
      return session;
    };

    beforeEach(async () => {
      driver.homey.app.getDevicesOfType.mockReturnValue({
        42: { subnet: 1, id: 42, type: 213 }
      });
      await startPairSession();
    });

    test('registers the pairing session handlers', () => {
      expect(Object.keys(handlers).sort()).toEqual([
        'list_controllers',
        'list_devices',
        'pair_mode',
        'pair_probe'
      ]);
    });

    test('lists discovered devices by default', async () => {
      const devices = await handlers.list_devices();
      expect(devices).toHaveLength(19);
      expect(devices.filter((d) => d.name.startsWith('HDL Floorheater'))).toHaveLength(6);
    });

    test('lists discovered floor heating controllers with bus addresses', async () => {
      const controllers = await handlers.list_controllers();
      expect(controllers).toEqual([{ address: '1.42' }]);
    });

    test('switches to probe mode after a valid probe ID is submitted', async () => {
      const device = await handlers.pair_probe({ address: '1.42', probeId: 133 });
      expect(device).toEqual({
        name: 'HDL Floor Sensor (1.42 probe 133)',
        data: {
          id: '1.42.183',
          address: '1.42',
          channel: 183
        },
        capabilities: ['measure_temperature']
      });

      const devices = await handlers.list_devices();
      expect(devices).toEqual([device]);
    });

    test('rejects probe IDs outside the supported range', async () => {
      await expect(handlers.pair_probe({ address: '1.42', probeId: 0 })).rejects.toThrow('whole number');
      await expect(handlers.pair_probe({ address: '1.42', probeId: 301 })).rejects.toThrow('whole number');
      await expect(handlers.pair_probe({ address: '1.42', probeId: 12.5 })).rejects.toThrow('whole number');
      await expect(handlers.pair_probe({ address: '1.42' })).rejects.toThrow('whole number');

      // A rejected probe must not leave the session in probe mode
      const devices = await handlers.list_devices();
      expect(devices).toHaveLength(19);
    });

    test('rejects controllers that were not discovered', async () => {
      await expect(handlers.pair_probe({ address: '1.99', probeId: 42 })).rejects.toThrow('Unknown floor heating controller');
    });

    test('rejects probe pairing when the bus is not connected', async () => {
      driver.homey.app.isBusConnected.mockReturnValue(false);
      await expect(handlers.pair_probe({ address: '1.42', probeId: 42 })).rejects.toThrow('Please configure the app settings first.');
      await expect(handlers.list_controllers()).rejects.toThrow('Please configure the app settings first.');
    });

    test('accepts a probe ID matching a built-in sensor channel', async () => {
      const device = await handlers.pair_probe({ address: '1.42', probeId: 1 });
      expect(device.data.channel).toBe(51);
    });
  });
});
