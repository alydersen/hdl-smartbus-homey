'use strict';

const Homey = require("homey");
const DEFAULT_DIM_DURATION = 0

class DimmerDevice extends Homey.Device {

  _controller() {
    return this.homey.app.controller();
  }

  async onInit() {
    this.homey.app.log(`Initated "${this.getName()}" (Dimmer/${this.getClass()}) ${this.getData().id}`);

    // Show the device's HDL bus address in the settings screen
    await this.setSettings({ hdl_address: this.getData().id }).catch(this.error);

    // Couple onoff and dim into one debounced listener, so a Flow or UI
    // action that changes both (e.g. "turn on" + "dim to 50%") sends a
    // single channel-control command instead of flashing to 100% first
    this.registerMultipleCapabilityListener(
      ["onoff", "dim"],
      this.onCapabilityOnoffDim.bind(this),
      500
    );

    // Ask for channel status
    if (this.homey.app.isBusConnected()) { this.requestUpdate() }
  }

  async updateHomeyLevel(level) {
    const corrected_level = level / 100;
    this.setCapabilityValue("dim", corrected_level).catch(this.error);
    this.setCapabilityValue("onoff", corrected_level !== 0).catch(this.error);
  }

  async requestUpdate() {
    this._controller().send(
      { target: this.getData().address, command: 0x0033 },
      (err) => {
        if (err) {
          this.homey.app.log(err);
        }
      }
    );
  }

  async updateDeviceByBus(level) {
    this.homey.app.controller().send(
      {
        target: this.getData().address,
        command: 0x0031,
        data: {
          channel: this.getData().channel,
          level: level * 100
        }
      },
      (err) => {
        if (err) {
          this.homey.app.log(err);
        }
      }
    );
  }

  // Homey debounces onoff and dim changes into one call; send a single
  // HDL channel-control command for the resulting level
  async onCapabilityOnoffDim(values, options) {
    const dim = values.dim;
    const onoff = values.onoff;

    // A dim value decides the level, unless the device is turned off
    if (typeof dim === "number") {
      const level = onoff === false ? 0 : dim;
      await this.setCapabilityValue("onoff", level > 0).catch(this.error);

      const dimOptions = (options && options.dim) || {};
      const duration = typeof dimOptions.duration === "number"
        ? dimOptions.duration
        : DEFAULT_DIM_DURATION;
      if (duration === 0) {
        this.updateDeviceByBus(level);
      } else {
        const current_level = await this.getCapabilityValue("dim");
        const step = (level - current_level) / 10;
        for (let i = 0; i < 10; i++) {
          setTimeout(() => { this.updateDeviceByBus(current_level + (step * (i + 1))); }, (duration / 10) * i);
        }
      }
      return;
    }

    // onoff only: restore the current dim level when switching on,
    // full on when no level is known
    let level = 0;
    if (onoff === true) {
      const current_level = await this.getCapabilityValue("dim");
      if (typeof current_level === "number" && current_level > 0) level = current_level;
      else level = 1;
    }
    this.updateDeviceByBus(level);
    this.setCapabilityValue("dim", level).catch(this.error);
  }
}

module.exports = DimmerDevice;
