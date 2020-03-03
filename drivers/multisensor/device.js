"use strict";

const Homey = require("homey");

class MultisensorDevice extends Homey.Device {
  onInit() {
    this.log("Device init");
    this.log("Name:", this.getName());
    this.log("Class:", this.getClass());
    this.log("Id:", this.getData().id);
  }

  requestUpdate() {
    let commands = [0xdb00, 0x1645, 0x1604];

    for (let i = 0; i < commands.length; i++) {
      if (Homey.app.isBusConnected()) {
        this._controller().send(
          { target: this.getData().id, command: commands[i] },
          function(err) {
            if (err) {
              Homey.app.log(err);
            }
          }
        );
      }
    }
  }

  _controller() {
    return Homey.app.controller();
  }
}

module.exports = MultisensorDevice;
