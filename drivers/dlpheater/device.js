'use strict';
const { Device } = require('homey');
const { readState } = require('../../hdl/dlp-heater-protocol');
const { activeSetpoint } = require('../../hdl/dlp-heater-service');
const profiles = require('../../hdl/heater-models.json');

class DLPHeaterDevice extends Device {
  async onInit() {
    await this.setSettings({ hdl_address: this.getData().id }).catch(error => this.error(error));
    this._deleted = false;
    this._stopModeWatch?.();
    this._stopModeWatch = this.service().watchMode(async event => {
      if (this._deleted) return;
      const bus = this.homey.app.bus();
      const identity = this.service().modeIdentity();
      await this.driver.ready();
      if (!this._deleted && bus === this.homey.app.bus()
          && identity === this.service().modeIdentity())
        await this.driver.triggerModeChange(this, event);
    }, error => this.error(error));
    // Keep the existing thermostat initialization and protocol behavior.
    for (const capability of ['measure_temperature', 'onoff', 'hdl_heating_mode', 'hdl_active_setpoint']) {
      if (!this.hasCapability(capability)) await this.addCapability(capability);
    }
    if (this.getClass() !== 'thermostat') await this.setClass('thermostat');
    // The SHS app has one thermostat view; Normal presets use the Flow action.
    if (this.hasCapability('target_temperature')) await this.removeCapability('target_temperature');
    this.registerCapabilityListener('onoff', value => this.service().setPower(value));
    // Add capabilities, never remove or repurpose the legacy Normal capability.
    for (const capability of ['hdl_thermostat_mode', 'target_temperature.active', 'measure_temperature.active'])
      if (!this.hasCapability(capability)) await this.addCapability(capability);

    this.registerCapabilityListener('target_temperature.active', value => this.setActiveTemperature(value, { uiStep: true }));
    this.registerCapabilityListener('hdl_thermostat_mode', value => this.setMode(value));
    this._modeTitle = null;
    await this.setCapabilityOptions('target_temperature.active', { min: 5, max: 26, step: 1, decimals: 0,
      title: { en: 'Active setpoint', no: 'Aktivt setpunkt' } });
    await this.setCapabilityOptions('measure_temperature.active', { title: { en: 'Room temperature', no: 'Romtemperatur' } });

    await this.setUnavailable('Waiting for DLP status in Celsius.');
    await this.requestUpdate();
  }

  service() { return this.homey.app.dlpService(this.getData().id); }

  assertWritableModel() {
    if (this._deleted) throw new Error('The device has been deleted.');
    const found = Object.values(this.homey.app.getDevicesOfType('panel') || {})
      .find(d => `${Number(this.homey.settings.get('hdl_subnet'))}.${Number(d.id)}` === this.getData().id);
    const type = found?.type ?? this.getData().heaterType;
    const profile = profiles.find(p => p.type === Number(type));
    // Migrated devices keep their old capabilities and Normal listeners, but
    // new controls require a saved or freshly discovered documented model.
    if (!profile || !profile.heaterProtocol)
      throw new Error('Thermostat control is not supported for this panel model. No write sent.');
    return profile;
  }
  async setMode(value) {
    this.assertWritableModel();
    const state = await this.service().setMode(value);
    if (!this._deleted) await this.applyState(state);
    return true;
  }
  async setModeTemperature(mode, value) {
    this.assertWritableModel();
    const state = await this.service().setModeTemperature(mode, value);
    if (!this._deleted) await this.applyState(state);
    return true;
  }
  async setActiveTemperature(value, { uiStep = false } = {}) {
    this.assertWritableModel();
    if (!this._lastState) throw new Error('Wait for valid DLP status before changing the setpoint.');
    let expectedTemperature;
    // Some iOS thermostat controls ignore step:1 and send +/-0.5. Treat only
    // an adjacent half-step as one whole degree in that direction. Flow
    // actions retain strict integer validation; never encode half degrees.
    if (uiStep && Number.isFinite(value) && !Number.isInteger(value)) {
      const current = activeSetpoint(this._lastState);
      if (Number.isInteger(current) && Math.abs(value - current) === 0.5) {
        expectedTemperature = current;
        value = current + Math.sign(value - current);
      }
    }
    const state = await this.service().setActiveTemperature(value, this._lastState.mode, expectedTemperature);
    if (!this._deleted) await this.applyState(state);
    return true;
  }
  async pressButton(value) {
    const profile = this.assertWritableModel();
    if (profile && Number(value) > profile.buttons) throw new Error('The button is outside the supported range for this panel.');
    return this.service().pressButton(value);
  }
  async onDeleted() { this._stopModeWatch?.(); this._deleted = true; this.homey.app.cancelDlpRead?.(this); this.service().cancelHeaterOperation(); }
  async onUninit() { this._stopModeWatch?.(); this._deleted = true; this.homey.app.cancelDlpRead?.(this); this.service().cancelHeaterOperation(); }

  async requestUpdate({ periodic = false, throwOnError = false } = {}) {
    if (this._deleted) return;
    if (!this.homey.app.queueDlpRead && !this.homey.app.isBusConnected()) return;
    try {
      const state = this.homey.app.queueDlpRead
        ? await this.homey.app.queueDlpRead(this)
        : await this.service().readStatus({ retry: periodic });
      if (state && !this._deleted) await this.applyState(state);
      return Boolean(state);
    } catch (error) {
      if (this._deleted) return;
      this.error(error);
      await this.setUnavailable(error.message);
      if (throwOnError) throw error;
    }
  }

  async applyState(state) {
    if (this._deleted) return;
    this._lastState = state;

    await this.setCapabilityValue('onoff', state.power === 1);
    this._normalMode = state.mode === 1;
    const titles = {
      1: { en: 'Normal', no: 'Normal' },
      2: { en: 'Day', no: 'Dag' },
      3: { en: 'Night', no: 'Natt' },
      4: { en: 'Away', no: 'Borte' },
      5: { en: 'Timer', no: 'Timer' },
    };
    const language = this.homey?.i18n?.getLanguage?.();
    const modeTitle = titles[state.mode];
    const norwegian = ['no', 'nb', 'nn'].includes(language?.split('-')[0]);
    await this.setCapabilityValue('hdl_heating_mode', norwegian ? modeTitle.no : modeTitle.en);
    const active = activeSetpoint(state);
    await this.setCapabilityValue('hdl_active_setpoint', active === undefined ? null : active);
    // Timer remains observable in hdl_heating_mode, but is never a command.
    await this.setCapabilityValue('hdl_thermostat_mode', state.mode === 5 ? null : String(state.mode));
    await this.setCapabilityValue('target_temperature.active', active);
    if (Number.isFinite(state.actualTemperature) && this.homey.app.valueOK('temperature', state.actualTemperature)) {
      await this.setCapabilityValue('measure_temperature', state.actualTemperature);
      await this.setCapabilityValue('measure_temperature.active', state.actualTemperature);
    }
    await this.setAvailable();
    // Homey may hide the title for a single thermostat. Keep the mode picker
    // and read-only status as the reliable UI; only update metadata on change.
    if (this._modeTitle !== state.mode) {
      try {
        // Supply the full options again: a title-only update must never reset
        // the thermostat to the default half-degree step on a client.
        await this.setCapabilityOptions('target_temperature.active', {
          min: 5, max: 26, step: 1, decimals: 0, title: titles[state.mode],
        });
        this._modeTitle = state.mode;
      } catch (error) {
        // A display metadata failure must not hide valid panel status.
        this.error(error);
      }
    }
  }

  async updateFromSignal(signal) {
    if (this._deleted) return;
    // A write acknowledgement is not an observation of actual active mode.
    // The transaction service validates ACKs and applies its full readback.
    if (signal.code === 0x1947) return;
    const p = signal.payload;
    if (!Buffer.isBuffer(p)) return;
    if (signal.code === 0xe3d9) {
      // Incremental notifications do not prove the active mode. Refresh full
      // state instead, using the same per-device lock as writes and polling.
      if (p.length >= 2 && [0x14, 0x15, 0x19].includes(p[0])) await this.requestUpdate();
      return;
    }
    try {
      let state;
      if (signal.code === 0x1945) {
        state = readState(p, false);
        Object.defineProperty(state, 'timerPeriod', { value: p.length >= 9 && [0, 1].includes(p[8]) ? p[8] : null });
        // HDL's legacy temperature is sign-magnitude, not signed int8.
        const actual = (p[1] & 0x80 ? -1 : 1) * (p[1] & 0x7f);
        if (actual >= -40 && actual <= 80) {
          await this.setCapabilityValue('measure_temperature', actual);
          await this.setCapabilityValue('measure_temperature.active', actual);
        }
      } else if (signal.code === 0x1947) {
        if (p.length < 8 || p[0] !== 0xf8) return;
        state = readState(Buffer.from([p[1], 0, p[2], p[3], p[4], p[5], p[6], p[7]]), false);
      } else return;
      await this.applyState(state);
    } catch (error) {
      this._normalMode = false;
      await this.setUnavailable(error.message);
    }
  }
}
module.exports = DLPHeaterDevice;
