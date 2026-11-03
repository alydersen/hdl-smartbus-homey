# Contributing HDL Commands to smart-bus Package

This document tracks where this Homey app deviates from the
[smart-bus](https://github.com/caligo-mentis/smart-bus) package: commands that
are parsed or encoded locally because smart-bus lacks (or lacked) support, and
the upstream contribution status of each. When a command lands in smart-bus,
the local implementation should be removed and this document updated.

**Current state**: app v1.4.4, smart-bus 0.9.0.

## Upstream activity in flight

- **[PR #23](https://github.com/caligo-mentis/smart-bus/pull/23)** — adds
  `0x000E` (device discovery broadcast) and `0x7262`/`0x7263` (floor heating
  extended temperature), version bump to **0.9.1**. Awaiting review/merge.
- **[PR #25](https://github.com/caligo-mentis/smart-bus/pull/25)** — parses
  the previously skipped `luxRange` and `uvSwitches` fields of `0xDB01`
  (8in1 DeviceType315 sensors status feedback). No app-local override exists
  for these fields; the app consumes them when the PR is merged and released.
  Awaiting review/merge.
- **[PR #26](https://github.com/caligo-mentis/smart-bus/pull/26)** — makes
  the `0xE801` parser length-tolerant so short curtain duration responses
  parse to `{ channel }` instead of throwing a Buffer range error (see the
  local guard below). Awaiting review/merge.
- **[PR #31](https://github.com/caligo-mentis/smart-bus/pull/31)** — fixes
  the `0x1C5F` (Read Floor Heating Status response) parser from the type 213
  bus captures in
  [issue #116](https://github.com/alydersen/hdl-smartbus-homey/issues/116):
  byte 1 bit `0x20` is exposed as `heatingPowerMode` (Normal vs "Heating
  power"/PWM) and byte 11 as `output` (current output percentage).
  **BREAKING:** `work.type` and `watering` are removed from the parse output.
  When a release lands, the `floorheater` driver's `watering.status`
  fallback in the on/off detection becomes inert (the field no longer
  exists) and can be removed along with `work.type`-based code, if any.
  Awaiting review/merge.
- **[Issue #24](https://github.com/caligo-mentis/smart-bus/issues/24)** —
  design discussion for the dry-contact payload variants of `0x0031` and
  `0xE3D9` (see below). No implementation until the maintainer picks a
  direction.

## When smart-bus 0.9.1 is released

We are waiting for the 0.9.1 release (merge + npm publish of PR #23). Once it
is out:

1. Bump the dependency: `smart-bus: ^0.9.1` in `package.json`, update
   `package-lock.json` (`npm install`), and keep the four-file version-bump
   procedure in mind only if the app version itself changes (see AGENTS.md).
2. Replace the raw `0x7262` send in `drivers/floorheater/device.js`
   (`_performPoll`: currently `payload: Buffer.from([channel])`) with the
   standard data form `data: { channel }` and remove the `rawPayload` variable.
3. Replace the raw `0x7263` channel extraction in
   `drivers/floorheater/driver.js` (`updateValues`: currently
   `bufferPayload.readUInt8(0)`) with `signal.data.channel`. The
   `_delayAfterCommand` case for `0x7262` stays as-is — only the payload
   construction changes, not the command code.
4. Run `npm run lint && npm test`, and update the floorheater tests that
   assert the raw buffer send.
5. Update this document: move `0x000E`, `0x7262` and `0x7263` to the
   "supported upstream" list.

## App-local implementations (still needed)

These are parsed from the raw `signal.payload` because smart-bus cannot
provide them (yet). Keep this list accurate — it is the source of truth for
what can be removed when upstream support arrives.

### 0x0031 — dry contact status variant

`drivers/dry-contact/driver.js` (`updateValues`)

Upstream parses `0x0031` with dimmer semantics: `{ channel, level, time }`.
Dry contact modules (HDL-MSDxx.40 family) reuse the opcode with different
layouts:

- 5+ byte payload: `level` at byte 1, **1-based contact index at byte 4**
- otherwise: `level` at byte 1, **channel bitmask in the last byte**

The mask byte collides with the low byte of upstream's `time` word, so the
standard parse silently misinterprets it. The variant cannot be contributed
as a parser change without breaking dimmer consumers — see
[issue #24](https://github.com/caligo-mentis/smart-bus/issues/24).

### 0xE3D9 — dry contact acknowledge variant

`drivers/dry-contact/driver.js` (`updateValues`)

Upstream parses `0xE3D9` as panel control response (`{ key, value }`). Dry
contact modules send acknowledgements in two other layouts:

- **Sentinel mode**: an `0x11` marker byte, followed by channel index and
  state byte (e.g. `00 00 00 11 03 01` → channel 3, active)
- **Mask mode**: channel bitmask at byte 1, state at byte 2
  (e.g. `00 03 01` → channels 1 and 2, active)

Same upstream constraint as `0x0031` — tracked in
[issue #24](https://github.com/caligo-mentis/smart-bus/issues/24).

### 0xE801 — short curtain duration response variant

`drivers/curtain/driver.js` (`updateValues`, guard before `signal.data`)

Some curtain modules answer the `0xE800` duration request with a payload
shorter than the 4 bytes (`[channel, reserved, duration_hi, duration_lo]`)
smart-bus's `0xE801` parser assumes. Observed: a 3-byte payload, which makes
`readUInt16BE(2)` throw `The value of "offset" is out of range. It must be
>= 0 and <= 1. Received 2` — logged by the app on every 60-second poll as
`Error for curtain <id>`.

The driver skips any `0xE801` payload shorter than 4 bytes, treating the
duration as unknown (same as no response). The upstream fix is
[PR #26](https://github.com/caligo-mentis/smart-bus/pull/26): a
length-tolerant `0xE801` parser that returns only `{ channel }` for short
payloads. When it is merged and released, remove this guard and the
matching tests. The exact meaning of the 3-byte variant is unknown —
verify with a real bus capture (`DEBUG=smart-bus`) before proposing field
semantics upstream.

### 0x7262 / 0x7263 — floor heating extended temperature

`drivers/floorheater/device.js` (`_performPoll`, raw `Buffer` payload),
`drivers/floorheater/driver.js` (`updateValues`, raw byte 0)

Used alongside the standard `0x1948`/`0x1949` temperature read:

- `0x7262` request: single channel byte
- `0x7263` response: channel byte at offset 0 (only observed field so far)

**Pending upstream**: [PR #23](https://github.com/caligo-mentis/smart-bus/pull/23)
registers both commands; when 0.9.1 is released, follow the checklist above.

### 0x000E — device discovery broadcast

`app.js` (`connect`)

Sent with an empty payload to `255.255`; devices announce themselves and are
identified by the bus frame header. Already works today (empty payload means
no encoder is needed); PR #23 registers it upstream for documentation and
round-tripping. No app change required when 0.9.1 lands.

## Legacy cleanup (done)

Both smart-bus 0.7.0-era workarounds have been removed now that the 0.9.0
parsers provide identical fields:

- `drivers/floorheater/driver.js` — the raw byte re-reads for valve
  (offset 9 for `0x1C5F`, 8 for `0x1C5D`), work status and `PWD` were
  replaced by the standard parsed fields (`valve`, `work.status`, `PWD`,
  `watering.status`).
- `drivers/curtain/driver.js` — the manual `signal.parse(signal.payload)`
  re-parse was removed; the driver consumes `signal.data` directly.

One related exception is kept intentionally: `app.js` `_signalReceived`
still lets curtain signals without parsable data through, so curtain
senders are recorded in the found-units list and remain pairable even
when their current command carries an empty payload. The curtain driver
itself ignores empty data.

## Supported upstream and used as-is

All of these go through smart-bus's standard parsers/encoders via
`signal.data` — no local protocol code:

| Command(s) | Area | Notes |
|------------|------|-------|
| `0x0031` (dimmer/relay semantics) | Dimmer, relay | Standard set-level command |
| `0x0033` | Dimmer, relay | Read channel status |
| `0xE3E0`–`0xE3E4` | Curtain | Control and status, incl. duration |
| `0xE800`/`0xE801` | Curtain | Curtain duration (since 0.9.0) |
| `0x1C5C`–`0x1C5F` | Floor heater | Status/control incl. valve, work, PWD |
| `0xE3E7`/`0xE3E8` | Sensors, floor heater | Legacy temperature read |
| `0x1948`/`0x1949` | Sensors, floor heater | Extended temperature read |
| `0x1944` | Panel | Additional panel data |
| `0xDB00`, `0x1645`, `0x1604` | Multisensor, dry contact | Sensor status requests |
| `0x6F00` | Dry contact | Multi-channel status mask (since 0.9.0) |
| `0xE018`, `0xE01C`, `0xE01D` | Universal switch | Status request/set/response |

## How to Contribute to smart-bus

1. Check the [smart-bus repository](https://github.com/caligo-mentis/smart-bus):
   parsers live in `lib/commands.js`, fixtures in `test/fixtures/commands.js`.
2. Verify the wire format with real-bus captures or the official HDL
   documentation — do not guess undocumented offsets.
3. Contribute upstream first (PR with command definition, parser, encoder,
   fixtures). Upstream squashes PRs — keep each PR a single small topic.
4. Only keep a local raw-parsing override in this app if upstream is blocked,
   and record it in the **App-local implementations** section above.
5. Once a command is merged and published, remove the local implementation,
   bump the dependency, test, and update this document.

## References

- [smart-bus Repository](https://github.com/caligo-mentis/smart-bus)
- [Upstream PR #23 — discovery + extended temperature (0.9.1)](https://github.com/caligo-mentis/smart-bus/pull/23)
- [Upstream issue #24 — 0x0031/0xE3D9 variants discussion](https://github.com/caligo-mentis/smart-bus/issues/24)
- [HDL Automation Documentation](http://hdlautomation.com/)
- [This App's GitHub](https://github.com/alydersen/hdl-smartbus-homey)

---

*Last updated: November 2026 — app v1.4.4, smart-bus 0.9.0 (awaiting 0.9.1)*
