"use strict";

const Homey = require("homey");
const HdlDevicelist = require("./../../hdl/hdl_devicelist");

class CurtainDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log("HDL CurtainDriver has been initiated");
    // Commands 0xE3E3, 0xE800, 0xE801 now provided by smart-bus 0.9.0+
  }

  getDeviceFromSignal(signal, channel) {
    let hdl_subnet = this.homey.settings.get("hdl_subnet");

    let deviceSignature = {
      id: `${hdl_subnet}.${signal.sender.id}.${signal.data.channel || channel}`,
      address: `${hdl_subnet}.${signal.sender.id}`,
      channel: signal.data.channel || channel
    };

    return this.getDevice(deviceSignature);    
  }

  async updateValues(signal) {
      if (signal.parse)
        signal.data = signal.parse(signal.payload);
        
      if (signal.data) {
        if (signal.code == 0xE3E4) {
          // This signal contains all channels, we need to process it for every device
          signal.data.curtains.forEach((crtn, index) => {
            let device = this.getDeviceFromSignal(signal, crtn.number);
            if (typeof device !== 'undefined') {
              if (device instanceof Error) return;

              // Update status only to idle (when autostop is used)
              if (signal.data.curtains[index].status === 0)
                device.updateStatus(signal.data.curtains[index].status);
            }
          });

        } else {
          let device = this.getDeviceFromSignal(signal, signal.data.curtain);
          if (typeof device !== 'undefined') {
            if (device instanceof Error) return;
            
            switch (signal.code) {
              case 0xE3E1:
                device.updateStatus(signal.data.status);
                break;

              case 0xE3E3:
                device.updateStatus(signal.data.status);
                if (signal.data.duration !== null) // in some cases duration is not in response
                  device.updateDuration(signal.data.duration);
                break;

              case 0xE801:
                device.updateDuration(signal.data.duration);
                break;
            }
          }
        }
      }
  }

  async onPairListDevices() {
    let devices = [];
    let hdl_subnet = this.homey.settings.get("hdl_subnet");

    // Check that the bus is connected
    if (!this.homey.app.isBusConnected()) {
      return new Error("Please configure the app settings first.");
    } else {
      this.homey.app.log("onPairListDevices from Curtain");
      for (const device of Object.values(this.homey.app.getDevicesOfType("curtain"))) {
        let devicelist = new HdlDevicelist()
        let channel;
        for (
          channel = 1;
          channel < await devicelist.numberOfChannels(device.type.toString()) + 1;
          channel++
        ) {
          devices.push({
            name: `HDL Curtain (${hdl_subnet}.${device.id} ch ${channel})`,
            data: {
              id: `${hdl_subnet}.${device.id}.${channel}`,
              address: `${hdl_subnet}.${device.id}`,
              channel: channel
            }
          });
        }
      }
      return devices.sort(CurtainDriver._compareHomeyDevice);
    }
  }

  static _compareHomeyDevice(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
}

module.exports = CurtainDriver;