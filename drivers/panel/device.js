'use strict';
const { Device } = require('homey');
class PanelDevice extends Device {
  async onInit() {
    await this.setSettings({ hdl_address: this.getData().id }).catch(error => this.error(error));
    if (!this.hasCapability('measure_temperature')) await this.addCapability('measure_temperature');
    await this.setAvailable();
    await this.requestUpdate();
  }
  async requestUpdate() {
    const app = this.homey.app;
    if (!app.isBusConnected()) return;
    // Heater already reads this physical address; its status also feeds Panel.
    if (this.homey.drivers.getDriver('dlpheater').getDevices()
        .some(device => device.getData().id === this.getData().id)) return;
    app.controller().send({ target: this.getData().id, command: 0x1948,
      data: { channel: 1 } }, error => { if (error) this.error(error); });
  }
}
module.exports = PanelDevice;
