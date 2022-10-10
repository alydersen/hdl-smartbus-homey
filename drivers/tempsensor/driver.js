'use strict';

const Homey = require("homey");
const HdlDevicelist = require("./../../hdl/hdl_devicelist");

class TempsensorDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log("HDL TempsensorDriver has been initiated");
  }

  async updateValues(signal) {
    // Parse and check the incoming signal, return if missing or invalid
    if (signal.data == undefined) return;
    if (signal.data.temperature == undefined) return;
    if (signal.data.channel == undefined) return;
    if (signal.sender.id == undefined) return;

    // Get the device from Homey, return if not found or error
    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    let homeyDevice = await this.getDevice({
      id: `${hdl_subnet}.${signal.sender.id}.${signal.data.channel}`,
      address: `${hdl_subnet}.${signal.sender.id}`,
      channel: signal.data.channel
    });

    if (typeof homeyDevice === 'undefined') return;
    if (homeyDevice instanceof Error) return;

    // Update the device with the new values and add the capability if missing
    if (! (homeyDevice.hasCapability("measure_temperature"))) {
      homeyDevice.addCapability("measure_temperature").catch(this.error);
    }
    homeyDevice
      .setCapabilityValue("measure_temperature", signal.data.temperature)
      .catch(this.error);
  }

  async onPairListDevices() {
    let devices = [];
    let hdl_subnet = this.homey.settings.get("hdl_subnet");

    // Check that the bus is connected
    if (!this.homey.app.isBusConnected()) {
      return new Error("Please configure the app settings first.");
    } else {
      this.homey.app.log("onPairListDevices from Tempsensor");
      for (const device of Object.values(this.homey.app.getDevicesOfType("tempsensor"))) {
        let devicelist = new HdlDevicelist()
        var channel;
        for (
          channel = 1;
          channel < await devicelist.numberOfChannels(device.type.toString()) + 1;
          channel++
        ) {
          devices.push({
            name: `HDL Temp Sensor (${hdl_subnet}.${device.id} ch ${channel})`,
            data: {
              id: `${hdl_subnet}.${device.id}.${channel}`,
              address: `${hdl_subnet}.${device.id}`,
              channel: channel
            }
          });
        }
      }
      return devices.sort(TempsensorDriver._compareHomeyDevice);
    }
  }

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
}

module.exports = TempsensorDriver;
