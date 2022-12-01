'use strict';

const Homey = require("homey");
const HdlDevicelist = require("./../../hdl/hdl_devicelist");

class DimmerDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log("HDL DimmerDriver has been initiated");
  }

  getDeviceFromSignal(id, channel) {
    try {
      var homeyDevice = this.getDevice(this.homey.app.devSignChnld(id, channel));
    } catch (error) {
      var homeyDevice = undefined;
    }
    return homeyDevice;   
  }

  async updateDevice(id, channel, level) {
    if (level == undefined || channel == undefined) return;
    let homeyDevice = this.getDeviceFromSignal(id, channel);
    if ( typeof homeyDevice === 'undefined' || homeyDevice instanceof Error ) return;
    homeyDevice.updateHomeyLevel(level);
  }

  async updateValues(signal) {
    // One channel received
    if (signal.data.channel != undefined && signal.data.level != undefined) {
      this.updateDevice(signal.sender.id, signal.data.channel, signal.data.level);
    }

    // Multiple channels received
    if (signal.data.channels != undefined) {
      signal.data.channels.forEach((chnl) => {
        if (chnl.level == undefined || chnl.number == undefined) return;
        this.updateDevice(signal.sender.id, chnl.number, chnl.level);
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
      for (const device of Object.values(this.homey.app.getDevicesOfType("dimmer"))) {
        let devicelist = new HdlDevicelist()
        var channel;
        for (
          channel = 1;
          channel < await devicelist.numberOfChannels(device.type.toString()) + 1;
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
