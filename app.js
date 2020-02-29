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
    this._tempsensors = {};

    this.log("Homey HDL SmartBus app has been initialized...");

    (async (args, callback) => {
      try {
        await this.connect();
      } catch (err) {
        Homey.app.log(err.message);
      }
    })();
  }

  async connect() {
    let hdl_ip_address = Homey.ManagerSettings.get("hdl_ip_address");
    let hdl_subnet = Homey.ManagerSettings.get("hdl_subnet");
    let hdl_id = Homey.ManagerSettings.get("hdl_id");
    let hdl_motion = Homey.ManagerSettings.get("hdl_universal_motion");

    // Set the universal motion if not set
    if (hdl_motion == undefined || hdl_motion == "") {
      Homey.ManagerSettings.set("hdl_universal_motion", "212");
    }

    // Return if settings are not defined
    if (
      hdl_ip_address == undefined ||
      hdl_ip_address == "" ||
      hdl_subnet == undefined ||
      hdl_subnet == ""
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
    if (hdl_id == undefined || hdl_id == "") {
      this._bus = new SmartBus({
        gateway: hdl_ip_address,
        port: 6000
      });
    } else {
      this._bus = new SmartBus({
        device: `${hdl_subnet}.${hdl_id}`,
        gateway: hdl_ip_address,
        port: 6000
      });
    }

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

    // Set the bus as connected
    this._busConnected = true;
    this.log("Homey HDL SmartBus is running...");
    this.log("Initializing recurring update...");
    setInterval(async () => {
      this.callForUpdate(this._bus);
    }, 60000);
  }

  async callForUpdate(bus) {
    this.log("Update called - looping through drivers");
    let drivers = ["dimmer", "relay", "tempsensor", "multisensor"];

    for (let i = 0; i < drivers.length; i++) {
      Homey.ManagerDrivers.getDriver(drivers[i])
        .getDevices()
        .forEach(function(device) {
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
    } else if (
      // TEMPSENSORS
      this.devicelist["tempsensors"][senderType] != undefined
    ) {
      this._tempsensors[signal.sender.id] = signal.sender;
      Homey.ManagerDrivers.getDriver("tempsensor").updateValues(signal);
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
        470: { channels: 6 },
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
        619: { channels: 2 },
        620: { channels: 4 },
        621: { channels: 6 },
        622: { channels: 6 },
        623: { channels: 4 },
        630: { channels: 4 },
        631: { channels: 2 },
        632: { channels: 4 },
        633: { channels: 6 },
        634: { channels: 2 },
        635: { channels: 4 },
        636: { channels: 6 }
      },
      multisensors: {
        305: { temperature: false, motion: true },
        307: { temperature: false, motion: true },
        308: { temperature: false, motion: true },
        309: { temperature: false, motion: true },
        312: { temperature: false, motion: true },
        314: { temperature: true, motion: true },
        315: { temperature: true, motion: true },
        316: { temperature: true, motion: true },
        318: { temperature: true, motion: true },
        321: { temperature: true, motion: true },
        322: { temperature: true, motion: true },
        328: { temperature: true, motion: true },
        329: { temperature: true, motion: true },
        330: { temperature: true, motion: true },
        336: { temperature: true, motion: true },
        337: { temperature: true, motion: true },
        340: { temperature: true, motion: true }
      },
      tempsensors: {
        124: { channels: 2 },
        134: { channels: 4 }
      }
    };
  }
}
module.exports = HDLSmartBus;
