"use strict";

const Homey = require("homey");
const SmartBus = require("smart-bus");
const HdlDevicelist = require("./hdl/hdl_devicelist");

class HDLSmartBus extends Homey.App {

  async onInit() {
    this._busConnected = false;
    this._bus = null;
    this._controller = null;
    this._hdlDevicelist = new HdlDevicelist();
    // All new devicetypes must be added here
    this._driverlist = [
      "dimmer",
      "relay",
      "tempsensor",
      "multisensor",
      "universal-switch",
      "floorheater",
      "curtain"
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
    let hdl_ip_address = this.homey.settings.get("hdl_ip_address");
    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    let hdl_id = this.homey.settings.get("hdl_id");
    let hdl_motion = this.homey.settings.get("hdl_universal_motion");

    // Set the universal motion if not set
    if (hdl_motion == undefined || hdl_motion == "") {
      this.homey.settings.set("hdl_universal_motion", "212");
    }

    // Return if settings are not defined
    if (
      hdl_ip_address == undefined ||
      hdl_ip_address == "" ||
      hdl_subnet == undefined ||
      hdl_subnet == "" ||
      hdl_id == undefined ||
      hdl_id == ""
    )
      return;

    // Return if not proper ip, subnet or id
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/g;
    const subnetRegex = /^\d{1,3}$/g;
    if (!hdl_ip_address.match(ipRegex)) return;
    if (!hdl_subnet.match(subnetRegex)) return;
    let hdl_subnet_int = parseInt(hdl_subnet);
    if (hdl_subnet_int < 1) return;
    if (hdl_subnet_int > 254) return;
    if (hdl_id != undefined && hdl_id != "") {
      if (!hdl_id.match(subnetRegex)) return;
      let hdl_id_int = parseInt(hdl_id);
      if (hdl_id_int < 1) return;
      if (hdl_id_int > 254) return;
    }

    // Close if the bus is already is running
    this._busConnected = false;
    if (this._bus != null) {
      this._bus.close();
      this._bus = null;
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
      function (err) {
        if (err) {
          this.log(err);
        }
      }
    );

    // Listen to bus
    this._bus.on("command", (signal) => {
      try {
        this.homey.app._signalReceived(signal);
      } catch (err) {
        console.log(`Could not parse received data: ${err}`);
      }
    });

    // Set the bus as connected
    this._busConnected = true;
    this.log("Homey HDL SmartBus is running...");
    this.log("Initializing recurring update...");
    setInterval(async () => {
      this.homey.app.callForUpdate(this._bus);
    }, 60000);
  }

  async callForUpdate(bus) {
    this.log("Update called - looping through drivers");
    for (let i = 0; i < this._driverlist.length; i++) {
      this.homey.drivers
        .getDriver(this._driverlist[i])
        .getDevices()
        .forEach(function (device) {
          device.requestUpdate();
        });
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

  getDevicesOfType(drivername) {
    return this._hdlFoundUnits[drivername];
  }

  async _updateDevice(hdlSenderType, signal) {
    const unknownDeviceMessages = ["invalid_device", "device is not defined", "Could not get device by device data"]
    await this.homey.drivers.getDriver(hdlSenderType).updateValues(signal).catch((error) => {
      if (! (unknownDeviceMessages.includes(error.message))) {
        this.log(`Error for ${hdlSenderType} ${signal.sender.id}: ${error.message}`);
      }
    });
  }

  async _signalReceived(signal) {
    // Check to see that the subnet is the same
    let allowed_subnets = [this.homey.settings.get("hdl_subnet"), "255"];
    if (!allowed_subnets.includes(signal.sender.subnet)) return;

    // Catch errors when trying to access the signal.data
    try {
      var dataFromSignal = signal.data;
    } catch(err) {
      var dataFromSignal = undefined;
    }

    // Check for universal switch
    if (dataFromSignal != undefined && dataFromSignal.switch != undefined) {
      await this._updateDevice("universal-switch", signal);
    }

    // Check if the device type is known
    var foundType = await this._hdlDevicelist.typeOfDevice(signal.sender.type.toString());  

    // Return if no type was found
    if (foundType == null) return;

    // Allow failing signal data only if the device is a curtain
    // (curtains are extending the signal data)
    if (!foundType == "curtain" && dataFromSignal == undefined) return;

    // Add the device to the list of found devices
    this._hdlFoundUnits[foundType][signal.sender.id] = signal.sender;

    // Update the driver with the signal
    await this._updateDevice(foundType, signal);
  }
}
module.exports = HDLSmartBus;
