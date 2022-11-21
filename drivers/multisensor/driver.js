'use strict';

const Homey = require("homey");
const HdlDevicelist = require("./../../hdl/hdl_devicelist");
const consoleLogging = false;

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
    if (signal.sender.type == undefined) return;

    // Get the Motion UVS from Homey settings
    let hdlUVSwitch = parseInt(this.homey.settings.get("hdl_universal_motion"));

    // Check which signals are present and range
    let hasTemp = signal.data.temperature != undefined && (signal.data.temperature < -40 || signal.data.temperature > 70);
    let hasHum = signal.data.humidity != undefined && (signal.data.humidity < 0 || signal.data.humidity > 100);
    let hasLux = signal.data.lux != undefined && (signal.data.lux < 0 || signal.data.lux > 100000);
    let hasMotion = signal.data.motion != undefined;
    let hasDryContact = signal.data.dryContacts != undefined;
    let hasUV = signal.data.switch != undefined && signal.data.status != undefined && hdlUVSwitch == signal.data.switch;

    // Get the device from Homey, return if not found or error
    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    let homeyDevice = this.getDevice({id: `${hdl_subnet}.${signal.sender.id}`});
    if (typeof homeyDevice === 'undefined' || homeyDevice instanceof Error) return;

    // Get the exclude list
    let devicelist = new HdlDevicelist();
    let exclude = await devicelist.excludeCapabilities(signal.sender.type.toString());

    // Check if there is a motion sensor input
    if ( hasMotion && !exclude.includes("alarm_motion")) {
      consoleLogging ? this.log(`Motion sensor input for ${signal.sender.id}: ${signal.data.movement}`) : null;
      await this.checkCapabilityAdded(homeyDevice, "alarm_motion");
      homeyDevice
        .setCapabilityValue("alarm_motion", signal.data.movement)
        .catch(this.error);
    }

    // Check if there is a Universal Switch indicating motion
    if ( hasUV && !exclude.includes("alarm_motion") ) {
      await this.checkCapabilityAdded(homeyDevice, "alarm_motion");
      homeyDevice
        .setCapabilityValue("alarm_motion", signal.data.status)
        .catch(this.error);
    }

    // Set temperature
    if ( hasTemp && !exclude.includes("measure_temperature") ) {
      consoleLogging ? this.log(`Temp input for ${signal.sender.id}: ${signal.data.temperature}`) : null;
      await this.checkCapabilityAdded(homeyDevice, "measure_temperature");
      homeyDevice
        .setCapabilityValue("measure_temperature", signal.data.temperature)
        .catch(this.error);
    }

    // Set brighness
    if ( hasLux && !exclude.includes("measure_luminance")) {
      consoleLogging ? this.log(`Luminance input for ${signal.sender.id}: ${signal.data.temperature}`) : null;
      await this.checkCapabilityAdded(homeyDevice, "measure_luminance");
      homeyDevice
        .setCapabilityValue("measure_luminance", signal.data.brightness)
        .catch(this.error);
    }

    // Set humidity
    if ( hasHum && !exclude.includes("measure_humidity")) {
      consoleLogging ? this.log(`Humidity input for ${signal.sender.id}: ${signal.data.temperature}`) : null;
      await this.checkCapabilityAdded(homeyDevice, "measure_humidity");
      homeyDevice
        .setCapabilityValue("measure_humidity", signal.data.humidity)
        .catch(this.error);
    }

    // Set DryContacts
    if ( hasDryContact ) {
      for (const dryContact in signal.data.dryContacts) {
        if ((parseInt(dryContact) + 1) <= 4) {
          let registered_drycontact = `dry_contact_${parseInt(dryContact) + 1}`;
          consoleLogging ? this.log(`Dry Contact input for ${signal.sender.id}/${registered_drycontact}: ${signal.data.dryContacts[dryContact].status}`) : null;
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

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
}

module.exports = MultisensorDriver;
