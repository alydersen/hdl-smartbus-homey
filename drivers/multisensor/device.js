'use strict';

const Homey = require("homey");

class MultisensorDevice extends Homey.Device {
  async onInit() {
    this.homey.app.log(`Initated "${this.getName()}" (Multisensor/${this.getClass()}) ${this.getData().id}`);
  }

  async requestUpdate() {
    let commands = [0xdb00, 0x1645, 0x1604];

    for (let i = 0; i < commands.length; i++) {
      if (this.homey.app.isBusConnected()) {
        this._controller().send(
          { target: this.getData().id, command: commands[i] },
          function(err) {
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
