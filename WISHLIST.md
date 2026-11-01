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
  and a setup guide has been requested (Nichel #333, see F1).
- **Context:** Covered by ojnordah's DLP driver effort (#335), see A1.

### A3. Reflect HDL-side mode/scene changes in Homey
- **Asked for:** When a user changes day/night/away mode from an HDL panel
  (e.g. Enviro), Homey should notice that relays/dimmers changed state.
  (Bendik #289)
- **Current capability:** Not possible today. HDL logic does not broadcast
  state changes; Homey relies on device broadcasts and the 60-second poll.
  Recommended approach (documented in thread): move logic to Homey.

### A4. itouch series panel support
- **Asked for:** Add itouch wall buttons/panels as devices. (Bendik #298, #314)
- **Current capability:** Not supported. Would need a contributor with the
  hardware to verify what the panel sends on the bus; the UV workaround in
  A1 applies in the meantime (#302).

## B. Sensors

### B1. Digital sensors / magnetic contacts as read-only window-door status
- **Status:** In progress
- **Asked for:** Window/door contacts (via UV switches today) show as toggle
  buttons in Homey; users want a read-only status ("open/closed"), alarm
  capability, or a lockable switch. (Andreas_Pedersen #324;
  GitHub issue #72)
- **Current state:** Test version released 2026-04 (#327) attempted to
  surface digital sensors; needs verification by someone with the units —
  devices likely need to be re-added.

### B2. 8in1 lux values missing or stale
- **Status:** Open (lux explained — protocol limitation on type 315;
  optional follow-up below)
- **Asked for:** Reliable lux reporting from 8in1 multisensors; some users
  get no lux at all, others get values hours old. (Fredrik #113, #299, #306)
- **Current state:** Confirmed against the official HDL-BUS Pro operation
  codes document. The two 8in1 models differ fundamentally: type 314 reports
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
- **Status:** Open
- **Asked for:** Control the relay output (e.g. garage door opener) on
  12in1 multisensors from Homey. (Eivind_Bo #261, #278, #283)
- **Current state:** Multisensors are read-only in the app. AndreasL
  assessed it as doable (#262) — the difference vs. the relay driver is one
  device with 2 channels rather than one Homey device per channel. Never
  implemented.

### C2. Generic/customizable relay or dimmer device
- **Status:** Open (design question)
- **Asked for:** A "manual" device where the user enters subnet, device ID,
  channel count and selects relay/dimmer — covering odd units without app
  updates. (Eivind_Bo #263)
- **Current state:** Rejected at the time as it required a rewrite of the
  signal handling. With the device-registry architecture
  (`hdl/hdl_devicelist.js`) this may be easier now.

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
- **Status:** Open
- **Asked for:** A step-by-step guide (Nichel #333); TorbjornM offered to
  write up his setup incl. HDL Setup Tool gotchas (#310).
- **Current state:** TorbjornM's multisensor and floor-heating guides are in
  the repo (`GUIDE_Multisensor.md`, `GUIDE_HeatingController.md`); the
  master/slave DLP synchronization guide is still missing.

### F2. Best-practice: moving HDL logic to Homey
- **Status:** Partially done
- **Asked for:** Documented patterns for replacing the logic module
  (Fredrik #145 proposed; ojnordah supported #147).
- **Current state:** Parts exist across `GUIDE_Multisensor.md` and the
  thread (TorbjornM #308). Could be consolidated.
