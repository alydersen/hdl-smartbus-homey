[Back to the main page](index.md)

# Temperature Sensors
A temperature sensor controller have one or more temperature sensors as channels. Different HDL Models have different number of channels, and you see this in [hdl_devicelist.js](https://github.com/alydersen/hdl-smartbus-homey/blob/master/hdl/hdl_devicelist.js) under each type as "channels". You always add each separate channel as a Homey device, and they will as such be shown indivdually in the process of adding them.

Temperature sensors are a built-in capability in Homey, and as such have very good Homey support.

## How signals are received
First of all, temperature sensors are one-way only, meanings readings come from the HDL side and are set in Homey. You can not send anything back to the sensor. The sensors are sending out updates with semi-regular intervals, and usually when changes in temperature occurs. I would generally not recommend trusting readings to be very fast, if you need logic that responds quickly to changes in temperature.

## Noisy sensors
Temperature sensors that are mot properly set up can be very noisy on the bus, meaning that they will send out a lot of updates. If you have a four-channel sensor with some channels not being connected to a physical temperature probe, remember to disable the channel in your HDL configuration. This also makes sense because the readings will be way off if there is nothing connected.

## Temperature scope
The app will disregard any readings that are below -40 or above 70 degrees celsius.