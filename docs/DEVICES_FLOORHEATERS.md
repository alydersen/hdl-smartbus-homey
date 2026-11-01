[Back to the main page](index.md)

# Floor Heater Controllers
A floor heater controller has one or more heating zones as channels. Different HDL Models have different number of channels, and you see this in [hdl_devicelist.js](https://github.com/alydersen/hdl-smartbus-homey/blob/master/hdl/hdl_devicelist.js) under each type as "channels". You always add each separate channel as a Homey device, and they will as such be shown individually in the process of adding them.

Each heating zone exposes a target temperature, measured temperature, on/off switch, and valve status in Homey.

## Digital Temperature Sensors
Floor heating controllers (device types 207-215) support up to 13 external digital temperature sensors wired in parallel. These sensors are available for pairing alongside the regular heating zones and appear as "HDL Floor Sensor" during pairing.

Sensor devices are read-only: they only expose a measured temperature. They are paired with only that capability, so the heating-zone capabilities (target temperature, on/off switch, valve status) never exist on the device and never appear in Insights. Sensor devices paired by earlier app versions lose the heating-zone capabilities automatically on the next app restart.

The sensor channels are mapped as follows:
- **Channel 13** — Outdoor temperature sensor
- **Channels 51-62** — Digital sensors (sensor ID + 50, so sensor ID 1 = channel 51, sensor ID 12 = channel 62)

## Missing sensor values
Controllers report fixed sentinel values when a channel has no sensor attached, so a paired sensor channel may never show a reading. These values are not bugs:

- **Channel 13 (0x1949 response)** answers `-50.0` (little-endian float `00 00 48 C2`) when no outdoor sensor is wired.
- The 0x1C5F status response reports `0x80` as the current temperature of a channel without a sensor.

Both sentinels fall outside the app's valid temperature range (-40..80 °C, see `valueOK()` in `app.js`), so they are silently discarded instead of being shown as readings. Do not widen the validation bounds to accommodate them; -50.0 and 0x80 mean "no sensor", not a real temperature.

## DLP panels
If DLP panels operate your floor heating, the heating controller can act as master for both Homey and the panels. See [Heating controller master + DLP slave](GUIDE_HeatingDlpSync.md) for how to keep the panels and Homey in sync.
