'use strict';

const Homey = require("homey");

class MultisensorDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log("HDL MultisensorDriver has been initiated");
  }

  async updateValues(signal) {
    // Parse and check the incoming signal, return if missing or invalid
    if (signal.data == undefined) return;
    if (signal.sender.id == undefined) return;

    // Get the device from Homey, return if not found or error
    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    let homeyDevice = this.getDevice({id: `${hdl_subnet}.${signal.sender.id}`});
    if (typeof homeyDevice === 'undefined') return;
    if (homeyDevice instanceof Error) return;

    // Update the device with the new motion values and add the capability if missing
    if (! (homeyDevice.hasCapability("alarm_motion"))) {
      homeyDevice.addCapability("alarm_motion").catch(this.error);
    }

    // Either this comes from a signal.motion or through universal switch
    if (signal.data.movement != undefined) {
      homeyDevice
        .setCapabilityValue("alarm_motion", signal.data.movement)
        .catch(this.error);
    }
    if (
      signal.data.switch != undefined &&
      signal.data.switch ==
        parseInt(this.homey.settings.get("hdl_universal_motion"))
    ) {
      homeyDevice
        .setCapabilityValue("alarm_motion", signal.data.status)
        .catch(this.error);
    }

    // Set temperature
    if (signal.data.temperature != undefined) {
      if (! (homeyDevice.hasCapability("measure_temperature"))) {
        homeyDevice.addCapability("measure_temperature").catch(this.error);
      }
      homeyDevice
        .setCapabilityValue("measure_temperature", signal.data.temperature)
        .catch(this.error);
    }

    // Set brighness
    if (signal.data.brightness != undefined) {
      if (! (homeyDevice.hasCapability("measure_luminance"))) {
        homeyDevice.addCapability("measure_luminance").catch(this.error);
      }
      homeyDevice
        .setCapabilityValue("measure_luminance", signal.data.brightness)
        .catch(this.error);
    }

    // Set DryContacts
    if (signal.data.dryContacts != undefined) {
      for (const dryContact in signal.data.dryContacts) {
        let registered_drycontact = `alarm_contact.contact_${dryContact + 1}`;
        if (! (homeyDevice.hasCapability(registered_drycontact))) {
          homeyDevice.addCapability(registered_drycontact).catch(this.error);
        }
        homeyDevice
          .setCapabilityValue(registered_drycontact, signal.data.dryContacts[dryContact].status)
          .catch(this.error);
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
      for (const device of Object.values(this.homey.app.getDevicesOfType("multisensor"))) {
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
