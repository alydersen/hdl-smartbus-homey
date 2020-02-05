"use strict";

const Homey = require("homey");

class RelayDevice extends Homey.Device {
  onInit() {
    this.log("Device init");
    this.log("Name:", this.getName());
    this.log("Class:", this.getClass());
    this.log("Id:", this.getData().id);
    this.log("Channel:", this.getData().channel);

    // register a capability listener
    this.registerCapabilityListener("onoff", this.onCapabilityOnoff.bind(this));
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
    } else {
      this._bus().send(this.getData().address, 0x0031, {
        channel: this.getData().channel,
        level: 0
      });
    }
  }
}

module.exports = RelayDevice;
