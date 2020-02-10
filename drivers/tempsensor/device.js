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

  _bus() {
    return Homey.app.bus();
  }
}

module.exports = TempsensorDevice;
