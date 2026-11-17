'use strict';

// Heater-only extension. The legacy parser, Normal Flow and Panel protocol
// remain unchanged. All services in this app share a transaction lock.
const { DlpHeaterProtocol, readState } = require('./dlp-heater-protocol');
const { ModeObserver } = require('./mode-observer');
const locks = new WeakMap();
const modeFields = { 1: 'normal', 2: 'day', 3: 'night', 4: 'away' };
function modeNumber(value, allowReportedTimer = false) {
  if (!(allowReportedTimer ? ['1', '2', '3', '4', '5'] : ['1', '2', '3', '4']).includes(String(value)))
    throw new Error('Choose Normal, Day, Night or Away.');
  return Number(value);
}
function parseStatus(payload) {
  const state = readState(payload, false);
  Object.defineProperty(state, 'timerPeriod', { value: payload.length >= 9 && [0, 1].includes(payload[8]) ? payload[8] : null });
  return state;
}
function activeSetpoint(state) {
  const field = modeFields[state.mode];
  return field ? state[field] : null;
}
class DlpHeaterService extends DlpHeaterProtocol {
  watchMode(deliver, report) {
    this._modeObserver?.reset();
    const observer = new ModeObserver(event => {
      if (observer.bus === this.app.bus() && observer.identity === this.modeIdentity()
          && this.app.isBusConnected()) return deliver(event);
    }, report);
    this._modeObserver = observer;
    return () => {
      observer.reset();
      if (this._modeObserver === observer) this._modeObserver = null;
    };
  }
  modeIdentity() {
    const c = this.app.controller();
    return [c.subnet, c.id, this.app.homey?.settings?.get('hdl_ip_address'),
      this.app.homey?.settings?.get('hdl_subnet')].join('|');
  }
  // Panel's unchanged button implementation uses the public busy flag. Bridge
  // that flag to the app-wide lock so buttons also serialize across addresses.
  get busy() { return Boolean(this._busy || (locks.has(this.app) && locks.get(this.app).owner !== this)); }
  set busy(value) {
    this._busy = value;
    if (value && this.app && !locks.has(this.app)) {
      this._externalLock = { owner: this };
      locks.set(this.app, this._externalLock);
    } else if (!value && this.app && locks.get(this.app) === this._externalLock) {
      locks.delete(this.app); this._externalLock = null;
    }
  }
  async transaction(operation, { read = false } = {}) {
    if (this.busy || locks.has(this.app)) {
      if (read) return null;
      throw new Error('A DLP operation is already in progress on the bus.');
    }
    if (!this.app.isBusConnected()) throw new Error('The HDL connection is not ready.');
    const token = { owner: this, epoch: this._cancelEpoch || 0 };
    locks.set(this.app, token);
    try { return await operation(); }
    finally { if (locks.get(this.app) === token) locks.delete(this.app); }
  }
  async setTemperature(value) { return this.transaction(() => super.setTemperature(value)); }
  async setPower(value) {
    if (typeof value !== 'boolean') throw new Error('Power must be a boolean.');
    await this.change({ power: value });
    return true;
  }
  async readStatus(options = {}) {
    return this.transaction(async () => {
      this.busy = true;
      const bus = this.app.bus();
      const epoch = this._cancelEpoch || 0;
      try {
        try { return await this.exchange(bus, 0x1944, Buffer.alloc(0), 0x1945, parseStatus); }
        catch (error) {
          if (!options.retry || epoch !== (this._cancelEpoch || 0) || bus !== this.app.bus() || !this.app.isBusConnected()) throw error;
          this.app.logDlpDebug?.(() => '[H005S] Background retry 1/1 (read only).');
          return await this.exchange(bus, 0x1944, Buffer.alloc(0), 0x1945, parseStatus);
        }
      } finally { this.busy = false; }
    }, { read: true });
  }
  // Cancellation is scoped to new Heater transactions; Panel's module is intact.
  exchange(...args) {
    const lock = locks.get(this.app);
    if (lock?.owner === this && lock.epoch !== undefined && lock.epoch !== (this._cancelEpoch || 0))
      return Promise.reject(new Error('The HDL device was stopped. No new command sent.'));
    const bus = args[0];
    const connection = this.app.bus();
    const epoch = this._cancelEpoch || 0;
    const identity = this.modeIdentity();
    const { EventEmitter } = require('node:events');
    const facade = new EventEmitter();
    const forward = signal => {
      // ACKs belonging to Setup/another app must not finish this transaction.
      if (signal.code === args[3] && signal.code !== 0x1945 && signal.target) {
        const c = this.app.controller();
        const directed = Number(signal.target.subnet) === Number(c.subnet) && Number(signal.target.id) === Number(c.id);
        const broadcast = Number(signal.target.subnet) === 255 && Number(signal.target.id) === 255;
        if (!directed && !broadcast) return;
      }
      facade.emit('command', signal);
    };
    const close = () => facade.emit('close');
    const fail = error => facade.emit('error', error);
    bus.on('command', forward); bus.on('close', close); bus.on('error', fail);
    const cancel = () => facade.emit('close');
    this._cancelPending = cancel;
    args[0] = facade;
    return super.exchange(...args).then(state => {
      // Hook every valid full read, including pre-write and legacy reads.
      // Never observe an ACK, a stale connection, or a cancelled operation.
      if (args[3] === 0x1945 && connection === this.app.bus()
          && epoch === (this._cancelEpoch || 0) && this.app.isBusConnected())
        this._modeObserver?.observe(state, connection, identity);
      return state;
    }).finally(() => {
      if (this._cancelPending === cancel) this._cancelPending = null;
      bus.removeListener('command', forward); bus.removeListener('close', close); bus.removeListener('error', fail);
    });
  }
  cancelHeaterOperation() {
    // Legacy exchange already removes listeners and cancels timeout on close.
    // Do not close the shared socket; a private facade supplies cancellation.
    this._cancelEpoch = (this._cancelEpoch || 0) + 1;
    this._cancelExchange?.();
    this._cancelPending?.();
  }
  async change({ mode, temperature, expectedMode, expectedTemperature, presetMode, power }) {
    const selectedPreset = presetMode === undefined ? undefined : modeNumber(presetMode);
    const requestedMode = mode === undefined ? undefined : modeNumber(mode);
    if (temperature !== undefined && (!Number.isInteger(temperature) || temperature < 5 || temperature > 26))
      throw new Error('Choose a whole number from 5 to 26 °C.');
    return this.transaction(async () => {
      this.busy = true;
      const bus = this.app.bus();
      let cancelled = false;
      // Facade cancellation invokes only this operation's exchange listeners.
      const { EventEmitter } = require('node:events');
      const facade = new EventEmitter();
      const forward = signal => facade.emit('command', signal);
      const close = () => facade.emit('close');
      const fail = error => facade.emit('error', error);
      bus.on('command', forward); bus.on('close', close); bus.on('error', fail);
      this._cancelExchange = () => { cancelled = true; facade.emit('close'); };
      const ready = () => {
        if (cancelled || bus !== this.app.bus() || !this.app.isBusConnected()) throw new Error('The HDL connection or device was stopped.');
      };
      const read = () => this.exchange(facade, 0x1944, Buffer.alloc(0), 0x1945, parseStatus);
      try {
        const before = await read(); ready();
        if (expectedMode !== undefined && before.mode !== modeNumber(expectedMode, true))
          throw new Error('The mode changed at the panel. Refresh the device before changing the setpoint. No write sent.');
        if (expectedTemperature !== undefined && activeSetpoint(before) !== expectedTemperature)
          throw new Error('The setpoint changed at the panel. Refresh the device before changing the temperature. No write sent.');
        const desired = { ...before };
        if (power !== undefined) {
          if (before.mode === 5) throw new Error('Power control is unavailable in Timer mode. Choose Normal, Day, Night or Away.');
          desired.power = power ? 1 : 0;
        }
        if (requestedMode !== undefined) desired.mode = requestedMode;
        if (temperature !== undefined) {
          const field = modeFields[selectedPreset ?? before.mode];
          if (!field) throw new Error('Timer has no setpoint. Choose a manual mode before changing the setpoint.');
          desired[field] = temperature;
        }
        if (Object.keys(desired).every(k => desired[k] === before[k])) return before;
        if (power !== undefined) {
          // Same dedicated power command already verified in Normal. Readback
          // must preserve the active mode and every preset in modes 1-4 too.
          await this.exchange(facade, 0xe3d8, Buffer.from([0x14, desired.power]), 0xe3d9,
            reply => { if (reply[1] !== desired.power) throw new Error('The DLP did not confirm the requested power state.'); },
            reply => reply.length >= 2 && reply[0] === 0x14);
        } else if (temperature === undefined) {
          // Protocol type 21 changes mode only; it never resends other presets.
          await this.exchange(facade, 0xe3d8, Buffer.from([0x15, desired.mode]), 0xe3d9,
            reply => { if (reply[1] !== desired.mode) throw new Error('The mode acknowledgement does not match.'); },
            reply => reply.length === 2 && reply[0] === 0x15);
        } else {
          // 1946 uses the freshly read presets. Extra 00 matches the existing
          // captured legacy implementation; no firmware/configuration write.
          const payload = Buffer.from([desired.unit, desired.power, desired.mode,
            desired.normal, desired.day, desired.night, desired.away, 0]);
          await this.exchange(facade, 0x1946, payload, 0x1947, reply => {
            if (reply.length < 8 || reply[0] !== 0xf8 || !reply.subarray(1, 8).equals(payload.subarray(0, 7)))
              throw new Error('The 0x1947 reply does not confirm the requested settings.');
          });
        }
        ready();
        let after = await read(); ready();
        if (Object.keys(desired).some(k => desired[k] !== after[k])) {
          // Bounded read-only verification retry, never repeat a write.
          after = await read(); ready();
        }
        const changed = Object.keys(desired).filter(k => desired[k] !== after[k]);
        if (changed.length) throw new Error(`Read-back mismatch (${changed.join(', ')}). The command was not repeated. Check the panel.`);
        return after;
      } finally {
        this._cancelExchange = null;
        bus.removeListener('command', forward); bus.removeListener('close', close); bus.removeListener('error', fail);
        this.busy = false;
      }
    });
  }
  setModeTemperature(mode, temperature) { return this.change({ presetMode: mode, temperature }); }
  setMode(mode) { return this.change({ mode }); }
  setActiveTemperature(temperature, expectedMode, expectedTemperature) {
    return this.change({ temperature, expectedMode, expectedTemperature });
  }
  pressButton(selection) {
    return this.transaction(async () => {
      const { EventEmitter } = require('node:events');
      const bus = this.app.bus(), facade = new EventEmitter();
      const forward = signal => facade.emit('command', signal);
      const close = () => facade.emit('close');
      const fail = error => facade.emit('error', error);
      bus.on('command', forward); bus.on('close', close); bus.on('error', fail);
      this._cancelExchange = close;
      const app = { log: (...args) => this.app.log(...args), logDlpDebug: message => this.app.logDlpDebug?.(message), bus: () => facade,
        controller: () => this.app.controller(), isBusConnected: () => this.app.isBusConnected(), dlpService: () => this };
      try { return await require('./dlp-buttons').pressButton(app, selection, 8000, this.target); }
      finally {
        this._cancelExchange = null;
        bus.removeListener('command', forward); bus.removeListener('close', close); bus.removeListener('error', fail);
      }
    });
  }
}
module.exports = { DlpHeaterService, parseStatus, activeSetpoint, modeNumber };
