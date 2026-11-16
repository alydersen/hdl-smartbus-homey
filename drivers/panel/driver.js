'use strict';

const { Driver } = require('homey');

class PanelDriver extends Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('HDL PanelDriver has been initialized');
  }

  // H006S waits for matching button acknowledgements on the shared bus.
  async updateValues(signal) {
    if (!signal.sender) return;
    const address = `${Number(signal.sender.subnet)}.${Number(signal.sender.id)}`;
    const device = this.getDevices().find(candidate => candidate.getData().id === address);
    if (!device) return;
    let temperature;
    if (signal.code === 0x1945 && Buffer.isBuffer(signal.payload)
        && signal.payload.length >= 8 && signal.payload[0] === 0) {
      temperature = (signal.payload[1] & 0x80 ? -1 : 1) * (signal.payload[1] & 0x7f);
    } else {
      let data;
      try { data = signal.data; } catch (_) { return; }
      if (data) temperature = data.temperature;
    }
    if (Number.isFinite(temperature) && this.homey.app.valueOK('temperature', temperature))
      await device.setCapabilityValue('measure_temperature', temperature);
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

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }

}

module.exports = PanelDriver;
