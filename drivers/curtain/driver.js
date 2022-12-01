"use strict";

const Homey = require("homey");
const HdlDevicelist = require("./../../hdl/hdl_devicelist");
const HdlCommands = require("smart-bus/lib/commands");

class CurtainDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.log("HDL CurtainDriver has been initiated");

    // Fix of 0xE3E3 response (its probably response of 0xE800 request also - instead of 0xE801)
    HdlCommands[0xE3E3] = {
      parse: function(buffer) {
        let duration = buffer.readUInt16BE(2) / 10;
        return {
          curtain: buffer.readUInt8(0),
          status: buffer.readUInt8(1),
          duration: duration
        };
      },
      
      encode: function(data) {
        let duration = data.duration * 10;
        return new Buffer([data.curtain, data.status, (duration >> 8) & 0xFF, duration & 0xFF]);
      }      
    };

    // Added request to get duration value
    HdlCommands[0xE800] = {
      parse: function(buffer) {
        return { 
          channel: buffer.readUInt8(0),
        }
      },

      encode: function(data) {
        return new Buffer([data.channel]);
      }
    };

    // Added response of get duration value
    HdlCommands[0xE801] = {
      parse: function(buffer) {
        return { 
          channel: buffer.readUInt8(0),
          duration: buffer.readUInt16BE(2)
        }
      },

      encode: function(data) {
        return new Buffer([data.channel]);
      }
    };
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
              if (signal.data.curtains[index].status == 0)
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
                if (signal.data.duration != null) // in some cases duration is not in response
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
        var channel;
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