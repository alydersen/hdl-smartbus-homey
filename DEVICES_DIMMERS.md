[Back to the main page](index.md)

# Dimmers
A dimmer controller have one or more dimmers as channels. Different HDL Models have different number of channels, and you see this in [hdl_devicelist.js](https://github.com/alydersen/hdl-smartbus-homey/blob/master/hdl/hdl_devicelist.js) under each type as "channels". You always add each separate channel as a Homey device, and they will as such be shown indivdually in the process of adding them.

Dimmers are a built-in capability in Homey, and as such have very good Homey support.

# Dimming with a duration
The dimmers supports going from the current dimming level to a new level over a time span when defined in a flow. This means that you can e.g. dim up your lights in the bedroom from off to 100% in intervals over 60 seconds. Notice that it always will be divided into 10 chunks. So in the bedroom example above, that would mean that it would increment with 10% every 6 seconds. You can also dim down over a period of time, but as flow generally will not care what the level is before it starts, you can only be sure that it will end up at what dimming level you set in the flow. These kind of calls are asyncronous, meaning that it will allow the app to act normally and update other devices while this is going on.

## Good to know
Homey operates with a dimming level of 0-100, whereas HDL operates with 0 to 1. This means that HDLs state of a dimmer channel of 0.4 will be equall to Homeys 40 (this is handled by the app). Dimmers in Homey can also receive simple ON/OFF, and the app fixes this by calling the "OFF" state when dim level is 0 and "ON" when everything above.