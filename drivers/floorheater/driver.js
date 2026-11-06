"use strict";

const Homey = require("homey");
const HdlDevicelist = require("./../../hdl/hdl_devicelist");

// Digital sensor probes report on channel 50 + the factory-set probe ID.
// The probe ID is typically two or three digits (roughly 1-300), so the
// fixed channels 51-62 in the device list only cover a small subset; the
// custom pairing views let the user type any probe ID instead (issue #72).
const PROBE_ID_MIN = 1;
const PROBE_ID_MAX = 300;
const PROBE_CHANNEL_OFFSET = 50;

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
    // 0x7263 (since smart-bus 0.10.0) and the other floor heating
    // responses all expose the channel via signal.data
    let channel = signal.data && signal.data.channel;
    if (typeof channel === "undefined") return;

    // Get the device from Homey, return if not found or error
    let signature = this.homey.app.devSignChnld(signal.sender.id, channel);
    let homeyDevice = this.getDevice(signature);
    if ( typeof homeyDevice === 'undefined' || homeyDevice instanceof Error ) return;
    
    switch (signal.code) {
      case 0x1C5F:
      case 0x1C5D: {
        // read floor heating status
        if (signal.data.temperature && this.homey.app.valueOK("temperature", signal.data.temperature.normal)) {
          homeyDevice.updateLevel(signal.data.temperature.normal);
        }
        // valve, work, PWD and watering are parsed by smart-bus 0.9.0
        // (0x1C5D/0x1C5F); the raw byte re-reads from the smart-bus
        // 0.7.0 era were redundant and have been removed
        const valveState = (() => {
          if (typeof signal.data.PWD !== "undefined") return Boolean(signal.data.PWD);
          if (signal.data.watering && typeof signal.data.watering.status !== "undefined") {
            return Boolean(signal.data.watering.status);
          }
          if (signal.data.work && typeof signal.data.work.status !== "undefined") {
            return Boolean(signal.data.work.status);
          }
          if (typeof signal.data.valve !== "undefined") return Boolean(signal.data.valve);
          return undefined;
        })();

        if (typeof valveState === "boolean") {
          const key = signature.id;
          const last = this._lastValveValue && this._lastValveValue.get(key);
          if (last !== valveState) {
            homeyDevice.updateValve(valveState);
            this._lastValveValue.set(key, valveState);
          }
        }

        if (signal.data.work && typeof signal.data.work.status !== "undefined") {
          homeyDevice.updatePowerSwitch(Boolean(signal.data.work.status));
        }

        homeyDevice.currentData = signal.data;
        return;
      }

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
      let channel;
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
      // Digital temperature sensors connected to the floor heating controller.
      // They are read-only, so pair them with only the measured temperature
      // capability: the heating-zone capabilities then never exist on the
      // device and never show up in Insights. (Devices paired before this
      // still lose the zone capabilities via FloorheaterDevice.onInit().)
      const sensorChannels = await devicelist.sensorChannels(device.type.toString());
      for (const sensorChannel of sensorChannels) {
        devices.push({
          name: `HDL Floor Sensor (${hdl_subnet}.${device.id} ch ${sensorChannel})`,
          data: {
            id: `${hdl_subnet}.${device.id}.${sensorChannel}`,
            address: `${hdl_subnet}.${device.id}`,
            channel: sensorChannel
          },
          capabilities: ["measure_temperature"]
        });
      }
    }
    return devices.sort(FloorHeaterDriver._compareHomeyDevice);
  }

  // Custom pairing flow. The first two views are defined in
  // drivers/floorheater/pair/ and drive the mode: "discovered" shows the
  // zones and built-in sensor channels from onPairListDevices(), "probe"
  // shows a single read-only device for a typed-in sensor probe ID.
  async onPair(session) {
    let pairMode = "discovered";
    let probeDevice = null;

    session.setHandler("pair_mode", async (mode) => {
      if (mode === "discovered" || mode === "probe") pairMode = mode;
    });

    session.setHandler("list_controllers", async () => {
      return this._discoveredControllers();
    });

    session.setHandler("pair_probe", async ({ address, probeId } = {}) => {
      this._requireBusConnection();
      const addresses = this._discoveredControllers().map((controller) => controller.address);
      if (!addresses.includes(address)) {
        throw new Error("Unknown floor heating controller. Select one from the list.");
      }
      probeDevice = this._buildProbeDevice(address, probeId);
      pairMode = "probe";
      return probeDevice;
    });

    session.setHandler("list_devices", async () => {
      if (pairMode === "probe" && probeDevice !== null) return [probeDevice];
      return this.onPairListDevices();
    });
  }

  _requireBusConnection() {
    if (!this.homey.app.isBusConnected()) {
      throw new Error("Please configure the app settings first.");
    }
  }

  _discoveredControllers() {
    this._requireBusConnection();
    const hdl_subnet = this.homey.settings.get("hdl_subnet");
    return Object.values(this.homey.app.getDevicesOfType("floorheater")).map((device) => ({
      address: `${hdl_subnet}.${device.id}`
    }));
  }

  _buildProbeDevice(address, probeId) {
    const id = Number(probeId);
    if (!Number.isInteger(id) || id < PROBE_ID_MIN || id > PROBE_ID_MAX) {
      throw new Error(`The sensor probe ID must be a whole number between ${PROBE_ID_MIN} and ${PROBE_ID_MAX}.`);
    }
    const channel = PROBE_CHANNEL_OFFSET + id;
    return {
      name: `HDL Floor Sensor (${address} probe ${id})`,
      data: {
        id: `${address}.${channel}`,
        address: address,
        channel: channel
      },
      capabilities: ["measure_temperature"]
    };
  }

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
}

module.exports = FloorHeaterDriver;


