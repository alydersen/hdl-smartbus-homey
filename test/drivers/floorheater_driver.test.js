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
        const payload = Buffer.alloc(11);
        payload.writeUInt8(1, 0); // channel
        payload.writeUInt8(1, 10); // valve open
        const signal = {
          code: 0x1C5F,
          sender: { id: 42, type: 207 },
          data: {
            channel: 1,
            work: { status: true }
          },
          payload: payload
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.updateValve).toHaveBeenCalledWith(
          true,
          expect.objectContaining({ raw: expect.any(Number) })
        );
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
});
