'use strict';

const Homey = require("homey");

/**
 * Update curtain level by on/off buttons
 */
class CurtainManualProcess {
  device = null;
  srcLevel = null;
  direction = null;
  startTime = null;
  timer = null;

  constructor(device, direction) {
    this.device = device;
    this.direction = direction;
  }

  /**
   * Start on user action
   * @returns 
   */
  start() {
    this.srcLevel = this.device.level;

    // Stop if the curtain level is on the edge 
    if (this.device.duration == null || (this.srcLevel == 0 && this.direction == -1 || this.srcLevel == 1 && this.direction == 1)) {
      this.stop(true);
      return;
    }

    // Get start time
    this.startTime = Date.now();

    let lastPos = this.srcLevel;
    let lastFrameTime = this.startTime;

    // Prepare timer for curtain level update
    this.timer = setInterval(() => {
      // Compute diference between timer ticks
      let currentFrameTime = Date.now();
      let dt = (currentFrameTime - lastFrameTime) * 0.001;
      let dv = dt / this.device.duration;
      
      // Update curtain level
      lastPos += this.direction * dv;
      this.device.updateLevel(lastPos);

      // Stop if the curtain level is on the edge
      if ((lastPos <= 0 && this.direction == -1 || lastPos >= 1 && this.direction == 1))
        this.stop(true);
      
      lastFrameTime = currentFrameTime;
    }, 30);
  }

  /**
   * Stop this curtain level update process
   * @param {boolean?} autostop 
   * @returns 
   */
  stop(autostop) {
    if (autostop == true)
      this.device.stop()
      //setTimeout(() => this.device.stop(), 1000); // enable to going through the edges
    
    // Stop timer
    if (this.timer)
      clearInterval(this.timer);
    this.timer = null;  
    
    if (this.device.duration == null)
      return;

    // Finally re-update total level
    let dt = (Date.now() - this.startTime) * 0.001;
    let dv = dt / this.device.duration;
    this.device.updateLevel(this.srcLevel + this.direction * dv);
  }
}

/**
 * Update curtain level by level bar widget 
 */
class CurtainLevelProcess {
  static TOLERANCE = 0.0125;
  device = null;
  destLevel = null;

  constructor(device, destLevel) {
    this.device = device;
    this.destLevel = destLevel;
  }

  /**
   * Start on user action
   * @returns 
   */
  start() {
    let srcLevel = this.device.level;

    // Stop if there is nothing to do
    if (srcLevel - this.destLevel == 0) {
      this.stop(true);
      return;
    }

    // Get direction
    let direction = (this.destLevel - srcLevel > 0) ? 1 : -1;

    let lastPos = srcLevel;
    let lastFrameTime = Date.now();

    // Prepare timer for curtain level update
    this.timer = setInterval(() => {
      // Compute diference between timer ticks
      let currentFrameTime = Date.now();
      let dt = (currentFrameTime - lastFrameTime) * 0.001;
      let dv = dt / this.device.duration;
      
      // Update curtain level
      lastPos += direction * dv;
      this.device.updateLevel(lastPos);

      // Stop if the curtain level near the dest level
      if (lastPos > this.destLevel - CurtainLevelProcess.TOLERANCE && lastPos < this.destLevel + CurtainLevelProcess.TOLERANCE)
        this.stop(true);
      
      lastFrameTime = currentFrameTime;
    }, 30);
  }

  /**
   * Stop this curtain level update process
   * @param {boolean?} autostop 
   * @returns 
   */
   stop(autostop) {
    if (autostop == true) 
      this.device.stop();

    // Stop timer
    if (this.timer)
      clearInterval(this.timer);
    this.timer = null;
  }
}

class CurtainDevice extends Homey.Device {
  level = null; // value range <0, 1>
  duration = null; // duration in seconds
  process = null;

  async onInit() {
    this.homey.app.log(`Initated "${this.getName()}" (Curtain/${this.getClass()}) ${this.getData().id}`);
 
    // register a capability listener
    this.registerCapabilityListener("windowcoverings_set", (value, opts) => this.onPositionChange(value, opts));
    this.registerCapabilityListener("windowcoverings_state", (value, opts) => this.onButton(value, opts));

    // Ask for channel status
    if (this.homey.app.isBusConnected()) {
      await this.requestUpdate();
    }
  }

  updateLevel(value) {
    this.level = Math.min(1, Math.max(0, value)); // value range <0, 1>
    this.setCapabilityValue("windowcoverings_set", this.level).catch(this.error);
  }

  updateDuration(value) {
    this.duration = value;
    this.level = this.getCapabilityValue("windowcoverings_set");
  }

  updateStatus(value) {
    this.setCapabilityValue("windowcoverings_state", this.intToState(value)).catch(this.error);
  }

  async requestUpdate() {
    this.sendCommand(0xE3E2, {
      curtain: this.getData().channel
    });

    this.sendCommand(0xE800, {
      channel: this.getData().channel
    });
  }

  /**
   * Send command to stop the curtain
   */
  stop() {
    this.sendState(0);
    this.updateStatus(0);
  }

  _controller() {
    return this.homey.app.controller();
  }

  /**
   * When user changes curtain state through Homey
   * @param value Number value range <0, 1>
   * @param opts Nothing
   * @returns 
   */
  async onPositionChange(value, opts) {
    this.startProcess(new CurtainLevelProcess(this, value));

    let direction = value - this.level;
    let state = 0;
    if (direction < 0)
      state = 2;
    else if (direction > 0)
      state = 1;

    this.sendCommand(0xE3E0, {
      curtain: this.getData().channel,
      status: state
    });
  }

  /**
   * When user push the button
   * @param state "up" | "down" | "idle"
   * @param opts 
   */
  async onButton(state, opts) {
    this.sendState(this.stateToInt(state));
  }

  /**
   * Send state command
   * @param state 0 - idle, 1 - up, 2 - down
   */
  sendState(state) {
    this.startProcess(state == 0 ? null : new CurtainManualProcess(this, state == 1 ? 1 : -1));
    this.sendCommand(0xE3E0, {
      curtain: this.getData().channel,
      status: state
    });
  }

  sendCommand(command, data) {
    this._controller().send({
      target: this.getData().address,
      command: command,
      data: data
    },
    (err) => {
      if (err) {
        this.homey.app.log(err);
      }
    });    
  }

  /**
   * Start an update process
   * @param {CurtainManualProcess | CurtainLevelProcess} newProcess 
   */
  startProcess(newProcess) {
    if (this.process) {
      this.process.stop();
      this.process = null;
    }
    this.process = newProcess;
    if (this.process) {
      this.process.start();
    }
  }

  /**
   * Convert state from Homey to int for HDL
   * @param state 
   * @returns 
   */
  stateToInt(state) {
    switch (state) {
      case "idle":
        return 0;

      case "up":
        return 1;

      case "down":
        return 2;
    }
  }

  /**
   * Convert int from HDL to state for Homey
   * @param value 
   * @returns 
   */
  intToState(value) {
    switch (value) {
      case 0:
        return "idle";

      case 1:
        return "up";

      case 2:
        return "down";
    }
  }
}

module.exports = CurtainDevice;
