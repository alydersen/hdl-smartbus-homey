[Back to the main page](index.md)

# Universal Switches
Universal Switches (UVS) are virtual switches that does not live at a specific device, but rather is kept at bus level. So if two devices needs to share a common understanding of state, a UVS is the way to go. In the App, you can add Universal Switches as a simple ON/OFF device. When a switch is changed by you in the app, the change is sent out as a broadcast. In addition, we do one of two thing, depending on the settings: In the App Settings, you can set the address to a logic controller. If this address is present, a change in a US will be sent to the Logic Controller, if not, the change will be sent to each device on the bus, from 1 to 254.

