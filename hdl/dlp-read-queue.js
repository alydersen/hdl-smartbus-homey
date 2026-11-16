'use strict';

// Only full status reads belong here. Writes retain the existing fail-fast lock.
// A single timer/worker per app prevents startup reads from skipping each other.
class DlpReadQueue {
  constructor({ connected, busy, read, delayMs = 250, waitMs = 30000, attempts = 2 }) {
    Object.assign(this, { connected, busy, read, delayMs, waitMs, attempts });
    this.pending = new Map();
    this.running = false;
    this.closed = false;
    this.timer = null;
  }

  enqueue(device) {
    if (this.closed) return Promise.reject(new Error('The HDL app has stopped.'));
    const existing = this.pending.get(device);
    if (existing) return existing.promise;
    const entry = { device, attempts: 0, waitingSince: null };
    entry.promise = new Promise((resolve, reject) => Object.assign(entry, { resolve, reject }));
    this.pending.set(device, entry);
    this.wake();
    return entry.promise;
  }

  wake() {
    if (this.closed || this.running || this.timer !== null || this.pending.size === 0) return;
    // Defer one turn so enqueue coalesces before the operation starts.
    this.timer = setTimeout(() => {
      this.timer = null;
      this.drain().catch(error => this.close(error));
    }, this.delayMs);
  }

  finish(entry, error, state) {
    if (this.pending.get(entry.device) !== entry) return;
    this.pending.delete(entry.device);
    if (error) entry.reject(error); else entry.resolve(state);
  }

  cancel(device) {
    const entry = this.pending.get(device);
    if (entry) this.finish(entry, new Error('The HDL device was stopped.'));
    if (this.pending.size === 0 && this.timer !== null) {
      clearTimeout(this.timer); this.timer = null;
    }
  }

  close(error = new Error('The HDL app has stopped.')) {
    this.closed = true;
    clearTimeout(this.timer); this.timer = null;
    for (const entry of this.pending.values()) this.finish(entry, error);
  }

  async drain() {
    if (this.running || this.closed) return;
    this.running = true;
    try {
      const entry = this.pending.values().next().value;
      if (!entry) return;
      if (entry.device._deleted) { this.cancel(entry.device); return; }
      if (!this.connected() || this.busy(entry.device)) {
        entry.waitingSince ??= Date.now();
        if (Date.now() - entry.waitingSince >= this.waitMs)
          this.finish(entry, new Error('Waiting for the HDL connection or an idle bus. Status will be read at the next poll.'));
        return;
      }
      try {
        const state = await this.read(entry.device);
        if (state) this.finish(entry, null, state);
        // A lock/connection race may return null. Keep the read queued.
        else {
          entry.waitingSince ??= Date.now();
          if (Date.now() - entry.waitingSince >= this.waitMs)
            this.finish(entry, new Error('The HDL bus is busy. Status will be read at the next poll.'));
        }
      } catch (error) {
        entry.waitingSince = null;
        entry.attempts++;
        if (entry.attempts >= this.attempts) this.finish(entry, error);
        else if (this.pending.get(entry.device) === entry) {
          // Retry at the back: a silent panel must not block every other one.
          this.pending.delete(entry.device); this.pending.set(entry.device, entry);
        }
      }
    } finally {
      this.running = false;
      this.wake();
    }
  }
}

module.exports = { DlpReadQueue };
