'use strict';

jest.mock('smart-bus', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
    controller: jest.fn().mockReturnValue({
      send: jest.fn((opts, cb) => { if (cb) cb(null); })
    })
  }));
});

const HDLSmartBus = require('../app');

/**
 * Test suite for HDLSmartBus connect() validation logic
 */
describe('HDLSmartBus App - connect()', () => {
  let app;
  let settings;

  beforeEach(() => {
    app = new HDLSmartBus();
    settings = {};
    app.homey = {
      settings: {
        get: jest.fn((key) => settings[key]),
        set: jest.fn((key, value) => { settings[key] = value; })
      },
      drivers: { getDriver: jest.fn() },
      app: app
    };
    app.log = jest.fn();
    app._bus = null;
    app._busConnected = false;
    app._updateInterval = null;
  });

  afterEach(() => {
    if (app._updateInterval) {
      clearInterval(app._updateInterval);
      app._updateInterval = null;
    }
  });

  describe('missing settings', () => {
    test('should return early when IP is undefined', async () => {
      settings.hdl_subnet = '1';
      settings.hdl_id = '100';
      await app.connect();
      expect(app._bus).toBeNull();
    });

    test('should return early when IP is empty', async () => {
      settings.hdl_ip_address = '';
      settings.hdl_subnet = '1';
      settings.hdl_id = '100';
      await app.connect();
      expect(app._bus).toBeNull();
    });

    test('should return early when subnet is undefined', async () => {
      settings.hdl_ip_address = '192.168.1.10';
      settings.hdl_id = '100';
      await app.connect();
      expect(app._bus).toBeNull();
    });

    test('should return early when id is undefined', async () => {
      settings.hdl_ip_address = '192.168.1.10';
      settings.hdl_subnet = '1';
      await app.connect();
      expect(app._bus).toBeNull();
    });
  });

  describe('universal motion default', () => {
    test('should set default motion to 212 when not configured', async () => {
      await app.connect();
      expect(app.homey.settings.set).toHaveBeenCalledWith('hdl_universal_motion', '212');
    });

    test('should set default motion to 212 when empty string', async () => {
      settings.hdl_universal_motion = '';
      await app.connect();
      expect(app.homey.settings.set).toHaveBeenCalledWith('hdl_universal_motion', '212');
    });

    test('should not overwrite existing motion setting', async () => {
      settings.hdl_universal_motion = '100';
      await app.connect();
      expect(app.homey.settings.set).not.toHaveBeenCalledWith('hdl_universal_motion', expect.anything());
    });
  });

  describe('IP validation', () => {
    beforeEach(() => {
      settings.hdl_subnet = '1';
      settings.hdl_id = '100';
    });

    test('should reject non-IP strings', async () => {
      settings.hdl_ip_address = 'not-an-ip';
      await app.connect();
      expect(app._bus).toBeNull();
    });

    test('should reject IP with too few octets', async () => {
      settings.hdl_ip_address = '192.168.1';
      await app.connect();
      expect(app._bus).toBeNull();
    });

    test('should reject IP with octet > 255', async () => {
      settings.hdl_ip_address = '192.168.1.256';
      await app.connect();
      expect(app._bus).toBeNull();
    });

    test('should reject IP with negative octet', async () => {
      settings.hdl_ip_address = '192.168.-1.1';
      await app.connect();
      expect(app._bus).toBeNull();
    });
  });

  describe('subnet validation', () => {
    beforeEach(() => {
      settings.hdl_ip_address = '192.168.1.10';
      settings.hdl_id = '100';
    });

    test('should reject subnet 0', async () => {
      settings.hdl_subnet = '0';
      await app.connect();
      expect(app._bus).toBeNull();
    });

    test('should reject subnet 255', async () => {
      settings.hdl_subnet = '255';
      await app.connect();
      expect(app._bus).toBeNull();
    });

    test('should reject non-numeric subnet', async () => {
      settings.hdl_subnet = 'abc';
      await app.connect();
      expect(app._bus).toBeNull();
    });

    test('should accept subnet 1', async () => {
      settings.hdl_subnet = '1';
      await app.connect();
      expect(app._bus).not.toBeNull();
    });

    test('should accept subnet 254', async () => {
      settings.hdl_subnet = '254';
      await app.connect();
      expect(app._bus).not.toBeNull();
    });
  });

  describe('ID validation', () => {
    beforeEach(() => {
      settings.hdl_ip_address = '192.168.1.10';
      settings.hdl_subnet = '1';
    });

    test('should reject ID 0', async () => {
      settings.hdl_id = '0';
      await app.connect();
      expect(app._bus).toBeNull();
    });

    test('should reject ID 255', async () => {
      settings.hdl_id = '255';
      await app.connect();
      expect(app._bus).toBeNull();
    });

    test('should accept valid ID', async () => {
      settings.hdl_id = '100';
      await app.connect();
      expect(app._bus).not.toBeNull();
      expect(app._busConnected).toBe(true);
    });
  });

  describe('reconnection', () => {
    test('should close existing bus before reconnecting', async () => {
      const mockClose = jest.fn();
      app._bus = { close: mockClose };
      app._busConnected = true;

      settings.hdl_ip_address = '192.168.1.10';
      settings.hdl_subnet = '1';
      settings.hdl_id = '100';

      await app.connect();
      expect(mockClose).toHaveBeenCalled();
    });

    test('should clear existing update interval on reconnect', async () => {
      const mockInterval = setInterval(() => {}, 999999);
      app._updateInterval = mockInterval;

      settings.hdl_ip_address = '192.168.1.10';
      settings.hdl_subnet = '1';
      settings.hdl_id = '100';

      await app.connect();
      // Old interval should have been cleared, new one set
      expect(app._updateInterval).not.toBe(mockInterval);
      expect(app._updateInterval).not.toBeNull();
      clearInterval(mockInterval);
    });
  });

  describe('poll interval setting', () => {
    beforeEach(() => {
      settings.hdl_ip_address = '192.168.1.10';
      settings.hdl_subnet = '1';
      settings.hdl_id = '100';
    });

    test('should set default poll interval to 60 when not configured', async () => {
      await app.connect();
      expect(app.homey.settings.set).toHaveBeenCalledWith('hdl_poll_interval', '60');
    });

    test('should not overwrite existing poll interval', async () => {
      settings.hdl_poll_interval = '30';
      await app.connect();
      expect(app.homey.settings.set).not.toHaveBeenCalledWith('hdl_poll_interval', expect.anything());
    });

    test('should use the configured poll interval', async () => {
      const spy = jest.spyOn(global, 'setInterval');
      settings.hdl_poll_interval = '30';
      await app.connect();
      expect(spy).toHaveBeenCalledWith(expect.any(Function), 30000);
      expect(app._pollIntervalMs).toBe(30000);
      spy.mockRestore();
    });

    test('should fall back to 60 seconds when below the minimum', async () => {
      const spy = jest.spyOn(global, 'setInterval');
      settings.hdl_poll_interval = '5';
      await app.connect();
      expect(spy).toHaveBeenCalledWith(expect.any(Function), 60000);
      spy.mockRestore();
    });

    test('should fall back to 60 seconds when above the maximum', async () => {
      const spy = jest.spyOn(global, 'setInterval');
      settings.hdl_poll_interval = '700';
      await app.connect();
      expect(spy).toHaveBeenCalledWith(expect.any(Function), 60000);
      spy.mockRestore();
    });

    test('should fall back to 60 seconds when not a number', async () => {
      const spy = jest.spyOn(global, 'setInterval');
      settings.hdl_poll_interval = 'abc';
      await app.connect();
      expect(spy).toHaveBeenCalledWith(expect.any(Function), 60000);
      spy.mockRestore();
    });
  });

  describe('callForUpdate staggering', () => {
    let devicesByDriver;

    beforeEach(() => {
      // onInit() is not called in these tests, so mirror its state
      app._driverlist = [
        'dimmer', 'relay', 'tempsensor', 'multisensor', 'dry-contact',
        'universal-switch', 'floorheater', 'curtain', 'panel'
      ];
      app._updateTimeouts = [];
      devicesByDriver = {};
      app.homey.drivers.getDriver = jest.fn((name) => ({
        getDevices: () => devicesByDriver[name] || []
      }));
    });

    test('should stagger requests evenly across the poll interval', async () => {
      jest.useFakeTimers();
      const relayDevice = { requestUpdate: jest.fn() };
      const dimmerDevices = [{ requestUpdate: jest.fn() }, { requestUpdate: jest.fn() }];
      devicesByDriver['relay'] = [relayDevice];
      devicesByDriver['dimmer'] = dimmerDevices;
      app._pollIntervalMs = 60000;

      await app.callForUpdate(app._bus);

      // Nothing is sent as one burst: three requests are scheduled
      const all = [relayDevice, ...dimmerDevices];
      all.forEach((device) => expect(device.requestUpdate).not.toHaveBeenCalled());
      expect(app._updateTimeouts.length).toBe(3);

      // First request fires right away, the others follow at even spacing.
      // Devices are collected in driverlist order (dimmer before relay)
      jest.advanceTimersByTime(1);
      expect(dimmerDevices[0].requestUpdate).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(20000);
      expect(dimmerDevices[1].requestUpdate).toHaveBeenCalledTimes(1);
      expect(relayDevice.requestUpdate).not.toHaveBeenCalled();

      jest.advanceTimersByTime(20000);
      expect(relayDevice.requestUpdate).toHaveBeenCalledTimes(1);
      expect(app._updateTimeouts.length).toBe(0);
      jest.useRealTimers();
    });

    test('should not schedule anything when there are no devices', async () => {
      jest.useFakeTimers();
      await app.callForUpdate(app._bus);
      expect(app._updateTimeouts.length).toBe(0);
      jest.useRealTimers();
    });

    test('should cancel pending requests through _clearUpdateTimeouts', async () => {
      jest.useFakeTimers();
      const device = { requestUpdate: jest.fn() };
      devicesByDriver['relay'] = [device];
      app._pollIntervalMs = 60000;

      await app.callForUpdate(app._bus);
      app._clearUpdateTimeouts();

      jest.advanceTimersByTime(60000);
      expect(device.requestUpdate).not.toHaveBeenCalled();
      expect(app._updateTimeouts.length).toBe(0);
      jest.useRealTimers();
    });
  });
});
