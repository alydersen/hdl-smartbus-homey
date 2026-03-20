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
});
