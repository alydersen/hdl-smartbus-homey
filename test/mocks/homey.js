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
  
  __(key, _tokens) {
    return key;
  }
}

// Mock Device class
class MockDevice {
  constructor(data, driver) {
    this._data = data;
    this.driver = driver;
    this.homey = { app: null };
    this._capabilities = new Set();
    this._capabilityValues = {};
    this._capabilityListeners = {};
    this._store = {};
    this._settings = {};
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
    return this._capabilities.has(capability);
  }
  
  async addCapability(capability) {
    this._capabilities.add(capability);
    return Promise.resolve();
  }
  
  async removeCapability(capability) {
    this._capabilities.delete(capability);
    return Promise.resolve();
  }

  registerCapabilityListener(capability, listener) {
    this._capabilityListeners[capability] = listener;
    return Promise.resolve();
  }

  registerMultipleCapabilityListener(capabilities, listener) {
    this._capabilityListeners[capabilities.join('+')] = listener;
    return Promise.resolve();
  }

  async setCapabilityOptions(_capability, _options) {
    return Promise.resolve();
  }
  
  async setCapabilityValue(capability, value) {
    this._capabilityValues[capability] = value;
    return Promise.resolve();
  }
  
  async getCapabilityValue(capability) {
    return Object.prototype.hasOwnProperty.call(this._capabilityValues, capability)
      ? this._capabilityValues[capability]
      : null;
  }

  async getSettings() {
    return this._settings;
  }

  async setSettings(settings) {
    this._settings = Object.assign({}, this._settings, settings);
    return Promise.resolve();
  }

  async getStoreValue(key) {
    return this._store[key];
  }

  async setStoreValue(key, value) {
    this._store[key] = value;
    return Promise.resolve();
  }

  // The real SDK provides these; tests can override with jest.fn()
  log() {}
  error() {}
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

