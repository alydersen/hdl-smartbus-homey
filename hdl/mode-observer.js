'use strict';

// Only completed, directed 1945 reads enter this observer. No bus traffic here.
class ModeObserver {
  constructor(deliver, report) {
    this.deliver = deliver;
    this.report = report;
    this.tail = Promise.resolve();
    this.generation = 0;
  }
  reset() {
    this.generation++;
    this.mode = undefined;
    this.bus = undefined;
    this.identity = undefined;
  }
  observe(state, bus, identity) {
    if (!Number.isInteger(state?.mode) || state.mode < 1 || state.mode > 5) return;
    if (this.bus !== bus || this.identity !== identity) {
      this.reset();
      this.bus = bus;
      this.identity = identity;
    }
    const previous = this.mode;
    // Advance synchronously before any asynchronous Homey call can interleave.
    this.mode = state.mode;
    if (previous === undefined || previous === state.mode) return;
    const event = { previous: String(previous), mode: String(state.mode) };
    const generation = this.generation;
    this.tail = this.tail.then(async () => {
      if (generation === this.generation) await this.deliver(event);
    }).catch(error => { this.report(error); });
  }
}
module.exports = { ModeObserver };
