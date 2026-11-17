'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Command = require('smart-bus/lib/command');
const { readState } = require('../hdl/dlp-heater-protocol');

test('smart-bus 0.10 retains raw DLP status for the Hanoy parser', () => {
  assert.equal(require('smart-bus/package.json').version, '0.10.0');
  for (const mode of [1, 2, 3, 4, 5]) {
    const payload = Buffer.from([0, 19, 1, mode, 20, 18, 16, 12, 0]);
    const signal = new Command(0x1945, { payload,
      sender: { subnet: 1, id: 103, type: 149 }, target: { subnet: 1, id: 2 } });
    void signal.data;
    assert.equal(readState(signal.payload, false).mode, mode);
    assert.deepEqual(signal.payload, payload);
  }
});

test('smart-bus 0.10 serializes raw Hanoy writes without re-encoding payloads', () => {
  for (const [code, bytes] of [[0x1946, [0, 1, 2, 20, 18, 16, 12, 0]],
    [0xe3d8, [0x12, 1, 1, 0, 0x36]], [0xe3d8, [0x14, 1, 0, 0, 0]]]) {
    const payload = Buffer.from(bytes);
    const command = new Command(code, { payload,
      sender: { subnet: 1, id: 2, type: 0xfffe }, target: { subnet: 1, id: 103 } });
    assert.deepEqual(command.message.subarray(9), payload);
  }
});
