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
    this.setCapabilityValue("onoff", !!pwr).catch(function () {
      //nothing
    });
  }

  updateValve(valve) {
    var x = valve ? "Open" : "Closed";
    this.setCapabilityValue("meter_valve", x).catch(function () {
      //nothing
    });
    var i = valve ? 1 : 0;
    this.setCapabilityValue("meter_valve_number", i).catch(function () {
      //nothing
    });
  }

  async requestUpdate() {
    this._controller().send({
      target: this.getData().address,
      command: 0x1C5E,
      data: {
        channel: this.getData().channel
      }
      }, (err) => {
        if (err) {
        this.homey.app.log(err);
        }
      }
    );

    this._controller().send({
      target: this.getData().address,
      command: 0xE3E7,
      data: {
        channel: this.getData().channel
      }
    }, (err) => {
      if (err) {
        this.homey.app.log(err);
      }
    });
  }

  _controller() {
    return this.homey.app.controller();
  }

  async onTemperatureChange(value, opts) {
    if (this.currentData == null){
      return; // No template data to send
    }

    this.currentData.watering = this.currentData.watering || {};
    this.currentData.work = this.currentData.work || {};
    this.currentData.temperature.normal = value;

    this._controller().send({
      target: this.getData().address,
      command: 0x1C5C,
      data: this.currentData
    },
    (err) => {
      if (err) {
        this.homey.app.log(err);
      }
    });
  }

  async onPowerSwitchChange(value, opts) {
    if (this.currentData == null){
      return; // No template data to send
    }

    this.currentData.watering = this.currentData.watering || {};
    this.currentData.work = this.currentData.work || {};
    this.currentData.work.status = value;

    this._controller().send({
      target: this.getData().address,
      command: 0x1C5C,
      data: this.currentData
    },
    (err) => {
      if (err) {
        this.homey.app.log(err);
      }
    });
  }
}

module.exports = FloorheaterDevice;
