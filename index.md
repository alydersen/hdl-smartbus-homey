This project is an app for [Homey](https://homey.app/) that allows it to communicate with [Equipment from HDL](http://hdlautomation.com/). It is free and open source and built by people on their spare time. The vision for the project is to replace the need for using the HDL Logic Controll with Homey, opening up your HDL devices to the home automation world. **You need an IP Gateway on your HDL bus in order to use this app**

## Contributing
There are three ways of making this project move forward:
1. Help us code in accordance with the [Homey Code of Conduct](CODE_OF_CONDUCT.md) and following the [Contribution guidelines](CONTRIBUTING.md).
2. Test [new versions](https://homey.app/no-no/app/com.github.alydersen.hdl-smartbus-homey/HDL-SmartBus/test/) and give feedback in the [Homey Forum Thread](https://community.homey.app/t/app-pro-hdl-smartbus/26575) following the [Homey Code of Conduct](CODE_OF_CONDUCT.md) or as [Issue in Github](CONTRIBUTING.md)
3. Donate money on by following the donation button on the [App page](https://homey.app/no-no/app/com.github.alydersen.hdl-smartbus-homey/HDL-SmartBus/)

## Getting started
After you have installed the App on your Homey, you need to set a couple of settings in the app so that it can find your HDL gateway. The process is explained here: [Connecting the App to HDL](CONNECTING.md).

After the settings are made and the App or Homey is restarted, give it a couple of minutes to collect signals from the HDL Bus. This will allow you to start adding devices.

You can find trubleshooting tips in the connection howto linke above.

## Devices
If you are a developer and want to add a new driver for the app, read the [Contribution guidelines](CONTRIBUTING.md).

### How devices are recognized
The App will listen to signes on the bus. For each signal, it will look into the sender type id and check that against a list of supported devices. A list of devices known by the documentation can be found [this Excel file](https://github.com/alydersen/hdl-smartbus-homey/blob/v1.0.1/assets/defDeviceType.xlsx) and the type IDs is then used in [hdl_devicelist.js](https://github.com/alydersen/hdl-smartbus-homey/blob/v1.0.1/hdl/hdl_devicelist.js) to make it known as a specific driver. Sometimes more device types can simply be added to hdl_devicelist.js to be known. If you suspect this to be the case, raise an [Issue in Github](CONTRIBUTING.md). Universal Switches are different, so read up on them below.

### How the device state is set
Devices broadcasts their state on the bus and the Homey App reads them and updates the state on your Homey device if it is added. Sometimes, state is not published as it is happening (for various reasons). The app will reach out to every device every minute with a signal on the bus to make it publish its state. This means that sometimes, you'll have to wait a minute before you have an updated state.

### Supported devices and best practice for them:
- [Relays](DEVICES_RELAYS.md)
- [Dimmers](DEVICES_DIMMERS.md)
- [Temperature Sensors](DEVICES_TEMPSENSORS.md)
- [Universal Switches](DEVICES_UVSWITCHES.md)
- [Multisensors](DEVICES_MULTISENSORS.md)
- [Curtain Controllers](DEVICES_CURTAINS.md)
- [Floor Heater Controllers](DEVICES_FLOORHEATERS.md)