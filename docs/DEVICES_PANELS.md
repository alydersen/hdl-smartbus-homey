[Back to the main page](index.md)

# DLP Panels

Add a DLP Panel to see its measured temperature in Homey and use that reading in Flows. If you want to control the panel's built-in floor heating thermostat, see [DLP Heater](DEVICES_DLPHEATER_HANOY.md).

## How signals are received

Temperature readings come from the panel. The panel sends updates at intervals and usually when the temperature changes. Allow for a delay if you use these readings in a Flow.

Panel-only devices use the panel temperature request. Heater status reads supply the temperature when the same panel is also paired as a DLP Heater.

## Pressing a panel button from Homey

Add **Press DLP button** as a **Then** card in your Flow, select the panel and choose the button number. The panel runs the function configured for that button in HDL Buspro Setup. For example, you can use a Homey Flow to run a lighting scene you already use from the wall panel.

Button numbers follow the panel's setup. On an eight-button DLP, page 4 uses buttons 25–32. Support varies by panel model, so try the button on your panel before relying on it in a Flow. The panel's reply confirms receipt of the command. Check the lights or other equipment separately to see whether the configured function ran.

## Starting a Flow from a physical button

Configure the button to send a [Universal Switch](DEVICES_UVSWITCHES.md) and add the corresponding switch in Homey. Use the switch turning on or off as the **When** card. You can also see the switch state in Homey.

## Two-way heating sync with Homey

If a separate floor heating controller is the master, see [Heating controller master + DLP slave](GUIDE_HeatingDlpSync.md) for how to keep it in sync with the panel and Homey.
