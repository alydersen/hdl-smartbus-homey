[Back to the main page](index.md)

# DLP Heater

Use DLP Heater when a supported DLP panel runs the floor heating thermostat. Homey shows the measured room temperature, the active setpoint and the current mode. You can change the setpoint, select a mode and turn heating on or off from Homey. Changes made on the panel are reflected in Homey when the app receives the updated status.

If you only need the temperature reading or want to run a panel button from a Flow, see [DLP Panels](DEVICES_PANELS.md). If a separate heating controller runs the heating, see [Heating controller master + DLP slave](GUIDE_HeatingDlpSync.md).

## Setting up the panel

Enable **Normal**, **Day**, **Night** and **Away** under **Floor heating → Mode** in HDL Buspro Setup. Homey offers these four choices and the panel can reject a mode that is disabled in its setup.

Add **DLP Heater** in Homey and select your panel. Check that the room temperature, mode and setpoint match what the panel shows.

## Modes and setpoints

Each mode has its own saved setpoint. The temperature control in Homey adjusts the setpoint for the active mode. For example, if Night is active, changing the setpoint changes the Night temperature.

Use whole degrees Celsius. Homey offers 5–26 °C. Stay within the range configured on the panel if it is narrower.

You can turn heating on or off in Normal, Day, Night and Away. If Timer is enabled and selected on the panel, Homey shows it in the mode status. Set up and start Timer on the panel. To leave Timer from Homey, select one of the four other modes before adjusting the active setpoint or switching heating on or off.

## Using DLP Heater in Flows

- **Set thermostat mode** selects Normal, Day, Night or Away. For example, select Away when nobody is home.
- **Set active setpoint** changes the temperature for the mode currently in use.
- **Set setpoint for mode** changes a saved temperature and leaves the current mode selected. For example, change the Night setpoint while Day is active.
- **Thermostat mode changed to** starts a Flow when Homey sees the panel enter the selected mode. You can also use Timer here if it is selected on the panel.
- **Read DLP status again** refreshes the status shown in Homey.

## Pressing a panel button from Homey

Add **Press Heater panel button** as a **Then** card, select your DLP Heater and choose the button number. This runs the existing function for that button on the physical panel. See [DLP Panels](DEVICES_PANELS.md#pressing-a-panel-button-from-homey) for button numbering and how to check that the configured function ran. To start a Flow from a physical button, use a [Universal Switch](DEVICES_UVSWITCHES.md).
