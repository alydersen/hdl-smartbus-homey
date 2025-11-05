/**
 * Mock Homey module for testing
 * This simulates the Homey SDK API
 */

// Mock the base App class
class MockHomeyApp {
  constructor() {
    this.settings = new MockSettings();
    this.drivers = new MockDrivers();
    this.i18n = new MockI18n();
    this.log = jest.fn();
    this.error = jest.fn();
    this.warn = jest.fn();
  }
}

// Mock Settings manager
class MockSettings {
  constructor() {
    this._settings = {};
  }
  
  get(key) {
    return this._settings[key];
  }
  
  set(key, value) {
    this._settings[key] = value;
  }
}

// Mock Drivers manager
class MockDrivers {
  constructor() {
    this._drivers = {};
    this._driverNotInitialized = false; // For testing initialization errors
  }
  
  getDriver(name) {
    // Simulate "Driver Not Initialized" error when enabled
    if (this._driverNotInitialized) {
      throw new Error('Driver Not Initialized');
    }
    
    if (!this._drivers[name]) {
      this._drivers[name] = new MockDriver(name);
    }
    return this._drivers[name];
  }
}

// Mock Driver
class MockDriver {
  constructor(name) {
    this.name = name;
    this._devices = [];
  }
  
  getDevices() {
    return this._devices;
  }
  
  getDevice(signature) {
    return this._devices.find(d => d.getData().id === signature.id);
  }
}

// Mock I18n manager
class MockI18n {
  constructor() {
    this.translations = {};
  }
  
  __(key, tokens) {
    return key;
  }
}

// Mock Device class
class MockDevice {
  constructor(data, driver) {
    this._data = data;
    this.driver = driver;
    this.homey = { app: null };
  }
  
  getData() {
    return this._data;
  }
  
  getName() {
    return this._data.name || `Mock Device ${this._data.id}`;
  }
  
  getClass() {
    return 'mock_device';
  }
  
  hasCapability(capability) {
    return false;
  }
  
  async addCapability(capability) {
    return Promise.resolve();
  }
  
  async setCapabilityValue(capability, value) {
    return Promise.resolve();
  }
  
  async getCapabilityValue(capability) {
    return null;
  }
}

// Export mocks
const homey = {
  App: MockHomeyApp,
  Device: MockDevice,
  Driver: class MockDriverClass {
    constructor() {
      this.homey = { app: null };
    }
  }
};

// Add static properties for direct access
homey.settings = new MockSettings();

module.exports = homey;

