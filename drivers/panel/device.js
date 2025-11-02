'use strict';

const { Device } = require('homey');

class PanelDevice extends Device {

  async onInit() {
    this.homey.app.log(`Initated "${this.getName()}" (DLP Panel/${this.getClass()}) ${this.getData().id}`);
  }

  async requestUpdate() {
    let commands = [0xe3e7, 0x1948, 0x1944];

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

module.exports = PanelDevice;
