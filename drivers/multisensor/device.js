'use strict';

const Homey = require("homey");

class MultisensorDevice extends Homey.Device {
  async onInit() {
    this.homey.app.log(`Initated "${this.getName()}" (Multisensor/${this.getClass()}) ${this.getData().id}`);

    // Show the device's HDL bus address in the settings screen
    await this.setSettings({ hdl_address: this.getData().id }).catch(this.error);

    // Relay outputs (12in1) may already be part of the device; capabilities
    // discovered later are wired up by the driver as they are added
    this._registeredRelayListeners = new Set();
    for (let channel = 1; channel <= 2; channel++) {
      const capability = `relay_${channel}`;
      if (this.hasCapability(capability)) {
        this.registerRelayListener(capability, channel);
      }
    }
  }

  registerRelayListener(capability, channel) {
    if (this._registeredRelayListeners.has(capability)) return;
    this._registeredRelayListeners.add(capability);
    this.registerCapabilityListener(capability, this.onCapabilityRelay.bind(this, channel));
  }

  async onCapabilityRelay(channel, value, _opts) {
    if (!this.homey.app.isBusConnected()) return;

    // Relay outputs are controlled with the standard Single Channel Control
    // command, the same one the relay driver uses
    this._controller().send(
      {
        target: this.getData().id,
        command: 0x0031,
        data: {
          channel: channel,
          level: value === true ? 100 : 0
        }
      },
      (err) => {
        if (err) {
          this.homey.app.log(err);
        }
      }
    );
  }

  async requestUpdate() {
    let commands = [0xdb00, 0x1645, 0x1604];

    // Sensor types with relay outputs also support Read Status of Channels;
    // the 0x0034 response carries every channel's switch status
    if (this.hasCapability("relay_1")) {
      commands.push(0x0033);
    }

    for (let i = 0; i < commands.length; i++) {
      if (this.homey.app.isBusConnected()) {
        this._controller().send(
          { target: this.getData().id, command: commands[i] },
          (err) => {
            if (err) {
              this.homey.app.log(err);
            }
          }
        );
      }
    }
  }

  _controller() {
    return this.homey.app.controller();
  }
}

module.exports = MultisensorDevice;
