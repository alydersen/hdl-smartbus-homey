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

  async updateValues(signal) {
    // Parse and check the incoming signal, return if missing or invalid
    if (signal.data.channel == undefined) return;

    // Get the device from Homey, return if not found or error
    let signature = this.homey.app.devSignChnld(signal.sender.id, signal.data.channel)
    let homeyDevice = this.getDevice(signature);
    if ( typeof homeyDevice === 'undefined' || homeyDevice instanceof Error ) return;
    
    switch (signal.code) {
      case 0x1C5F:
      case 0x1C5D:
        // read floor heating status
        if (this.homey.app.valueOK("temperature", signal.data.temperature.normal)) {
          homeyDevice.updateLevel(signal.data.temperature.normal);
        }
        homeyDevice.updateValve(signal.data.watering && signal.data.watering.status);
        homeyDevice.updatePowerSwitch(signal.data.work && signal.data.work.status);
        homeyDevice.currentData = signal.data;
        return;

      case 0xE3E8:
      case 0x1949:
        // read temperature (legacy 0xE3E8 and extended 0x1949)
        if (this.homey.app.valueOK("temperature", signal.data.temperature)) {
          const rawPayload = (Buffer.isBuffer(signal.payload) && signal.payload.length)
            ? signal.payload
            : (Buffer.isBuffer(signal.raw) ? signal.raw : null);
          const rawHex = rawPayload ? rawPayload.toString("hex") : "";
          this.homey.app.log(
            `[Floorheater] temp frame ${signal.sender.id}.${signal.data.channel} cmd=0x${signal.code.toString(16)} value=${signal.data.temperature}` +
            (rawHex ? ` raw=${rawHex}` : "")
          );
          homeyDevice.updateTemperature(signal.data.temperature, { command: signal.code });
        }          
    }
  }

  async onPairListDevices() {
    let devices = [];
    let hdl_subnet = this.homey.settings.get("hdl_subnet");

    // Check that the bus is connected
    if (!this.homey.app.isBusConnected()) {
      return new Error("Please configure the app settings first.");
    }
    this.homey.app.log("onPairListDevices from Floorheater");
    for (const device of Object.values(this.homey.app.getDevicesOfType("floorheater"))) {
      let devicelist = new HdlDevicelist()
      var channel;
      for (
        channel = 1;
        channel < await devicelist.numberOfChannels(device.type.toString()) + 1;
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

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
}

module.exports = FloorHeaterDriver;
