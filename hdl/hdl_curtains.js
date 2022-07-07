class HdlCurtains {
  constructor(type) {
    this._type = type;
  }

  async isOne() {
    return this.list[this._type] != undefined;
  }

  async numberOfChannels() {
    return this.list[this._type].channels;
  }

  get list() {
    return {
      "713": { channels: 2, hasDuration: true, hasLevelMonitor: false },
      "719": { channels: 2, hasDuration: undefined, hasLevelMonitor: undefined }
    };
  }
}

module.exports = HdlCurtains;
