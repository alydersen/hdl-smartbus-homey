'use strict';

const Homey = require("homey");
const HdlDimmers = require("./../../hdl/hdl_dimmers");

class DimmerDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log("HDL DimmerDriver has been initiated");
  }

  async updateValues(signal) {
    if (signal.data == undefined) return;
    if (signal.sender.id == undefined) return;

    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    let parent = this;
    if (signal.data.channel != undefined) {
      if (signal.data.level != undefined) {
        let homeyDevice = parent.getDevice({
          id: `${hdl_subnet}.${signal.sender.id}.${signal.data.channel}`,
          address: `${hdl_subnet}.${signal.sender.id}`,
          channel: signal.data.channel
          });
        if (typeof homeyDevice !== 'undefined') {
          if (homeyDevice instanceof Error) return;
          homeyDevice.updateLevel(signal.data.level);
        }
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
          if (typeof homeyDevice !== 'undefined') {
            if (homeyDevice instanceof Error) return;
            homeyDevice.updateLevel(element.level);
          }
        }
      });
    }
  }

  async onPairListDevices() {
    let devices = [];
    let hdl_subnet = this.homey.settings.get("hdl_subnet");

    // Check that the bus is connected
    if (!this.homey.app.isBusConnected()) {
      return new Error("Please configure the app settings first.");
    } else {
      this.homey.app.log("onPairListDevices from Dimmer");
      for (const device of Object.values(this.homey.app.getDimmers())) {
        let hdlDimmer = new HdlDimmers(device.type.toString());
        var channel;
        for (
          channel = 1;
          channel < await hdlDimmer.numberOfChannels() + 1;
          channel++
        ) {
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
      return devices.sort(DimmerDriver._compareHomeyDevice);
    }
  }

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
}

module.exports = DimmerDriver;
