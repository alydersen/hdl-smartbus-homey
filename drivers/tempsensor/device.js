"use strict";

const Homey = require("homey");

class TempsensorDevice extends Homey.Device {
  onInit() {
    this.log("Device init");
    this.log("Name:", this.getName());
    this.log("Class:", this.getClass());
    this.log("Id:", this.getData().id);
    this.log("Channel:", this.getData().channel);
  }

  requestUpdate() {
    let commands = [0xe3e7, 0x1948];

    for (let i = 0; i < commands.length; i++) {
      if (Homey.app.isBusConnected()) {
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
              Homey.app.log(err);
            }
          }
        );
      }
    }
  }

  _bus() {
    return Homey.app.bus();
  }

  _controller() {
    return Homey.app.controller();
  }
}

module.exports = TempsensorDevice;
