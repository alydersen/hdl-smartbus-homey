'use strict';

const Homey = require("homey");

class TempsensorDevice extends Homey.Device {
  async onInit() {
    this.homey.app.log(`Initated "${this.getName()}" (Temperature Sensor/${this.getClass()}) ${this.getData().id}`);
  }

  async requestUpdate() {
    let commands = [0xe3e7, 0x1948];

    for (let i = 0; i < commands.length; i++) {
      if (this.homey.app.isBusConnected()) {
        this._controller().send(
          {
            target: this.getData().address,
            command: commands[i],
            data: {
              channel: this.getData().channel
            }
          },
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

module.exports = TempsensorDevice;
