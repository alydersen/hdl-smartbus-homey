'use strict';

const Homey = require("homey");

class FloorheaterDevice extends Homey.Device {
  currentData = null;

  async onInit() {
    this.homey.app.log(`Initated "${this.getName()}" (Floor Heater/${this.getClass()}) ${this.getData().id}`);
 
    // register a capability listener
    this.registerCapabilityListener("target_temperature", this.onTemperatureChange.bind(this));
    this.registerCapabilityListener("onoff", this.onPowerSwitchChange.bind(this));

    // Ask for channel status
    if (this.homey.app.isBusConnected()) {
      await this.requestUpdate();
    }
  }

  updateLevel(level) {
    this.setCapabilityValue("target_temperature", level).catch(this.error);
  }

  updateTemperature(temperature) {
    // invalid_capability 
    this.setCapabilityValue("measure_temperature", temperature).catch(this.error);
  }

  updatePowerSwitch(pwr) {
    this.setCapabilityValue("onoff", !!pwr).catch(() => {
      // nothing
    });
  }

  updateValve(valve) {
    const label = valve ? "Open" : "Closed";
    const numeric = valve ? 1 : 0;
    this.setCapabilityValue("meter_valve", label).catch(() => {
      // nothing
    });
    this.setCapabilityValue("meter_valve_number", numeric).catch(() => {
      // nothing
    });
  }

  async requestUpdate() {
    if (!this.homey.app.isBusConnected()) return;

    const payload = { channel: this.getData().channel };
    await Promise.all([
      this._sendCommand(0x1C5E, payload),
      this._sendCommand(0xE3E7, payload)
    ]);
  }

  _controller() {
    return this.homey.app.controller();
  }

  async onTemperatureChange(value, opts) {
    if (this.currentData == null) {
      return; // No template data to send
    }

    this.currentData.temperature = this.currentData.temperature || {};
    this.currentData.watering = this.currentData.watering || {};
    this.currentData.work = this.currentData.work || {};
    this.currentData.temperature.normal = value;

    await this._sendCommand(0x1C5C, this.currentData);
  }

  async onPowerSwitchChange(value, opts) {
    if (this.currentData == null) {
      return; // No template data to send
    }

    this.currentData.temperature = this.currentData.temperature || {};
    this.currentData.watering = this.currentData.watering || {};
    this.currentData.work = this.currentData.work || {};
    this.currentData.work.status = value;

    await this._sendCommand(0x1C5C, this.currentData);
  }

  async _sendCommand(command, data) {
    const controller = this._controller();
    if (!controller) return;

    await new Promise((resolve) => {
      controller.send(
        {
          target: this.getData().address,
          command,
          data
        },
        (err) => {
          if (err) {
            this.homey.app.log(err);
          }
          resolve();
        }
      );
    });
  }
}

module.exports = FloorheaterDevice;
