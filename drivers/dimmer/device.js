'use strict';

const Homey = require("homey");

class DimmerDevice extends Homey.Device {
  async onInit() {
    this.homey.app.log(`Initated "${this.getName()}" (Dimmer/${this.getClass()}) ${this.getData().id}`);
 
    // register a capability listener
    this.registerCapabilityListener("onoff", this.onCapabilityOnoff.bind(this));
    this.registerCapabilityListener("dim", this.onCapabilityDim.bind(this));

    // Ask for channel status
    if (this.homey.app.isBusConnected()) {
      this._controller().send(
        {
          target: this.getData().address,
          command: 0x0033
        },
        function(err) {
          if (err) {
            this.homey.app.log(err);
          }
        }
      );
    }
  }

  async updateLevel(level) {
    var corrected_level = level / 100;
    this.setCapabilityValue("dim", corrected_level).catch(this.error);
    this.setCapabilityValue("onoff", corrected_level != 0).catch(this.error);
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
      this.setCapabilityValue("dim", 1).catch(this.error);
    } else {
      this._controller().send(
        {
          target: this.getData().address,
          command: 0x0031,
          data: {
            channel: this.getData().channel,
            level: 0
          }
        },
        function(err) {
          if (err) {
            this.homey.app.log(err);
          }
        }
      );
      this.setCapabilityValue("dim", 0).catch(this.error);
    }
  }

  async onCapabilityDim(value, opts) {
    this._controller().send(
      {
        target: this.getData().address,
        command: 0x0031,
        data: {
          channel: this.getData().channel,
          level: value * 100
        }
      },
      function(err) {
        if (err) {
          this.homey.app.log(err);
        }
      }
    );
    this.setCapabilityValue("onoff", value > 0).catch(this.error);
  }
}

module.exports = DimmerDevice;
