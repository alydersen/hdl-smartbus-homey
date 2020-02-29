"use strict";

const Homey = require("homey");
const SmartBus = require("smart-bus");
const HdlDimmers = require("./hdl/hdl_dimmers");
const HdlRelays = require("./hdl/hdl_relays");
const HdlMultisensors = require("./hdl/hdl_multisensors");
const HdlTempsensors = require("./hdl/hdl_tempsensors");

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
    let hdlDimmers = new HdlDimmers(senderType);
    let hdlRelays = new HdlRelays(senderType);
    let hdlMultisensors = new HdlMultisensors(senderType);
    let hdlTempsensors = new HdlTempsensors(senderType);
    if (hdlDimmers.isOne()) {
      // DIMMERS
      this._dimmers[signal.sender.id] = signal.sender;
      Homey.ManagerDrivers.getDriver("dimmer").updateValues(signal);
    } else if (hdlRelays.isOne()) {
      // RELAYS
      this._relays[signal.sender.id] = signal.sender;
      Homey.ManagerDrivers.getDriver("relay").updateValues(signal);
    } else if (hdlMultisensors.isOne()) {
      // MULTISENSORS
      this._multisensors[signal.sender.id] = signal.sender;
      Homey.ManagerDrivers.getDriver("multisensor").updateValues(signal);
    } else if (hdlTempsensors.isOne()) {
      // TEMPSENSORS
      this._tempsensors[signal.sender.id] = signal.sender;
      Homey.ManagerDrivers.getDriver("tempsensor").updateValues(signal);
    }
  }
}
module.exports = HDLSmartBus;
