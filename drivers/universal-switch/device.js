"use strict";

const Homey = require("homey");

class HdlUniversalSwitchDevice extends Homey.Device {
  onInit() {
    this.log("Device init");
    this.log("Name:", this.getName());
    this.log("Class:", this.getClass());
    this.log("Id:", this.getData().id);
    this.log("Switch:", this.getData().switch);

    // register a capability listener
    this.registerCapabilityListener("onoff", this.onCapabilityOnoff.bind(this));
  }

  updateTrueFalse(status) {
    this.setCapabilityValue("onoff", status).catch(this.error);
  }

  respondToSender(sender) {
    this._controller().send(
      {
        target: `${sender.subnet}.${sender.id}`,
        command: 0xE01D,
        data: { switch: this.getData().switch, status: this.getCapabilityValue("onoff") }
      },
      function(err) {
        if (err) {
          Homey.app.log(err);
        }
      }
    );
  }

  requestUpdate() {
    this._controller().send(
      {
        target: "255.255",
        command: 0xe018,
        data: { switch: this.getData().switch }
      },
      function(err) {
        if (err) {
          Homey.app.log(err);
        }
      }
    );
  }

  _controller() {
    return Homey.app.controller();
  }

  async onCapabilityOnoff(value, opts) {
    this._controller().send(
      {
        target: "255.255",
        command: 0xe01c,
        data: {
          switch: this.getData().switch,
          status: value
        }
      },
      function(err) {
        if (err) {
          Homey.app.log(err);
        }
      }
    );
  }
}

module.exports = HdlUniversalSwitchDevice;
