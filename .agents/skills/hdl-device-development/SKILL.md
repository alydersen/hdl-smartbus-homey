---
name: hdl-device-development
description: Load when setting up local Homey development for this app, listening to an HDL SmartBus to identify devices by address and type, adding support for new HDL device types or commands, or deciding whether command support belongs in the upstream smart-bus package instead of this app.
---

# HDL SmartBus Device Development

Read `AGENTS.md` first for general codebase guidance. This skill covers the
device-development workflow. It intentionally does not replicate online
documentation that may change — it links to the live sources and only
documents what is specific to this repository.

## 1. Set up local development

App-specific hard requirements (not covered by the official docs):

- A **Homey Pro** on the same LAN as the HDL IP gateway. HDL signals are UDP
  broadcasts and cannot be routed, so the gateway and Homey must share a
  subnet. Nothing can be tested over the internet.
- The IP address of the HDL IP gateway, and a free device address on the HDL
  bus for the app itself.
- Node.js >= 22 (repo requirement; match your Homey's firmware version or
  higher).

Tooling and commands: follow the official Homey docs.

- Getting started (CLI install, `homey login`, `homey app run`):
  https://apps.developer.homey.app/the-basics/getting-started
- Full CLI reference (`app run`, `app install`, `app validate`, flags such as
  `--remote` and `--clean`): https://apps.developer.homey.app/the-basics/getting-started/homey-cli
- Docker is required by the CLI for `app run`/`build`/`validate` on Homey Pro
  (Early 2023) and later.

After `homey app run`, configure the app's settings page (or use
`homey app run --clean` to start from scratch):

- `hdl_ip_address` — IP of the HDL IP gateway
- `hdl_subnet` — the HDL subnet (1-254)
- `hdl_id` — a free device ID on the subnet for this app (1-254)
- `hdl_universal_motion` — optional, defaults to 212

The app connects, sends a discovery broadcast, and starts pairing from the
devices that announce themselves. Give it a few minutes.

Before submitting changes: `npm run lint && npm test`.

## 2. Listen to the bus and recognize devices

How this app does it (all in `app.js`):

- `connect()` creates a `smart-bus` connection (port 6000), registers a
  controller at `subnet.id`, and broadcasts discovery command `0x000e` to
  `255.255`.
- `bus.on('command')` routes every signal to `_signalReceived()`:
  - Signals from other subnets are dropped (configured subnet + 255 only).
  - Signals with `data.switch` go to the `universal-switch` driver.
  - Otherwise `signal.sender.type` is looked up in `hdl/hdl_devicelist.js`;
    unknown types are silently dropped.
  - Recognized senders are recorded in `_hdlFoundUnits`, which is what
    `onPairListDevices` offers during pairing.
- Addresses: a physical device is `subnet.deviceId`; Homey devices are per
  channel, signed `subnet.deviceId.channel`.

### Identifying an unknown device

Zero-code option: run any script with `DEBUG=smart-bus` in the environment to
stream every command crossing the gateway (see the smart-bus README,
Debugging section).

Minimal listener (API documented in the smart-bus README, Receive Commands):

```js
"use strict";
const SmartBus = require("smart-bus");
const bus = new SmartBus({ gateway: "<gateway-ip>", port: 6000 });
bus.on("command", (c) => {
  console.log(`${c.sender.subnet}.${c.sender.id} type=${c.sender.type} code=0x${c.code.toString(16)}`);
});
```

Take the reported `sender.type` and:

1. Check `hdl/hdl_devicelist.js` — if the type ID is there, the device is
   already recognized.
2. If missing, look it up in `assets/defDeviceType.xlsx` (official HDL device
   type IDs, column A) to identify what the hardware is.
3. If the hardware belongs to an existing driver family (e.g. another dimmer
   model), support may only need a new entry in `hdl_devicelist.js`
   (`type`, `channels`, `zones`, `main_capability`, optional `exclude`).
   See index.md, "How devices are recognized".
4. Otherwise the device needs a new driver — continue to section 4.

## 3. Missing command support: contribute upstream first

If `smart-bus` lacks a parser or encoder for a command the device needs:

1. Check the smart-bus repo (`caligo-mentis/smart-bus`): parsers live in
   `lib/`, usage examples in `test/fixtures/commands.js`.
2. Contribute the command upstream first — the maintainer welcomes PRs, and
   upstream support means this app uses the standard implementation.
3. Only implement a local override in this app if upstream is blocked, and
   document it in `CONTRIBUTING_TO_SMART_BUS.md`, which tracks every custom
   command that should eventually move upstream.

smart-bus README: https://github.com/caligo-mentis/smart-bus

## 4. Add a new device type

First decide: devicelist entry only (section 2, step 3) or a full new driver.
For a new driver:

1. `hdl/hdl_devicelist.js` — add the type ID entry.
2. `app.js` — add the driver name to `this._driverlist`.
3. `drivers/<type>/` — create `driver.js`, `device.js`, `driver.compose.json`
   and `assets/` (icon, images). Copy the existing driver closest in behavior.
   `driver.js` handles pairing (`onPairListDevices`), signal-to-device mapping
   (`getDeviceFromSignal`) and state updates (`updateValues`). `device.js`
   registers capability listeners in `onInit()` and sends commands to the bus.
4. Custom capabilities go in `.homeycompose/capabilities/`, flow triggers in
   `.homeycompose/flow/triggers/`. Never edit the generated root `app.json` —
   `.homeycompose/` is the source of truth.
5. Tests in `test/drivers/<type>_driver.test.js`, following the existing
   pattern (Homey SDK is mocked via `test/mocks/homey.js`; extend the mock if
   needed). Cover `updateValues` and pairing.
6. Documentation: add `DEVICES_<TYPE>.md` and link it from `index.md`.

Conventions that reviewers check: `'use strict'` in every file, value bounds
via `valueOK` in `app.js` (temperature -40..80, humidity 0..100,
lux 0..100000), expected errors suppressed silently. Run `homey app validate`
before submitting.

Submit using the checklist in `.github/PULL_REQUEST_TEMPLATE.md`.
