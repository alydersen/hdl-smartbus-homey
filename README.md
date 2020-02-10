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

Currently, only motion and temperature readings are collected from the multisensors. For motion, the sensor needs to have logic set up to activate another device. I'm currently working on getting this to function differently.

### Thanks

This project builds on other peoples work:

[Andrey Ivashchenko: Node.js implementation of HDL SmartBus protocol ](https://github.com/caligo-mentis/smart-bus)

[Arthur Shlain: Icons on the Noun Project](https://thenounproject.com/ArtZ91/)

[Equipment from HDL](http://hdlautomation.com/)
