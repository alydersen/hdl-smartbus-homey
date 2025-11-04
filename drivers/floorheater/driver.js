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
    this._lastValveValue = new Map();
  }

  async updateValues(signal) {
    const bufferPayload = (signal.payload && Buffer.isBuffer(signal.payload))
      ? signal.payload
      : (signal.raw && Buffer.isBuffer(signal.raw) ? signal.raw : null);

    let channel = signal.data && signal.data.channel;
    if (typeof channel === "undefined") {
      if (signal.code === 0x7263 && bufferPayload && bufferPayload.length > 0) {
        channel = bufferPayload.readUInt8(0);
      } else {
        return;
      }
    }

    // Get the device from Homey, return if not found or error
    let signature = this.homey.app.devSignChnld(signal.sender.id, channel);
    let homeyDevice = this.getDevice(signature);
    if ( typeof homeyDevice === 'undefined' || homeyDevice instanceof Error ) return;
    
    switch (signal.code) {
      case 0x1C5F:
      case 0x1C5D:
        // read floor heating status
        if (signal.data.temperature && this.homey.app.valueOK("temperature", signal.data.temperature.normal)) {
          homeyDevice.updateLevel(signal.data.temperature.normal);
        }
        const valueSource = bufferPayload;
        const valveRaw =
          Buffer.isBuffer(valueSource) && valueSource.length > 9
            ? valueSource.readUInt8(signal.code === 0x1C5F ? 9 : 8)
            : undefined;
        const payloadHex = Buffer.isBuffer(valueSource) ? valueSource.toString("hex") : "";
        const valveState = (() => {
          if (typeof signal.data.PWD !== "undefined") return Boolean(signal.data.PWD);
          if (signal.data.watering && typeof signal.data.watering.status !== "undefined") {
            return Boolean(signal.data.watering.status);
          }
          if (signal.data.work && typeof signal.data.work.status !== "undefined") {
            return Boolean(signal.data.work.status);
          }
          if (Buffer.isBuffer(valueSource) && valueSource.length > 10) {
            return valueSource.readUInt8(10) > 0;
          }
          if (Buffer.isBuffer(valueSource) && valueSource.length > 11) {
            return valueSource.readUInt8(11) > 0;
          }
          if (typeof signal.data.valve !== "undefined") return Boolean(signal.data.valve);
          return undefined;
        })();

        if (typeof valveState === "boolean") {
          const key = signature.id;
          const last = this._lastValveValue && this._lastValveValue.get(key);
          if (last !== valveState) {
            homeyDevice.updateValve(valveState, { raw: valveRaw, payload: payloadHex });
            this._lastValveValue.set(key, valveState);
          }
        }

        if (signal.data.work && typeof signal.data.work.status !== "undefined") {
          homeyDevice.updatePowerSwitch(Boolean(signal.data.work.status));
        }

        homeyDevice.currentData = signal.data;
        return;

      case 0xE3E8:
      case 0x1949:
        // read temperature (legacy 0xE3E8 and extended 0x1949)
        if (this.homey.app.valueOK("temperature", signal.data.temperature)) {
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


