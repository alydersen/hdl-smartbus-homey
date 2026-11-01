[Back to the main page](index.md)

# DLP Panels
Even though the panels have a lot of functionality, they are only available as temperature sensors in this app. This is because of the complex nature of the DLPs and bridging this with Homey. As temperature sensors, they match a built-in capability in Homey, and as such have very good Homey support.

## How signals are received
First of all, temperature sensors are one-way only, meanings readings come from the HDL side and are set in Homey. You can not send anything back to the panel. The sensors are sending out updates with semi-regular intervals, and usually when changes in temperature occurs. I would generally not recommend trusting readings to be very fast, if you need logic that responds quickly to changes in temperature.

## Temperature scope
The app will disregard any readings that are below -40 or above 70 degrees celsius.