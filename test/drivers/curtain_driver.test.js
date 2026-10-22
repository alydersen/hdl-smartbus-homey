'use strict';

const CurtainDriver = require('../../drivers/curtain/driver');
const HdlDevicelist = require('../../hdl/hdl_devicelist');

describe('CurtainDriver', () => {
  let driver;
  let mockHomeyDevice;

  beforeEach(() => {
    driver = new CurtainDriver();
    mockHomeyDevice = {
      updateStatus: jest.fn(),
      updateDuration: jest.fn()
    };
    driver.homey = {
      app: {
        log: jest.fn(),
        isBusConnected: jest.fn().mockReturnValue(true),
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

  describe('getDeviceFromSignal', () => {
    test('should use channel from signal data when present', () => {
      const signal = { sender: { id: 42 }, data: { channel: 2 } };
      driver.getDeviceFromSignal(signal, 1);
      expect(driver.getDevice).toHaveBeenCalledWith({
        id: '1.42.2',
        address: '1.42',
        channel: 2
      });
    });

    test('should fall back to passed channel', () => {
      const signal = { sender: { id: 42 }, data: {} };
      driver.getDeviceFromSignal(signal, 3);
      expect(driver.getDevice).toHaveBeenCalledWith({
        id: '1.42.3',
        address: '1.42',
        channel: 3
      });
    });

    test('should propagate lookup errors', () => {
      driver.getDevice.mockImplementation(() => { throw new Error('not found'); });
      const signal = { sender: { id: 42 }, data: { channel: 2 } };
      expect(() => driver.getDeviceFromSignal(signal, 2)).toThrow('not found');
    });
  });

  describe('updateValues', () => {
    test('should do nothing when signal has no data', async () => {
      await driver.updateValues({ code: 0xE3E1, sender: { id: 42 } });
      expect(mockHomeyDevice.updateStatus).not.toHaveBeenCalled();
      expect(mockHomeyDevice.updateDuration).not.toHaveBeenCalled();
    });

    test('should parse payload when parse function is present', async () => {
      const signal = {
        code: 0xE3E1,
        sender: { id: 42 },
        payload: Buffer.from([0x00]),
        parse: jest.fn(() => ({ curtain: 1, status: 2 }))
      };
      await driver.updateValues(signal);
      expect(signal.parse).toHaveBeenCalledWith(signal.payload);
      expect(mockHomeyDevice.updateStatus).toHaveBeenCalledWith(2);
    });

    describe('0xE3E4 - all channels status', () => {
      test('should only update status for channels reporting idle', async () => {
        const signal = {
          code: 0xE3E4,
          sender: { id: 42 },
          data: {
            curtains: [
              { number: 1, status: 0 },
              { number: 2, status: 1 }
            ]
          }
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.updateStatus).toHaveBeenCalledTimes(1);
        expect(mockHomeyDevice.updateStatus).toHaveBeenCalledWith(0);
      });

      test('should skip unknown devices', async () => {
        driver.getDevice.mockReturnValue(undefined);
        const signal = {
          code: 0xE3E4,
          sender: { id: 42 },
          data: { curtains: [{ number: 1, status: 0 }] }
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.updateStatus).not.toHaveBeenCalled();
      });

      test('should skip device errors', async () => {
        driver.getDevice.mockReturnValue(new Error('not found'));
        const signal = {
          code: 0xE3E4,
          sender: { id: 42 },
          data: { curtains: [{ number: 1, status: 0 }] }
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.updateStatus).not.toHaveBeenCalled();
      });
    });

    test('should update status on 0xE3E1', async () => {
      const signal = {
        code: 0xE3E1,
        sender: { id: 42 },
        data: { curtain: 1, status: 2 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.updateStatus).toHaveBeenCalledWith(2);
      expect(mockHomeyDevice.updateDuration).not.toHaveBeenCalled();
    });

    describe('0xE3E3 - status with duration', () => {
      test('should update status and duration', async () => {
        const signal = {
          code: 0xE3E3,
          sender: { id: 42 },
          data: { curtain: 1, status: 3, duration: 500 }
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.updateStatus).toHaveBeenCalledWith(3);
        expect(mockHomeyDevice.updateDuration).toHaveBeenCalledWith(500);
      });

      test('should skip duration when null', async () => {
        const signal = {
          code: 0xE3E3,
          sender: { id: 42 },
          data: { curtain: 1, status: 3, duration: null }
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.updateStatus).toHaveBeenCalledWith(3);
        expect(mockHomeyDevice.updateDuration).not.toHaveBeenCalled();
      });
    });

    test('should update duration on 0xE801', async () => {
      const signal = {
        code: 0xE801,
        sender: { id: 42 },
        data: { curtain: 1, duration: 500 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.updateDuration).toHaveBeenCalledWith(500);
      expect(mockHomeyDevice.updateStatus).not.toHaveBeenCalled();
    });

    test('should skip unknown command codes', async () => {
      const signal = {
        code: 0x0000,
        sender: { id: 42 },
        data: { curtain: 1, status: 2 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.updateStatus).not.toHaveBeenCalled();
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
      expect(devices[1].data.id).toBe('1.10.2');
      expect(devices[2].data.id).toBe('1.42.1');
      expect(devices[3].data.id).toBe('1.42.2');
      expect(devices[0].name).toBe('HDL Curtain (1.10 ch 1)');
    });

    test('should return empty list when no devices found', async () => {
      const devices = await driver.onPairListDevices();
      expect(devices).toEqual([]);
    });
  });
});
