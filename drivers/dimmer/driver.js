"use strict";

const Homey = require("homey");

class DimmerDriver extends Homey.Driver {
  onInit() {
    this.log("HDL DimmerDriver has been initiated");
  }

  updateValues(signal) {
    if (signal.data == undefined) return;
    if (signal.data.level == undefined) return;
    if (signal.data.id == undefined) return;

    let hdl_subnet = Homey.ManagerSettings.get("hdl_subnet");
    if (signal.data.channel != undefined) {
      let homeyDevice = this.getDevice({
        id: `${hdl_subnet}.${signal.sender.id}.${signal.data.channel}`,
        address: `${hdl_subnet}.${signal.sender.id}`,
        channel: signal.data.channel
      });
      if (homeyDevice instanceof Error) return;

      homeyDevice.updateLevel(signal.data.level);
    }

    if (signal.data.channels != undefined) {
      signal.data.channels.forEach(function(element) {
        let homeyDevice = this.getDevice({
          id: `${hdl_subnet}.${signal.sender.id}.${element.number}`,
          address: `${hdl_subnet}.${signal.sender.id}`,
          channel: element.number
        });
        if (homeyDevice instanceof Error) return;

        homeyDevice.updateLevel(element.level);
      });
    }
  }

  onPairListDevices(data, callback) {
    let devices = [];
    let hdl_subnet = Homey.ManagerSettings.get("hdl_subnet");

    // Check that the bus is connected
    if (!Homey.app.isBusConnected()) {
      callback(new Error("Please configure the app settings first."));
    } else {
      this.log("onPairListDevices from Dimmer");
      let dimmers = Homey.app.getDimmers();

      for (const device of Object.values(dimmers)) {
        let type = Homey.app.devicelist["dimmers"][device.type.toString()];
        let channelsAvailable = type["channels"];

        var channel;
        for (channel = 1; channel < channelsAvailable + 1; channel++) {
          devices.push({
            name: `HDL Dimmer (${hdl_subnet}.${device.id} ch ${channel})`,
            data: {
              id: `${hdl_subnet}.${device.id}.${channel}`,
              address: `${hdl_subnet}.${device.id}`,
              channel: channel
            }
          });
        }
      }
      callback(null, devices.sort(DimmerDriver._compareHomeyDevice));
    }
  }

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
}

module.exports = DimmerDriver;
