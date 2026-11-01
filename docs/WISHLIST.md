# Wish List

Thread reviewed: 2026-11-01 (last post read: #335, ojnordah, 2026-10-23)

This is a working list of feature requests and open issues collected from the
[Homey community forum thread](https://community.homey.app/t/app-pro-hdl-smartbus/26575)
(331 posts, 2020–2026), plus related GitHub issues. It is intended as a
maintainer's overview of what users are asking for, the current state, and
what would be needed to move each item forward.

Post references (e.g. `#124`) point to posts in the forum thread unless
stated otherwise. State labels:

- **Open** — not started
- **In progress** — work started but not verified/finished
- **Needs info** — blocked on hardware, type IDs, or signal details
- **Blocked** — blocked by the `smart-bus` library or the Homey platform
- **Done** — shipped in a released version

## A. DLP / panel integration

> This section is kept as a record of what users are asking for and what the
> app can do today. No app-side work is planned here; the DLP panels are
> complex one-way devices and the standard solution is Universal Switches on
> the HDL side (see the section's notes per item).

### A1. DLP panel buttons as flow triggers
- **Asked for:** Trigger Homey flows directly from buttons on DLP/itouch
  panels, without routing through Universal Switches on the HDL side.
  (Tor-Oskar #21, Fredrik #97, Bendik #298, einarso #317)
- **Current capability:** Panels are supported read-only as temperature
  sensors (`panel` driver); button state cannot be read or set. Buttons can
  be configured in HDL Setup Tool to switch a UV (typically 212), which
  Homey picks up. This works reliably for many users (ojnordah #302,
  TorbjornM #308) but requires HDL Setup Tool work and confuses some users.
- **Context:** ojnordah is developing a DLP driver (panel buttons and
  thermostat control) with AI assistance (#335).

### A2. DLP thermostat control (set/read target temperature and modes)
- **Asked for:** Read and set target temperature and mode
  (Normal/Day/Night/Away) on DLP panels, so panels and Homey stay in sync.
  (Fredrik #213, #330; ojnordah #291, #335)
- **Current capability:** Panel driver is one-way (temperature reading
  only). A setup where the heating controller is master and the DLPs are
  slaves, all zones in Normal mode, makes changes to the heating controller
  reflect on the DLPs (TorbjornM #332) — this is the documented workaround,
  now described step by step in `GUIDE_HeatingDlpSync.md` (see F1).
- **Context:** Covered by ojnordah's DLP driver effort (#335), see A1.

### A3. Reflect HDL-side mode/scene changes in Homey
- **Asked for:** When a user changes day/night/away mode from an HDL panel
  (e.g. Enviro), Homey should notice that relays/dimmers changed state.
  (Bendik #289)
- **Current capability:** Not possible today. HDL logic does not broadcast
  state changes; Homey relies on device broadcasts and the 60-second poll.
  Recommended approach (documented in thread): move logic to Homey, see
  `GUIDE_MovingLogicToHomey.md` (F2).

### A4. itouch series panel support
- **Asked for:** Add itouch wall buttons/panels as devices. (Bendik #298, #314)
- **Current capability:** Not supported. Would need a contributor with the
  hardware to verify what the panel sends on the bus; the UV workaround in
  A1 applies in the meantime (#302).

## B. Sensors

### B1a. Digital sensors on floor heating controllers (read-only)
- **Status:** Implemented; awaiting verification by a user with the units
- **Asked for:** Read digital sensor probes on heating controllers:
  channel 13 is the HDL-standard outside temperature, channels 50+probe ID
  are other digital sensors — as read-only temperatures, not thermostats.
  (kroaeg, GitHub issue #72)
- **Current state:** Shipped in v1.4.4 (commit e6ba20a): `sensorChannels`
  [13, 51-62] added to floorheater types 207-215 in `hdl_devicelist.js`;
  sensor channels pair as read-only temperature-only devices (heating-zone
  capabilities removed, write commands guarded, the 60-second poll only
  reads temperature). Issue #72 is closed.
- **Verification:** kroaeg has no Discourse presence — GitHub is the only
  channel (issue #72 comment; maintainer asked for confirmation there,
  2026-11-01). Devices likely need to be re-added for the new pairing to
  take effect.

### B1b. Magnetic contacts as read-only window/door status
- **Status:** Needs info (input hardware unknown); design sketched
- **Asked for:** Window/door magnetic contacts are set up as UV switches
  and show in Homey as toggleable buttons; pressing the toggle writes to
  the bus and falsifies the open/closed state. Wants a read-only status,
  alarm capability, or a lockable switch. (Andreas_Pedersen #324)
- **Current state:** Not implemented. The universal-switch driver is
  inherently writable: its `onoff` listener broadcasts UV Switch Control
  (0xE01C) to 255.255 plus every device address individually (or the logic
  controller), so the contact state can be changed from Homey.
- **Needs info — which input module are the contacts wired to?**
  A magnetic contact is a plain reed switch, not an HDL device type; it
  must be wired to an HDL input module, and #324 does not say which one.
  - Standalone dry contact module (HDL-MSD): the `dry-contact` driver
    already reads it read-only, with per-channel capabilities and flow
    triggers — no new code needed, just pairing the module.
  - Multisensor dry-contact inputs: the multisensor driver already
    exposes `dry_contact_1..4` read-only with flow triggers.
  - Only if the contacts genuinely exist only as UV switches is a new
    UV-based read-only device type needed.
  Asked Andreas_Pedersen in the forum (2026-11-01); awaiting reply.
- **Design sketch (if UV-based read-only is needed):** new read-only
  `contact` driver modeled on universal-switch: Homey's standard
  `alarm_contact` capability (read-only by nature, correct open/closed
  semantics for flows, zones and Insights), device class `sensor`, pairs
  UV numbers 1-254 excluding the reserved motion UV (default 212). No
  capability listener, ever; keeps `respondToSender()` (0xE01D is a
  protocol acknowledgment, not a state write). `app.js`'s UV branch
  dispatches to both drivers; no `hdl_devicelist.js` entry (UV-number
  based, like universal-switch). Flow triggers `contact_true`/`false`.
  Self-contained: no protocol or library work, no bus capture needed.
  Generic bonus: also covers DLP panel buttons and any other UV-routed
  state (cf. A1).

### B2. 8in1 lux values missing or stale
- **Status:** Open (lux explained — protocol limitation on type 315;
  optional follow-up below)
- **Asked for:** Reliable lux reporting from 8in1 multisensors; some users
  get no lux at all, others get values hours old. (Fredrik #113, #299, #306)
- **Current state:** Confirmed against the official HDL-BUS Pro operation
  codes document (in-repo:
  `assets/HDL-BUS Pro operation codes(Eng) Jan 08 2013.pdf`). The two 8in1
  models differ fundamentally: type 314 reports
  brightness (0-5000 lux) in its status feedback and works in the app, while
  type 315 has no brightness measurement at all — its status feedback
  (`0xDB01`) only carries an "In LUX range" flag (0/1) relative to the range
  configured in HDL Setup. A numeric lux value cannot be provided for the
  type 315, regardless of app changes.
- **Staleness:** The type 315 has no auto-broadcast command; it only answers
  the app's status requests, so with the default poll its readings refresh
  once a minute. Since 1.5.0 the poll interval is configurable down to 10
  seconds (D3), which is the app's full remedy for stale readings.
- **Notes:** smart-bus
  [PR #25](https://github.com/caligo-mentis/smart-bus/pull/25) parses the
  lux-range flag (and UV switch states) from `0xDB01`. If merged and
  released, the app could surface an "in lux range" capability for type 315
  sensors — the only lux-related data that model offers.

### B3. SB-CMS-PIR support
- **Status:** Needs info
- **Asked for:** Add the SB-CMS-PIR motion sensor. (Fredrik #115)
- **Current state:** Never resolved; needs type ID and a bus capture.
  Mini PIR type 323 was added earlier (#193–197), which may cover it.

### B4. Motion detection latency on some installations
- **Status:** Open (configuration-dependent)
- **Asked for:** Fast, consistent motion-triggered lighting. (Fredrik #145,
  #223, #242, #246)
- **Current state:** For affected users the 60-second poll is the fallback
  path when the UV (212) signal isn't caught, giving up to ~30 s latency.
  Best practice documented by TorbjornM (#308): sensor → logic module → UV →
  Homey, reset UV to off after the flow. Included in the multisensor guide.
- **Notes:** App-side fixes may include more resilient UV handling (D2) or
  a shorter poll interval (D3).

## C. Device types

### C1. 12in1 multisensor relay output control
- **Status:** Open (investigated; implementation not started)
- **Asked for:** Control the relay output (e.g. garage door opener) on
  12in1 multisensors from Homey. (Eivind_Bo #261, #278, #283)
- **Current state:** Multisensors are read-only in the app. AndreasL
  assessed it as doable (#262) — the difference vs. the relay driver is one
  device with 2 channels rather than one Homey device per channel. Never
  implemented.
- **Investigation (2026-11-01, no code changes yet):**
  - The 12in1 is device type **321** (HDL-MS12.2C / SB-CMS-12in1), with
    type **308** (HDL-MS12) as the older variant (per
    `assets/defDeviceType.xlsx`). Both are already registered as
    `multisensor` in `hdl/hdl_devicelist.js`, so their signals already
    reach the multisensor driver.
  - **Protocol/library: supported.** The relay output is controlled with
    the standard Single Channel Control command (`0x0031`, channel 1/2),
    confirmed by Eivind_Bo (#261: DLPs and switches trigger it that way).
    `smart-bus` fully supports `0x0031`, its response `0x0032`, and Read
    Status of Channels `0x0033` — the same commands `drivers/relay/`
    already uses. No upstream work needed; the gap is purely app-side.
  - **App-side gap:** the multisensor driver is passive —
    `driver.js:updateValues()` only looks for movement/temperature/
    humidity/brightness/dry-contact payloads and ignores
    `data.channel`/`level`; `device.js` has no capability listeners and only
    polls sensor status (0xdb00, 0x1645, 0x1604).
  - **Design sketch:** keep one Homey device per unit and add per-channel
    relay capabilities (`relay_1`/`relay_2`), following the dry-contact
    driver's lazy-capability pattern (custom capabilities in
    `.homeycompose/capabilities/` plus per-channel flow cards). Capability
    listeners in `device.js` send `0x0031` with the channel; `updateValues()`
    additionally handles `data.channel`/`data.channels` for feedback, and
    `requestUpdate()` can add an `0x0033` poll. The standard `onoff`
    capability cannot be used (only one per device, and there are two
    relay channels). Per-channel sub-devices relay-style would break the
    unit-level pairing model.
  - **Per-type gating:** only the 12in1 types have relay outputs, but all
    multisensor types share this driver — the devicelist needs per-type
    relay-channel metadata (e.g. a new field on entries 321/308) so relay
    capabilities are only added for those types (AndreasL's point in #262).
  - **Feedback path (per the official operation codes doc, in-repo
    `assets/HDL-BUS Pro operation codes(Eng) Jan 08 2013.pdf`):** the
    12in1 Read Status feedback (`0x1646`) carries only temperature,
    brightness, PIR, sonic and two dry contacts — **no relay state**. So
    the sensor status poll can never reflect the relay outputs. If the
    12in1 implements the standard single-channel command family, feedback
    arrives via `0x0032` answerbacks, which are broadcasts carrying the
    switch status of every channel, or `0x0034`/`0x0039` responses
    (`0x0038` reads actual status). The bus capture should target these.
  - **Open unknown (needs a bus capture):** whether the 12in1 actually
    *reports* relay channel state back the way relay modules do (see the
    feedback path above). Only the control direction is confirmed. Control
    would work without feedback, but state sync when the relay is switched
    from a DLP depends on this. Capture with a `DEBUG=smart-bus` listener
    (see `.agents/skills/hdl-device-development/`) before finalizing the
    feedback design.
  - Details also documented in `DEVICES_MULTISENSORS.md`, section
    "Relay outputs (12in1)".

### C2. Generic/customizable relay or dimmer device
- **Status:** Rejected by maintainer (2026-11-01)
- **Asked for:** A "manual" device where the user enters subnet, device ID,
  channel count and selects relay/dimmer — covering odd units without app
  updates. (Eivind_Bo #263)
- **Current state:** Rejected at the time as it required a rewrite of the
  signal handling. With the device-registry architecture
  (`hdl/hdl_devicelist.js`) this may be easier now.
- **Decision:** Not pursued — maintainer prefers supporting devices
  explicitly through the device registry (see C1 for the 12in1 relay
  outputs). Revisit only if unregistered-device requests keep recurring.

### C3. IR module (HDL-MIR) support
- **Status:** Blocked (library)
- **Asked for:** Read temperature/control IR equipment via the IR module.
  (Fredrik #42)
- **Current state:** No commands implemented in `smart-bus`; protocol work
  is needed upstream before the app can use it.

### C4. DALI gateway (HDL-MC64-DALI.431)
- **Status:** Done (basic)
- **Asked for:** Confirmation/experiences with the DALI gateway (#254).
- **Current state:** DALI dimmers work for users (Bendik #258); "better
  DALI support" shipped in 2023 (#241). No open asks.

### C5. Granite touch panel HDL-MPTL4C.48
- **Status:** Needs info
- **Asked for:** Support as temperature sensor like other DLPs (#209, #210).
- **Current state:** Missing from the device type list at the time; needs
  its type ID to register it as a panel.

## D. Platform / architecture

### D1a. Multiple subnets through one gateway
- **Status:** Open (app-side rework; no library changes needed)
- **Asked for:** Use devices on several HDL subnets (wired + wireless,
  house + apartment) that are behind the same IP gateway, from one Homey.
  (Yngvi #79, Martin #293)
- **Current state:** Not the `smart-bus` library's fault — it does no subnet
  filtering and already delivers every subnet's traffic to the app. The
  blocker is the app's single-subnet assumptions:
  - `_signalReceived()` in `app.js` drops signals whose sender subnet is
    not the one configured setting (`hdl_subnet`)
  - `devSignChnld()` builds device signatures with the configured subnet
    instead of the signal sender's actual subnet
  - `_hdlFoundUnits` (discovery) is keyed by device id only, so the same
    device number on two subnets collides; pairing also stamps the
    configured subnet into device ids/names
  - The universal-switch broadcast loop uses the configured subnet
- **Implementation:** Accept a list of subnets instead of one
  (`hdl_subnet` → `hdl_subnets`, seeded from the old key on first run),
  route everywhere by the sender's actual subnet. Device data format
  (`subnet.deviceId.channel`) is unchanged, so existing installations and
  pairings keep working without re-pairing.

### D1b. Multiple IP gateways
- **Status:** Open (app-side; builds on D1a)
- **Asked for:** Support two separate HDL systems, each with its own IP
  gateway, from one Homey. (Yngvi #79, Martin #293)
- **Current state:** Gateway traffic is broadcast over UDP on the LAN
  (port 6000), so a Homey receives all gateways' streams on one socket.
  The library already supports this: each `SmartBus` instance filters
  datagrams by its configured gateway's embedded source IP, and its
  socket uses `reuseAddr`, so one instance per gateway can share port
  6000 with no cross-talk. The remaining work is sending: commands must
  be unicast to the gateway that can reach the target device, so the app
  needs a subnet → gateway routing map (explicit config, or learnable
  from observed traffic since every signal carries both the sender's
  subnet and the source gateway IP).
- **Implementation:** Config becomes a list of buses
  (`{gateway, subnets, controllerId}`); D1a is the single-entry case, so
  the same routing refactor serves both.
- **Constraint (both D1a and D1b):** The two systems must use distinct
  subnet numbers — device data is `subnet.deviceId.channel` and cannot
  disambiguate two systems numbering themselves the same subnet.

### D2. Universal Switch robustness and addressing
- **Status:** Partially done
- **Asked for:** Send UVs to a specific logic controller address instead of
  broadcast only (#58); fix "ghost" UV switches triggering flows on their
  own (Fredrik #131, #176, #178, #184).
- **Current state:** Optional logic-controller addressing was added (test
  version #319: "Universal switch: broadcast + optional logic controller
  path"). Ghost-UV reports appear to be local to Fredrik's 2011
  installation/configuration and were never reproduced or resolved.

### D3. Configurable polling interval
- **Status:** Done — implemented in PR #102, released in 1.5.0
- **Asked for:** Several reports of slow state updates implicitly trace back
  to the fixed 60-second poll (see B2, B4, #252).
- **Current state:** Poll interval is an app setting (`hdl_poll_interval`,
  10–600 seconds, default 60). Per-device status requests are staggered
  evenly across the interval instead of firing one burst on the bus.

### D4. Energy tab support for relays
- **Status:** Done — implemented in PR #103, released in 1.5.0
- **Asked for:** Relay power usage ("Power usage when on (Watt)") should
  appear in Homey's Energy tab as a consumer. (horakmar #296)
- **Current state:** The relay and dimmer drivers declare
  `energy.approximation` (`usageOn`/`usageOff`, default 0), which gives every
  channel the standard Homey "Power usage when on/off" settings. Homey
  calculates consumption from on-time (scaled by dim level for dimmers).
  Limitation (Homey design): approximated devices count towards the total
  but are not included in the "Top Consumers" list. horakmar's
  `"energy": {"cumulative": true}` suggestion applies to cumulative
  `meter_power` meters, not to relays.

### D5. Homey Bridge support
- **Status:** Blocked (platform)
- **Asked for:** Run the app on the Homey Bridge. (Fredrik #67, #80)
- **Current state:** Impossible: the Bridge does not allow apps to access
  the local network. Closed unless Athom changes this.

## E. Bugs and loose ends

### E1. DMX dimmer SB-DN-48DMX flashes to 100% before dim level
- **Status:** Open
- **Asked for:** When a flow sets a dim level, the light flashes to 100%
  before going to the requested level. (Eivind_Bo #124)
- **Current state:** No code error found at the time; never resolved.
  Possibly related to gradual dimming (added later, #214) or the unit
  handling on/off + level commands.

### E2. Intermittent wrong device state in Homey
- **Status:** Recurring / configuration-dependent
- **Asked for:** Dimmer/relay icons in Homey showing the wrong state.
  (Fredrik #100, #109, #175; Nichel #116, #153)
- **Current state:** Multiple fixes shipped over the years (dimmer update
  fix #190, refactoring #127/#200). Reports correlate with busy buses, WiFi
  Homey units and heavy HDL logic; no open reproducer on current versions.
- **Notes:** Fredrik reports 8in1 relay status and lux updates stopping
  again in 2023 (#280) — likely same root causes (B2).

### E3. Fredrik's UV flow triggers firing without button presses
- **Status:** Unresolved (single install)
- **Asked for:** Flows triggered by UVs activate with no visible source
  ("ghost UVs"). (Fredrik #176–#184, #239)
- **Current state:** Extensive debugging (including a patched driver for
  logging); conclusion was local configuration/bus issues. HDL support had
  not heard of the problem. No app-side action identified.

## F. Documentation opportunities

### F1. Heating controller master + DLP slave setup guide
- **Status:** Done — `GUIDE_HeatingDlpSync.md` (pending release)
- **Asked for:** A step-by-step guide (Nichel #333); TorbjornM offered to
  write up his setup incl. HDL Setup Tool gotchas (#310).
- **Current state:** The guide documents the master/slave role switch:
  heating controller as master, DLPs pointed at their zone's controller
  channel, all zones in Normal mode, with the Setup Tool gotchas (refresh
  before editing, save per heating ID, inner-sensor and
  temperature-source choices, cycle time) and an explicit statement of the
  trade-off (no Day/Night/Away mode control from Homey). Written from
  TorbjornM's thread reports (#308, #332) and the existing
  `GUIDE_HeatingController.md`; cross-linked from the sidebar, the front
  page guides list, `DEVICES_PANELS.md` and `DEVICES_FLOORHEATERS.md`.
  Not yet verified step-by-step on a live installation — TorbjornM's
  promised screenshots (#310) would still make a good review pass.

### F2. Best-practice: moving HDL logic to Homey
- **Status:** Done — `GUIDE_MovingLogicToHomey.md` (pending release)
- **Asked for:** Documented patterns for replacing the logic module
  (Fredrik #145 proposed; ojnordah supported #147).
- **Current state:** The patterns scattered across `GUIDE_Multisensor.md`
  and the thread (TorbjornM #308) are consolidated in a dedicated guide:
  what to keep on the HDL side (sensor→UV conversion, safety-critical and
  real-time logic), what moves well (scenes/modes, timers, composite
  conditions, notifications), a step-by-step migration with a
  disable-don't-delete rollback strategy, and tips covering UV numbering,
  the UV signal log (D2) and poll-interval latency.
