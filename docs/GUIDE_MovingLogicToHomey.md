# Moving HDL logic to Homey

## Introduction

The vision for this app is to let Homey replace the HDL Logic Controller for everyday automation. This guide consolidates the recommended patterns for doing that migration safely, based on the setups reported working in the community thread.

There are two main reasons to move automation logic from an HDL Logic Controller to Homey flows:

- **HDL logic does not announce what it does.** When a logic module switches a relay or changes a scene, nothing is broadcast on the bus — Homey only notices the *result* (if the affected device reports it), sometimes not until the next poll. When the logic lives in Homey, Homey knows the intent and the state, and every device stays in sync.
- **Homey flows are easier to work with.** Logic module blocks and OR tables are hard to read, hard to debug and invisible once the Setup Tool is closed. Homey flows are visual, logged, testable, and can use conditions Homey already knows: time of day, presence, weather, and the state of any non-HDL device in your home.

## What to keep on the HDL side

Do not uninstall the logic module or move *everything*. Some jobs belong on the HDL bus:

- **Sensor to UV conversion.** The most reliable motion setup keeps a small logic block that converts sensor states into Universal Switch broadcasts, which Homey picks up instantly. This is described in detail in the [multisensor guide](GUIDE_Multisensor.md) — keep that part.
- **Safety-critical automations.** Anything that must keep working if Homey is offline, under maintenance, or out of power: heating safety limits, emergency lighting, alarm loops.
- **Hard real-time reactions.** Logic that must fire in well under a second and cannot depend on a broadcast or the app's poll interval.

## What moves well to Homey

- **Scenes and modes** (day/night/away). Recreate them as Homey scenes driven by flows. Keep a shared mode state either in a Universal Switch (so HDL panels can read it too) or in a Homey variable.
- **Timers and timeouts.** "Turn the light off X minutes after the last motion" is a built-in Homey feature (zone inactive triggers) and does not need logic blocks at all. See the multisensor documentation for the recommended pattern.
- **Composite conditions.** AND/OR combinations of sensor states, time, presence and weather are straightforward flow conditions in Homey — and much easier to review than logic tables.
- **Anything with notifications.** "Notify me when the garage door has been open for 10 minutes" simply cannot be done on the HDL side.

## Migrating, step by step

1. **Inventory.** Open your project in HDL Setup Tool v2 and back it up first. List every logic block: its inputs, what it switches, and what it is for. This list is your migration plan.
2. **Classify each block**: keep on HDL (see above) or move to Homey.
3. **Make the inputs visible to Homey.** A block can only move if Homey can see what drives it: sensors report directly or through a UV (see the [multisensor guide](GUIDE_Multisensor.md)), dry contacts through the dry contact capability or a UV, panel buttons through a UV.
4. **Build the flow in Homey.** Use the device or UV as the trigger and control relays and dimmers directly from the flow.
5. **Test with the HDL block still enabled.** Watch for double actions — both the logic module and Homey will act. If everything looks right, disable (do not delete) the HDL block and verify the flow still behaves.
6. **Migrate one block at a time.** Live with each change for a few days before moving the next one.

Disabling instead of deleting is your rollback: if a moved automation misbehaves, re-enable the logic block and fix the flow. Keep the HDL Setup Tool backup around regardless.

## Tips

- **Use the UV signal log while migrating.** The app can record every universal switch signal it receives, including the filtered ones, in the app settings (see [Universal Switches](DEVICES_UVSWITCHES.md)). It shows exactly what the bus sends while you rewire logic, which makes it easy to tell a sensor, a logic block and a leftover broadcast apart.
- **Plan your UV numbers.** If you add new UV switches during migration, number them in a planned range and document them, as described in the multisensor guide. Avoid reusing existing numbers and the reserved ranges.
- **Remember the poll interval.** Devices that do not broadcast their state only refresh when the app polls them (default every 60 seconds, configurable down to 10). Flows reacting to such devices inherit that latency — prefer triggers from broadcasts or UV switches where speed matters.
