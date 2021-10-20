class HdlFloorheaters {
  constructor(type) {
    this._type = type;
  }

  async isOne() {
    return this.list[this._type] != undefined;
  }
  
  numberOfChannels() {
    return this.list[this._type].channels;
  }

  get list() {
    return {
      "207": { channels: 6 },
      "208": { channels: 6 },
      "209": { channels: 6 },
      "210": { channels: 6 },
      "211": { channels: 6 },

      // "367": { channels: 6 },
      // "371": { channels: 6 },
      // "2182": { channels: 6 },
      // "9600": { channels: 6 },
    };
  }
}

module.exports = HdlFloorheaters;
