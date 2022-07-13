'use strict';

const Homey = require("homey");
const HdlMultisensors = require("./../../hdl/hdl_multisensors");

class MultisensorDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log("HDL MultisensorDriver has been initiated");
  }

  async updateValues(signal) {
    if (signal.data == undefined) return;
    if (signal.sender.id == undefined) return;

    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    try {
      let homeyDevice = this.getDevice({
        id: `${hdl_subnet}.${signal.sender.id}`
      });
      } catch (err) {
      return;
    }
    if (typeof homeyDevice === 'undefined') {
      return;
    }

    if (homeyDevice instanceof Error) return;
    // Set motion status
    if (
      signal.data.switch != undefined &&
      signal.data.switch ==
        parseInt(this.homey.settings.get("hdl_universal_motion"))
    ) {
      if (homeyDevice.hasCapability("alarm_motion")) {
        homeyDevice
          .setCapabilityValue("alarm_motion", signal.data.status)
          .catch(this.error);
      }
    }

    // Set temperature
    if (signal.data.temperature != undefined) {
      if (homeyDevice.hasCapability("measure_temperature")) {
        homeyDevice
          .setCapabilityValue("measure_temperature", signal.data.temperature)
          .catch(this.error);
      } else {
        homeyDevice.addCapability("measure_temperature").catch(this.error);
      }
    }

    // Set brighness
    if (signal.data.brightness != undefined) {
      if (homeyDevice.hasCapability("measure_luminance")) {
        homeyDevice
          .setCapabilityValue("measure_luminance", signal.data.brightness)
          .catch(this.error);
      } else {
        homeyDevice.addCapability("measure_luminance").catch(this.error);
      }
    }
  }

  async onPairListDevices() {
    let devices = [];
    let hdl_subnet = this.homey.settings.get("hdl_subnet");

    // Check that the bus is connected
    if (!this.homey.app.isBusConnected()) {
      return new Error("Please configure the app settings first.");
    } else {
      this.homey.app.log("onPairListDevices from Multisensor");
      for (const device of Object.values(this.homey.app.getMultisensors())) {
        let hdlMultisensor = new HdlMultisensors(device.type.toString());
        let capabilities = ["alarm_motion"];

        devices.push({
          name: `HDL Multisensor (${hdl_subnet}.${device.id})`,
          capabilities: capabilities,
          data: {
            id: `${hdl_subnet}.${device.id}`
          }
        });
      }
      return devices.sort(MultisensorDriver._compareHomeyDevice);
    }
  }
}

module.exports = MultisensorDriver;
