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
      getCapabilityValue: jest.fn().mockReturnValue(null)
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
});
