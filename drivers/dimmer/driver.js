"use strict";

const Homey = require("homey");

class DimmerDriver extends Homey.Driver {
  onInit() {
    this.log("HDL DimmerDriver has been initiated");
  }

  updateValues(command) {
    if (command.data["success"] != undefined) {
      let hdl_subnet = Homey.ManagerSettings.get("hdl_subnet");
      let level = command.data.level / 100;
      let homeyDevice = this.getDevice({
        id: `${hdl_subnet}.${command.sender.id}.${command.data.channel}`,
        address: `${hdl_subnet}.${command.sender.id}`,
        channel: command.data.channel
      });
      if (homeyDevice instanceof Error) return;
      homeyDevice.setCapabilityValue("dim", level).catch(this.error);
      if (level == 0) {
        homeyDevice.setCapabilityValue("onoff", false).catch(this.error);
      } else {
        homeyDevice.setCapabilityValue("onoff", true).catch(this.error);
      }
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
        callback(null, devices.sort(DimmerDriver._compareHomeyDevice));
      }
    }
  }

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
}

module.exports = DimmerDriver;
