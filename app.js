"use strict";

const Homey = require("homey");
const SmartBus = require("smart-bus");
const HdlDevicelist = require("./hdl/hdl_devicelist");
const { pressPanelButton } = require("./hdl/dlp-buttons");
const { DlpHeaterService } = require("./hdl/dlp-heater-service");
const { DlpReadQueue } = require('./hdl/dlp-read-queue');

class HDLSmartBus extends Homey.App {
  logDlpDebug(message) {
    if (this.homey.settings.get('hdl_dlp_debug') === true) this.log(message());
  }

  async onInit() {
    this._busConnected = false;
    this._bus = null;
    this._controller = null;
    this._hdlDevicelist = new HdlDevicelist();
    this._updateInterval = null;
    this._updateTimeouts = [];
    this._pollIntervalMs = 60000;
    this._dlpServices = new Map();
    this.homey.flow.getActionCard('panel_press_button')
      .registerRunListener(async args => pressPanelButton(this, args.device, args.button));
    // All new devicetypes must be added here
    this._driverlist = [
      "dimmer",
      "relay",
      "tempsensor",
      "multisensor",
      "dry-contact",
      "universal-switch",
      "floorheater",
      "curtain",
      "panel",
      "dlpheater",
    ];
    this._hdlFoundUnits = {}
    for (let i = 0; i < this._driverlist.length; i++) {
      this._hdlFoundUnits[this._driverlist[i]] = {}
    }

    this.log("Homey HDL SmartBus app has been initialized...");

    try {
      await this.connect();
    } catch (err) {
      this.log(err.message);
    }
  }

  async connect() {
    if ([undefined, null, ''].includes(this.homey.settings.get('hdl_poll_interval')))
      this.homey.settings.set('hdl_poll_interval', '60');
    let hdl_ip_address = this.homey.settings.get("hdl_ip_address");
    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    let hdl_id = this.homey.settings.get("hdl_id");
    let hdl_motion = this.homey.settings.get("hdl_universal_motion");

    // Set the universal motion if not set
    if (hdl_motion === undefined || hdl_motion === "") {
      this.homey.settings.set("hdl_universal_motion", "212");
    }

    // Return if settings are not defined
    if (
      hdl_ip_address === undefined ||
      hdl_ip_address === "" ||
      hdl_subnet === undefined ||
      hdl_subnet === "" ||
      hdl_id === undefined ||
      hdl_id === ""
    )
      return;

    // Return if not proper ip, subnet or id
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    const subnetRegex = /^\d{1,3}$/;

    // Validate IPv4 address and ensure each octet is 0-255
    if (!ipRegex.test(hdl_ip_address)) return;
    const ipOctets = hdl_ip_address.split('.');
    for (const octet of ipOctets) {
      const octetValue = parseInt(octet, 10);
      if (octetValue < 0 || octetValue > 255) return;
    }

    // Validate subnet (1-254)
    if (!subnetRegex.test(hdl_subnet)) return;
    let hdl_subnet_int = parseInt(hdl_subnet, 10);
    if (hdl_subnet_int < 1 || hdl_subnet_int > 254) return;

    // Validate ID if provided (1-254)
    if (hdl_id !== undefined && hdl_id !== "") {
      if (!subnetRegex.test(hdl_id)) return;
      let hdl_id_int = parseInt(hdl_id, 10);
      if (hdl_id_int < 1 || hdl_id_int > 254) return;
    }

    // Close if the bus is already is running
    this._busConnected = false;
    if (this._bus !== null) {
      this._bus.close();
      this._bus = null;
    }

    this._clearUpdateTimeouts();

    // Clear any existing update interval
    if (this._updateInterval !== null) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }

    // Connect the bus
    this._bus = new SmartBus({
      gateway: hdl_ip_address,
      port: 6000,
    });

    this._controller = this._bus.controller(`${hdl_subnet}.${hdl_id}`);

    // Send out a discovery ping
    this._controller.send(
      {
        target: "255.255",
        command: 0x000e,
      },
      (err) => {
        if (err) {
          this.homey.app.log(err);
        }
      }
    );

    // Listen to bus
    this._bus.on("command", (signal) => {
      try {
        this.homey.app._signalReceived(signal);
      } catch (err) {
        this.log(`Could not parse received data: ${err}`);
      }
    });

    // Set the bus as connected
    this._busConnected = true;
    this.log("Homey HDL SmartBus is running...");
    this.log("Initializing recurring update...");
    this._pollIntervalMs = this._getPollIntervalMs();
    this._updateInterval = setInterval(async () => {
      this.homey.app.callForUpdate(this._bus);
    }, this._pollIntervalMs);
  }

  // Get the poll interval in milliseconds from the app settings. Invalid
  // values fall back to the default of 60 seconds, and the interval is
  // limited to 10-600 seconds to protect the bus from too much traffic
  _getPollIntervalMs() {
    let hdl_poll_interval = this.homey.settings.get("hdl_poll_interval");
    let seconds = parseInt(hdl_poll_interval, 10);
    if (isNaN(seconds) || seconds < 10 || seconds > 600) return 60000;
    return seconds * 1000;
  }

  // Cancel any pending staggered update requests
  _clearUpdateTimeouts() {
    if (this._updateTimeouts === undefined) {
      this._updateTimeouts = [];
      return;
    }
    this._updateTimeouts.forEach((timeout) => clearTimeout(timeout));
    this._updateTimeouts = [];
  }

  async callForUpdate(_bus) {
    this._clearUpdateTimeouts();
    const connection = this._bus;
    this.log("Update called - looping through drivers");
    // Collect all devices so that their requests can be staggered across
    // the poll interval instead of firing one burst on the bus
    let devices = [];
    for (let i = 0; i < this._driverlist.length; i++) {
      devices = devices.concat(
        this.homey.drivers.getDriver(this._driverlist[i]).getDevices()
      );
    }
    if (devices.length === 0) return;
    const spacing = (this._pollIntervalMs || 60000) / devices.length;
    for (let i = 0; i < devices.length; i++) {
      const device = devices[i];
      const timeout = setTimeout(() => {
        try {
          if (connection !== this._bus || !this.isBusConnected()) return;
          // Busy DLP operations are skipped by the shared transaction service.
          Promise.resolve(device.requestUpdate({ periodic: true })).catch(err => this.log(
            'Could not request update: ' + err.message));
        } catch (err) {
          this.log(`Could not request update: ${err}`);
        }
        this._updateTimeouts = this._updateTimeouts.filter(
          (pending) => pending !== timeout
        );
      }, Math.round(i * spacing));
      this._updateTimeouts.push(timeout);
    }
  }

  isBusConnected() {
    if (this._bus === null) {
      return false;
    }

    return this._busConnected;
  }

  bus() {
    return this._bus;
  }

  controller() {
    return this._controller;
  }

  dlpService(address) {
    if (!this._dlpServices.has(address)) this._dlpServices.set(address, new DlpHeaterService(this, 5000, address));
    return this._dlpServices.get(address);
  }

  queueDlpRead(device) {
    this._dlpReadQueue ??= new DlpReadQueue({
      connected: () => this.isBusConnected(),
      busy: candidate => candidate.service().busy,
      read: async candidate => {
        const connection = this.bus();
        const state = await candidate.service().readStatus({ retry: true });
        return connection === this.bus() ? state : null;
      },
    });
    return this._dlpReadQueue.enqueue(device);
  }

  cancelDlpRead(device) { this._dlpReadQueue?.cancel(device); }

  getDevicesOfType(drivername) {
    return this._hdlFoundUnits[drivername];
  }

  // Get the signature of a device with channels
  devSignChnld(id, channel){
    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    return {
      id: `${hdl_subnet}.${id}.${channel}`,
      address: `${hdl_subnet}.${id}`,
      channel: channel
    };
  }

  valueOK(type, value) {
    if (typeof value === "undefined") return false;
    switch (type) {
      case "temperature":
        if (typeof value !== "number") return false;
        if (value < -40 || value > 80) return false;
        return true;
      case "humidity":
        if (typeof value !== "number") return false;
        if (value < 0 || value > 100) return false;
        return true;
      case "lux":
        if (typeof value !== "number") return false;
        if (value < 0 || value > 100000) return false;
        return true;
    }
    return true;
  }

  async _updateDevice(hdlSenderType, signal) {
    if (signal.code === 0xF) return; // Ignore discovery signals

    // Silently ignore expected errors that don't need logging
    // "Driver Not Initialized" can happen during app startup when signals arrive
    // before drivers have finished initializing - this is normal and resolves quickly
    const silentErrors = [
      "invalid_device",
      "device is not defined",
      "Could not get device by device data",
      "Driver Not Initialized"
    ];

    await this.homey.drivers.getDriver(hdlSenderType).updateValues(signal).catch((error) => {
      // Only log unexpected errors
      if (!silentErrors.includes(error.message)) {
        this.log(`Error for ${hdlSenderType} ${signal.sender.id}: ${error.message}`);
      }
    });
  }

  async _signalReceived(signal) {
    // Check to see that the subnet is the same
    let allowed_subnets = [parseInt(this.homey.settings.get("hdl_subnet"), 10), 255];
    if (!allowed_subnets.includes(parseInt(signal.sender.subnet, 10))) return;

    // Catch errors when trying to access the signal.data
    let dataFromSignal;
    try {
      dataFromSignal = signal.data;
    } catch(_err) {
      dataFromSignal = undefined;
    }

    // Check for universal switch
    if (dataFromSignal !== undefined && dataFromSignal.switch !== undefined) {
      await this._updateDevice("universal-switch", signal);
    }

    // Check if the device type is known
    const foundType = await this._hdlDevicelist.typeOfDevice(signal.sender.type.toString());

    // Return if no type was found
    if (foundType === null) return;

    // Allow failing signal data only if the device is a curtain
    // (curtains are extending the signal data)
    const rawPanelStatus = foundType === 'panel'
      && [0x1945, 0x1947, 0xe3d9].includes(signal.code)
      && Buffer.isBuffer(signal.payload);
    if (foundType !== "curtain" && dataFromSignal === undefined && !rawPanelStatus) return;
    if (signal.sender.id === undefined) return;

    // Add the device to the list of found devices
    this._hdlFoundUnits[foundType][signal.sender.id] = signal.sender;

    // Update the driver with the signal
    if (foundType === 'panel') {
      const thermostat = [0x1945, 0x1947].includes(signal.code)
        || (signal.code === 0xe3d9 && Buffer.isBuffer(signal.payload)
          && [0x14, 0x19].includes(signal.payload[0]));
      if (thermostat) {
        await this._updateDevice('dlpheater', signal);
        if (signal.code === 0x1945) await this._updateDevice('panel', signal);
      }
      else if (signal.code === 0xe3d9) {
        if (signal.payload?.[0] === 0x15) await this._updateDevice('dlpheater', signal);
        await this._updateDevice('panel', signal);
      }
      else {
        // Preserve legacy ambient-temperature notifications for Heater.
        await this._updateDevice('dlpheater', signal);
        await this._updateDevice('panel', signal);
      }
      return;
    }
    await this._updateDevice(foundType, signal);
  }
  async onUninit() {
    this._dlpReadQueue?.close();
    this._clearUpdateTimeouts();
    for (const service of this._dlpServices?.values() || []) service.cancelHeaterOperation();
    if (this._updateInterval !== null) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
    if (this._bus !== null) {
      this._bus.close();
      this._bus = null;
    }
    this._busConnected = false;
  }
}
module.exports = HDLSmartBus;
