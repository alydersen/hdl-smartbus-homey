'use strict';

const MultisensorDriver = require('../../drivers/multisensor/driver');

describe('MultisensorDriver', () => {
  let driver;
  let mockHomeyDevice;

  beforeEach(() => {
    mockHomeyDevice = {
      hasCapability: jest.fn().mockReturnValue(true),
      addCapability: jest.fn().mockResolvedValue(),
      setCapabilityValue: jest.fn().mockResolvedValue(),
      getCapabilityValue: jest.fn().mockReturnValue(null),
      registerRelayListener: jest.fn()
    };

    driver = new MultisensorDriver();
    driver.homey = {
      app: {
        log: jest.fn(),
        isBusConnected: jest.fn().mockReturnValue(true),
        valueOK: jest.fn((type, value) => {
          if (typeof value !== 'number') return false;
          switch (type) {
            case 'temperature': return value >= -40 && value <= 80;
            case 'humidity': return value >= 0 && value <= 100;
            case 'lux': return value >= 0 && value <= 100000;
          }
          return false;
        }),
        getDevicesOfType: jest.fn().mockReturnValue({})
      },
      settings: {
        get: jest.fn((key) => {
          if (key === 'hdl_subnet') return '1';
          if (key === 'hdl_universal_motion') return '212';
          return undefined;
        })
      }
    };
    driver.getDevice = jest.fn().mockReturnValue(mockHomeyDevice);
    driver.error = jest.fn();
    driver.log = jest.fn();
  });

  describe('updateValues', () => {
    test('should return when sender type is undefined', async () => {
      const signal = { sender: {}, data: { temperature: 22 } };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).not.toHaveBeenCalled();
    });

    test('should return when device not found', async () => {
      driver.getDevice.mockReturnValue(undefined);
      const signal = {
        sender: { type: 305, id: 42 },
        data: { temperature: 22 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).not.toHaveBeenCalled();
    });

    test('should return when device is Error', async () => {
      driver.getDevice.mockReturnValue(new Error('not found'));
      const signal = {
        sender: { type: 305, id: 42 },
        data: { temperature: 22 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).not.toHaveBeenCalled();
    });

    test('should set temperature', async () => {
      const signal = {
        sender: { type: 305, id: 42 },
        data: { temperature: 22.5 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith(
        'measure_temperature', 22.5
      );
    });

    test('should set humidity', async () => {
      const signal = {
        sender: { type: 305, id: 42 },
        data: { humidity: 65 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith(
        'measure_humidity', 65
      );
    });

    test('should set luminance from brightness field', async () => {
      const signal = {
        sender: { type: 305, id: 42 },
        data: { brightness: 500 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith(
        'measure_luminance', 500
      );
    });

    test('should set motion alarm', async () => {
      const signal = {
        sender: { type: 305, id: 42 },
        data: { movement: true }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith(
        'alarm_motion', true
      );
    });

    test('should set all sensor values when present', async () => {
      const signal = {
        sender: { type: 305, id: 42 },
        data: {
          temperature: 22.5,
          humidity: 65,
          brightness: 500,
          movement: false
        }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith('measure_temperature', 22.5);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith('measure_humidity', 65);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith('measure_luminance', 500);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith('alarm_motion', false);
    });

    test('should reject out-of-range temperature', async () => {
      const signal = {
        sender: { type: 305, id: 42 },
        data: { temperature: 200 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).not.toHaveBeenCalledWith(
        'measure_temperature', expect.anything()
      );
    });

    test('should handle universal switch motion', async () => {
      const signal = {
        sender: { type: 305, id: 42 },
        data: { switch: 212, status: true }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith(
        'alarm_motion', true
      );
    });

    test('should not treat non-motion universal switch as motion', async () => {
      const signal = {
        sender: { type: 305, id: 42 },
        data: { switch: 100, status: true }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).not.toHaveBeenCalledWith(
        'alarm_motion', expect.anything()
      );
    });

    test('should add capability if device does not have it', async () => {
      mockHomeyDevice.hasCapability.mockReturnValue(false);
      const signal = {
        sender: { type: 305, id: 42 },
        data: { temperature: 22.5 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.addCapability).toHaveBeenCalledWith('measure_temperature');
    });

    test('should handle dry contact data', async () => {
      const signal = {
        sender: { type: 305, id: 42 },
        data: {
          dryContacts: {
            0: { status: 1 },
            1: { status: 0 }
          }
        }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith('dry_contact_1', true);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith('dry_contact_2', false);
    });
  });

  describe('updateValues relay outputs (12in1, types 308/321)', () => {
    test('should set relay_1 from a single channel answerback (0x0032)', async () => {
      const signal = {
        sender: { type: 321, id: 42 },
        code: 0x0032,
        data: { channel: 1, success: true, level: 100 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith('relay_1', true);
    });

    test('should set relay_2 off from a single channel answerback with level 0', async () => {
      const signal = {
        sender: { type: 308, id: 42 },
        code: 0x0032,
        data: { channel: 2, success: true, level: 0 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith('relay_2', false);
    });

    test('should update both relays from a channel status response (0x0034)', async () => {
      const signal = {
        sender: { type: 321, id: 42 },
        code: 0x0034,
        data: {
          channels: [
            { number: 1, level: 100 },
            { number: 2, level: 0 }
          ]
        }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith('relay_1', true);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith('relay_2', false);
    });

    test('should update relays from a level status response (0x0039)', async () => {
      const signal = {
        sender: { type: 321, id: 42 },
        code: 0x0039,
        data: {
          channels: [{ number: 1, level: 55 }]
        }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith('relay_1', true);
    });

    test('should ignore relay feedback for sensor types without relay outputs', async () => {
      const signal = {
        sender: { type: 305, id: 42 },
        code: 0x0032,
        data: { channel: 1, success: true, level: 100 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).not.toHaveBeenCalledWith('relay_1', expect.anything());
    });

    test('should ignore answerback channels beyond the relay count', async () => {
      const signal = {
        sender: { type: 321, id: 42 },
        code: 0x0032,
        data: { channel: 3, success: true, level: 100 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).not.toHaveBeenCalledWith('relay_3', expect.anything());
    });

    test('should not update unchanged relay values', async () => {
      mockHomeyDevice.getCapabilityValue.mockReturnValue(true);
      const signal = {
        sender: { type: 321, id: 42 },
        code: 0x0032,
        data: { channel: 1, success: true, level: 100 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).not.toHaveBeenCalledWith('relay_1', expect.anything());
    });

    test('should add the relay capability and register its listener when missing', async () => {
      mockHomeyDevice.hasCapability.mockReturnValue(false);
      const signal = {
        sender: { type: 321, id: 42 },
        code: 0x0032,
        data: { channel: 1, success: true, level: 100 }
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.addCapability).toHaveBeenCalledWith('relay_1');
      expect(mockHomeyDevice.registerRelayListener).toHaveBeenCalledWith('relay_1', 1);
      expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith('relay_1', true);
    });
  });

  describe('onPairListDevices relay outputs', () => {
    test('should declare relay capabilities when pairing a 12in1 sensor', async () => {
      driver.homey.app.getDevicesOfType.mockReturnValue({ 42: { id: 42, type: 321 } });
      const devices = await driver.onPairListDevices();
      expect(devices).toHaveLength(1);
      expect(devices[0].capabilities).toEqual(['alarm_motion', 'relay_1', 'relay_2']);
    });

    test('should not declare relay capabilities for other multisensors', async () => {
      driver.homey.app.getDevicesOfType.mockReturnValue({ 43: { id: 43, type: 305 } });
      const devices = await driver.onPairListDevices();
      expect(devices).toHaveLength(1);
      expect(devices[0].capabilities).toEqual(['alarm_motion']);
    });
  });
});
