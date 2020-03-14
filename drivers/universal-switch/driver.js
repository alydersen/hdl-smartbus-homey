"use strict";

const Homey = require("homey");

class HdlUniversalSwitchDriver extends Homey.Driver {
  onInit() {
    this.log("HdlUniversalSwitchDriver has been initiated");
  }

  updateValues(signal) {
    if (signal.data == undefined) return;
    if (signal.sender.id == undefined) return;
    if (signal.data.switch == undefined) return;
    if (
      signal.data.switch ==
      parseInt(Homey.ManagerSettings.get("hdl_universal_motion"))
    )
      return;

    let hdl_subnet = Homey.ManagerSettings.get("hdl_subnet");
    let homeyDevice = this.getDevice({
      id: `${hdl_subnet}.${signal.data.switch}`,
      switch: signal.data.switch
    });
    if (homeyDevice instanceof Error) return;

    homeyDevice.updateTrueFalse(signal.data.status).catch(this.error);
  }

  onPairListDevices(data, callback) {
    let devices = [];
    let hdl_subnet = Homey.ManagerSettings.get("hdl_subnet");

    // Check that the bus is connected
    if (!Homey.app.isBusConnected()) {
      callback(new Error("Please configure the app settings first."));
    } else {
      this.log("onPairListDevices from UniversalSwitches");
      var i;
      for (i = 1; i < 255; i++) {
        if (i == parseInt(Homey.ManagerSettings.get("hdl_universal_motion")))
          continue;
        devices.push({
          name: `HDL Universal Switch (${hdl_subnet}.${i})`,
          data: {
            id: `${hdl_subnet}.${i}`,
            switch: i
          }
        });
      }
      callback(
        null,
        devices.sort(HdlUniversalSwitchDriver._compareHomeyDevice)
      );
    }
  }
}

module.exports = HdlUniversalSwitchDriver;
