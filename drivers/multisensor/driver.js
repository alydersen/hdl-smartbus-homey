"use strict";

const Homey = require("homey");

class MultisensorDriver extends Homey.Driver {
  onInit() {
    this.log("HDL MultisensorDriver has been initiated");
  }

  updateMultisensorValue(id, channel, data) {
    let combinedId = `${Homey.ManagerSettings.get(
      "hdl_subnet"
    )}.${id}.${channel}`;
    let address = `${Homey.ManagerSettings.get("hdl_subnet")}.${id}`;
    let homeyDevice = this.getDevice({
      id: combinedId,
      address: address
    });
    if (homeyDevice instanceof Error) return;
    homeyDevice.setCapabilityValue("dim", level).catch(this.error);
  }

  onPairListDevices(data, callback) {
    // Check that the bus is connected
    if (!Homey.app.isBusConnected()) {
      callback(new Error("Please configure the app settings first."));
    } else {
      this.log("onPairListDevices from Multisensor");

      const devices = [];
      this._bus().on("command", function(command) {
        if (
          Homey.app.devicelist["multisensors"][
            command.sender.type.toString()
          ] != undefined
        ) {
          devices.push({
            name: `HDL Multisensor (${Homey.ManagerSettings.get(
              "hdl_subnet"
            )}.${command.sender.id})`,
            data: {
              id: `${Homey.ManagerSettings.get("hdl_subnet")}.${
                command.sender.id
              }.${i}`,
              address: `${Homey.ManagerSettings.get("hdl_subnet")}.${
                command.sender.id
              }`
            }
          });
        }
      });

      this._bus().send("255.255", 0x000e, function(err) {
        if (err) {
          console.log(err);
        }
      });

      setTimeout(() => {
        callback(null, devices);
      }, 10000);
    }
  }

  _bus() {
    return Homey.app.bus();
  }
}

module.exports = MultisensorDriver;
