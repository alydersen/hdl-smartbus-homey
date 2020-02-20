"use strict";

const Homey = require("homey");

class DimmerDevice extends Homey.Device {
  onInit() {
    this.log("Device init");
    this.log("Name:", this.getName());
    this.log("Class:", this.getClass());
    this.log("Id:", this.getData().id);
    this.log("Channel:", this.getData().channel);

    // register a capability listener
    this.registerCapabilityListener("onoff", this.onCapabilityOnoff.bind(this));
    this.registerCapabilityListener("dim", this.onCapabilityDim.bind(this));

    // Ask for channel status
    if (Homey.app.isBusConnected()) {
      this._bus().send(this.getData().address, 0x0033);
    }
  }

  updateLevel(level) {
    let corrected_level = level / 100;
    this.setCapabilityValue("dim", corrected_level).catch(this.error);
    this.setCapabilityValue("onoff", corrected_level != 0).catch(this.error);
  }

  updateTrueFalse(status) {
    this.setCapabilityValue("onoff", status).catch(this.error);
  }

  _bus() {
    return Homey.app.bus();
  }

  async onCapabilityOnoff(value, opts) {
    if (value === true) {
      this._bus().send(this.getData().address, 0x0031, {
        channel: this.getData().channel,
        level: 100
      });
      this.setCapabilityValue("dim", 1).catch(this.error);
    } else {
      this._bus().send(this.getData().address, 0x0031, {
        channel: this.getData().channel,
        level: 0
      });
      this.setCapabilityValue("dim", 0).catch(this.error);
    }
  }

  async onCapabilityDim(value, opts) {
    this._bus().send(this.getData().address, 0x0031, {
      channel: this.getData().channel,
      level: value * 100
    });
    this.setCapabilityValue("onoff", value > 0).catch(this.error);
  }
}

module.exports = DimmerDevice;
