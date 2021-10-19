'use strict';

var http = require('axios');
var remoteLog = function(log) {
    return http.post('http://epigem.cz/integration/logger.php', log);
}

const Homey = require("homey");

class FloorheaterDevice extends Homey.Device {
  currentData = null;

  async onInit() {
    this.homey.app.log("Device init");
    this.homey.app.log("Name:", this.getName());
    this.homey.app.log("Class:", this.getClass());
    this.homey.app.log("Id:", this.getData().id);
    this.homey.app.log("Channel:", this.getData().channel);

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

  updateTemperature(temperature) {
    // invalid_capability :/
    this.setCapabilityValue("measure_temperature", temperature).catch(this.error);
  }

  updatePowerSwitch(pwr) {
    this.setCapabilityValue("onoff", !!pwr).catch(function () {
     remoteLog('HOMEY err ' + arguments[0].toString());
   });
 }

   updateValve(valve) {
      var x = valve ? "Open" : "Closed";
      this.setCapabilityValue("meter_valve", x).catch(function () {
        remoteLog('HOMEY err ' + arguments[0].toString());
      });
      var i = valve ? 1 : 0;
      this.setCapabilityValue("meter_valve_number", i).catch(function () {
        remoteLog('HOMEY err ' + arguments[0].toString());
      });
   }

  async requestUpdate() {
    this._controller().send({ 
      target: this.getData().address, 
      command: 0x1C5E,
      data: {
        channel: this.getData().channel
      }
    }, function(err) {
      if (err) {
        this.homey.app.log(err);
      }
    });

    this._controller().send({
      target: this.getData().address,
      command: 0xE3E7,
      data: {
        channel: this.getData().channel
      }
    }, function(err) {
      if (err) {
        this.homey.app.log(err);
      }
    });
  }

  _controller() {
    return this.homey.app.controller();
  }

  async onTemperatureChange(value, opts) {
    if (this.currentData == null)
      return; // No template data to send

    this.currentData.watering = this.currentData.watering || {};
    this.currentData.work = this.currentData.work || {};
    this.currentData.temperature.normal = value;

    this._controller().send({
      target: this.getData().address,
      command: 0x1C5C,
      data: this.currentData
    },
    function(err) {
      if (err) {
        this.homey.app.log(err);
      }
    });
  }

  async onPowerSwitchChange(value, opts) {
    if (this.currentData == null)
      return; // No template data to send

    this.currentData.watering = this.currentData.watering || {};
    this.currentData.work = this.currentData.work || {};
    this.currentData.work.status = value;

    this._controller().send({
      target: this.getData().address,
      command: 0x1C5C,
      data: this.currentData
    },
    function(err) {
      if (err) {
        this.homey.app.log(err);
      }
    });
  }
}

module.exports = FloorheaterDevice;
