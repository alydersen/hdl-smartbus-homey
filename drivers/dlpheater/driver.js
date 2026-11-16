'use strict';

const { Driver } = require('homey');
const profiles = require('../../hdl/heater-models.json');

class DLPHeaterDriver extends Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('HDL DLPHeaterDriver has been initialized');
    this._modeChanged = this.homey.flow.getDeviceTriggerCard('heater_mode_changed_to');
    this._modeChanged.registerRunListener(async (args, state) => args.mode === state.mode);
    this.homey.flow.getActionCard('heater_set_mode_temperature')
      .registerRunListener(args => args.device.setModeTemperature(args.mode, args.temperature));
    this.homey.flow.getActionCard('heater_set_mode')
      .registerRunListener(args => args.device.setMode(args.mode));
    this.homey.flow.getActionCard('heater_set_active_temperature')
      .registerRunListener(args => args.device.setActiveTemperature(args.temperature));
    this.homey.flow.getActionCard('heater_press_button')
      .registerRunListener(args => args.device.pressButton(args.button));
    this.homey.flow.getActionCard('heater_refresh_status')
      .registerRunListener(async args => {
        if (!await args.device.requestUpdate({ throwOnError: true }))
          throw new Error('No DLP status received. Check the HDL connection.');
        return true;
      });
  }

  triggerModeChange(device, event) {
    return this._modeChanged.trigger(device,
      { previous_mode: event.previous, new_mode: event.mode }, { mode: event.mode });
  }

  async updateValues(signal) {
    if (!signal.sender) return;
    const address = `${Number(signal.sender.subnet)}.${Number(signal.sender.id)}`;
    const device = this.getDevices().find(candidate => candidate.getData().id === address);
    if (!device) return;
    if ([0x1945, 0x1947, 0xe3d9].includes(signal.code)) {
      await device.updateFromSignal(signal);
      return;
    }
    // Retain the panel driver's existing ambient-temperature updates.
    let data;
    try { data = signal.data; } catch (_error) { return; }
    if (data && Number.isFinite(data.temperature)
        && this.homey.app.valueOK('temperature', data.temperature)) {
      await device.setCapabilityValue('measure_temperature', data.temperature);
      if (device.hasCapability('measure_temperature.active'))
        await device.setCapabilityValue('measure_temperature.active', data.temperature);
    }
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

    this.homey.app.log("onPairListDevices from DLPHeaterDriver");
    for (const device of Object.values(this.homey.app.getDevicesOfType("panel"))) {
      const profile = profiles.find(p => p.type === Number(device.type));
      if (!profile?.heaterProtocol) continue;
      devices.push({
        name: `HDL DLP Heater (${hdl_subnet}.${device.id})`,
        capabilities: ["measure_temperature", "onoff", "hdl_heating_mode", "hdl_active_setpoint", "hdl_thermostat_mode", "target_temperature.active", "measure_temperature.active"],
        data: {
          id: `${hdl_subnet}.${device.id}`,
          heaterType: Number(device.type)
        }
      });
    }
    return devices.sort(DLPHeaterDriver._compareHomeyDevice);
  }

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }

}

module.exports = DLPHeaterDriver;
