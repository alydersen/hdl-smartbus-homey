"use strict";

const Homey = require("homey");
const HdlRelays = require("./../../hdl/hdl_relays");

class RelayDriver extends Homey.Driver {
  onInit() {
    this.log("HDL RelayDriver has been initiated");
  }

  updateValues(signal) {
    if (signal.data == undefined) return;
    if (signal.data.level == undefined) return;
    if (signal.sender.id == undefined) return;

    let hdl_subnet = Homey.ManagerSettings.get("hdl_subnet");
    let parent = this;
    if (signal.data.channel != undefined) {
      if (signal.data.level != undefined) {
        let homeyDevice = parent.getDevice({
          id: `${hdl_subnet}.${signal.sender.id}.${signal.data.channel}`,
          address: `${hdl_subnet}.${signal.sender.id}`,
          channel: signal.data.channel
        });
        if (homeyDevice instanceof Error) return;

        homeyDevice.updateLevel(signal.data.level);
      }
    }

    if (signal.data.channels != undefined) {
      signal.data.channels.forEach(function(element) {
        if (element.level != undefined) {
          let homeyDevice = parent.getDevice({
            id: `${hdl_subnet}.${signal.sender.id}.${element.number}`,
            address: `${hdl_subnet}.${signal.sender.id}`,
            channel: element.number
          });
          if (homeyDevice instanceof Error) return;

          homeyDevice.updateLevel(element.level);
        }
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
      for (const device of Object.values(Homey.app.getRelays())) {
        let hdlRelay = new HdlRelays(device.type.toString());
        var channel;
        for (
          channel = 1;
          channel < hdlRelay.numberOfChannels() + 1;
          channel++
        ) {
          devices.push({
            name: `HDL Relay (${hdl_subnet}.${device.id} ch ${channel})`,
            data: {
              id: `${hdl_subnet}.${device.id}.${channel}`,
              address: `${hdl_subnet}.${device.id}`,
              channel: channel
            }
          });
        }
      }
      callback(null, devices.sort(RelayDriver._compareHomeyDevice));
    }
  }

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
}

module.exports = RelayDriver;
