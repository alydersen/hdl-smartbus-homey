"use strict";

const Homey = require("homey");
const SmartBus = require("smart-bus");
const relayDriverName = "relay";
const dimmerDriverName = "dimmer";

class HDLSmartBus extends Homey.App {
  onInit() {
    this._busConnected = false;
    this._bus = null;
    this._homeyRelayDriver = Homey.ManagerDrivers.getDriver(relayDriverName);
    this._homeyDimmerDriver = Homey.ManagerDrivers.getDriver(dimmerDriverName);
    this._relays = {};
    this._dimmers = {};

    (async (args, callback) => {
      try {
        await this.connect();
      } catch (err) {
        this.log(err.message);
      }
    })();

    this.log("Homey HDL SmartBus app has been initialized...");
  }

  async connect() {
    this._busConnected = false;
    // Return if settings are not defined
    if (Homey.ManagerSettings.get("hdl_ip_address") == undefined) return;
    if (Homey.ManagerSettings.get("hdl_ip_address") == "") return;
    if (Homey.ManagerSettings.get("hdl_subnet") == undefined) return;
    if (Homey.ManagerSettings.get("hdl_subnet") == "") return;

    // Close if the bus is already is running
    if (this._bus != null) {
      this._bus.close();
      this._bus = null;
    }

    // Connect the bus
    this._bus = new SmartBus(
      `hdl://${Homey.ManagerSettings.get("hdl_ip_address")}:6000`
    );

    // Listen to bus
    this._bus.on("command", function(command) {
      if (
        command.sender.subnet ==
        parseInt(Homey.ManagerSettings.get("hdl_subnet"))
      ) {
        this._deviceUpdated.bind(command);
      }
      //.on("device updated", this._deviceUpdated.bind(this))
    });

    // Set the bus as connected
    this._busConnected = true;
    this.log("Homey HDL SmartBus is running...");
  }

  isBusConnected() {
    return this._busConnected;
  }

  bus() {
    return this._bus;
  }

  _deviceUpdated(command) {
    console.log(command.sender.id);
    console.log(command.data);
    if (
      this.devicelist["dimmers"][command.sender.type.toString()] != undefined
    ) {
      this.log("Message from a dimmer");
    } else if (
      this.devicelist["relays"][command.sender.type.toString()] != undefined
    ) {
      this.log("Message from a relay");
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
      }
    };
  }
}
module.exports = HDLSmartBus;
