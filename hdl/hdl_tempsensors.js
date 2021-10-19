class HdlTempsensors {
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
      "124": { channels: 2 },
      "134": { channels: 4 }
    };
  }
}

module.exports = HdlTempsensors;
