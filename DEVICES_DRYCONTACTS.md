[Back to the main page](index.md)

# Dry Contact Input Modules
The HDL-MSDxx.40 family (HDL-MSD04.40, HDL-MSD08.40, HDL-MSD04T.40, HDL-MSD06.40, etc.) provide dry contact inputs that now appear in Homey as dedicated **Dry Contact** devices.

## Capabilities
- dry_contact_1 - dry_contact_8 (added on demand as signals are received)
- measure_temperature (added automatically for the T/A variants with an onboard sensor)

Each capability is created the first time Homey receives a status update for that channel. Inputs that never report a change stay hidden.

## Flow cards
The driver exposes flow triggers for every contact (activated/deactivated). Combine these with the standard boolean capability cards if you prefer the built-in capability triggers.

## Pairing tips
- Ensure the HDL SmartBus app is configured and connected to the bus before pairing.
- During pairing, the app lists all discovered dry contact modules using their HDL subnet/device address.
- After pairing, toggle each physical input once so Homey can discover and add the corresponding capability.

## Temperature handling
For HDL-MSD04T/06.40 (and other variants with a temperature probe) the driver automatically adds `measure_temperature` when valid readings are received. The value is filtered through the same sanity checks as the multisensor driver.

## Recommended configuration
- Configure each channel in HDL Buspro Setup Tool with the correct switch type (NO/NC) and enable the vandal-proof resistor if required (1 kOhm in parallel).
- If you need faster Homey updates than the periodic poll, configure the module to broadcast dry contact status changes. The driver will also request periodic updates every 60 seconds through the SmartBus polling loop.





