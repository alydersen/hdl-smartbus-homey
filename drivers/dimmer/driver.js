'use strict';

const Homey = require("homey");
const HdlDimmers = require("./../../hdl/hdl_dimmers");

class DimmerDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log("HDL DimmerDriver has been initiated");
  }

  getDeviceFromSignal(signal, channel) {
    let hdl_subnet = this.homey.settings.get("hdl_subnet");

    let deviceSignature = {
      id: `${hdl_subnet}.${signal.sender.id}.${signal.data.channel || channel}`,
      address: `${hdl_subnet}.${signal.sender.id}`,
      channel: signal.data.channel || channel
    };

    return this.getDevice(deviceSignature);    
  }

  async updateValues(signal) {
    if (signal.data == undefined) return;
    if (signal.sender.id == undefined) return;

    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    let parent = this;
    if (signal.data.channel != undefined) {
      if (signal.data.level != undefined) {
        try { let device = this.getDeviceFromSignal(signal, signal.data.channel); } catch (err) { return; }
        if (typeof device !== 'undefined') {
          if (device instanceof Error) return;
          device.updateLevel(signal.data.level);
        }
      }
    }

    if (signal.data.channels != undefined) {
      // This signal contains all channels, we need to process it for every device
      signal.data.channels.forEach((chnl, index) => {
        if (signal.data.channels[index].level != undefined) {
          try { let device = this.getDeviceFromSignal(signal, chnl.number); } catch (err) { return; }
          if (typeof device !== 'undefined') {
            if (device instanceof Error) return;
            device.updateLevel(signal.data.channels[index].level);
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
