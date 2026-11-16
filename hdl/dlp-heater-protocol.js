'use strict';

// Experimental DLP 1.103 support, based on the user's T4a/T4b captures.
const TARGET = '1.103';

function readState(payload, requireNormal = true) {
  if (!Buffer.isBuffer(payload) || payload.length < 8) {
    throw new Error('Incomplete DLP status (0x1945). No write sent.');
  }
  const state = {
    unit: payload[0], power: payload[2], mode: payload[3],
    normal: payload[4], day: payload[5], night: payload[6], away: payload[7],
  };
  if (state.unit !== 0 || !Number.isInteger(state.mode) || state.mode < 1 || state.mode > 5 || ![0, 1].includes(state.power)
      || [state.normal, state.day, state.night, state.away]
        .some(value => value < 5 || value > 35)) {
    throw new Error('Invalid DLP status. Check that the panel uses Celsius.');
  }
  if (requireNormal && state.mode !== 1) throw new Error('This operation requires Normal mode. No write sent.');
  return state;
}

function buildPayload(state, temperature) {
  if (!Number.isInteger(temperature) || temperature < 5 || temperature > 26) {
    throw new Error('Choose a whole number from 5 to 26 °C.');
  }
  // Byte 8 is deliberately 00, matching Setup in T4a/T4b. Meaning unknown.
  // No CRC bytes here: smart-bus constructs the complete packet.
  return Buffer.from([state.unit, state.power, state.mode, temperature,
    state.day, state.night, state.away, 0x00]);
}

function assertState(expected, actual, app) {
  const names = { unit: 'temperature unit', power: 'power', mode: 'mode',
    normal: 'Normal setpoint', day: 'Day', night: 'Night', away: 'Away' };
  const differences = Object.keys(expected).filter(key => actual[key] !== expected[key]);
  if (!differences.length) return;
  const detail = differences.map(key => `${names[key]}: expected ${expected[key]}, read ${actual[key]}`).join('; ');
  app.log(`[H005S] Read-back mismatch: ${detail}`);
  throw new Error(`Read-back mismatch: ${detail}. Check the panel before retrying.`);
}

class DlpHeaterProtocol {
  constructor(app, timeoutMs = 5000, target = TARGET) {
    this.app = app;
    if (!/^(?:[1-9]\d{0,2})\.(?:[1-9]\d{0,2})$/.test(target)
        || target.split('.').some(value => Number(value) > 254)) throw new Error('Invalid HDL address.');
    this.target = target;
    this.timeoutMs = timeoutMs;
    this.busy = false;
    this.exchangeSequence = 0;
  }

  exchange(bus, command, payload, responseCode, check, accept = () => true) {
    return new Promise((resolve, reject) => {
      const trace = `${this.target} #${++this.exchangeSequence}`;
      const started = Date.now();
      const controller = this.app.controller();
      const ownSubnet = Number(controller.subnet);
      const ownId = Number(controller.id);
      if (!Number.isInteger(ownSubnet) || !Number.isInteger(ownId)) {
        reject(new Error('The app HDL source address is not ready.'));
        return;
      }
      let finished = false;
      let timer;
      const finish = (error, result) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        bus.removeListener('command', listener);
        bus.removeListener('close', onClose);
        bus.removeListener('error', onError);
        if (error) reject(error); else resolve(result);
      };
      const onClose = () => finish(new Error('The HDL connection closed.'));
      const onError = error => finish(error);
      const listener = signal => {
        if (!signal.sender || `${Number(signal.sender.subnet)}.${Number(signal.sender.id)}` !== this.target
            || signal.code !== responseCode) return;
        // 1945 is a directed read reply. Replies to Setup or the original app
        // must never complete this app's outstanding status request.
        if (responseCode === 0x1945 && (!signal.target
            || Number(signal.target.subnet) !== ownSubnet
            || Number(signal.target.id) !== ownId)) return;
        try {
          const reply = signal.payload;
          if (!Buffer.isBuffer(reply)) throw new Error('The DLP reply has no raw payload.');
          if (!accept(reply)) return;
          this.app.logDlpDebug?.(() => `[H005S ${trace} +${Date.now() - started}ms] RX ${responseCode.toString(16)} to ${signal.target?.subnet}.${signal.target?.id} ${reply.toString('hex')}`);
          const checked = check(reply);
          if (checked && typeof checked === 'object' && responseCode === 0x1945)
            Object.defineProperty(checked, 'actualTemperature', { value: (reply[1] & 0x80 ? -1 : 1) * (reply[1] & 0x7f), enumerable: false });
          finish(null, checked);
        } catch (error) { finish(error); }
      };
      bus.on('command', listener);
      bus.on('close', onClose);
      bus.on('error', onError);
      timer = setTimeout(() => finish(new Error(
        `No acknowledgement (${responseCode.toString(16)}) innen ${this.timeoutMs} ms. `
        + 'If a write was sent, the setting may have changed. Check the panel before retrying.'
      )), this.timeoutMs);
      try {
        this.app.logDlpDebug?.(() => `[H005S ${trace}] TX ${command.toString(16)} from ${ownSubnet}.${ownId} ${payload.toString('hex')}`);
        controller.send({ target: this.target, command, payload }, error => {
          if (error) finish(error);
        });
      } catch (error) { finish(error); }
    });
  }

  async setTemperature(temperature) {
    if (!Number.isInteger(temperature) || temperature < 5 || temperature > 26) {
      throw new Error('Choose a whole number from 5 to 26 °C.');
    }
    if (this.busy) throw new Error('A DLP operation is already in progress.');
    if (!this.app.isBusConnected()) throw new Error('The HDL connection is not ready.');
    this.busy = true;
    let writeAttempted = false;
    try {
      const bus = this.app.bus();
      const before = await this.exchange(bus, 0x1944, Buffer.alloc(0), 0x1945, readState);
      if (bus !== this.app.bus() || !this.app.isBusConnected()) {
        throw new Error('The HDL connection changed. No write sent.');
      }
      const payload = buildPayload(before, temperature);
      writeAttempted = true;
      await this.exchange(bus, 0x1946, payload, 0x1947, reply => {
        if (reply.length < 8 || reply[0] !== 0xf8) {
          throw new Error('The DLP did not return a successful 0x1947 acknowledgement.');
        }
        if (!reply.subarray(1, 8).equals(payload.subarray(0, 7))) {
          throw new Error('The 0x1947 reply does not match the requested settings.');
        }
        // The trailing response fields are undocumented and are not proven
        // echoes of command byte 8. Keep them for analysis, not validation.
        this.app.logDlpDebug?.(() => `[H005S] Additional 0x1947 data (unknown): ${reply.subarray(8).toString('hex')}`);
      });
      if (bus !== this.app.bus() || !this.app.isBusConnected()) {
        throw new Error('The HDL connection changed before read-back.');
      }
      let after = await this.exchange(bus, 0x1944, Buffer.alloc(0), 0x1945, readState);
      const expected = { ...before, normal: temperature };
      this.app.logDlpDebug?.(() => `[H005S] Temperature check expected=${JSON.stringify(expected)} actual=${JSON.stringify(after)}`);
      if (after.normal !== expected.normal
          && Object.keys(expected).every(key => key === 'normal' || after[key] === expected[key])) {
        this.app.logDlpDebug?.(() => '[H005S] Normal mismatch: reading again after 300 ms; no new write.');
        await new Promise(resolve => setTimeout(resolve, 300));
        if (bus !== this.app.bus() || !this.app.isBusConnected()) throw new Error('The HDL connection changed.');
        after = await this.exchange(bus, 0x1944, Buffer.alloc(0), 0x1945, readState);
        this.app.logDlpDebug?.(() => `[H005S] Temperature recheck actual=${JSON.stringify(after)}`);
      }
      assertState(expected, after, this.app);
      this.app.logDlpDebug?.(() => `[H005S] Confirmed ${temperature} °C on ${this.target}; other known settings are unchanged.`);
      return true;
    } catch (error) {
      this.app.log(`[H005S] ${writeAttempted ? 'Write attempted; check the panel' : 'No write sent'}: ${error.message}`);
      throw error;
    } finally { this.busy = false; }
  }

  async readStatus({ retry = false } = {}) {
    if (this.busy) return null;
    if (!this.app.isBusConnected()) throw new Error('The HDL connection is not ready.');
    this.busy = true;
    try {
      const bus = this.app.bus();
      try {
        return await this.exchange(bus, 0x1944, Buffer.alloc(0), 0x1945, reply => readState(reply, false));
      } catch (error) {
        if (!retry) throw error;
        this.app.logDlpDebug?.(() => `[H005S ${this.target}] Background read failed: ${error.message}; retry 1/1.`);
        if (bus !== this.app.bus() || !this.app.isBusConnected()) throw error;
        try {
          const state = await this.exchange(bus, 0x1944, Buffer.alloc(0), 0x1945, reply => readState(reply, false));
          this.app.logDlpDebug?.(() => `[H005S ${this.target}] Background retry 1/1 succeeded.`);
          return state;
        } catch (retryError) {
          this.app.log(`[H005S ${this.target}] Background retry 1/1 failed: ${retryError.message}`);
          throw retryError;
        }
      }
    } finally { this.busy = false; }
  }

  async setPower(value) {
    if (typeof value !== 'boolean') throw new Error('Power must be a boolean.');
    if (this.busy) throw new Error('A DLP operation is already in progress.');
    if (!this.app.isBusConnected()) throw new Error('The HDL connection is not ready.');
    this.busy = true;
    try {
      const bus = this.app.bus();
      const before = await this.exchange(bus, 0x1944, Buffer.alloc(0), 0x1945, readState);
      if (bus !== this.app.bus() || !this.app.isBusConnected()) throw new Error('The HDL connection changed.');
      // T3 confirmed E3D8 key 14 as thermostat power, separate from relay output.
      await this.exchange(bus, 0xe3d8, Buffer.from([0x14, value ? 1 : 0]), 0xe3d9, reply => {
        if (reply.length < 2 || reply[1] !== (value ? 1 : 0)) throw new Error('The DLP did not confirm the requested power state.');
      }, reply => reply.length > 0 && reply[0] === 0x14);
      if (bus !== this.app.bus() || !this.app.isBusConnected()) throw new Error('The HDL connection changed.');
      let after = await this.exchange(bus, 0x1944, Buffer.alloc(0), 0x1945, readState);
      const expected = { ...before, power: value ? 1 : 0 };
      this.app.logDlpDebug?.(() => `[H005S] Power check expected=${JSON.stringify(expected)} actual=${JSON.stringify(after)}`);
      // One read-only retry for an isolated power mismatch. This does not
      // establish why the first reply was stale, and never repeats the write.
      if (after.power !== expected.power
          && Object.keys(expected).every(key => key === 'power' || after[key] === expected[key])) {
        this.app.logDlpDebug?.(() => '[H005S] Power mismatch: reading again after 300 ms; no new write.');
        await new Promise(resolve => setTimeout(resolve, 300));
        if (bus !== this.app.bus() || !this.app.isBusConnected()) throw new Error('The HDL connection changed.');
        after = await this.exchange(bus, 0x1944, Buffer.alloc(0), 0x1945, readState);
        this.app.logDlpDebug?.(() => `[H005S] Power recheck actual=${JSON.stringify(after)}`);
      }
      assertState(expected, after, this.app);
      return true;
    } finally { this.busy = false; }
  }
}

module.exports = { DlpHeaterProtocol, readState, buildPayload };
