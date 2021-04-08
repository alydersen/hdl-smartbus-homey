'use strict';

const Homey = require("homey");

class RelayDevice extends Homey.Device {
  async onInit() {
    this.homey.app.log("Device init");
    this.homey.app.log("Name:", this.getName());
    this.homey.app.log("Class:", this.getClass());
    this.homey.app.log("Id:", this.getData().id);
    this.homey.app.log("Channel:", this.getData().channel);

    // register a capability listener
    this.registerCapabilityListener("onoff", this.onCapabilityOnoff.bind(this));

    // Ask for channel status
    if (this.homey.app.isBusConnected()) {
      this._controller().send(
        { target: this.getData().address, command: 0x0033 },
        function(err) {
          if (err) {
            this.homey.app.log(err);
          }
        }
      );
    }
  }

  async updateLevel(level) {
    this.setCapabilityValue("onoff", level != 0).catch(this.error);
  }

  async updateTrueFalse(status) {
    this.setCapabilityValue("onoff", status).catch(this.error);
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

  _controller() {
    return this.homey.app.controller();
  }

  async onCapabilityOnoff(value, opts) {
    if (value === true) {
      this._controller().send(
        {
          target: this.getData().address,
          command: 0x0031,
          data: {
            channel: this.getData().channel,
            level: 100
          }
        },
        function(err) {
          if (err) {
            this.homey.app.log(err);
          }
        }
      );
    } else {
      this._controller().send({
        target: this.getData().address,
        command: 0x0031,
        data: {
          channel: this.getData().channel,
          level: 0
        },
        function(err) {
          if (err) {
            this.homey.app.log(err);
          }
        }
      });
    }
  }
}

module.exports = RelayDevice;
