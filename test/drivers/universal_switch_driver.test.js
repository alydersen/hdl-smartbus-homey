'use strict';

const UniversalSwitchDriver = require('../../drivers/universal-switch/driver');
const UniversalSwitchDevice = require('../../drivers/universal-switch/device');

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

describe('UniversalSwitchDevice', () => {
  test('should show the HDL bus address in the device settings on init', async () => {
    const device = new UniversalSwitchDevice({ id: '1.42', switch: 42 }, null);
    device.homey = { app: { log: jest.fn() } };

    await device.onInit();

    expect(await device.getSettings()).toEqual({ hdl_address: '1.42' });
  });
});

describe('UniversalSwitchDriver signal logging', () => {
  let driver;
  let mockHomeyDevice;
  let settingsStore;

  beforeEach(() => {
    mockHomeyDevice = {
      setCapabilityValue: jest.fn().mockResolvedValue(),
      respondToSender: jest.fn()
    };

    settingsStore = {
      hdl_subnet: '1',
      hdl_universal_motion: '10',
      hdl_id: '100',
      hdl_uv_debug: true,
      hdl_uv_debug_log: []
    };

    driver = new UniversalSwitchDriver();
    driver.homey = {
      app: {
        log: jest.fn(),
        isBusConnected: jest.fn().mockReturnValue(true),
        getDevicesOfType: jest.fn().mockReturnValue({})
      },
      settings: {
        get: jest.fn((key) => settingsStore[key]),
        set: jest.fn((key, value) => {
          settingsStore[key] = value;
        })
      }
    };
    driver.getDevice = jest.fn().mockReturnValue(mockHomeyDevice);
    driver.error = jest.fn();
  });

  test('should not log when debug logging is disabled', async () => {
    settingsStore.hdl_uv_debug = false;
    const signal = {
      sender: { subnet: 1, id: 42, type: 51 },
      data: { switch: 5, status: true }
    };
    await driver.updateValues(signal);
    expect(driver.homey.settings.set).not.toHaveBeenCalled();
  });

  test('should log accepted signals with sender, switch and note', async () => {
    const signal = {
      sender: { subnet: 1, id: 42, type: 51 },
      data: { switch: 5, status: true }
    };
    await driver.updateValues(signal);
    const log = settingsStore.hdl_uv_debug_log;
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      sender: '1.42',
      type: 51,
      switch: 5,
      status: true,
      note: 'accepted'
    });
  });

  test('should log filtered signals with the reason', async () => {
    const motionSignal = {
      sender: { subnet: 1, id: 42, type: 51 },
      data: { switch: 10, status: true }
    };
    const selfSignal = {
      sender: { subnet: 1, id: 100, type: 51 },
      data: { switch: 5, status: true }
    };
    await driver.updateValues(motionSignal);
    await driver.updateValues(selfSignal);
    const log = settingsStore.hdl_uv_debug_log;
    expect(log).toHaveLength(2);
    expect(log[0].note).toBe('ignored: motion universal switch');
    expect(log[1].note).toBe('ignored: from the app itself');
  });

  test('should log signals without data', async () => {
    const signal = { sender: { subnet: 1, id: 42, type: 51 } };
    await driver.updateValues(signal);
    const log = settingsStore.hdl_uv_debug_log;
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ sender: '1.42', note: 'ignored: no data' });
  });

  test('should log unknown switches as unpaired', async () => {
    driver.getDevice.mockReturnValue(undefined);
    const signal = {
      sender: { subnet: 1, id: 42, type: 51 },
      data: { switch: 5, status: true }
    };
    await driver.updateValues(signal);
    expect(settingsStore.hdl_uv_debug_log[0].note).toBe(
      'ignored: no paired device for this switch'
    );
  });

  test('should cap the log at 100 entries', async () => {
    settingsStore.hdl_uv_debug_log = Array.from({ length: 100 }, (_, i) => ({
      t: i,
      note: 'old'
    }));
    const signal = {
      sender: { subnet: 1, id: 42, type: 51 },
      data: { switch: 5, status: true }
    };
    await driver.updateValues(signal);
    const log = settingsStore.hdl_uv_debug_log;
    expect(log).toHaveLength(100);
    expect(log[99].note).toBe('accepted');
    expect(log[98].note).toBe('old');
  });
});

describe('UniversalSwitchDevice send modes', () => {
  const makeDevice = (settings) => {
    const device = new UniversalSwitchDevice({ id: '1.7', switch: 7 }, null);
    const controller = { send: jest.fn((options, callback) => callback()) };
    device._controller = jest.fn().mockReturnValue(controller);
    device.homey = {
      app: { log: jest.fn() },
      settings: { get: jest.fn((key) => settings[key]) }
    };
    return { device, controller };
  };

  const sentTargets = (controller) =>
    controller.send.mock.calls.map((call) => call[0].target);

  test('default (legacy) without logic controller sprays to all addresses', async () => {
    const { device, controller } = makeDevice({
      hdl_subnet: '1',
      hdl_id: '100'
    });
    await device.onCapabilityOnoff(true);
    const targets = sentTargets(controller);
    expect(targets[0]).toBe('255.255');
    expect(targets).toHaveLength(255);
    expect(targets.filter((t) => t === '1.100')).toHaveLength(0);
  });

  test('default (legacy) with logic controller sends broadcast plus controller only', async () => {
    const { device, controller } = makeDevice({
      hdl_subnet: '1',
      hdl_id: '100',
      hdl_logic_controller: '5'
    });
    await device.onCapabilityOnoff(true);
    expect(sentTargets(controller)).toEqual(['255.255', '1.5']);
  });

  test('logic mode sends broadcast plus the logic controller', async () => {
    const { device, controller } = makeDevice({
      hdl_subnet: '1',
      hdl_id: '100',
      hdl_logic_controller: '5',
      hdl_uv_send_mode: 'logic'
    });
    await device.onCapabilityOnoff(true);
    expect(sentTargets(controller)).toEqual(['255.255', '1.5']);
  });

  test('logic mode with invalid logic controller falls back to broadcast only', async () => {
    const { device, controller } = makeDevice({
      hdl_subnet: '1',
      hdl_id: '100',
      hdl_logic_controller: 'abc',
      hdl_uv_send_mode: 'logic'
    });
    await device.onCapabilityOnoff(true);
    expect(sentTargets(controller)).toEqual(['255.255']);
  });

  test('logic mode with empty logic controller falls back to broadcast only', async () => {
    const { device, controller } = makeDevice({
      hdl_subnet: '1',
      hdl_id: '100',
      hdl_logic_controller: '',
      hdl_uv_send_mode: 'logic'
    });
    await device.onCapabilityOnoff(true);
    expect(sentTargets(controller)).toEqual(['255.255']);
  });

  test('broadcast mode sends only the broadcast', async () => {
    const { device, controller } = makeDevice({
      hdl_subnet: '1',
      hdl_id: '100',
      hdl_logic_controller: '5',
      hdl_uv_send_mode: 'broadcast'
    });
    await device.onCapabilityOnoff(true);
    expect(sentTargets(controller)).toEqual(['255.255']);
  });

  test('spray mode matches the legacy default behavior', async () => {
    const { device, controller } = makeDevice({
      hdl_subnet: '1',
      hdl_id: '100',
      hdl_uv_send_mode: 'spray'
    });
    await device.onCapabilityOnoff(true);
    expect(sentTargets(controller)).toHaveLength(255);
  });

  test('sends the switch number and status in every message', async () => {
    const { device, controller } = makeDevice({
      hdl_subnet: '1',
      hdl_id: '100',
      hdl_logic_controller: '5',
      hdl_uv_send_mode: 'logic'
    });
    await device.onCapabilityOnoff(false);
    controller.send.mock.calls.forEach((call) => {
      expect(call[0].command).toBe(0xe01c);
      expect(call[0].data).toEqual({ switch: 7, status: false });
    });
  });
});
