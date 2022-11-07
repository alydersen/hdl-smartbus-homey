'use strict';

const Homey = require("homey");

class DimmerDevice extends Homey.Device {

  _controller() {
    return this.homey.app.controller();
  }

  async onInit() {
    this.homey.app.log(`Initated "${this.getName()}" (Dimmer/${this.getClass()}) ${this.getData().id}`);
 
    // register a capability listener
    this.registerCapabilityListener("onoff", this.onCapabilityOnoff.bind(this));
    this.registerCapabilityListener("dim", this.onCapabilityDim.bind(this));

    // Ask for channel status
    if (this.homey.app.isBusConnected()) { this.requestUpdate() }
  }

  async updateHomeyLevel(level) {
    var corrected_level = level / 100;
    this.setCapabilityValue("dim", corrected_level).catch(this.error);
    this.setCapabilityValue("onoff", corrected_level != 0).catch(this.error);
  }

  async requestUpdate() {
    this._controller().send(
      { target: this.getData().address, command: 0x0033 },
      function(err) {
        if (err) {
          this.homey.app.log(err);
        }
      }
    );
  }

  async updateDeviceByBus(level) {
    this._controller().send(
      {
        target: this.getData().address,
        command: 0x0031,
        data: {
          channel: this.getData().channel,
          level: level
        }
      },
      function(err) {
        if (err) {
          this.homey.app.log(err);
        }
      }
    );
  }

  async onCapabilityOnoff(value, opts) {
    let level = value === true ? 100 : 0;
    let dimlevel = value === true ? 1 : 0;
    this.updateDeviceByBus(level);
    this.setCapabilityValue("dim", dimlevel).catch(this.error);
  }

  async onCapabilityDim(value, opts) {
    this.updateDeviceByBus(value * 100);
    this.setCapabilityValue("onoff", value > 0).catch(this.error);
  }
}

module.exports = DimmerDevice;
