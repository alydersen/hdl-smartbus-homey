'use strict';

const Homey = require("homey");
const DEFAULT_DIM_DURATION = 0

class DimmerDevice extends Homey.Device {

  _controller() {
    return this.homey.app.controller();
  }

  async onInit() {
    this.homey.app.log(`Initated "${this.getName()}" (Dimmer/${this.getClass()}) ${this.getData().id}`);
 
    // register a capability listener
    this.registerCapabilityListener("onoff", this.onCapabilityOnoff.bind(this));
    this.registerCapabilityListener("dim", async (value, options) => {
      await this.onCapabilityDim({
        level: value,
        duration: typeof options.duration === "number"
          ? options.duration
          : DEFAULT_DIM_DURATION,
      });
    });

    // Ask for channel status
    if (this.homey.app.isBusConnected()) { this.requestUpdate() }
  }

  async updateHomeyLevel(level) {
    var corrected_level = level / 100;
    this.setCapabilityValue("dim", corrected_level).catch(this.error);
    this.setCapabilityValue("onoff", corrected_level != 0).catch(this.error);
  }

  async requestUpdate() {
    this._controller().send(
      { target: this.getData().address, command: 0x0033 },
      function(err) {
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
      function(err) {
        if (err) {
          this.homey.app.log(err);
        }
      }
    );
  }

  async onCapabilityOnoff(value) {
    let level = value === true ? 1 : 0;
    this.updateDeviceByBus(level);
    this.setCapabilityValue("dim", level).catch(this.error);
  }

  async onCapabilityDim(opts) {
    var dev = this;
    await this.setCapabilityValue("onoff", opts.level > 0).catch(this.error);
    if (opts.duration === 0) {      
      dev.updateDeviceByBus(opts.level);
    } else {
      var current_level = await this.getCapabilityValue("dim");
      var step = (opts.level - current_level) / 10;
      [ ...Array(10) ].forEach(async (e, i) => {
        setTimeout(function () {dev.updateDeviceByBus(current_level + (step * (i+1)))}, (opts.duration / 10) * i);
      });
    }
  }
}

module.exports = DimmerDevice;
