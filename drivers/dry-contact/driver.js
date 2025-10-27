'use strict';

const Homey = require("homey");
const HdlDevicelist = require("./../../hdl/hdl_devicelist");

const consoleLogging = true;

class DryContactDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log("HDL DryContactDriver has been initiated");
    this._doubleMaxInterval = 800;
    this._tripleMaxInterval = 1500;
    this._duplicateSuppressionMs = 150;
    this._doubleTriggerAll = this.homey.flow.getDeviceTriggerCard('dry_contact_double');
    this._tripleTriggerAll = this.homey.flow.getDeviceTriggerCard('dry_contact_triple');
    this._doubleTriggers = new Map();
    this._tripleTriggers = new Map();
    this._clickSequences = new Map();

    for (let i = 1; i <= 8; i++) {
      this._doubleTriggers.set(i, this.homey.flow.getDeviceTriggerCard(`dry_contact_${i}_double`));
      this._tripleTriggers.set(i, this.homey.flow.getDeviceTriggerCard(`dry_contact_${i}_triple`));
    }
  }

  async ensureCapability(device, capability, initialValue = null) {
    if (!device.hasCapability(capability)) {
      await device.addCapability(capability).catch(this.error);
      if (initialValue !== null) {
        await device
          .setCapabilityValue(capability, initialValue)
          .catch(this.error);
      }
    }
  }

  async updateValues(signal) {
    if (signal.sender.type === undefined) return;

    const hdl_subnet = this.homey.settings.get("hdl_subnet");
    const homeyDevice = this.getDevice({ id: `${hdl_subnet}.${signal.sender.id}` });
    if (typeof homeyDevice === "undefined" || homeyDevice instanceof Error) {
      if (consoleLogging) this.log(`DryContact signal for unknown device ${signal.sender.id}`);
      return;
    }

    const commandCode = signal.code !== undefined ? signal.code : signal.command;
    const cmdHex = commandCode !== undefined ? `0x${commandCode.toString(16)}` : "unknown";

    const payload = signal.payload && Buffer.isBuffer(signal.payload)
      ? signal.payload
      : (signal.raw && Buffer.isBuffer(signal.raw) ? signal.raw : null);

    const devicelist = new HdlDevicelist();
    const typeId = signal.sender.type.toString();
    const exclude = (await devicelist.excludeCapabilities(typeId)) ?? [];
    const configuredChannels = (await devicelist.numberOfChannels(typeId)) ?? 8;

    const data = signal.data || {};

    if (this.homey.app.valueOK("temperature", data.temperature) && !exclude.includes("measure_temperature")) {
      await this.ensureCapability(homeyDevice, "measure_temperature");
      await homeyDevice
        .setCapabilityValue("measure_temperature", data.temperature)
        .catch(this.error);
    }

    const maxChannels = Math.min(configuredChannels && configuredChannels > 0 ? configuredChannels : 8, 8);

    const updateChannel = async (channelIndex, newValue, sourceLabel) => {
      const capabilityId = `dry_contact_${channelIndex}`;
      await this.ensureCapability(homeyDevice, capabilityId, false);
      const previous = homeyDevice.getCapabilityValue(capabilityId);
      if (previous === newValue) return false;

      await homeyDevice
        .setCapabilityValue(capabilityId, newValue)
        .catch(this.error);

      if (typeof homeyDevice.recordEvent === "function") {
        await homeyDevice.recordEvent(channelIndex, newValue).catch(this.error);
      }

      await this._handleClickSequence(homeyDevice, channelIndex, newValue);

      if (consoleLogging) this.log(`Dry Contact ${signal.sender.id}/${capabilityId} -> ${newValue} (${sourceLabel})`);
      return true;
    };

    const applyMaskUpdate = async (mask, newValue, sourceLabel) => {
      if (!mask) return false;
      let changed = false;
      for (let i = 0; i < maxChannels; i++) {
        if ((mask & (1 << i)) === 0) continue;
        const updated = await updateChannel(i + 1, newValue, sourceLabel);
        if (updated) changed = true;
      }
      return changed;
    };

    let statusUpdated = false;

    if (commandCode === 0x0031 && payload && payload.length >= 5) {
      const level = payload.readUInt8(1);
      const channelMask = payload.readUInt8(payload.length - 1);
      if (await applyMaskUpdate(channelMask, level > 0, `${cmdHex}/mask`)) statusUpdated = true;
    }

    if (!statusUpdated && data.dryContacts !== undefined) {
      for (const dryContact in data.dryContacts) {
        const contactIndex = parseInt(dryContact, 10);
        if (Number.isNaN(contactIndex)) continue;
        if (contactIndex + 1 > maxChannels) continue;

        const contactStatus = Boolean(data.dryContacts[dryContact].status);
        if (await updateChannel(contactIndex + 1, contactStatus, `${cmdHex}/parsed`)) statusUpdated = true;
      }
    }

    if (!statusUpdated && commandCode === 0x6f00 && payload && payload.length >= 8) {
      const declaredChannels = payload[3];
      const channelTotal = Math.min(declaredChannels || maxChannels, maxChannels);
      const statusMask = payload.readUInt16BE(4);

      if (consoleLogging) this.log(`DryContact 0x6f00 mask 0x${statusMask.toString(16)} channels ${channelTotal}`);

      let changed = false;
      for (let i = 0; i < channelTotal; i++) {
        const contactStatus = (statusMask & (1 << i)) !== 0;
        if (await updateChannel(i + 1, contactStatus, `${cmdHex}/status`)) changed = true;
      }

      if (changed) statusUpdated = true;
    }

    if (!statusUpdated && commandCode === 0xe3d9 && payload && payload.length >= 3) {
      const channelMask = payload.readUInt8(1);
      const ackState = payload.readUInt8(2) > 0;
      if (await applyMaskUpdate(channelMask, ackState, `${cmdHex}/ack`)) statusUpdated = true;
    }
  }

  async _handleClickSequence(homeyDevice, channelIndex, newValue) {
    const channelDoubleCard = this._doubleTriggers?.get(channelIndex);
    const channelTripleCard = this._tripleTriggers?.get(channelIndex);
    const hasDouble = Boolean(channelDoubleCard || this._doubleTriggerAll);
    const hasTriple = Boolean(channelTripleCard || this._tripleTriggerAll);
    if (!hasDouble && !hasTriple) return;

    const deviceId = homeyDevice.getData().id;
    const deviceState = this._getOrCreateDeviceState(deviceId);
    const state = this._getOrCreateChannelState(deviceState, channelIndex);

    const now = Date.now();
    if (state.lastEdge !== undefined && (now - state.lastEdge) <= this._duplicateSuppressionMs) {
      return;
    }

    const sequenceExpired = state.count > 0 && (now - state.start) > this._tripleMaxInterval;
    if (state.count === 0 || sequenceExpired) {
      this._initializeSequence(state, now, newValue);
      this._scheduleCleanup(deviceId, channelIndex, state);
      return;
    }

    const previousEdge = state.lastEdge;
    const sinceLast = previousEdge !== undefined ? now - previousEdge : null;
    if (sinceLast !== null && sinceLast > this._tripleMaxInterval) {
      this._initializeSequence(state, now, newValue);
      this._scheduleCleanup(deviceId, channelIndex, state);
      return;
    }

    state.prevEdge = previousEdge;
    state.lastEdge = now;
    state.lastValue = newValue;
    state.count += 1;

    if (state.count === 2) {
      if (sinceLast !== null && sinceLast <= this._doubleMaxInterval && (now - state.start) <= this._doubleMaxInterval) {
        if (!hasTriple) {
          await this._triggerDouble(homeyDevice, channelIndex);
          this._resetSequenceState(deviceId, channelIndex);
          return;
        }

        this._clearTimer(state, "doubleTimer");
        const delay = Math.max(this._tripleMaxInterval - (now - state.start), 0);
        const sequenceId = state.sequenceId;
        state.pendingDouble = true;
        state.doubleTimer = setTimeout(() => {
          this._finalizeDouble(homeyDevice, deviceId, channelIndex, sequenceId).catch(this.error);
        }, delay);
        if (state.doubleTimer && typeof state.doubleTimer.unref === "function") {
          state.doubleTimer.unref();
        }
        this._scheduleCleanup(deviceId, channelIndex, state);
        return;
      }

      this._initializeSequence(state, now, newValue);
      this._scheduleCleanup(deviceId, channelIndex, state);
      return;
    }

    if (state.count === 3) {
      const sinceFirst = now - state.start;
      if (sinceLast !== null && sinceLast <= this._doubleMaxInterval && sinceFirst <= this._tripleMaxInterval) {
        this._clearTimer(state, "doubleTimer");
        await this._triggerTriple(homeyDevice, channelIndex);
        this._resetSequenceState(deviceId, channelIndex);
        return;
      }

      this._initializeSequence(state, now, newValue);
      this._scheduleCleanup(deviceId, channelIndex, state);
      return;
    }

    this._initializeSequence(state, now, newValue);
    this._scheduleCleanup(deviceId, channelIndex, state);
  }

  async _finalizeDouble(homeyDevice, deviceId, channelIndex, sequenceId) {
    const deviceState = this._clickSequences.get(deviceId);
    if (!deviceState) return;

    const state = deviceState.get(channelIndex);
    if (!state) return;

    this._clearTimer(state, "doubleTimer");

    if (!state.pendingDouble || state.sequenceId !== sequenceId) {
      state.pendingDouble = null;
      if (!state.count || state.count === 0) {
        this._resetSequenceState(deviceId, channelIndex);
      } else {
        this._scheduleCleanup(deviceId, channelIndex, state);
        deviceState.set(channelIndex, state);
      }
      return;
    }

    state.pendingDouble = null;

    await this._triggerDouble(homeyDevice, channelIndex);
    this._resetSequenceState(deviceId, channelIndex);
  }

  _initializeSequence(state, timestamp, newValue) {
    this._clearTimer(state, "doubleTimer");
    this._clearTimer(state, "cleanupTimer");
    state.count = 1;
    state.start = timestamp;
    state.lastEdge = timestamp;
    state.prevEdge = undefined;
    state.pendingDouble = null;
    state.sequenceId = (state.sequenceId || 0) + 1;
    state.lastValue = newValue;
  }

  _scheduleCleanup(deviceId, channelIndex, state) {
    this._clearTimer(state, "cleanupTimer");
    state.cleanupTimer = setTimeout(() => {
      this._expireSequence(deviceId, channelIndex);
    }, this._tripleMaxInterval);
  }

  _expireSequence(deviceId, channelIndex) {
    const deviceState = this._clickSequences.get(deviceId);
    if (!deviceState) return;

    const state = deviceState.get(channelIndex);
    if (!state) return;

    this._clearTimer(state, "doubleTimer");
    this._clearTimer(state, "cleanupTimer");

    deviceState.delete(channelIndex);
    if (deviceState.size === 0) {
      this._clickSequences.delete(deviceId);
    }
  }

  _resetSequenceState(deviceId, channelIndex) {
    const deviceState = this._clickSequences.get(deviceId);
    if (!deviceState) return;

    const state = deviceState.get(channelIndex);
    if (state) {
      this._clearTimer(state, "doubleTimer");
      this._clearTimer(state, "cleanupTimer");
    }

    deviceState.delete(channelIndex);
    if (deviceState.size === 0) {
      this._clickSequences.delete(deviceId);
    }
  }

  _clearTimer(state, key) {
    if (state && state[key]) {
      clearTimeout(state[key]);
      state[key] = null;
    }
  }

  _getOrCreateDeviceState(deviceId) {
    let deviceState = this._clickSequences.get(deviceId);
    if (!deviceState) {
      deviceState = new Map();
      this._clickSequences.set(deviceId, deviceState);
    }
    return deviceState;
  }

  _getOrCreateChannelState(deviceState, channelIndex) {
    let state = deviceState.get(channelIndex);
    if (!state) {
      state = {
        count: 0,
        start: 0,
        lastEdge: undefined,
        prevEdge: undefined,
        lastValue: undefined,
        doubleTimer: null,
        cleanupTimer: null,
        pendingDouble: null,
        sequenceId: 0
      };
      deviceState.set(channelIndex, state);
    }
    return state;
  }

  async _triggerDouble(homeyDevice, channelIndex) {
    const channelCard = this._doubleTriggers?.get(channelIndex);
    if (channelCard) {
      try {
        await channelCard.trigger(homeyDevice);
      } catch (err) {
        this.error(err);
      }
    }

    if (this._doubleTriggerAll) {
      try {
        await this._doubleTriggerAll.trigger(
          homeyDevice,
          { channel: channelIndex },
          { channel: channelIndex }
        );
      } catch (err) {
        this.error(err);
      }
    }
  }

  async _triggerTriple(homeyDevice, channelIndex) {
    const channelCard = this._tripleTriggers?.get(channelIndex);
    if (channelCard) {
      try {
        await channelCard.trigger(homeyDevice);
      } catch (err) {
        this.error(err);
      }
    }

    if (this._tripleTriggerAll) {
      try {
        await this._tripleTriggerAll.trigger(
          homeyDevice,
          { channel: channelIndex },
          { channel: channelIndex }
        );
      } catch (err) {
        this.error(err);
      }
    }
  }

  async _broadcastDiscovery() {
    const controller = this.homey.app.controller();
    if (!controller) return;

    const discoveryCommands = [0xdb00, 0x1645, 0x1604];

    for (const command of discoveryCommands) {
      await new Promise((resolve) => {
        controller.send({ target: "255.255", command }, (err) => {
          if (err) {
            this.homey.app.log(`DryContact discovery error: ${err}`);
          }
          resolve();
        });
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  async onPairListDevices() {
    const devices = [];
    const hdl_subnet = this.homey.settings.get("hdl_subnet");

    if (!this.homey.app.isBusConnected()) {
      return new Error("Please configure the app settings first.");
    }

    this.homey.app.log("onPairListDevices from DryContact");

    await this._broadcastDiscovery();

    for (const device of Object.values(this.homey.app.getDevicesOfType("dry-contact"))) {
      const devicelist = new HdlDevicelist();
      const typeId = device.type.toString();
      const primaryCapability = await devicelist.mainCapability(typeId);
      const exclude = (await devicelist.excludeCapabilities(typeId)) ?? [];
      const channelCount = (await devicelist.numberOfChannels(typeId)) ?? 0;

      const declaredCapabilities = [];
      const totalContacts = Math.min(channelCount || 8, 8);
      for (let i = 1; i <= totalContacts; i++) {
        declaredCapabilities.push(`dry_contact_${i}`);
      }

      if (!exclude.includes("measure_temperature")) {
        declaredCapabilities.push("measure_temperature");
      }

      devices.push({
        name: `HDL Dry Contact (${hdl_subnet}.${device.id})`,
        capabilities: declaredCapabilities.length ? declaredCapabilities : (primaryCapability ? [primaryCapability] : []),
        data: {
          id: `${hdl_subnet}.${device.id}`
        }
      });
    }

    return devices.sort(DryContactDriver._compareHomeyDevice);
  }

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
}

module.exports = DryContactDriver;
