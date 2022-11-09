'use strict';

const Homey = require("homey");
const HdlDevicelist = require("./../../hdl/hdl_devicelist");

class MultisensorDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log("HDL MultisensorDriver has been initiated");
  }


  async checkCapabilityAdded(device, capability) {
    if (! (device.hasCapability(capability))) {
      device.addCapability(capability).catch(this.error);
    }
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


    // Either this comes from a signal.motion or through universal switch
    if (signal.data.movement != undefined) {
      await this.checkCapabilityAdded(homeyDevice, "alarm_motion");
      homeyDevice
        .setCapabilityValue("alarm_motion", signal.data.movement)
        .catch(this.error);
    }
    if (
      signal.data.switch != undefined &&
      signal.data.switch ==
        parseInt(this.homey.settings.get("hdl_universal_motion"))
    ) {
      await this.checkCapabilityAdded(homeyDevice, "alarm_motion");
      homeyDevice
        .setCapabilityValue("alarm_motion", signal.data.status)
        .catch(this.error);
    }

    // Set temperature
    if (signal.data.temperature != undefined) {
      await this.checkCapabilityAdded(homeyDevice, "measure_temperature");
      homeyDevice
        .setCapabilityValue("measure_temperature", signal.data.temperature)
        .catch(this.error);
    }

    // Set brighness
    if (signal.data.brightness != undefined) {
      await this.checkCapabilityAdded(homeyDevice, "measure_luminance");
      homeyDevice
        .setCapabilityValue("measure_luminance", signal.data.brightness)
        .catch(this.error);
    }

    // Set humidity
    if (signal.data.humidity != undefined) {
      await this.checkCapabilityAdded(homeyDevice, "measure_humidity");
      homeyDevice
        .setCapabilityValue("measure_humidity", signal.data.humidity)
        .catch(this.error);
    }

    // Set DryContacts
    if (signal.data.dryContacts != undefined) {
      for (const dryContact in signal.data.dryContacts) {
        if ((parseInt(dryContact) + 1) <= 4) {
          let registered_drycontact = `dry_contact_${parseInt(dryContact) + 1}`;
          await this.checkCapabilityAdded(homeyDevice, registered_drycontact);
          homeyDevice
            .setCapabilityValue(registered_drycontact, signal.data.dryContacts[dryContact].status)
            .catch(this.error);
        }
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
        let devicelist = new HdlDevicelist();
        let cap = await devicelist.mainCapability(device.type.toString());

        devices.push({
          name: `HDL Multisensor (${hdl_subnet}.${device.id})`,
          capabilities: [cap],
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
