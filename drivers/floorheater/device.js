'use strict';

const Homey = require("homey");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class FloorheaterDevice extends Homey.Device {
  currentData = null;
  _supportsExtendedTemperature = false;
  _isPollScheduled = false;
  _lastPollPromise = null;
  _lastExtendedTimestamp = null;

  async onInit() {
    
    try {
      const storedFlag = await this.getStoreValue("supportsExtendedTemperature");
      if (typeof storedFlag === "boolean") {
        this._supportsExtendedTemperature = storedFlag;
      }
    } catch (err) {
      
    }
 
    // register a capability listener
    this.registerCapabilityListener("target_temperature", this.onTemperatureChange.bind(this));
    this.registerCapabilityListener("onoff", this.onPowerSwitchChange.bind(this));

    // Ask for channel status
    if (this.homey.app.isBusConnected()) {
      await this.requestUpdate();
    }
  }

  updateLevel(level) {
    this.setCapabilityValue("target_temperature", level).catch(this.error);
  }

  updateTemperature(temperature, options = {}) {
    const command = options.command;
    if (command === 0x1949) {
      if (!this._supportsExtendedTemperature) {
        this._supportsExtendedTemperature = true;
        this.setStoreValue("supportsExtendedTemperature", true).catch(() => {
          // non-fatal if we cannot persist
        });
      }
      this._lastExtendedTimestamp = Date.now();
      // Keep track of last extended result to decide legacy fallback
    } else if (command === 0xE3E8 && this._supportsExtendedTemperature) {
      return; // Ignore legacy reading once extended mode is available
    }

    const rounded = Math.round(temperature * 10) / 10;
    // invalid_capability 
    this.setCapabilityValue("measure_temperature", rounded).catch(this.error);
  }

  updatePowerSwitch(pwr) {
    const nextValue = !!pwr;
    if (this.getCapabilityValue("onoff") === nextValue) return;
    this.setCapabilityValue("onoff", nextValue).catch(() => {
      // nothing
    });
  }

  updateValve(valve) {
    const label = valve ? "Open" : "Closed";
    const numeric = valve ? 1 : 0;
    const currentLabel = this.getCapabilityValue("meter_valve");
    const currentNumeric = this.getCapabilityValue("meter_valve_number");
    if (currentLabel === label && currentNumeric === numeric) return;
    this.setCapabilityValue("meter_valve", label).catch(() => {
      // nothing
    });
    this.setCapabilityValue("meter_valve_number", numeric).catch(() => {
      // nothing
    });
  }

  async requestUpdate() {
    if (!this.homey.app.isBusConnected()) return this._lastPollPromise;

    if (this._isPollScheduled && this._lastPollPromise) {
      return this._lastPollPromise;
    }

    const runPoll = async () => {
      try {
        await this._performPoll();
      } catch (err) {
        
        this.error(err);
      } finally {
        this._isPollScheduled = false;
      }
    };

    this._isPollScheduled = true;
    this._lastPollPromise = FloorheaterDevice._enqueuePoll(async () => {
      await runPoll();
    });

    return this._lastPollPromise;
  }

  static _enqueuePoll(fn) {
    const wrapped = async () => {
      await fn();
      await delay(FloorheaterDevice._GLOBAL_QUEUE_DELAY_MS);
    };

    FloorheaterDevice._globalPollQueue = FloorheaterDevice._globalPollQueue.then(wrapped, wrapped);
    return FloorheaterDevice._globalPollQueue;
  }

  async _performPoll() {
    const payload = { channel: this.getData().channel };
    const rawPayload = Buffer.from([this.getData().channel]);
    const commands = [
      { command: 0x1C5E, data: payload },
      { command: 0x1948, data: payload }
    ];

    if (this._shouldUseLegacyRead()) {
      commands.push({ command: 0xE3E7, data: payload });
    }

    commands.push({ command: 0x7262, payload: rawPayload });

    for (const entry of commands) {
      await this._sendCommand(entry.command, entry.data, entry.payload);
      await delay(this._delayAfterCommand(entry.command));
    }
  }

  _shouldUseLegacyRead() {
    if (!this._supportsExtendedTemperature) return true;
    if (!this._lastExtendedTimestamp) return true;
    const STALE_WINDOW_MS = 5 * 60 * 1000;
    return Date.now() - this._lastExtendedTimestamp > STALE_WINDOW_MS;
  }

  _delayAfterCommand(command) {
    switch (command) {
      case 0x1C5E:
        return 200;
      case 0x1948:
        return 220;
      case 0xE3E7:
        return 250;
      case 0x7262:
        return 200;
      default:
        return 200;
    }
  }

  _controller() {
    return this.homey.app.controller();
  }

  async onTemperatureChange(value, opts) {
    if (this.currentData == null) {
      return; // No template data to send
    }

    this.currentData.temperature = this.currentData.temperature || {};
    this.currentData.watering = this.currentData.watering || {};
    this.currentData.work = this.currentData.work || {};
    this.currentData.temperature.normal = value;

    await this._sendCommand(0x1C5C, this.currentData);
  }

  async onPowerSwitchChange(value, opts) {
    if (this.currentData == null) {
      return; // No template data to send
    }

    this.currentData.temperature = this.currentData.temperature || {};
    this.currentData.watering = this.currentData.watering || {};
    this.currentData.work = this.currentData.work || {};
    this.currentData.work.status = value;

    await this._sendCommand(0x1C5C, this.currentData);
  }

  async _sendCommand(command, data, payloadBuffer) {
    const controller = this._controller();
    if (!controller) return;

    await new Promise((resolve) => {
      controller.send(
        {
          target: this.getData().address,
          command,
          data,
          payload: payloadBuffer
        },
        (err) => {
          if (err) {
            this.homey.app.log(err);
          }
          resolve();
        }
      );
    });
  }
}

FloorheaterDevice._globalPollQueue = Promise.resolve();
FloorheaterDevice._GLOBAL_QUEUE_DELAY_MS = 150;

module.exports = FloorheaterDevice;
