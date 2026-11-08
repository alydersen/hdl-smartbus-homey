[Back to the main page](index.md)

# Floor Heater Controllers
A floor heater controller has one or more heating zones as channels. Different HDL Models have different number of channels, and you see this in [hdl_devicelist.js](https://github.com/alydersen/hdl-smartbus-homey/blob/master/hdl/hdl_devicelist.js) under each type as "channels". You always add each separate channel as a Homey device, and they will as such be shown individually in the process of adding them.

Each heating zone exposes a target temperature, measured temperature, on/off switch, and valve status in Homey.

## Energy (heating cable power)
To list a heating zone in Homey's Energy tab, set the zone device's **Heating cable size (W)** setting to the watts drawn by the cable connected to that zone. The zone then appears in Energy with an approximated power usage: the full cable size while the zone's valve is open, and zero while it is closed. The value follows the valve condition — the load is only drawn when the valve lets the heated water (or the cable's contactor) run — not the on/off switch, which only enables the zone. It is marked as an approximation; Homey shows it with a tilde (~) and it is never as accurate as a real power meter.

The valve condition updates from the controller's status poll, so short openings and closings between polls may not be reflected. Setting the cable size to 0 removes the zone from Energy reporting again.

## Digital Temperature Sensors
Floor heating controllers (device types 207-215) support external digital temperature sensors wired in parallel. These sensors are read-only: they only expose a measured temperature, so they are paired with only that capability — the heating-zone capabilities (target temperature, on/off switch, valve status) never exist on the device and never appear in Insights. Sensor devices paired by earlier app versions lose the heating-zone capabilities automatically on the next app restart.

When you add a floor heater device, you first choose how to continue:

- **Search for devices** — shows the heating zones and the controller's built-in sensor channels (channel 13, plus channels 51-62 for probe IDs 1-12).
- **Add a digital temperature sensor probe** — lets you pick the controller and type in the probe ID. Use this for any probe: digital sensor probes have a factory-set ID, typically two or three digits (roughly 1-300), and probes with IDs above 12 are only reachable this way.

The sensor channels are mapped as follows:
- **Channel 13** — Outdoor temperature sensor
- **Channels 51+** — Digital sensors (50 + sensor probe ID, so probe ID 1 = channel 51, probe ID 133 = channel 183)

## Missing sensor values
Controllers report fixed sentinel values when a channel has no sensor attached, so a paired sensor channel may never show a reading. These values are not bugs:

- **Channel 13 (0x1949 response)** answers `-50.0` (little-endian float `00 00 48 C2`) when no outdoor sensor is wired.
- The 0x1C5F status response reports `0x80` as the current temperature of a channel without a sensor.

Both sentinels fall outside the app's valid temperature range (-40..80 °C, see `valueOK()` in `app.js`), so they are silently discarded instead of being shown as readings. Do not widen the validation bounds to accommodate them; -50.0 and 0x80 mean "no sensor", not a real temperature.

## DLP panels
If DLP panels operate your floor heating, the heating controller can act as master for both Homey and the panels. See [Heating controller master + DLP slave](GUIDE_HeatingDlpSync.md) for how to keep the panels and Homey in sync.
