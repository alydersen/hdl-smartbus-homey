'use strict';

const DryContactDriver = require('../../drivers/dry-contact/driver');
const HdlDevicelist = require('../../hdl/hdl_devicelist');

describe('DryContactDriver', () => {
  let driver;
  let mockHomeyDevice;
  let triggerCards;

  const makeDevice = () => {
    const capabilities = new Map();
    return {
      getData: () => ({ id: '1.42' }),
      hasCapability: (capability) => capabilities.has(capability),
      addCapability: jest.fn(async (capability) => {
        capabilities.set(capability, null);
      }),
      setCapabilityValue: jest.fn(async (capability, value) => {
        capabilities.set(capability, value);
      }),
      getCapabilityValue: (capability) => capabilities.get(capability),
      recordEvent: jest.fn(async () => {}),
      respondToSender: jest.fn()
    };
  };

  const channelSetCalls = (channel) =>
    mockHomeyDevice.setCapabilityValue.mock.calls.filter(
      ([capability]) => capability === `dry_contact_${channel}`
    );

  beforeEach(async () => {
    triggerCards = {};
    mockHomeyDevice = makeDevice();

    driver = new DryContactDriver();
    driver.homey = {
      app: {
        log: jest.fn(),
        valueOK: jest.fn((type, value) => {
          if (typeof value !== 'number') return false;
          if (type === 'temperature') return value >= -40 && value <= 80;
          return false;
        })
      },
      flow: {
        getDeviceTriggerCard: jest.fn((name) => {
          if (!triggerCards[name]) {
            triggerCards[name] = { trigger: jest.fn().mockResolvedValue() };
          }
          return triggerCards[name];
        })
      },
      settings: {
        get: jest.fn().mockReturnValue('1')
      }
    };
    driver.getDevice = jest.fn().mockReturnValue(mockHomeyDevice);
    driver.error = jest.fn();

    jest.spyOn(HdlDevicelist.prototype, 'excludeCapabilities').mockResolvedValue([]);
    jest.spyOn(HdlDevicelist.prototype, 'numberOfChannels').mockResolvedValue(8);

    await driver.onInit();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('updateValues', () => {
    test('should return when sender type is undefined', async () => {
      const signal = {
        code: 0x0031,
        sender: { id: 42 },
        data: {}
      };
      await driver.updateValues(signal);
      expect(driver.getDevice).not.toHaveBeenCalled();
    });

    test('should return when device not found', async () => {
      driver.getDevice.mockReturnValue(undefined);
      const signal = {
        code: 0x0031,
        sender: { id: 42, type: 62 },
        data: {}
      };
      await driver.updateValues(signal);
      expect(mockHomeyDevice.setCapabilityValue).not.toHaveBeenCalled();
    });

    test('should look up device by subnet and sender id', async () => {
      const signal = {
        code: 0x0031,
        sender: { id: 42, type: 62 },
        payload: Buffer.from([0x00, 1, 0x00, 0x00, 2]),
        data: {}
      };
      await driver.updateValues(signal);
      expect(driver.getDevice).toHaveBeenCalledWith({ id: '1.42' });
    });

    describe('0x0031 - contact status', () => {
      test('should update single contact from payload contact index', async () => {
        const signal = {
          code: 0x0031,
          sender: { id: 42, type: 62 },
          payload: Buffer.from([0x00, 1, 0x00, 0x00, 2]),
          data: {}
        };
        await driver.updateValues(signal);
        const calls = channelSetCalls(2);
        expect(calls).toContainEqual(['dry_contact_2', true]);
        expect(mockHomeyDevice.recordEvent).toHaveBeenCalledWith(2, true);
      });

      test('should update contacts from channel mask when no contact index', async () => {
        const signal = {
          code: 0x0031,
          sender: { id: 42, type: 62 },
          payload: Buffer.from([0x00, 1, 0x00, 0b0101]),
          data: {}
        };
        await driver.updateValues(signal);
        expect(channelSetCalls(1)).toContainEqual(['dry_contact_1', true]);
        expect(channelSetCalls(3)).toContainEqual(['dry_contact_3', true]);
        expect(channelSetCalls(2)).toHaveLength(0);
      });

      test('should set contact false for level 0', async () => {
        const signal = {
          code: 0x0031,
          sender: { id: 42, type: 62 },
          payload: Buffer.from([0x00, 0, 0x00, 0x00, 2]),
          data: {}
        };
        await driver.updateValues(signal);
        expect(channelSetCalls(2)).toContainEqual(['dry_contact_2', false]);
      });
    });

    describe('parsed dryContacts data', () => {
      test('should update channels from parsed contact statuses', async () => {
        const signal = {
          code: 0x6F00,
          sender: { id: 42, type: 62 },
          data: {
            dryContacts: {
              0: { status: 1 },
              1: { status: 0 }
            }
          }
        };
        await driver.updateValues(signal);
        expect(channelSetCalls(1)).toContainEqual(['dry_contact_1', true]);
        expect(channelSetCalls(2)).toContainEqual(['dry_contact_2', false]);
      });

      test('should skip contact indices beyond configured channels', async () => {
        const signal = {
          code: 0x6F00,
          sender: { id: 42, type: 62 },
          data: {
            dryContacts: {
              8: { status: 1 }
            }
          }
        };
        await driver.updateValues(signal);
        expect(channelSetCalls(9)).toHaveLength(0);
      });
    });

    describe('0xE3D9 - acknowledgement', () => {
      test('should update channel from sentinel-based payload', async () => {
        const signal = {
          code: 0xE3D9,
          sender: { id: 42, type: 62 },
          payload: Buffer.from([0x00, 0x00, 0x00, 0x11, 3, 1]),
          data: {}
        };
        await driver.updateValues(signal);
        expect(channelSetCalls(3)).toContainEqual(['dry_contact_3', true]);
      });

      test('should fall back to mask when no sentinel found', async () => {
        const signal = {
          code: 0xE3D9,
          sender: { id: 42, type: 62 },
          payload: Buffer.from([0x00, 0b0011, 1]),
          data: {}
        };
        await driver.updateValues(signal);
        expect(channelSetCalls(1)).toContainEqual(['dry_contact_1', true]);
        expect(channelSetCalls(2)).toContainEqual(['dry_contact_2', true]);
      });
    });

    describe('temperature', () => {
      test('should set temperature capability when value is valid', async () => {
        const signal = {
          code: 0x0031,
          sender: { id: 42, type: 62 },
          data: { temperature: 21.5 }
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.setCapabilityValue).toHaveBeenCalledWith(
          'measure_temperature',
          21.5
        );
      });

      test('should skip temperature when out of range', async () => {
        const signal = {
          code: 0x0031,
          sender: { id: 42, type: 62 },
          data: { temperature: 200 }
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.setCapabilityValue).not.toHaveBeenCalledWith(
          'measure_temperature',
          expect.anything()
        );
      });

      test('should skip temperature when capability is excluded', async () => {
        HdlDevicelist.prototype.excludeCapabilities.mockResolvedValue(['measure_temperature']);
        const signal = {
          code: 0x0031,
          sender: { id: 42, type: 62 },
          data: { temperature: 21.5 }
        };
        await driver.updateValues(signal);
        expect(mockHomeyDevice.setCapabilityValue).not.toHaveBeenCalledWith(
          'measure_temperature',
          expect.anything()
        );
      });
    });

    test('should not update a channel when value is unchanged', async () => {
      const signal = {
        code: 0x0031,
        sender: { id: 42, type: 62 },
        payload: Buffer.from([0x00, 1, 0x00, 0x00, 2]),
        data: {}
      };
      await driver.updateValues(signal);
      const firstCallCount = channelSetCalls(2).length;
      await driver.updateValues(signal);
      expect(channelSetCalls(2).length).toBe(firstCallCount);
      expect(mockHomeyDevice.recordEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('click sequences', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const contactSignal = (channel, level) => ({
      code: 0x0031,
      sender: { id: 42, type: 62 },
      payload: Buffer.from([0x00, level, 0x00, 0x00, channel]),
      data: {}
    });

    const flush = async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    };

    test('should trigger single click when no second edge arrives', async () => {
      await driver.updateValues(contactSignal(1, 1));
      await jest.advanceTimersByTimeAsync(900);
      await flush();
      expect(triggerCards['dry_contact_1_single'].trigger).toHaveBeenCalledTimes(1);
      expect(triggerCards['dry_contact_1_double'].trigger).not.toHaveBeenCalled();
      expect(triggerCards['dry_contact_1_triple'].trigger).not.toHaveBeenCalled();
    });

    test('should trigger double click on two rapid edges', async () => {
      await driver.updateValues(contactSignal(1, 1));
      await jest.advanceTimersByTimeAsync(200);
      await driver.updateValues(contactSignal(1, 0));
      await jest.advanceTimersByTimeAsync(2000);
      await flush();
      expect(triggerCards['dry_contact_1_double'].trigger).toHaveBeenCalledTimes(1);
      expect(triggerCards['dry_contact_1_single'].trigger).not.toHaveBeenCalled();
      expect(triggerCards['dry_contact_1_triple'].trigger).not.toHaveBeenCalled();
    });

    test('should trigger triple click on three rapid edges', async () => {
      await driver.updateValues(contactSignal(1, 1));
      await jest.advanceTimersByTimeAsync(200);
      await driver.updateValues(contactSignal(1, 0));
      await jest.advanceTimersByTimeAsync(200);
      await driver.updateValues(contactSignal(1, 1));
      await flush();
      expect(triggerCards['dry_contact_1_triple'].trigger).toHaveBeenCalledTimes(1);
      expect(triggerCards['dry_contact_1_single'].trigger).not.toHaveBeenCalled();
      expect(triggerCards['dry_contact_1_double'].trigger).not.toHaveBeenCalled();
    });

    test('should suppress duplicate edges within suppression window', async () => {
      await driver.updateValues(contactSignal(1, 1));
      await driver.updateValues(contactSignal(1, 0));
      await jest.advanceTimersByTimeAsync(900);
      await flush();
      expect(triggerCards['dry_contact_1_single'].trigger).toHaveBeenCalledTimes(1);
    });

    test('should track sequences per channel', async () => {
      await driver.updateValues(contactSignal(1, 1));
      await jest.advanceTimersByTimeAsync(200);
      await driver.updateValues(contactSignal(2, 1));
      await jest.advanceTimersByTimeAsync(900);
      await flush();
      expect(triggerCards['dry_contact_1_single'].trigger).toHaveBeenCalledTimes(1);
      expect(triggerCards['dry_contact_2_single'].trigger).toHaveBeenCalledTimes(1);
    });
  });
});
