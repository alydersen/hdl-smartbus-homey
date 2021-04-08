'use strict';

const Homey = require("homey");

class HdlUniversalSwitchDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log("HdlUniversalSwitchDriver has been initiated");
  }

  async updateValues(signal) {
    if (signal.data == undefined) return;  // RETURN IF NO DATA
    if (signal.data.switch == undefined) return;  // RETURN IF NO CONTENT
    if (
      signal.data.switch == parseInt(this.homey.settings.get("hdl_universal_motion"))
    )
      return;  // RETURN IF THE SIGNAL IS FOR UNIVERSAL MOTION
    if (
      signal.sender.id == parseInt(this.homey.settings.get("hdl_id"))
    )
      return;  // RETURN IF THE SIGNAL IS FROM MYSELF

    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    let parent = this;
    try {
      let homeyDevice = parent.getDevice({
        id: `${hdl_subnet}.${signal.data.switch}`,
        switch: signal.data.switch
        });
    } catch (error) {
      return;
    }
    if (typeof homeyDevice !== 'undefined') {
      if (homeyDevice instanceof Error) return;
      homeyDevice
        .setCapabilityValue("onoff", signal.data.status)
        .catch(this.error);
      homeyDevice.respondToSender(signal.sender);
    }
  }

  async onPairListDevices() {
    let devices = [];
    let hdl_subnet = this.homey.settings.get("hdl_subnet");

    // Check that the bus is connected
    if (!this.homey.app.isBusConnected()) {
      return new Error("Please configure the app settings first.");
    } else {
      this.homey.app.log("onPairListDevices from UniversalSwitches");
      var i;
      for (i = 1; i < 255; i++) {
        if (i == parseInt(this.homey.settings.get("hdl_universal_motion")))
          continue;
        devices.push({
          name: `HDL Universal Switch (${hdl_subnet}.${i})`,
          data: {
            id: `${hdl_subnet}.${i}`,
            switch: i
          }
        });
      }
      return devices.sort(HdlUniversalSwitchDriver._compareHomeyDevice);
    }
  }
}

module.exports = HdlUniversalSwitchDriver;
