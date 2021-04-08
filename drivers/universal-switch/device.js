'use strict';

const Homey = require("homey");

class HdlUniversalSwitchDevice extends Homey.Device {
  async onInit() {
    this.homey.app.log("Device init");
    this.homey.app.log("Name:", this.getName());
    this.homey.app.log("Class:", this.getClass());
    this.homey.app.log("Id:", this.getData().id);
    this.homey.app.log("Switch:", this.getData().switch);

    // register a capability listener
    this.registerCapabilityListener("onoff", this.onCapabilityOnoff.bind(this));
  }

  async updateTrueFalse(status) {
    this.setCapabilityValue("onoff", status).catch(this.error);
  }

  async respondToSender(sender) {
    this._controller().send(
      {
        target: `${sender.subnet}.${sender.id}`,
        command: 0xE01D,
        data: { switch: this.getData().switch, status: this.getCapabilityValue("onoff") }
      },
      function(err) {
        if (err) {
          this.homey.app.log(err);
        }
      }
    );
  }

  async requestUpdate() {
    this._controller().send(
      {
        target: "255.255",
        command: 0xe018,
        data: { switch: this.getData().switch }
      },
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
    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    let hdl_id = parseInt(this.homey.settings.get("hdl_id"));

    var i;
    for (i = 1; i < 256; i++) {
      if (i != hdl_id) {
        this._controller().send(
          {
            target: `${hdl_subnet}.${i}`,
            command: 0xe01c,
            data: {
              switch: this.getData().switch,
              status: value
            }
          },
          function(err) {
            if (err) {
              this.homey.app.log(err);
            }
          }
        );
      }
    }
  }
}

module.exports = HdlUniversalSwitchDevice;
