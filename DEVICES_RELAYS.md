[Back to the main page](index.md)

# Relays
A relay controller have one or more on/off capable channels. Different HDL Models have different number of channels, and you see this in [hdl_devicelist.js](https://github.com/alydersen/hdl-smartbus-homey/blob/master/hdl/hdl_devicelist.js) under each type as "channels". You always add each separate channel as a Homey device, and they will as such be shown indivdually in the process of adding them.

ON/OFF switches are a built-in capability in Homey, and as such have very good Homey support.

## Energy
HDL relay channels do not measure power consumption, but the app declares an approximated power usage in the driver. This gives every relay channel a "Power usage when on/off" setting in the Homey app (in the device's power settings). Fill in the Watt value of the load that the relay switches, and Homey will calculate its energy consumption based on the on-time. Approximated devices count towards the total consumption in Homey Energy, but are not included in the "Top Consumers" list (which only shows devices that measure their own usage).
