# Homey Support for HDL SmartBus

Adds support for HDL devices to your Homey. Requires that you have an IP-module, and that its IP-address is at the same network as your Homey.

## Setup

Install the app and go to its settings. Set the IP-address and the subnet (on your bus) you want to use. Add devices by auto-discovery.

### Troubleshooting

If devices are not discovered, no traffic is published on the bus for that device in the ten seconds the auto-discovery is running. Try activating the device by a switch or other means.

## Supported equipment

- Relays
- Dimmers

If you want more equipment to be supported. Create an issue or contribute by creating the code yourself.

### Thanks

This project builds on other peoples work:

[Andrey Ivashchenko: Node.js implementation of HDL SmartBus protocol ](https://github.com/caligo-mentis/smart-bus)

[Arthur Shlain: Icons on the Noun Project](https://thenounproject.com/ArtZ91/)

[Equipment from HDL](http://hdlautomation.com/)
