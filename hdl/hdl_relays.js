class HdlRelays {
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
      "423": { channels: 4 },
      "425": { channels: 6 },
      "426": { channels: 6 },
      "427": { channels: 8 },
      "428": { channels: 8 },
      "429": { channels: 12 },
      "430": { channels: 12 },
      "431": { channels: 12 },
      "432": { channels: 24 },
      "433": { channels: 4 },
      "434": { channels: 4 },
      "435": { channels: 4 },
      "436": { channels: 8 },
      "437": { channels: 4 },
      "438": { channels: 4 },
      "439": { channels: 8 },
      "440": { channels: 12 },
      "441": { channels: 4 },
      "442": { channels: 8 },
      "443": { channels: 12 },
      "444": { channels: 4 },
      "445": { channels: 8 },
      "446": { channels: 12 },
      "447": { channels: 4 },
      "448": { channels: 8 },
      "449": { channels: 12 },
      "450": { channels: 16 },
      "451": { channels: 16 },
      "454": { channels: 3 },
      "456": { channels: 8 },
      "457": { channels: 3 },
      "458": { channels: 4 },
      "459": { channels: 4 },
      "460": { channels: 8 },
      "461": { channels: 12 },
      "462": { channels: 4 },
      "463": { channels: 8 },
      "464": { channels: 12 },
      "465": { channels: 16 },
      "466": { channels: 16 },
      "467": { channels: 3 },
      "468": { channels: 6 },
      "469": { channels: 4 },
      "470": { channels: 6 }
    };
  }
}

module.exports = HdlRelays;
