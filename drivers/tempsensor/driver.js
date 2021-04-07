'use strict';

const Homey = require("homey");
const HdlTempsensors = require("./../../hdl/hdl_tempsensors");

class TempsensorDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log("HDL TempsensorDriver has been initiated");
  }

  updateValues(signal) {
    if (signal.data == undefined) return;
    if (signal.data.temperature == undefined) return;
    if (signal.data.channel == undefined) return;
    if (signal.sender.id == undefined) return;

    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    let homeyDevice = this.getDevice({
      id: `${hdl_subnet}.${signal.sender.id}.${signal.data.channel}`,
      address: `${hdl_subnet}.${signal.sender.id}`,
      channel: signal.data.channel
    });
    if (homeyDevice instanceof Error) return;

    homeyDevice
      .setCapabilityValue("measure_temperature", signal.data.temperature)
      .catch(this.error);
  }

  onPairListDevices(data, callback) {
    let devices = [];
    let hdl_subnet = this.homey.settings.get("hdl_subnet");

    // Check that the bus is connected
    if (!this.homey.app.isBusConnected()) {
      callback(new Error("Please configure the app settings first."));
    } else {
      this.homey.app.log("onPairListDevices from Tempsensor");
      for (const device of Object.values(Homey.app.getTempsensors())) {
        let hdlTempsensor = new HdlTempsensors(device.type.toString());
        var channel;
        for (
          channel = 1;
          channel < hdlTempsensor.numberOfChannels() + 1;
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
      callback(null, devices.sort(TempsensorDriver._compareHomeyDevice));
    }
  }

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
}

module.exports = TempsensorDriver;
