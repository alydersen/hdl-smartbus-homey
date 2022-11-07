'use strict';

const Homey = require("homey");
const HdlDevicelist = require("./../../hdl/hdl_devicelist");

class RelayDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log("HDL RelayDriver has been initiated");
  }

  getDeviceFromSignal(signal, channel) {
    let hdl_subnet = this.homey.settings.get("hdl_subnet");

    let deviceSignature = {
      id: `${hdl_subnet}.${signal.sender.id}.${signal.data.channel || channel}`,
      address: `${hdl_subnet}.${signal.sender.id}`,
      channel: signal.data.channel || channel
    };
    try {
      var homeyDevice = this.getDevice(deviceSignature);
    } catch (error) {
      var homeyDevice = undefined;
    }
    return homeyDevice;    
  }

  async updateValues(signal) {
    // Parse and check the incoming signal, return if missing or invalid
    if (signal.data == undefined) return;
    if (signal.data.level == undefined) return;
    if (signal.sender.id == undefined) return;

    // Get the device from Homey, return if not found or error
    if (signal.data.channel != undefined) {
      if (signal.data.level != undefined) {
        let homeyDevice = this.getDeviceFromSignal(signal, signal.data.channel);
        if (typeof homeyDevice === 'undefined') return;
        if (homeyDevice instanceof Error) return;

        // Update the device with the new values and add the capability if missing
        homeyDevice.updateHomeyLevel(signal.data.level);
      }
    }

    if (signal.data.channels != undefined) {
      signal.data.channels.forEach(function(chnl) {
        if (chnl.level != undefined) {
          let homeyDevice = this.getDeviceFromSignal(signal, chnl.number);
          if (typeof homeyDevice === 'undefined') return;
          if (homeyDevice instanceof Error) return;
  
          // Update the device with the new values and add the capability if missing
          homeyDevice.updateHomeyLevel(chnl.level);
        }
      });
    }
  }

  async onPairListDevices() {
    let devices = [];
    let hdl_subnet = this.homey.settings.get("hdl_subnet");

    // Check that the bus is connected
    if (!this.homey.app.isBusConnected()) {
      return Error("Please configure the app settings first.");
    } else {
      this.homey.app.log("onPairListDevices from Relay");
      for (const device of Object.values(this.homey.app.getDevicesOfType("relay"))) {
        let devicelist = new HdlDevicelist()
        var channel;
        for (
          channel = 1;
          channel < await devicelist.numberOfChannels(device.type.toString()) + 1;
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
      return devices.sort(RelayDriver._compareHomeyDevice);
    }
  }

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
}

module.exports = RelayDriver;
