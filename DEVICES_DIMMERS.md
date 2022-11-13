[Back to the main page](index.md)

# Dimmers
A dimmer controller have one or more dimmers as channels. Different HDL Models have different number of channels, and you see this in [hdl_devicelist.js](https://github.com/alydersen/hdl-smartbus-homey/blob/v1.0.1/hdl/hdl_devicelist.js) under each type as "channels". You always add each separate channel as a Homey device, and they will as such be shown indivdually in the process of adding them.

Dimmers are a built-in capability in Homey, and as such have very good Homey support.

## Good to know
Homey operates with a dimming level of 0-100, whereas HDL operates with 0 to 1. This means that HDLs state of a dimmer channel of 0.4 will be equall to Homeys 40 (this is handles by the app). Dimmers in Homey can also receive simple on/off, and the app fixes this by calling the off state when dim level is 0 and on when everything above.