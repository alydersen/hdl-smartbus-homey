# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Open-source Homey app (SDK v3) that integrates HDL SmartBus home automation devices with the Homey smart home hub. Uses the `smart-bus` npm package for HDL protocol communication over IP.

Homey SDK docs: https://apps.developer.homey.app

## Commands

```bash
npm install          # Install dependencies
npm test             # Run Jest tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

There is no build step. The app runs JavaScript directly via Homey SDK v3.

To deploy/test on a Homey device, use the [Homey CLI](https://apps.developer.homey.app/the-basics/getting-started#install-the-homey-cli).

## Architecture

### Signal Flow

```
HDL Bus → SmartBus IP Gateway → app.js._signalReceived()
  → Check subnet match
  → Lookup device type via hdl/hdl_devicelist.js
  → Route to matching driver via _updateDevice()
  → Driver updates Homey device capabilities
```

The app also actively polls devices every 60 seconds via `callForUpdate()`.

### App Entry Point (`app.js`)

Extends `Homey.App`. Connects to the HDL bus via IP gateway settings (`hdl_ip_address`, `hdl_subnet`, `hdl_id`). All incoming bus signals are routed through `_signalReceived()` which identifies the device type and dispatches to the correct driver.

### Driver Pattern

All 9 device types (`dimmer`, `relay`, `tempsensor`, `multisensor`, `dry-contact`, `universal-switch`, `floorheater`, `curtain`, `panel`) follow the same two-file pattern in `drivers/<type>/`:

- **`driver.js`** — Extends `Homey.Driver`. Handles pairing (`onPairListDevices`), signal-to-device mapping (`getDeviceFromSignal`), and state updates (`updateValues`/`updateDevice`).
- **`device.js`** — Extends `Homey.Device`. Registers capability listeners in `onInit()`, sends commands to HDL bus, and updates Homey state via `updateHomeyLevel()`.

### Device Registry (`hdl/hdl_devicelist.js`)

Maps 350+ HDL device type IDs to driver types with metadata: channel count, zone count, main capability, and excluded capabilities. One HDL physical device can expose multiple Homey devices (one per channel).

Device signatures use the format: `subnet.deviceId.channel`

### Homey Compose (`.homeycompose/`)

Source of truth for `app.json` (auto-generated at build), custom capability definitions, and flow trigger/condition/action definitions. Edit files here, not the root `app.json`.

## Testing

Tests live in `test/` and use Jest. The Homey SDK is mocked via `test/mocks/homey.js` (configured in `jest.config.js` moduleNameMapper). When adding mock functionality, extend `test/mocks/homey.js`.

## Key Conventions

- `'use strict'` at the top of every JS file
- New device types must be added to `this._driverlist` in `app.js` and registered in `hdl_devicelist.js`
- Silent error handling: expected errors (e.g., "Driver Not Initialized", "invalid_device") are suppressed from logs; unexpected errors are logged
- Value validation bounds: temperature -40..80°C, humidity 0..100%, lux 0..100,000
