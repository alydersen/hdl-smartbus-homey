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
    if (value < 0.01) {
      this.setCapabilityValue("onoff", false).catch(this.error);
    } else {
      this.setCapabilityValue("onoff", true).catch(this.error);
    }
  }
}

module.exports = DimmerDevice;
