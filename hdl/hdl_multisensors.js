class HdlMultisensors {
  constructor(type) {
    this._type = type;
  }

  isOne() {
    return this.list[this._type] != undefined;
  }

  hasTemperature() {
    return this.list[this._type].temperature;
  }

  hasMotion() {
    return this.list[this._type].motion;
  }

  get list() {
    return {
      "305": { temperature: false, motion: true },
      "307": { temperature: false, motion: true },
      "308": { temperature: false, motion: true },
      "309": { temperature: false, motion: true },
      "312": { temperature: false, motion: true },
      "314": { temperature: true, motion: true },
      "315": { temperature: true, motion: true },
      "316": { temperature: true, motion: true },
      "318": { temperature: true, motion: true },
      "321": { temperature: true, motion: true },
      "322": { temperature: true, motion: true },
      "328": { temperature: true, motion: true },
      "329": { temperature: true, motion: true },
      "330": { temperature: true, motion: true },
      "336": { temperature: true, motion: true },
      "337": { temperature: true, motion: true },
      "340": { temperature: true, motion: true }
    };
  }
}

module.exports = HdlMultisensors;
