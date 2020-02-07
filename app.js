"use strict";

const Homey = require("homey");
const SmartBus = require("smart-bus");

class HDLSmartBus extends Homey.App {
  onInit() {
    this._busConnected = false;
    this._bus = null;
    this._dimmers = {};
    this._relays = {};
    this._multisensors = {};

    (async (args, callback) => {
      try {
        await this.connect();
      } catch (err) {
        Homey.app.log(err.message);
      }
    })();

    this.log("Homey HDL SmartBus app has been initialized...");
  }

  async connect() {
    let hdl_ip_address = Homey.ManagerSettings.get("hdl_ip_address");
    let hdl_subnet = Homey.ManagerSettings.get("hdl_subnet");
    // Return if settings are not defined
    if (
      hdl_ip_address == undefined ||
      hdl_ip_address == "" ||
      hdl_subnet == undefined ||
      hdl_subnet == ""
    )
      return;

    // Close if the bus is already is running
    this._busConnected = false;
    if (this._bus != null) {
      this._bus.close();
      this._bus = null;
    }

    // Connect the bus
    this._bus = new SmartBus(`hdl://${hdl_ip_address}:6000`);

    // Send out a discovery ping
    this._bus.send("255.255", 0x000e, function(err) {
      if (err) {
        Homey.app.log(err);
      }
    });

    // Listen to bus
    this._bus.on("command", function(signal) {
      Homey.app._signalReceived(signal);
    });

    this._bus.on(49, function(signal) {
      Homey.app._motionReceived(signal);
    });

    // Set the bus as connected
    this._busConnected = true;
    this.log("Homey HDL SmartBus is running...");
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

  getDimmers() {
    return this._dimmers;
  }

  getRelays() {
    return this._relays;
  }

  getMultisensors() {
    return this._multisensors;
  }

  _signalReceived(signal) {
    // Check to see that the subnet is the same
    if (
      signal.sender.subnet != parseInt(Homey.ManagerSettings.get("hdl_subnet"))
    )
      return;

    let senderType = signal.sender.type.toString();
    if (
      // DIMMERS
      this.devicelist["dimmers"][senderType] != undefined
    ) {
      this._dimmers[signal.sender.id] = signal.sender;
      Homey.ManagerDrivers.getDriver("dimmer").updateValues(signal);
    } else if (
      // RELAYS
      this.devicelist["relays"][senderType] != undefined
    ) {
      this._relays[signal.sender.id] = signal.sender;
      Homey.ManagerDrivers.getDriver("relay").updateValues(signal);
    } else if (
      // MULTISENSORS
      this.devicelist["multisensors"][senderType] != undefined
    ) {
      this._multisensors[signal.sender.id] = signal.sender;
      Homey.ManagerDrivers.getDriver("multisensor").updateValues(signal);
    }
  }

  _motionReceived(signal) {
    // Check to see that the subnet is the same
    if (
      signal.sender.subnet != parseInt(Homey.ManagerSettings.get("hdl_subnet"))
    )
      return;

    let senderType = signal.sender.type.toString();
    if (
      // MULTISENSORS
      this.devicelist["multisensors"][senderType] != undefined
    ) {
      this._multisensors[signal.sender.id] = signal.sender;
      Homey.ManagerDrivers.getDriver("multisensor").updateValues(
        signal,
        "motion"
      );
    }
  }

  get devicelist() {
    // This is a list of the different devises and theirs channels and
    // properties
    return {
      dimmers: {
        600: { channels: 6 },
        601: { channels: 4 },
        602: { channels: 2 },
        606: { channels: 2 },
        607: { channels: 4 },
        608: { channels: 6 },
        609: { channels: 1 },
        610: { channels: 6 },
        611: { channels: 4 },
        612: { channels: 2 },
        613: { channels: 6 },
        614: { channels: 2 },
        615: { channels: 4 },
        616: { channels: 4 },
        617: { channels: 6 },
        618: { channels: 1 },
        619: { channels: 2 }
      },
      relays: {
        423: { channels: 4 },
        425: { channels: 6 },
        426: { channels: 6 },
        427: { channels: 8 },
        428: { channels: 8 },
        429: { channels: 12 },
        430: { channels: 12 },
        431: { channels: 12 },
        432: { channels: 24 },
        433: { channels: 4 },
        434: { channels: 4 },
        435: { channels: 4 },
        436: { channels: 8 },
        437: { channels: 4 },
        438: { channels: 4 },
        439: { channels: 8 },
        440: { channels: 12 },
        441: { channels: 4 },
        442: { channels: 8 },
        443: { channels: 12 },
        444: { channels: 4 },
        445: { channels: 8 },
        446: { channels: 12 },
        447: { channels: 4 },
        448: { channels: 8 },
        449: { channels: 12 },
        450: { channels: 16 },
        451: { channels: 16 },
        454: { channels: 3 },
        456: { channels: 8 },
        457: { channels: 3 },
        458: { channels: 4 },
        459: { channels: 4 },
        460: { channels: 8 },
        461: { channels: 12 },
        462: { channels: 4 },
        463: { channels: 8 },
        464: { channels: 12 },
        465: { channels: 16 },
        466: { channels: 16 },
        467: { channels: 3 },
        468: { channels: 6 },
        469: { channels: 4 },
        470: { channels: 6 }
      },
      multisensors: {
        305: { temperature: true, motion: true },
        307: { temperature: true, motion: true },
        308: { temperature: true, motion: true },
        309: { temperature: true, motion: true },
        312: { temperature: true, motion: true },
        314: { temperature: true, motion: true },
        315: { temperature: true, motion: true },
        316: { temperature: true, motion: true },
        318: { temperature: true, motion: true },
        321: { temperature: true, motion: true },
        322: { temperature: true, motion: true },
        328: { temperature: true, motion: true },
        329: { temperature: true, motion: true },
        336: { temperature: true, motion: true },
        337: { temperature: true, motion: true },
        340: { temperature: true, motion: true }
      }
    };
  }
}
module.exports = HDLSmartBus;
