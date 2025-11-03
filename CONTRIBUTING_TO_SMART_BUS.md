# Contributing HDL Commands to smart-bus Package

This document lists HDL commands that are custom-implemented in this Homey app due to lack of support in the [smart-bus](https://github.com/caligo-mentis/smart-bus) package. These commands should ideally be contributed back to smart-bus so the app can use the standard implementations.

## Overview

The HDL SmartBus Homey app extends the `smart-bus` package by:
1. **Adding new commands** not yet supported
2. **Fixing buggy command implementations** with corrections
3. **Adding missing response parsers** for commands that existed but lacked full support

## Table of Contents

- [Custom Command Implementations](#custom-command-implementations)
  - [Curtain Controller Commands](#curtain-controller-commands)
  - [Dry Contact Commands](#dry-contact-commands)
  - [Floor Heater Commands](#floor-heater-commands)
  - [Temperature & Sensor Commands](#temperature--sensor-commands)
  - [Multisensor Commands](#multisensor-commands)
  - [Universal Switch Commands](#universal-switch-commands)
  - [Discovery Commands](#discovery-commands)
  - [Dimmer/Relay Commands](#dimmerrelay-commands)
- [How to Contribute to smart-bus](#how-to-contribute-to-smart-bus)
- [Priority Commands](#priority-commands)
- [Summary Table](#summary-table)

## Custom Command Implementations

### Curtain Controller Commands

#### 0xE3E3 - Curtain Status with Duration (Fixed)
**Location**: `drivers/curtain/driver.js:12-26`  
**Status**: Fix for existing command

**Problem**: The command in smart-bus was incorrect or incomplete.

**Implementation**:
```javascript
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
    return Buffer.from([data.curtain, data.status, (duration >> 8) & 0xFF, duration & 0xFF]);
  }      
};
```

**Description**: Returns curtain status along with duration in deciseconds (0.1 second units). Used by curtain devices to report position and movement duration.

**Usage**: 
- Sent by curtain controller when status changes
- Duration represents total time for fully opening/closing

---

#### 0xE800 - Get Curtain Duration Request (New)
**Location**: `drivers/curtain/driver.js:29-39`  
**Status**: New command not in smart-bus

**Implementation**:
```javascript
HdlCommands[0xE800] = {
  parse: function(buffer) {
    return { 
      channel: buffer.readUInt8(0),
    }
  },
  encode: function(data) {
    return Buffer.from([data.channel]);
  }
};
```

**Description**: Request to get the duration setting for a specific curtain channel.

**Buffer Format**:
```
[0] = Channel number
```

**Usage**: Sent from Homey to curtain controller to query the configured open/close duration.

---

#### 0xE801 - Get Curtain Duration Response (New)
**Location**: `drivers/curtain/driver.js:42-53`  
**Status**: New command not in smart-bus

**Implementation**:
```javascript
HdlCommands[0xE801] = {
  parse: function(buffer) {
    return { 
      channel: buffer.readUInt8(0),
      duration: buffer.readUInt16BE(2)
    }
  },
  encode: function(data) {
    return Buffer.from([data.channel]);
  }
};
```

**Description**: Response from curtain controller containing the duration configuration.

**Buffer Format**:
```
[0]   = Channel number
[1]   = Reserved (0x00)
[2-3] = Duration in deciseconds (Big Endian)
```

**Usage**: Response to 0xE800 request, providing the configured duration in centiseconds (0.01 second units).

**Note**: The encode function doesn't seem to be used in practice - curtain devices send this as a response, Homey only receives it.

---

#### 0xE3E0 - Set Curtain State (Used but may need review)
**Location**: `drivers/curtain/device.js:220-223, 241-244`  
**Status**: Used in app, likely supported in smart-bus

**Description**: Set curtain to UP (1), DOWN (2), or IDLE/STOP (0).

**Data Format**:
```javascript
{
  curtain: <channel>,
  status: <0|1|2>
}
```

**Usage**: Send control commands to curtain controller.

---

#### 0xE3E1 - Curtain Status Update (Used)
**Location**: `drivers/curtain/driver.js:92-94`  
**Status**: Used in app, likely supported in smart-bus

**Description**: Single-channel curtain status notification.

---

#### 0xE3E2 - Multi-Channel Curtain Status (Used)
**Location**: `drivers/curtain/device.js:183`  
**Status**: Used in app, likely supported in smart-bus

**Description**: Request status for all curtain channels on a device.

---

#### 0xE3E4 - Multi-Channel Curtain Status Response (Used)
**Location**: `drivers/curtain/driver.js:73-84`  
**Status**: Used in app, may need parsing support

**Description**: Response containing status for all curtain channels.

**Format**: Contains array of curtain statuses, each with `number` and `status` fields.

---

### Dry Contact Commands

These commands handle dry contact input sensors with advanced parsing logic:

#### 0x0031 - Dry Contact Status (Partial)
**Location**: `drivers/dry-contact/driver.js:106-110`  
**Status**: Custom parsing for dry contact variant

**Description**: Standard relay/dimmer status command, but dry-contact driver uses custom parsing for channel mask.

**Custom Implementation**:
```javascript
if (commandCode === 0x0031 && payload && payload.length >= 5) {
  const level = payload.readUInt8(1);
  const channelMask = payload.readUInt8(payload.length - 1);
  // Apply mask to update multiple channels
}
```

**Buffer Format**:
```
[0]     = Command
[1]     = Level
[...]   = Data
[n-1]   = Channel mask (bitfield)
```

---

#### 0x6F00 - Dry Contact Multi-Channel Status (New)
**Location**: `drivers/dry-contact/driver.js:123-137`  
**Status**: New command not in smart-bus

**Implementation**:
```javascript
if (commandCode === 0x6f00 && payload && payload.length >= 8) {
  const declaredChannels = payload[3];
  const channelTotal = Math.min(declaredChannels || maxChannels, maxChannels);
  const statusMask = payload.readUInt16BE(4);
  // Parse 16-bit mask for up to 16 channels
}
```

**Buffer Format**:
```
[0-1]   = Command (0x6F00)
[2]     = Subnet?
[3]     = Number of declared channels
[4-5]   = Status mask (16-bit, Big Endian)
[6-7]   = Additional data
```

**Description**: Report status for multiple dry contact channels using a 16-bit bitfield where each bit represents one channel state.

---

#### 0xE3D9 - Dry Contact Acknowledge (New)
**Location**: `drivers/dry-contact/driver.js:139-160`  
**Status**: New command not in smart-bus

**Implementation**:
```javascript
if (commandCode === 0xe3d9 && payload && payload.length >= 3) {
  // Two parsing modes:
  // 1. Sentinel mode: Look for 0x11 marker, followed by channel and status
  // 2. Standard mode: Direct channel mask and status
}
```

**Buffer Format (Sentinel Mode)**:
```
[...]   = Preamble data
[?]     = 0x11 (sentinel marker)
[?+1]   = Channel index
[?+2]   = Status (boolean as byte)
```

**Buffer Format (Standard Mode)**:
```
[0]     = Command
[1]     = Channel mask
[2]     = Status
[...]   = Additional data
```

**Description**: Acknowledge message for dry contact changes, supporting two parsing modes for different device firmware versions.

---

### Floor Heater Commands

#### 0x1C5D / 0x1C5F - Floor Heater Status (Used)
**Location**: `drivers/floorheater/driver.js:30-38`  
**Status**: Used in app, likely supported in smart-bus

**Description**: Read floor heating controller status including temperature settings, valve positions, and power status.

**Data Structure**:
```javascript
{
  channel: <channel>,
  temperature: {
    normal: <target_temperature>
  },
  watering: {
    status: <valve_open_boolean>
  },
  work: {
    status: <power_on_boolean>
  }
}
```

---

#### 0x1C5C - Set Floor Heater (Used)
**Location**: `drivers/floorheater/device.js:71, 84`  
**Status**: Used in app, likely supported in smart-bus

**Description**: Set floor heater configuration (temperature, valve, power).

**Data Structure**: Same as status response above.

---

#### 0x1C5E - Read Floor Heater (Used)
**Location**: `drivers/floorheater/device.js:52`  
**Status**: Used in app, likely supported in smart-bus

**Description**: Request to read floor heater status.

---

### Temperature & Sensor Commands

#### 0xE3E7 - Read Temperature (Used)
**Location**: `drivers/tempsensor/device.js:11, drivers/panel/device.js:12, drivers/floorheater/device.js:53`  
**Status**: Used in app, likely supported in smart-bus

**Description**: Request temperature reading from sensor.

---

#### 0x1948 - Temperature Response (Used)
**Location**: `drivers/tempsensor/device.js:11, drivers/panel/device.js:12`  
**Status**: Used in app, likely supported in smart-bus

**Description**: Temperature reading response.

---

#### 0x1944 - Additional Panel Data (Used)
**Location**: `drivers/panel/device.js:12`  
**Status**: Used in app, likely supported in smart-bus

**Description**: Request additional panel data.

---

#### 0xE3E8 - Temperature Reading (Used)
**Location**: `drivers/floorheater/driver.js:41-45`  
**Status**: Used in app, likely supported in smart-bus

**Description**: Temperature reading for floor heater sensors.

---

### Multisensor Commands

#### 0xDB00, 0x1645, 0x1604 - Multisensor Status (Used)
**Location**: `drivers/multisensor/device.js:11, drivers/dry-contact/device.js:21`  
**Status**: Used in app, likely supported in smart-bus

**Description**: Request sensor status including motion, temperature, humidity, and luminance.

**Note**: These commands are reused by both multisensors and dry contact modules.

---

### Universal Switch Commands

#### 0xE018 - Universal Switch Status Request (Used)
**Location**: `drivers/universal-switch/device.js:36`  
**Status**: Used in app, likely supported in smart-bus

**Description**: Broadcast request to get status of a universal switch.

---

#### 0xE01C - Set Universal Switch (Used)
**Location**: `drivers/universal-switch/device.js:55`  
**Status**: Used in app, likely supported in smart-bus

**Description**: Set universal switch state.

---

#### 0xE01D - Universal Switch Status Response (Used)
**Location**: `drivers/universal-switch/device.js:21`  
**Status**: Used in app, likely supported in smart-bus

**Description**: Respond to status request.

---

### Discovery Commands

#### 0x000E - Device Discovery (Used)
**Location**: `app.js:111`  
**Status**: Used in app, likely supported in smart-bus

**Description**: Broadcast discovery ping to find all devices on the bus.

---

### Dimmer/Relay Commands

#### 0x0031 - Set Channel Level (Used)
**Location**: `drivers/dimmer/device.js:51, drivers/relay/device.js:40`  
**Status**: Standard command supported in smart-bus

**Description**: Set level for a specific channel.

---

#### 0x0033 - Read Channel Status (Used)
**Location**: `drivers/dimmer/device.js:38, drivers/relay/device.js:27`  
**Status**: Standard command supported in smart-bus

**Description**: Request status for channels.

---

## How to Contribute to smart-bus

### Step 1: Review Existing Implementation

Check if the command already exists in smart-bus:
1. Visit [smart-bus GitHub repository](https://github.com/caligo-mentis/smart-bus)
2. Review `lib/commands.js` or similar command definitions
3. Look for existing documentation

### Step 2: Verify Buffer Format

For each command, verify the buffer format using:
- Official HDL documentation
- Network packet captures
- Device behavior observations

Important fields to document:
- Buffer length
- Byte positions and meanings
- Endianness (Big Endian / Little Endian)
- Numeric scaling factors
- Reserved/unused bytes

### Step 3: Create Test Cases

Develop test cases that cover:
- Normal operation
- Edge cases (boundary values)
- Multi-channel scenarios
- Error conditions

### Step 4: Submit Pull Request

1. Fork the [smart-bus repository](https://github.com/caligo-mentis/smart-bus)
2. Create a feature branch
3. Add the command implementation
4. Include:
   - Command definition
   - Parser function
   - Encoder function (if needed)
   - Documentation comments
   - Test cases
5. Submit pull request with clear description

### Step 5: Update This App

Once merged into smart-bus:
1. Remove custom implementation from this app
2. Update to use smart-bus version
3. Test thoroughly
4. Remove this file section

---

## Priority Commands

Commands that most urgently need smart-bus support:

1. **0xE800** - Get Curtain Duration Request (New)
2. **0xE801** - Get Curtain Duration Response (New)
3. **0xE3E3** - Curtain Status with Duration (Fix)
4. **0x6F00** - Dry Contact Multi-Channel Status (New)
5. **0xE3D9** - Dry Contact Acknowledge (New)

These are the commands that truly don't have smart-bus equivalents and require custom parsing.

---

## Summary Table

| Command | Status | Type | Description |
|---------|--------|------|-------------|
| **0xE800** | ❌ NEW | Curtain | Get duration request |
| **0xE801** | ❌ NEW | Curtain | Get duration response |
| **0xE3E3** | ⚠️ FIX | Curtain | Status with duration (fixed parser) |
| **0x6F00** | ❌ NEW | Dry Contact | Multi-channel status mask |
| **0xE3D9** | ❌ NEW | Dry Contact | Acknowledge with dual parsing |
| **0x0031** | ⚠️ CUSTOM | Dry Contact | Custom mask parsing variant |
| 0xE3E0 | ✅ Used | Curtain | Set curtain state |
| 0xE3E1 | ✅ Used | Curtain | Single channel status |
| 0xE3E2 | ✅ Used | Curtain | Multi-channel status request |
| 0xE3E4 | ✅ Used | Curtain | Multi-channel status response |
| 0x1C5C | ✅ Used | Floor Heater | Set heater config |
| 0x1C5D | ✅ Used | Floor Heater | Read heater status |
| 0x1C5E | ✅ Used | Floor Heater | Read heater request |
| 0x1C5F | ✅ Used | Floor Heater | Read heater status variant |
| 0xE3E7 | ✅ Used | Sensors | Read temperature request |
| 0xE3E8 | ✅ Used | Floor Heater | Temperature reading |
| 0x1948 | ✅ Used | Sensors | Temperature response |
| 0x1944 | ✅ Used | Panel | Additional panel data |
| 0xDB00 | ✅ Used | Multisensor | Sensor status request |
| 0x1645 | ✅ Used | Multisensor | Sensor status request |
| 0x1604 | ✅ Used | Multisensor | Sensor status request |
| 0xE018 | ✅ Used | Universal Switch | Status request broadcast |
| 0xE01C | ✅ Used | Universal Switch | Set switch state |
| 0xE01D | ✅ Used | Universal Switch | Status response |
| 0x0033 | ✅ Used | Dimmer/Relay | Read channel status |
| 0x000E | ✅ Used | Discovery | Device discovery broadcast |

**Legend**:
- ❌ NEW: Not in smart-bus, needs implementation
- ⚠️ FIX/CUSTOM: In smart-bus but broken or needs custom variant
- ✅ Used: Likely supported in smart-bus, used as-is

---

## Contact

If you're interested in contributing these to smart-bus, you can:
- Open an issue in the smart-bus repository with command details
- Create a pull request with implementation
- Contact the smart-bus maintainers
- Discuss in this app's GitHub issues

## References

- [smart-bus Repository](https://github.com/caligo-mentis/smart-bus)
- [HDL Automation Documentation](http://hdlautomation.com/)
- [This App's GitHub](https://github.com/alydersen/hdl-smartbus-homey)

---

*Last Updated: Generated for v1.2.6*  
*smart-bus version: 0.7.0*

