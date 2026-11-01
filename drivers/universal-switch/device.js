'use strict';

const Homey = require("homey");

class HdlUniversalSwitchDevice extends Homey.Device {
  async onInit() {
    this.homey.app.log(`Initated "${this.getName()}" (Universal Switch/${this.getClass()}) ${this.getData().id}`);

    // Show the device's HDL bus address in the settings screen
    await this.setSettings({ hdl_address: this.getData().id }).catch(this.error);

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

  async onCapabilityOnoff(value, _opts) {
    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    let hdl_id = parseInt(this.homey.settings.get("hdl_id"), 10);
    let hdl_logic_controller = this.homey.settings.get("hdl_logic_controller");
    let hdl_send_mode = this.homey.settings.get("hdl_uv_send_mode");

    // A valid logic controller address is 1-254; anything else (unset,
    // empty or malformed) means no logic controller is configured
    let logic = parseInt(hdl_logic_controller, 10);
    let hasLogic = !isNaN(logic) && logic >= 1 && logic <= 254;

    // Always broadcast the change
    await this.updateDeviceByBus("255.255", value);

    // Broadcast only: nothing more to do
    if (hdl_send_mode === "broadcast") return;

    // Broadcast + the logic controller only
    if (hdl_send_mode === "logic") {
      if (hasLogic) {
        await this.updateDeviceByBus(`${hdl_subnet}.${logic}`, value);
      }
      return;
    }

    // Default (legacy) behavior: if a logic controller is present, send to
    // it in addition to the broadcast; otherwise send to all addresses
    // individually (broadcast already sent)
    if (hasLogic) {
      await this.updateDeviceByBus(`${hdl_subnet}.${logic}`, value);
    } else {
      for (let i = 1; i < 256; i++) {
        if (i !== hdl_id) {
          await this.updateDeviceByBus(`${hdl_subnet}.${i}`, value);
        }
      }
    }
  }
}

module.exports = HdlUniversalSwitchDevice;
