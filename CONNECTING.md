[Back to the main page](INDEX.md)

# Connecting Homey to HDL (initial setup)
HDL is a bus where the different equipment have an address and then sends out signals to all (broadcast) or individual addresses. All signals are sent to all on the bus, so the only difference is if a receiver is defined by device address. The address is built up of two things: A subnet and an ID.

## Things you need to know

### The subnet
The subnet you should be familiar with from configuring HDL, and the app only supports one subnet. You'll need to know it for the configuration of the App.

### The ID
You are going to need an address that is available on your HDL subnet for assigning to the App. This makes it possible for it to be recognized on the bus. You'll need to know it for the configuration of the App.

### The IP-address of your IP-gateway
In order for the Homey app to be able to connect to your HDL bus, you need an IP-gateway from HDL. You are also going to need to know the IP-address of this gateway and to make sure that the Homey and the gateway have addresses in the same IP subnet. The IP-gateway broadcasts all signals from the HDL bus to the network, and broadcasts are not possible to route, so you can not communicate with an IP-gateway over the Internet.

## Setting up the App
First of all; install the App from the App Store. The App has a configuration/settings page that you can reach in your Homey App. You need to input the values described above in the settings and save. Then you need to restart the App or Homey. After the App has restarted, it will broadcast a signal on the bus asking all devices to make themselves know. This can take a couple of minutes and you can not add devices you haven't received a signal from.

## Troubleshooting
If you cant find any devices or you meet any other issue:
1. Make sure that your Homey and your HDL IP Gateway are on the same network. Trafic from HDL is not routable, meaning you can't have e.g. your Homey running at home connecting to your HDL at the cabin. They should have IP-addresses in the same range and on the same subnet.
2. Double check that you have set the correct settings for your App and restarted the App/Homey.
3. Check that your devices are supported
4. Make sure that you have waited some minutes
5. Try to access the devices from you HDL Software. If you can reach it, you should have created enough trafic on the bus for the App to have seen it.
6. If you still can't find them. Create an [Issue in Github](CONTRIBUTING.md) or ask in the [Homey Forum Thread](https://community.homey.app/t/app-pro-hdl-smartbus/26575)