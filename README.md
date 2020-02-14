# Homey Support for HDL SmartBus

Adds support for HDL devices to your Homey. Requires that you have an IP-module, and that its IP-address is at the same network as your Homey.

## Setup

Install the app and go to its settings. Set the IP-address and the subnet (on your bus) you want to use. Add devices.

### Troubleshooting

If devices are not discovered, no traffic is published on the bus for that device since the app was started, or is is not supported. Try activating the device by a switch or other means.

## Supported equipment

- Relays
- Dimmers
- Multisensors (x-in-1 etc.)
- Temperature sensors

If you want more equipment to be supported. Create an issue or contribute by creating the code yourself.

### About multisensors

As the multisensors from HDL does not publish any motion status on its own, you have to create this yourself.
You do this by adding a piece of logic to the sensor. When motion is detected, you let a universal switch number be `true` and then `false` when you want to turn the motion status to off. The default universal switch number is 212, but you can change this in the apps settings. Do this on every sensor, and then this app will see who the sender of the switch is and then activate/deactivate that sensor.

### Thanks

This project builds on other peoples work:

[Andrey Ivashchenko: Node.js implementation of HDL SmartBus protocol ](https://github.com/caligo-mentis/smart-bus)

[Arthur Shlain: Icons on the Noun Project](https://thenounproject.com/ArtZ91/)

[Equipment from HDL](http://hdlautomation.com/)
