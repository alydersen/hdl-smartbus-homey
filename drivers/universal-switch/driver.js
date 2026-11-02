'use strict';

const Homey = require("homey");

class HdlUniversalSwitchDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log("HDL UniversalSwitchDriver has been initiated");
  }

  // Record a universal switch signal in the troubleshooting log, if the
  // user has enabled it in the app settings. Signals are logged with the
  // outcome of the filters below, also when they are filtered out
  async _logUvSignal(signal, note) {
    if (this.homey.settings.get("hdl_uv_debug") !== true) return;

    let log = this.homey.settings.get("hdl_uv_debug_log");
    if (!Array.isArray(log)) log = [];

    let sender = signal.sender || {};
    log.push({
      t: Date.now(),
      sender: sender.subnet !== undefined && sender.id !== undefined
        ? `${sender.subnet}.${sender.id}`
        : undefined,
      type: sender.type,
      switch: signal.data !== undefined ? signal.data.switch : undefined,
      status: signal.data !== undefined ? signal.data.status : undefined,
      note: note
    });

    // Keep the buffer bounded; the log is stored in the Homey settings
    this.homey.settings.set(
      "hdl_uv_debug_log",
      log.length > 100 ? log.slice(-100) : log
    );
  }

  async updateValues(signal) {
    if (signal.data === undefined) {
      await this._logUvSignal(signal, "ignored: no data");
      return;
    }
    if (signal.data.switch === undefined) {
      await this._logUvSignal(signal, "ignored: no switch number");
      return;
    }
    // Read requests (e.g. 0xE018 Read Status of UV Switch, 0x15CE Read Dry
    // Contact Status) carry a switch number but no status; they are not
    // switch controls and must not be written to the onoff capability
    if (typeof signal.data.status !== "boolean") {
      await this._logUvSignal(signal, "ignored: no switch status");
      return;
    }
    if (
      signal.data.switch === parseInt(this.homey.settings.get("hdl_universal_motion"), 10)
    ) {
      await this._logUvSignal(signal, "ignored: motion universal switch");
      return;
    }
    if (
      signal.sender.id === parseInt(this.homey.settings.get("hdl_id"), 10)
    ) {
      await this._logUvSignal(signal, "ignored: from the app itself");
      return;
    }

    let hdl_subnet = this.homey.settings.get("hdl_subnet");
    let homeyDevice = this.getDevice({
      id: `${hdl_subnet}.${signal.data.switch}`,
      switch: signal.data.switch
    });
    if ( typeof homeyDevice === 'undefined' || homeyDevice instanceof Error ) {
      await this._logUvSignal(signal, "ignored: no paired device for this switch");
      return;
    }

    await this._logUvSignal(signal, "accepted");

    homeyDevice
      .setCapabilityValue("onoff", signal.data.status)
      .catch(this.error);
    homeyDevice.respondToSender(signal.sender);
  }

  async onPairListDevices() {
    let devices = [];
    let hdl_subnet = this.homey.settings.get("hdl_subnet");

    // Check that the bus is connected
    if (!this.homey.app.isBusConnected()) {
      return new Error("Please configure the app settings first.");
    } else {
      this.homey.app.log("onPairListDevices from UniversalSwitches");
      for (let i = 1; i < 255; i++) {
        if (i === parseInt(this.homey.settings.get("hdl_universal_motion"), 10))
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

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
}

module.exports = HdlUniversalSwitchDriver;
