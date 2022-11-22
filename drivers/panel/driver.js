'use strict';

const { Driver } = require('homey');
const HdlDevicelist = require("./../../hdl/hdl_devicelist");

class PanelDriver extends Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('HDL PanelDriver has been initialized');
  }

  async updateValues(signal) {
      // Parse and check the incoming signal, return if missing or invalid
      if (signal.data == undefined) return;
      if (signal.sender.id == undefined) return;
      if (!this.homey.app.valueOK("temperature", signal.data.temperature)) return;

      this.log(signal.data);
  
      // Get the device from Homey, return if not found or error
      let hdl_subnet = this.homey.settings.get("hdl_subnet");
      let homeyDevice = this.getDevice({id: `${hdl_subnet}.${signal.sender.id}`});
      if (typeof homeyDevice === 'undefined' || homeyDevice instanceof Error) return;
  
      // Set temperature
      homeyDevice
        .setCapabilityValue("measure_temperature", signal.data.temperature)
        .catch(this.error);
    
  }

  /**
   * onPairListDevices is called when a user is adding a device
   * and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    let devices = [];
    let hdl_subnet = this.homey.settings.get("hdl_subnet");

    // Check that the bus is connected
    if (!this.homey.app.isBusConnected()) return new Error("Please configure the app settings first.");

    this.homey.app.log("onPairListDevices from PanelDriver");
    for (const device of Object.values(this.homey.app.getDevicesOfType("panel"))) {
      devices.push({
        name: `HDL DLP Panel (${hdl_subnet}.${device.id})`,
        capabilities: ["measure_temperature"],
        data: {
          id: `${hdl_subnet}.${device.id}`
        }
      });
    }
    return devices.sort(PanelDriver._compareHomeyDevice);
  }

}

module.exports = PanelDriver;
