'use strict';

const Homey = require("homey");
const HdlDevicelist = require("./../../hdl/hdl_devicelist");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Capabilities that only apply to heating zones, not digital sensors
const ZONE_ONLY_CAPABILITIES = [
  "target_temperature",
  "onoff",
  "meter_valve",
  "meter_valve_number",
];

class FloorheaterDevice extends Homey.Device {
  currentData = null;
  _isSensorChannel = false;
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
    } catch (_err) {
      // ignore
    }

    this._isSensorChannel = await this._detectSensorChannel();

    if (this._isSensorChannel) {
      // Digital sensor channels (13 and 50 + probe ID) are read-only
      // temperature inputs, so drop the heating-zone capabilities
      for (const capability of ZONE_ONLY_CAPABILITIES) {
        if (this.hasCapability(capability)) {
          await this.removeCapability(capability).catch(this.error);
        }
      }
    } else {
      // register a capability listener
      this.registerCapabilityListener("target_temperature", this.onTemperatureChange.bind(this));
      this.registerCapabilityListener("onoff", this.onPowerSwitchChange.bind(this));

      try {
        await this.setCapabilityOptions("target_temperature", {
          step: 1,
          decimals: 0
        });
      } catch (err) {
        this.error(err);
      }
    }

    // Ask for channel status
    if (this.homey.app.isBusConnected()) {
      await this.requestUpdate();
    }
  }

  async _detectSensorChannel() {
    const data = this.getData();
    const channel = data ? data.channel : undefined;
    if (typeof channel === "undefined") return false;

    let type = null;
    try {
      const units = this.homey.app.getDevicesOfType("floorheater") || {};
      for (const sender of Object.values(units)) {
        if (sender && data.address === `${sender.subnet}.${sender.id}`) {
          type = sender.type;
          break;
        }
      }
    } catch (_err) {
      // fall through to the channel heuristic below
    }

    if (type !== null) {
      const devicelist = new HdlDevicelist();
      const sensorChannels = await devicelist.sensorChannels(type.toString());
      if (sensorChannels.length > 0) return sensorChannels.includes(channel);
    }

    // Fallback for modules not yet seen on the bus: every supported floor
    // heating controller has 6 heating zones, so any higher channel number
    // is a digital sensor input (13 and 50 + probe ID)
    return channel > 6;
  }

  updateLevel(level) {
    if (this._isSensorChannel) return;
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
    if (this._isSensorChannel) return;
    const nextValue = !!pwr;
    if (this.getCapabilityValue("onoff") === nextValue) return;
    this.setCapabilityValue("onoff", nextValue).catch(() => {
      // nothing
    });
  }

  updateValve(valve) {
    if (this._isSensorChannel) return;
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
    const commands = [];

    // Sensor channels only support temperature reads; skip the
    // heating-zone status and valve commands
    if (!this._isSensorChannel) {
      commands.push({ command: 0x1C5E, data: payload });
    }

    commands.push({ command: 0x1948, data: payload });

    if (this._shouldUseLegacyRead()) {
      commands.push({ command: 0xE3E7, data: payload });
    }

    if (!this._isSensorChannel) {
      commands.push({ command: 0x7262, payload: rawPayload });
    }

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

  async onTemperatureChange(value, _opts) {
    if (this._isSensorChannel) return; // read-only sensor channel

    if (this.currentData === null) {
      return; // No template data to send
    }

    this.currentData.temperature = this.currentData.temperature || {};
    this.currentData.watering = this.currentData.watering || {};
    this.currentData.work = this.currentData.work || {};
    this.currentData.temperature.normal = value;

    await this._sendCommand(0x1C5C, this.currentData);
  }

  async onPowerSwitchChange(value, _opts) {
    if (this._isSensorChannel) return; // read-only sensor channel

    if (this.currentData === null) {
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
