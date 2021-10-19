class HdlMultisensors {
  constructor(type) {
    this._type = type;
  }

  async isOne() {
    return this.list.includes(this._type);
  }

  get list() {
    return [
      "305",
      "307",
      "308",
      "309",
      "312",
      "314",
      "315",
      "316",
      "318",
      "321",
      "322",
      "328",
      "329",
      "330",
      "336",
      "337",
      "340"
    ];
  }
}

module.exports = HdlMultisensors;
