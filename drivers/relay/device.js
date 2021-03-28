"use strict";

const Homey = require("homey");

class RelayDevice extends Homey.Device {
  async onInit() {
    this.log("Device init");
    this.log("Name:", this.getName());
    this.log("Class:", this.getClass());
    this.log("Id:", this.getData().id);
    this.log("Channel:", this.getData().channel);

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

  updateLevel(level) {
    this.setCapabilityValue("onoff", level != 0).catch(this.error);
  }

  updateTrueFalse(status) {
    this.setCapabilityValue("onoff", status).catch(this.error);
  }

  requestUpdate() {
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
