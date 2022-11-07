'use strict';

const Homey = require("homey");

class RelayDevice extends Homey.Device {

  _controller() {
    return this.homey.app.controller();
  }

  async onInit() {
    this.homey.app.log(`Initated "${this.getName()}" (Relay/${this.getClass()}) ${this.getData().id}`);
 
    // register a capability listener
    this.registerCapabilityListener("onoff", this.onCapabilityOnoff.bind(this));

    // Ask for channel status
    if (this.homey.app.isBusConnected()) { this.requestUpdate() }
  }

  async updateHomeyLevel(level) {
    this.setCapabilityValue("onoff", level != 0).catch(this.error);
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
    this.updateDeviceByBus(level);
  }
}

module.exports = RelayDevice;
