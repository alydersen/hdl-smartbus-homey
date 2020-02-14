"use strict";

const Homey = require("homey");

class MultisensorDriver extends Homey.Driver {
  onInit() {
    this.log("HDL MultisensorDriver has been initiated");
  }

  updateValues(signal) {
    if (signal.data == undefined) return;
    if (signal.data.channel == undefined) return;
    if (signal.data.id == undefined) return;

    let hdl_subnet = Homey.ManagerSettings.get("hdl_subnet");
    let homeyDevice = this.getDevice({
      id: `${hdl_subnet}.${signal.sender.id}`
    });
    if (homeyDevice instanceof Error) return;

    // Set motion status
    if (
      signal.data.switch != undefined &&
      signal.data.switch ==
        parseInt(Homey.ManagerSettings.get("hdl_universal_motion"))
    ) {
      if (homeyDevice.hasCapability("alarm_motion")) {
        homeyDevice
          .setCapabilityValue("alarm_motion", signal.data.switch)
          .catch(this.error);
      }
    }

    // Set temperature
    if (signal.data.temperature != undefined) {
      if (homeyDevice.hasCapability("measure_temperature")) {
        homeyDevice
          .setCapabilityValue("alarm_motion", signal.data.switch)
          .catch(this.error);
      }
    }
  }

  onPairListDevices(data, callback) {
    let devices = [];
    let hdl_subnet = Homey.ManagerSettings.get("hdl_subnet");

    // Check that the bus is connected
    if (!Homey.app.isBusConnected()) {
      callback(new Error("Please configure the app settings first."));
    } else {
      this.log("onPairListDevices from Multisensor");

      let multisensors = Homey.app.getMultisensors();
      for (const device of Object.values(multisensors)) {
        let type = Homey.app.devicelist["multisensors"][device.type.toString()];
        let capabilities = [];
        if (type.temperature) {
          capabilities.push("measure_temperature");
        }
        if (type.motion) {
          capabilities.push("alarm_motion");
        }

        devices.push({
          name: `HDL Multisensor (${hdl_subnet}.${device.id})`,
          capabilities: capabilities,
          data: {
            id: `${hdl_subnet}.${device.id}`
          }
        });
      }
      callback(null, devices.sort(MultisensorDriver._compareHomeyDevice));
    }
  }
}

module.exports = MultisensorDriver;
