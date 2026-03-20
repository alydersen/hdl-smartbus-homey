'use strict';

const HDLSmartBus = require('../app');
const HdlDevicelist = require('../hdl/hdl_devicelist');

/**
 * Test suite for HDLSmartBus _signalReceived() signal routing
 */
describe('HDLSmartBus App - _signalReceived()', () => {
  let app;

  beforeEach(() => {
    app = new HDLSmartBus();
    app._hdlDevicelist = new HdlDevicelist();
    app._busConnected = true;
    app._hdlFoundUnits = {
      dimmer: {}, relay: {}, tempsensor: {}, multisensor: {},
      'dry-contact': {}, 'universal-switch': {}, floorheater: {},
      curtain: {}, panel: {}
    };
    app.log = jest.fn();
    app._updateDevice = jest.fn();
    app.homey = {
      settings: {
        get: jest.fn((key) => {
          if (key === 'hdl_subnet') return '1';
          return undefined;
        }),
        set: jest.fn()
      },
      drivers: { getDriver: jest.fn() },
      app: app
    };
  });

  describe('subnet filtering', () => {
    test('should accept signal from matching subnet', async () => {
      const signal = {
        sender: { subnet: 1, id: 42, type: 16 },
        data: { channel: 1, level: 50 }
      };
      await app._signalReceived(signal);
      expect(app._updateDevice).toHaveBeenCalledWith('dimmer', signal);
    });

    test('should accept signal from broadcast subnet 255', async () => {
      const signal = {
        sender: { subnet: 255, id: 42, type: 16 },
        data: { channel: 1, level: 50 }
      };
      await app._signalReceived(signal);
      expect(app._updateDevice).toHaveBeenCalledWith('dimmer', signal);
    });

    test('should reject signal from different subnet', async () => {
      const signal = {
        sender: { subnet: 2, id: 42, type: 16 },
        data: { channel: 1, level: 50 }
      };
      await app._signalReceived(signal);
      expect(app._updateDevice).not.toHaveBeenCalled();
    });
  });

  describe('device type routing', () => {
    test('should route dimmer signal to dimmer driver', async () => {
      const signal = {
        sender: { subnet: 1, id: 42, type: 16 },
        data: { channel: 1, level: 80 }
      };
      await app._signalReceived(signal);
      expect(app._updateDevice).toHaveBeenCalledWith('dimmer', signal);
    });

    test('should route relay signal to relay driver', async () => {
      const signal = {
        sender: { subnet: 1, id: 42, type: 150 },
        data: { channel: 1, level: 100 }
      };
      await app._signalReceived(signal);
      expect(app._updateDevice).toHaveBeenCalledWith('relay', signal);
    });

    test('should route tempsensor signal to tempsensor driver', async () => {
      const signal = {
        sender: { subnet: 1, id: 42, type: 124 },
        data: { temperature: 22.5, channel: 1 }
      };
      await app._signalReceived(signal);
      expect(app._updateDevice).toHaveBeenCalledWith('tempsensor', signal);
    });

    test('should route multisensor signal to multisensor driver', async () => {
      const signal = {
        sender: { subnet: 1, id: 42, type: 305 },
        data: { temperature: 22.5 }
      };
      await app._signalReceived(signal);
      expect(app._updateDevice).toHaveBeenCalledWith('multisensor', signal);
    });

    test('should route floorheater signal to floorheater driver', async () => {
      const signal = {
        sender: { subnet: 1, id: 42, type: 207 },
        data: { channel: 1 }
      };
      await app._signalReceived(signal);
      expect(app._updateDevice).toHaveBeenCalledWith('floorheater', signal);
    });

    test('should route panel signal to panel driver', async () => {
      const signal = {
        sender: { subnet: 1, id: 42, type: 48 },
        data: { temperature: 23.0 }
      };
      await app._signalReceived(signal);
      expect(app._updateDevice).toHaveBeenCalledWith('panel', signal);
    });

    test('should ignore signal from unknown device type', async () => {
      const signal = {
        sender: { subnet: 1, id: 42, type: 9999 },
        data: { something: true }
      };
      await app._signalReceived(signal);
      expect(app._updateDevice).not.toHaveBeenCalled();
    });
  });

  describe('universal switch handling', () => {
    test('should route universal switch signal to universal-switch driver', async () => {
      const signal = {
        sender: { subnet: 1, id: 42, type: 9999 },
        data: { switch: 5, status: true }
      };
      await app._signalReceived(signal);
      expect(app._updateDevice).toHaveBeenCalledWith('universal-switch', signal);
    });

    test('should route universal switch AND device type when both match', async () => {
      const signal = {
        sender: { subnet: 1, id: 42, type: 305 },
        data: { switch: 5, status: true, temperature: 22.5 }
      };
      await app._signalReceived(signal);
      expect(app._updateDevice).toHaveBeenCalledWith('universal-switch', signal);
      expect(app._updateDevice).toHaveBeenCalledWith('multisensor', signal);
    });

    test('should not route universal switch when switch field is missing', async () => {
      const signal = {
        sender: { subnet: 1, id: 42, type: 9999 },
        data: { status: true }
      };
      await app._signalReceived(signal);
      expect(app._updateDevice).not.toHaveBeenCalledWith('universal-switch', signal);
    });
  });

  describe('curtain special handling', () => {
    test('should allow curtain signals with undefined data', async () => {
      const signal = {
        sender: { subnet: 1, id: 42, type: 700 },
        get data() { throw new Error('no data'); }
      };
      await app._signalReceived(signal);
      expect(app._updateDevice).toHaveBeenCalledWith('curtain', signal);
    });

    test('should block non-curtain signals with undefined data', async () => {
      const signal = {
        sender: { subnet: 1, id: 42, type: 16 },
        get data() { throw new Error('no data'); }
      };
      await app._signalReceived(signal);
      expect(app._updateDevice).not.toHaveBeenCalledWith('dimmer', signal);
    });
  });

  describe('device discovery tracking', () => {
    test('should add sender to found units list', async () => {
      const signal = {
        sender: { subnet: 1, id: 42, type: 16 },
        data: { channel: 1, level: 50 }
      };
      await app._signalReceived(signal);
      expect(app._hdlFoundUnits.dimmer[42]).toBe(signal.sender);
    });

    test('should not track devices with undefined id', async () => {
      const signal = {
        sender: { subnet: 1, id: undefined, type: 16 },
        data: { channel: 1, level: 50 }
      };
      await app._signalReceived(signal);
      expect(app._updateDevice).not.toHaveBeenCalledWith('dimmer', signal);
    });
  });

  describe('onUninit cleanup', () => {
    test('should clear interval and close bus', async () => {
      const mockClose = jest.fn();
      app._bus = { close: mockClose };
      app._busConnected = true;
      app._updateInterval = setInterval(() => {}, 999999);

      await app.onUninit();

      expect(app._updateInterval).toBeNull();
      expect(app._bus).toBeNull();
      expect(app._busConnected).toBe(false);
      expect(mockClose).toHaveBeenCalled();
    });

    test('should handle already clean state', async () => {
      app._bus = null;
      app._updateInterval = null;
      app._busConnected = false;

      await app.onUninit();

      expect(app._bus).toBeNull();
      expect(app._busConnected).toBe(false);
    });
  });
});
