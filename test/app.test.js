const HDLSmartBus = require('../app');

/**
 * Test suite for HDLSmartBus App
 * These tests verify critical validation and configuration logic
 */
describe('HDLSmartBus App', () => {
  let app;

  beforeEach(() => {
    // Create a fresh app instance for each test
    app = new HDLSmartBus();
    app.homey = {
      settings: {
        get: jest.fn(),
        set: jest.fn()
      },
      drivers: {
        getDriver: jest.fn()
      },
      app: app
    };
  });

  describe('valueOK validation', () => {
    test('should reject undefined values', () => {
      expect(app.valueOK('temperature', undefined)).toBe(false);
      expect(app.valueOK('humidity', undefined)).toBe(false);
      expect(app.valueOK('lux', undefined)).toBe(false);
    });

    test('should validate temperature correctly', () => {
      expect(app.valueOK('temperature', 20)).toBe(true);
      expect(app.valueOK('temperature', -40)).toBe(true);
      expect(app.valueOK('temperature', 80)).toBe(true);
      expect(app.valueOK('temperature', -41)).toBe(false);
      expect(app.valueOK('temperature', 81)).toBe(false);
      expect(app.valueOK('temperature', 'not a number')).toBe(false);
    });

    test('should validate humidity correctly', () => {
      expect(app.valueOK('humidity', 50)).toBe(true);
      expect(app.valueOK('humidity', 0)).toBe(true);
      expect(app.valueOK('humidity', 100)).toBe(true);
      expect(app.valueOK('humidity', -1)).toBe(false);
      expect(app.valueOK('humidity', 101)).toBe(false);
      expect(app.valueOK('humidity', 'not a number')).toBe(false);
    });

    test('should validate lux correctly', () => {
      expect(app.valueOK('lux', 500)).toBe(true);
      expect(app.valueOK('lux', 0)).toBe(true);
      expect(app.valueOK('lux', 100000)).toBe(true);
      expect(app.valueOK('lux', -1)).toBe(false);
      expect(app.valueOK('lux', 100001)).toBe(false);
      expect(app.valueOK('lux', 'not a number')).toBe(false);
    });
  });

  describe('devSignChnld', () => {
    beforeEach(() => {
      app.homey.settings.get.mockReturnValue('1');
    });

    test('should create correct device signature', () => {
      const signature = app.devSignChnld('42', 3);
      expect(signature).toEqual({
        id: '1.42.3',
        address: '1.42',
        channel: 3
      });
    });
  });

  describe('isBusConnected', () => {
    test('should return false when bus is null', () => {
      app._bus = null;
      expect(app.isBusConnected()).toBe(false);
    });

    test('should return true when bus is connected', () => {
      app._bus = { mock: true };
      app._busConnected = true;
      expect(app.isBusConnected()).toBe(true);
    });

    test('should return false when bus exists but not connected', () => {
      app._bus = { mock: true };
      app._busConnected = false;
      expect(app.isBusConnected()).toBe(false);
    });
  });

  describe('_updateDevice error handling', () => {
    beforeEach(() => {
      app.homey.settings.get.mockReturnValue('1');
      app.log = jest.fn();
    });

    test('should silently handle Driver Not Initialized errors', async () => {
      // Mock driver to throw "Driver Not Initialized" error
      const mockDriver = {
        updateValues: jest.fn().mockRejectedValue(new Error('Driver Not Initialized'))
      };
      app.homey.drivers.getDriver = jest.fn().mockReturnValue(mockDriver);

      const signal = { code: 0x01, sender: { id: '123' } };
      await app._updateDevice('tempsensor', signal);

      // Should not log the error
      expect(app.log).not.toHaveBeenCalled();
      expect(mockDriver.updateValues).toHaveBeenCalled();
    });

    test('should silently handle invalid device errors', async () => {
      const mockDriver = {
        updateValues: jest.fn().mockRejectedValue(new Error('invalid_device'))
      };
      app.homey.drivers.getDriver = jest.fn().mockReturnValue(mockDriver);

      const signal = { code: 0x01, sender: { id: '123' } };
      await app._updateDevice('tempsensor', signal);

      expect(app.log).not.toHaveBeenCalled();
    });

    test('should log unexpected errors', async () => {
      const mockDriver = {
        updateValues: jest.fn().mockRejectedValue(new Error('Something went wrong'))
      };
      app.homey.drivers.getDriver = jest.fn().mockReturnValue(mockDriver);

      const signal = { code: 0x01, sender: { id: '123' } };
      await app._updateDevice('tempsensor', signal);

      expect(app.log).toHaveBeenCalledWith('Error for tempsensor 123: Something went wrong');
    });

    test('should skip discovery signals', async () => {
      const mockDriver = {
        updateValues: jest.fn()
      };
      app.homey.drivers.getDriver = jest.fn().mockReturnValue(mockDriver);

      const signal = { code: 0xF, sender: { id: '123' } };
      await app._updateDevice('tempsensor', signal);

      expect(mockDriver.updateValues).not.toHaveBeenCalled();
    });
  });
});

