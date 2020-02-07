"use strict";

const Homey = require("homey");

class MultisensorDevice extends Homey.Device {
  onInit() {
    this.log("Device init");
    this.log("Name:", this.getName());
    this.log("Class:", this.getClass());
    this.log("Id:", this.getData().id);
  }
}

module.exports = MultisensorDevice;
