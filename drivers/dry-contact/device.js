'use strict';

const Homey = require("homey");

class DryContactDevice extends Homey.Device {
  async onInit() {
    this.homey.app.log(`Initated "${this.getName()}" (DryContact/${this.getClass()}) ${this.getData().id}`);
    try {
      const history = await this.getStoreValue("history");
      if (!Array.isArray(history)) {
        await this.setStoreValue("history", []);
      }
    } catch (err) {
      await this.setStoreValue("history", []);
    }

  }

  async requestUpdate() {
    // Reuse the same sensor status commands as multisensors to fetch dry contact states (and temperature where available)
    const commands = [0xdb00, 0x1645, 0x1604];

    for (const command of commands) {
      if (!this.homey.app.isBusConnected()) continue;

      this._controller().send(
        { target: this.getData().id, command },
        (err) => {
          if (err) {
            this.homey.app.log(err);
          }
        }
      );
    }
  }

  _controller() {
    return this.homey.app.controller();
  }

  async recordEvent(channelIndex, isActive) {
    const entry = {
      timestamp: new Date().toISOString(),
      channel: channelIndex,
      active: isActive
    };

    let history = [];
    try {
      const stored = await this.getStoreValue("history");
      if (Array.isArray(stored)) {
        history = stored;
      }
    } catch (err) {
      // ignore
    }

    history.unshift(entry);
    if (history.length > 40) {
      history = history.slice(0, 40);
    }

    await this.setStoreValue("history", history).catch(this.error);
  }
}

module.exports = DryContactDevice;
