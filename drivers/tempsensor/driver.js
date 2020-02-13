"use strict";

const Homey = require("homey");

class TempsensorDriver extends Homey.Driver {
  onInit() {
    this.log("HDL TempsensorDriver has been initiated");
  }

  updateValues(command) {
    if (command.data["temperature"] != undefined) {
      let hdl_subnet = Homey.ManagerSettings.get("hdl_subnet");
      let homeyDevice = this.getDevice({
        id: `${hdl_subnet}.${command.sender.id}.${command.data.channel}`,
        address: `${hdl_subnet}.${command.sender.id}`,
        channel: command.data.channel
      });
      if (homeyDevice instanceof Error) return;
      homeyDevice
        .setCapabilityValue("measure_temperature", command.data.temperature)
        .catch(this.error);
    }
  }

  onPairListDevices(data, callback) {
    let devices = [];
    let hdl_subnet = Homey.ManagerSettings.get("hdl_subnet");

    // Check that the bus is connected
    if (!Homey.app.isBusConnected()) {
      callback(new Error("Please configure the app settings first."));
    } else {
      this.log("onPairListDevices from Tempsensor");
      let tempsensors = Homey.app.getTempsensors();

      for (const device of Object.values(tempsensors)) {
        let type = Homey.app.devicelist["tempsensors"][device.type.toString()];
        let channelsAvailable = type["channels"];

        var channel;
        for (channel = 1; channel < channelsAvailable + 1; channel++) {
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