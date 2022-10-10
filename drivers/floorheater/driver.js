"use strict";

const Homey = require("homey");
const HdlDevicelist = require("./../../hdl/hdl_devicelist");

// interface Signal {
//   code,
//   sender,
//   target,
//   payload,
//   parse?,
//   encode?
// }

class FloorHeaterDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log("HDL FloorHeaterDriver has been initiated");
  }

  getDeviceFromSignal(signal) {
    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    return this.getDevice({
      id: `${hdl_subnet}.${signal.sender.id}.${signal.data.channel}`,
      address: `${hdl_subnet}.${signal.sender.id}`,
      channel: signal.data.channel
    });    
  }

  async updateValues(signal) {
    if (signal.data) {
        let device = this.getDeviceFromSignal(signal);
        if (typeof device !== 'undefined') {
          if (device instanceof Error) return;
          
          switch (signal.code) {
            case 0x1C5F:
            case 0x1C5D:
              // read floor heating status
              device.updateLevel(signal.data.temperature.normal);
              device.updateValve(signal.data.watering && signal.data.watering.status);
              device.updatePowerSwitch(signal.data.work && signal.data.work.status);
              device.currentData = signal.data;
              return;

            case 0xE3E8:
              // read temperature
              device.updateTemperature(signal.data.temperature);
          }
        }
    }
  }

  async onPairListDevices() {
    let devices = [];
    let hdl_subnet = this.homey.settings.get("hdl_subnet");

    // Check that the bus is connected
    if (!this.homey.app.isBusConnected()) {
      return Error("Please configure the app settings first.");
    } else {
      this.homey.app.log("onPairListDevices from Floorheater");
      for (const device of Object.values(this.homey.app.getFloorheaters())) {
        let devicelist = new HdlDevicelist()
        var channel;
        for (
          channel = 1;
          channel < devicelist.numberOfChannels(device.type.toString()) + 1;
          channel++
        ) {
          devices.push({
            name: `HDL Floorheater (${hdl_subnet}.${device.id} ch ${channel})`,
            data: {
              id: `${hdl_subnet}.${device.id}.${channel}`,
              address: `${hdl_subnet}.${device.id}`,
              channel: channel
            }
          });
        }
      }
      return devices.sort(FloorHeaterDriver._compareHomeyDevice);
    }
  }

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
}

module.exports = FloorHeaterDriver;
