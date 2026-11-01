[Back to the main page](index.md)

# Universal Switches
Universal Switches (UVS) are virtual switches that does not live at a specific device, but rather is kept at bus level. So if two devices needs to share a common understanding of state, a UVS is the way to go. In the App, you can add Universal Switches as a simple ON/OFF device.

## Setting the state based on signals on the bus
The App will listen to signals containing Universal Switch changes. These can be come as separate messages, or together with other messages from a specific device. When any signal is received, the App will check to see if it contains Universal Switch changes and update a Homey Device accordingly if it exists.

## Setting the state from Homey
When a switch is changed by you in the App, the change is always sent out as a broadcast. What the App sends in addition to the broadcast is controlled by the **Send mode** setting:

- **Legacy** (default, the behavior of earlier app versions): if a logic controller ID is set in the App Settings, the change is also sent to that controller. If no logic controller is set, the change is sent individually to every address on the subnet, 1 to 254.
- **Broadcast + logic controller**: the change is only sent to the logic controller in addition to the broadcast.
- **Broadcast only**: nothing is sent in addition to the broadcast. This puts far less traffic on the HDL bus, and most installations work fine with it.

The legacy mode sends a lot of messages (255 packets per switch change, plus answerbacks from the modules on the bus). If you experience delayed or odd behavior on a large bus, try "Broadcast only" first.

## Troubleshooting: switches that change on their own
If Universal Switches appear to flip without anyone touching them, enable **Log universal switch signals** in the App Settings. The App then records the last 100 universal switch signals it received, including the signals it normally filters out (the motion sensor switch and its own messages), with the sender address, the switch number and what the App did with it. Enable it, wait for the switch to "misbehave", and open the App Settings to see what was actually on the bus. Keep it off when you do not need it.


