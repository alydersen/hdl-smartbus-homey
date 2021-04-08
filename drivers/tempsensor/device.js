'use strict';

const Homey = require("homey");

class TempsensorDevice extends Homey.Device {
  async onInit() {
    this.homey.app.log("Device init");
    this.homey.app.log("Name:", this.getName());
    this.homey.app.log("Class:", this.getClass());
    this.homey.app.log("Id:", this.getData().id);
    this.homey.app.log("Channel:", this.getData().channel);
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

module.exports = TempsensorDevice;
