"use strict";

const Homey = require("homey");

class MultisensorDriver extends Homey.Driver {
  onInit() {
    this.log("HDL MultisensorDriver has been initiated");
  }

  updateValues(signal, context = "generic") {
    let hdl_subnet = Homey.ManagerSettings.get("hdl_subnet");
    let homeyDevice = this.getDevice({
      id: `${hdl_subnet}.${signal.sender.id}`
    });
    if (homeyDevice instanceof Error) return;

    if (context == "generic") {
      // Update temperature
      if (signal.data.temperature != undefined) {
        homeyDevice
          .setCapabilityValue("measure_temperature", signal.data.temperature)
          .catch(this.error);
      }
    } else if (context == "motion") {
      // Update motion
      if (signal.data.level != undefined) {
        if (signal.data.level == 100) {
          homeyDevice
            .setCapabilityValue("alarm_motion", true)
            .catch(this.error);
        } else {
          homeyDevice
            .setCapabilityValue("alarm_motion", false)
            .catch(this.error);
        }
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
