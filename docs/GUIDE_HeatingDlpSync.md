# Heating Controller Master + DLP Slave Setup

## What this guide covers

If you have **DLP panels** controlling your floor heating, this guide shows
you how to configure the system so that **temperature changes made in Homey
show up on the DLPs, and changes made on a DLP show up in Homey** — without
writing any HDL logic.

Homey cannot talk to the DLP panels directly: the panel integration in this
app is read-only (temperature sensor). The trick is to change the roles on
the HDL bus so the panels and Homey both talk to the same master: the
**heating controller**.

This is the companion guide to [Heating controller setup](GUIDE_HeatingController.md),
which covers the full picture of moving your heating logic to Homey. If you
are setting up a heating controller with Homey from scratch, start there —
this page focuses specifically on the master/slave role switch that makes
DLPs and Homey stay in sync.

## How the roles work

HDL floor heating has two possible masters, and only one of them can own a
zone's thermostat:

| Role | Controls target temperature and mode | Typical setup |
| ---- | ------------------------------------ | ------------- |
| **DLP panel as master** | The panel | The "classic" HDL setup. Homey cannot steer heating, and mode changes made on a DLP are invisible to Homey. |
| **Heating controller as master** | The heating controller channel | The recommended setup with Homey. Both DLPs and Homey read and adjust the same master, so they stay in sync. |

With the heating controller as master:

* Homey sets and reads the heating controller channels directly (the
  [floor heater devices](DEVICES_FLOORHEATERS.md)).
* Each DLP is pointed at a heating controller channel and acts as a
  display/adjustment unit for that channel.
* A change from either side reaches the heating controller, which is the
  single source of truth — so both interfaces update.

## What you get — and what you don't

**You get:** two-way synchronization of target temperature per zone. Turn a
dial on the DLP in the hallway and the zone's target temperature in Homey
follows within seconds; change it in Homey and the DLP reflects it.

**You don't get:** mode control (Normal/Day/Night/Away) from Homey. As part
of this setup, all DLPs are locked to **Normal** mode, and Homey does not
read or set panel modes. If you need modes, build them as target-temperature
profiles in Homey flows (see
[Moving HDL logic to Homey](GUIDE_MovingLogicToHomey.md)) — that is the
standard workaround while panel control remains read-only in this app.

## Before you start

* You need **HDL Setup Tool v2** installed.
* **Back up everything** in Setup Tool before changing anything: heating
  controller, DLP panels, logic controllers — everything you are about to
  touch.
* If an HDL **logic controller** currently operates your heating (day/night
  programs, away modes, UV-driven logic), plan to disable that logic.
  Otherwise it will fight with the new roles and cause confusing behavior.
* Don't do this for the first time in the middle of winter. If it breaks,
  you don't want to be without heating.
* Test with **one zone first**. When it works, repeat for the rest.

## Step 1 – Configure the heating controller as master

1. Open the heating controller in **HDL Setup Tool** and *Refresh* to load
   the latest configuration.
2. For each heating ID (zone):
   * Set **Work Mode** to *Fully Control (Master)*.
   * Set **Temperature Source** to *External* and enter the matching DLP
     address (or an HDL sensor address, if the zone uses a dedicated
     sensor).
   * Enable the channel and select the correct heating type.
   * Set **Current Mode** to *Normal*.
   * **Save before moving to the next ID.** Batch-saving several IDs at once
     is a known source of half-applied configurations.
3. Note the heating controller's subnet/device address and the channel
   number for each zone — the DLPs need them in the next step.

## Step 2 – Point each DLP at its heating controller channel

1. Open a DLP in **HDL Setup Tool** and open the **Floor Heating** tab.
   *Refresh first* so you are editing the latest configuration.
2. Click the **Master** button and enter the heating controller's
   subnet/device address and the channel this DLP should operate. The DLP
   is now a slave of that channel.
3. **Inner sensor:** leave it enabled if the DLP's built-in temperature
   sensor is the temperature source for the zone (it reports ambient
   temperature to the heating controller and to Homey). If the zone uses a
   dedicated HDL sensor, the sensor address belongs in the heating
   controller's temperature source instead.
4. Set the **Mode** to *Normal* and disable Day, Night, Away and Timer.
5. Leave **PID**, **Always-On** and **Sync** alone unless you have a reason
   to change them — if PID is already enabled, it is probably for a good
   reason, and disabling it can cause issues.
6. Save, and double-check that the DLP's master address points to the right
   heating controller and channel.

## Step 3 – Pair the zones in Homey

1. Add the heating controller's zones in Homey via this app (each channel
   becomes its own device, see
   [Floor Heater Controllers](DEVICES_FLOORHEATERS.md)).
2. Give the system a few minutes to sync, then check that every zone is
   visible and reporting a temperature.

## Step 4 – Verify the two-way sync

* Change the target temperature on a DLP and watch the zone in the Homey
  app — it should follow within seconds.
* Change the target temperature in Homey and check the DLP — it should
  reflect the new value.
* Confirm in Setup Tool (*Refresh*) that the heating controller picked up
  changes from both sides.
* All DLPs should show *Normal* mode.

## Gotchas and tips from the field

* **Refresh before you edit.** Setup Tool does not always show the current
  configuration; editing a stale view can silently overwrite newer
  settings.
* **Save per heating ID**, not in batches.
* **DLP temperature readings are not the most reliable** temperature
  source. If a zone barely reacts, a flow in Homey may need to push a
  larger delta to move the controller.
* **Cycle time:** a 5-minute adjustment cycle with medium heat adjustment
  on the controller has proven a good starting point for waterborne
  heating.
* **Watch out for the logic controller.** Any remaining HDL-side heating
  logic (schedules, mode switches, UV-driven control) must be disabled —
  it will otherwise override or fight the master/slave setup.
* **Give it time after changes.** Some changes take a few minutes to
  propagate across the bus and panels.

## Troubleshooting

See the [troubleshooting section](GUIDE_HeatingController.md#troubleshooting)
of the heating controller guide — the failure modes are the same: missing
channels in Homey, temperatures not updating, or unstable behavior traced
to leftover HDL logic.

## Background

This guide documents the setup described by TorbjornM in the
[Homey community forum thread](https://community.homey.app/t/app-pro-hdl-smartbus/26575)
(#308, #332), answering the request in #333. HDL equipment comes in many
flavours with different firmware, so your Setup Tool screens may not match
exactly — treat this as a general walkthrough and verify each setting as
you go.
