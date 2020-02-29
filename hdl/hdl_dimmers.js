class HdlDimmers {
  constructor(type) {
    this._type = type;
  }

  isOne() {
    return this.list[this._type] != undefined;
  }

  numberOfChannels() {
    return this.list[this._type].channels;
  }

  get list() {
    return {
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
      "636": { channels: 6 }
    };
  }
}

module.exports = HdlDimmers;
