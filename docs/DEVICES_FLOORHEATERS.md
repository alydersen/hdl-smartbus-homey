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
