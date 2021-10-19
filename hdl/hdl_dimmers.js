class HdlDimmers {
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
      "16": { channels: 48 },
      "17": { channels:6 },
      "18": { channels: 48 },
      "32": { channels: 48 },
      "40": { channels: 48 },
      "41": { channels: 48 },
      "42": { channels: 64 },
      "43": { channels: 64 },
      "600": { channels: 6 },
      "601": { channels: 4 },
      "602": { channels: 2 },
      "606": { channels: 2 },
      "607": { channels: 4 },
      "608": { channels: 6 },
      "609": { channels: 1 },
      "610": { channels: 6 },
      "611": { channels: 4 },
      "612": { channels: 2 },
      "613": { channels: 6 },
      "614": { channels: 2 },
      "615": { channels: 4 },
      "616": { channels: 4 },
      "617": { channels: 6 },
      "618": { channels: 1 },
      "619": { channels: 2 },
      "620": { channels: 4 },
      "621": { channels: 6 },
      "622": { channels: 6 },
      "623": { channels: 4 },
      "630": { channels: 4 },
      "631": { channels: 2 },
      "632": { channels: 4 },
      "633": { channels: 6 },
      "634": { channels: 2 },
      "635": { channels: 4 },
      "636": { channels: 6 },
      "800": { channels: 8 },
      "850": { channels: 96 },
      "851": { channels: 96 },
      "852": { channels: 96 },
      "853": { channels: 48 },
      "854": { channels: 48 },
      "4300": { channels: 64 },
      "4301": { channels: 64 },
      "4302": { channels: 64 }
    };
  }
}

module.exports = HdlDimmers;
