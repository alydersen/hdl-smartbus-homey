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
      await device.addCapability(capability).catch(this.error);
    }
  }

  async updateValues(signal) {
    // Parse and check the incoming signal, return if missing or invalid
    if (signal.sender.type === undefined) return;

    // Get the Motion UVS from Homey settings
    let hdlUVSwitch = parseInt(this.homey.settings.get("hdl_universal_motion"), 10);

    // Check which signals are present and range
    let hasTemp = this.homey.app.valueOK("temperature", signal.data.temperature);
    let hasHum = this.homey.app.valueOK("humidity", signal.data.humidity);
    let hasLux = this.homey.app.valueOK("lux", signal.data.brightness);
    let hasMotion = signal.data.movement !== undefined;
    let hasDryContact = signal.data.dryContacts !== undefined;
    let hasUV = signal.data.switch !== undefined && signal.data.status !== undefined && hdlUVSwitch === signal.data.switch;

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
      consoleLogging ? this.log(`Luminance input for ${signal.sender.id}: ${signal.data.brightness}`) : null;
      await this.checkCapabilityAdded(homeyDevice, "measure_luminance");
      homeyDevice
        .setCapabilityValue("measure_luminance", signal.data.brightness)
        .catch(this.error);
    }

    // Set humidity
    if ( hasHum && !exclude.includes("measure_humidity")) {
      consoleLogging ? this.log(`Humidity input for ${signal.sender.id}: ${signal.data.humidity}`) : null;
      await this.checkCapabilityAdded(homeyDevice, "measure_humidity");
      homeyDevice
        .setCapabilityValue("measure_humidity", signal.data.humidity)
        .catch(this.error);
    }

    // Set DryContacts
    if ( hasDryContact ) {
      for (const dryContact in signal.data.dryContacts) {
        const contactIndex = parseInt(dryContact, 10);
        if (Number.isNaN(contactIndex)) continue;

        const capabilityIndex = contactIndex + 1;
        if (capabilityIndex > 8) continue;

        const registered_drycontact = `dry_contact_${capabilityIndex}`;
        const contactStatus = Boolean(signal.data.dryContacts[dryContact].status);

        consoleLogging ? this.log(`Dry Contact input for ${signal.sender.id}/${registered_drycontact}: ${contactStatus}`) : null;
        await this.checkCapabilityAdded(homeyDevice, registered_drycontact);
        homeyDevice
          .setCapabilityValue(registered_drycontact, contactStatus)
          .catch(this.error);
      }
    }

    // Set relay outputs (only sensor types with relay channel metadata, e.g. the 12in1)
    const relayChannels = await devicelist.relayChannels(signal.sender.type.toString());
    if (relayChannels > 0) {
      // Single Channel Control answerback (0x0032) carries one channel's status
      if (signal.code === 0x0032 && signal.data.channel !== undefined && signal.data.level !== undefined) {
        await this.updateRelayOutputs(homeyDevice, signal.sender.id, signal.data.channel, signal.data.level, relayChannels);
      }

      // Read Status of Channels responses (0x0034/0x0039) carry every channel's status
      if ((signal.code === 0x0034 || signal.code === 0x0039) && signal.data.channels !== undefined) {
        for (const channel of signal.data.channels) {
          if (channel.number === undefined || channel.level === undefined) continue;
          await this.updateRelayOutputs(homeyDevice, signal.sender.id, channel.number, channel.level, relayChannels);
        }
      }
    }
  }

  async updateRelayOutputs(homeyDevice, senderId, channel, level, relayChannels) {
    if (channel < 1 || channel > relayChannels) return;

    const capability = `relay_${channel}`;
    const newValue = level !== 0;

    consoleLogging ? this.log(`Relay output for ${senderId}/${capability}: ${newValue}`) : null;
    await this.checkCapabilityAdded(homeyDevice, capability);

    // Homey fires the relay_<n>_true/false flow triggers on setCapabilityValue;
    // skip unchanged values to avoid duplicate triggers
    const previous = homeyDevice.getCapabilityValue(capability);
    if (previous === newValue) return;

    homeyDevice
      .setCapabilityValue(capability, newValue)
      .catch(this.error);

    // The capability was just added to an already-running device; wire up its
    // control listener so Homey can switch the relay output
    if (typeof homeyDevice.registerRelayListener === "function") {
      homeyDevice.registerRelayListener(capability, channel);
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
        let relayChannels = await devicelist.relayChannels(device.type.toString());

        const capabilities = [cap];
        for (let channel = 1; channel <= relayChannels; channel++) {
          capabilities.push(`relay_${channel}`);
        }

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

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
}

module.exports = MultisensorDriver;
