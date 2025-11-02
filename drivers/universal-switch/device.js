'use strict';

const Homey = require("homey");

class HdlUniversalSwitchDevice extends Homey.Device {
  async onInit() {
    this.homey.app.log(`Initated "${this.getName()}" (Universal Switch/${this.getClass()}) ${this.getData().id}`);
 
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
      (err) => {
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
      (err) => {
        if (err) {
          this.homey.app.log(err);
        }
      }
    );
  }

  _controller() {
    return this.homey.app.controller();
  }

  async updateDeviceByBus(target, status) {
    this._controller().send(
      {
        target: target,
        command: 0xe01c,
        data: {
          switch: this.getData().switch,
          status: status
        }
      },
      (err) => {
        if (err) {
          this.homey.app.log(err);
        }
      }
    );
  }

  async onCapabilityOnoff(value, opts) {
    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    let hdl_id = parseInt(this.homey.settings.get("hdl_id"));
    let hdl_logic_controller = this.homey.settings.get("hdl_logic_controller");

    // Broadcast the change
    this.updateDeviceByBus("255.255", value)

    // Treat sending differently if there is a logic controller present
    if (hdl_logic_controller !== undefined) {
      // If present - only send to the logiccontroller (broadcast already sent)
      let logic = parseInt(hdl_logic_controller);
      this.updateDeviceByBus(`${hdl_subnet}.${logic}`, value)
    } else {
      // If not present - send to all addresses individually (broadcast already sent)
      var i;
      for (i = 1; i < 256; i++) {
        if (i != hdl_id) {
          this.updateDeviceByBus(`${hdl_subnet}.${i}`, value)
        }
      }  
    }
  }
}

module.exports = HdlUniversalSwitchDevice;
