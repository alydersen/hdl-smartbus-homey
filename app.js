"use strict";

const Homey = require("homey");
const SmartBus = require("smart-bus");
const HdlDimmers = require("./hdl/hdl_dimmers");
const HdlRelays = require("./hdl/hdl_relays");
const HdlMultisensors = require("./hdl/hdl_multisensors");
const HdlTempsensors = require("./hdl/hdl_tempsensors");

class HDLSmartBus extends Homey.App {

  async onInit() {
    this._busConnected = false;
    this._bus = null;
    this._controller = null;
    this._dimmers = {};
    this._relays = {};
    this._multisensors = {};
    this._tempsensors = {};

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
        console.log(`Could not parse data from ${signal.sender.id}: ${err}`);
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
    let drivers = [
      "dimmer",
      "relay",
      "tempsensor",
      "multisensor",
      "universal-switch",
    ];

    for (let i = 0; i < drivers.length; i++) {
      this.homey.drivers
        .getDriver(drivers[i])
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

  getDimmers() {
    return this._dimmers;
  }

  getRelays() {
    return this._relays;
  }

  getMultisensors() {
    return this._multisensors;
  }

  getTempsensors() {
    return this._tempsensors;
  }

  async _signalReceived(signal) {
    // Check to see that the subnet is the same
    if (
      signal.sender.subnet !=
      parseInt(this.homey.settings.get("hdl_subnet"))
    )
      return;

    // UNIVERSAL SWITCH
    if (signal.data != undefined) {
      if (signal.data.switch != undefined) {
        this.homey.drivers
          .getDriver("universal-switch")
          .updateValues(signal)
          .catch((error) => {
            if (error.message !== 'invalid_device') {
              console.error(error.message);
            }
          });
      }
    }

    let senderType = signal.sender.type.toString();
    let hdlDimmers = new HdlDimmers(senderType);
    let hdlRelays = new HdlRelays(senderType);
    let hdlMultisensors = new HdlMultisensors(senderType);
    let hdlTempsensors = new HdlTempsensors(senderType);
    if (await hdlDimmers.isOne()) {
      // DIMMERS
      this._dimmers[signal.sender.id] = signal.sender;
      await this.homey.drivers.getDriver("dimmer").updateValues(signal).catch((error) => {
        if (error.message !== 'invalid_device') {
          console.error(error.message);
        }
      });
    } else if (await hdlRelays.isOne()) {
      // RELAYS
      this._relays[signal.sender.id] = signal.sender;
      await this.homey.drivers.getDriver("relay").updateValues(signal).catch((error) => {
        if (error.message !== 'invalid_device') {
          console.error(error.message);
        }
      });
    } else if (await hdlMultisensors.isOne()) {
      // MULTISENSORS
      this._multisensors[signal.sender.id] = signal.sender;
      await this.homey.drivers.getDriver("multisensor").updateValues(signal).catch((error) => {
        if (error.message !== 'invalid_device') {
          console.error(error.message);
        }
      });
    } else if (await hdlTempsensors.isOne()) {
      // TEMPSENSORS
      this._tempsensors[signal.sender.id] = signal.sender;
      await this.homey.drivers.getDriver("tempsensor").updateValues(signal).catch((error) => {
        if (error.message !== 'invalid_device') {
          console.error(error.message);
        }
      });
    }
  }
}
module.exports = HDLSmartBus;
