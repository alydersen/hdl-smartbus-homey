'use strict';

const Homey = require("homey");
const HdlTempsensors = require("./../../hdl/hdl_tempsensors");

class TempsensorDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log("HDL TempsensorDriver has been initiated");
  }

  async updateValues(signal) {
    if (signal.data == undefined) return;
    if (signal.data.temperature == undefined) return;
    if (signal.data.channel == undefined) return;
    if (signal.sender.id == undefined) return;

    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    let parent = this;
    try {
      let homeyDevice = parent.getDevice({
        id: `${hdl_subnet}.${signal.sender.id}.${signal.data.channel}`,
        address: `${hdl_subnet}.${signal.sender.id}`,
        channel: signal.data.channel
      });
    } catch (error) {
      return;
    }
    if (typeof homeyDevice !== 'undefined') {
      if (homeyDevice instanceof Error) return;
      homeyDevice.setCapabilityValue("measure_temperature", signal.data.temperature);
    }
  }

  async onPairListDevices() {
    let devices = [];
    let hdl_subnet = this.homey.settings.get("hdl_subnet");

    // Check that the bus is connected
    if (!this.homey.app.isBusConnected()) {
      return new Error("Please configure the app settings first.");
    } else {
      this.homey.app.log("onPairListDevices from Tempsensor");
      for (const device of Object.values(this.homey.app.getTempsensors())) {
        let hdlTempsensor = new HdlTempsensors(device.type.toString());
        var channel;
        for (
          channel = 1;
          channel < await hdlTempsensor.numberOfChannels() + 1;
          channel++
        ) {
          devices.push({
            name: `HDL Temp Sensor (${hdl_subnet}.${device.id} ch ${channel})`,
            data: {
              id: `${hdl_subnet}.${device.id}.${channel}`,
              address: `${hdl_subnet}.${device.id}`,
              channel: channel
            }
          });
        }
      }
      return devices.sort(TempsensorDriver._compareHomeyDevice);
    }
  }

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
}

module.exports = TempsensorDriver;
