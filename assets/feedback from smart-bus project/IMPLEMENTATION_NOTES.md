# smart-bus Command Implementation Notes

This document contains findings and recommendations from implementing HDL commands for the smart-bus package based on requirements from the HDL SmartBus Homey app.

## Implementation Summary

Successfully implemented 4 out of 5 priority commands from CONTRIBUTING_TO_SMART_BUS.md:

✅ **Implemented and Tested:**
- 0xE3E3 - Curtain Status with Duration (FIXED)
- 0xE800 - Get Curtain Duration Request (NEW)
- 0xE801 - Get Curtain Duration Response (NEW)
- 0x6F00 - Dry Contact Multi-Channel Status (NEW)

⚠️ **Not Implemented:**
- 0xE3D9 - Dry Contact Acknowledge (CONFLICT - see details below)

---

## Implemented Commands

### 1. 0xE3E3 - Curtain Status with Duration (FIXED)

**Original Issue:** The command in smart-bus only parsed 2 bytes (curtain + status) but missed the optional duration field.

**Solution:** Enhanced parser to support both formats:
- **2-byte format** (legacy): `[curtain, status]` - backward compatible
- **4-byte format** (with duration): `[curtain, status, duration_high, duration_low]`
  - Duration is in deciseconds (0.1 second units)
  - Duration = `(duration_high << 8 | duration_low) / 10`

**Implementation Notes:**
- Parse: Detects format based on buffer length
- Encode: Outputs 2-byte format if duration is undefined, 4-byte format if provided
- Fully backward compatible with existing smart-bus code

**Test Cases Added:**
```javascript
'0xE3E3': [
  { payload: Buffer.from('0102', 'hex'), data: { curtain: 1, status: 2 } },
  { payload: Buffer.from('115A', 'hex'), data: { curtain: 17, status: 90 } },
  { payload: Buffer.from('010201F4', 'hex'), data: { curtain: 1, status: 2, duration: 50.0 } }
]
```

---

### 2. 0xE800 - Get Curtain Duration Request (NEW)

**Purpose:** Request to query the configured open/close duration for a specific curtain channel.

**Buffer Format:**
```
[0] = Channel number
```

**Implementation:**
- Simple 1-byte payload with channel number
- Response command is 0xE801
- Standard request/response pattern

**Test Cases Added:**
```javascript
'0xE800': [
  { payload: Buffer.from('01', 'hex'), data: { channel: 1 } },
  { payload: Buffer.from('0A', 'hex'), data: { channel: 10 } }
]
```

---

### 3. 0xE801 - Get Curtain Duration Response (NEW)

**Purpose:** Response containing the duration configuration for a curtain channel.

**Buffer Format:**
```
[0]   = Channel number
[1]   = Reserved (0x00)
[2]   = Reserved (0x00)
[3-4] = Duration in centiseconds (Big Endian)
```

**Important:** The documentation in CONTRIBUTING_TO_SMART_BUS.md has contradictory information:
- Line 117: "Duration in **deciseconds** (Big Endian)"
- Line 120: "configured duration in **centiseconds** (0.01 second units)"

**Resolution:** After analyzing the test fixtures, the duration is stored as **centiseconds** (raw value, no division needed).

**Implementation Notes:**
- Total buffer size: 5 bytes
- Duration is a 16-bit Big Endian value representing centiseconds
- Example: duration 5000 = 50.00 seconds

**Test Cases Added:**
```javascript
'0xE801': [
  { payload: Buffer.from('0100001388', 'hex'), data: { channel: 1, duration: 5000 } },
  { payload: Buffer.from('03000007D0', 'hex'), data: { channel: 3, duration: 2000 } }
]
```

---

### 4. 0x6F00 - Dry Contact Multi-Channel Status (NEW)

**Purpose:** Report status for multiple dry contact channels using a 16-bit bitfield.

**Buffer Format:**
```
[0]     = Subnet
[1]     = Number of declared channels
[2-3]   = Status mask (16-bit, Big Endian)
```

**Implementation Notes:**
- Parses a 16-bit mask where each bit represents one channel state
- Channels are numbered 1-16 (bit 0 = channel 1, bit 15 = channel 16)
- Returns array of channel objects with `{ number, status }` for all 16 channels
- Note: Documentation mentions 8-byte format but actual usage is 4-byte format

**Bit Mapping Example:**
- `0x0F00` = `0b0000111100000000` = channels 9, 10, 11, 12 are active
- Bit 0 = channel 1, bit 1 = channel 2, ..., bit 15 = channel 16

**Test Cases Added:**
```javascript
'0x6F00': [
  {
    payload: Buffer.from('01080F00', 'hex'),
    data: {
      subnet: 1,
      declaredChannels: 8,
      statusMask: 0x0F00,
      channels: [ /* 16 channel objects */ ]
    }
  }
]
```

---

## Not Implemented Commands

### 0xE3D9 - Dry Contact Acknowledge (CONFLICT)

**Status:** ⚠️ Not implemented due to command code conflict

**Conflict Details:**
- In smart-bus: 0xE3D9 is defined as "Response Panel Control" (Section 9.1.2)
- In CONTRIBUTING doc: 0xE3D9 is described as "Dry Contact Acknowledge" with dual parsing modes

**Existing Implementation in smart-bus:**
```javascript
0xE3D9: {
  parse: function(buffer) {
    return {
      key: buffer.readUInt8(0),
      value: buffer.readUInt8(1)
    };
  },
  encode: function(data) {
    return Buffer.from([data.key, data.value]);
  }
}
```

**Proposed Implementation (from CONTRIBUTING):**
```javascript
// Two parsing modes:
// 1. Sentinel mode: Look for 0x11 marker, followed by channel and status
// 2. Standard mode: Direct channel mask and status
```

**Recommendations:**

**Option 1: Verify Command Codes**
- The Homey app may be using 0xE3D9 for dry contact in a non-standard way
- HDL devices might reuse command codes for different purposes
- Investigate if this is a device-specific or firmware-version-specific implementation

**Option 2: Smart Parsing**
- Add logic to detect payload format and parse accordingly
- Risk: May cause incorrect parsing of panel control responses if they happen to look like dry contact acknowledgements

**Option 3: Check HDL Documentation**
- Consult official HDL documentation to determine the "correct" use of 0xE3D9
- May need to contact HDL support or check for protocol version differences

**Recommendation:** Defer implementation until confirming:
1. Whether these are truly the same command code or a documentation error
2. Device/firmware versions that use each format
3. Whether the payload formats are distinguishable programmatically

---

## Code Quality Notes

### Testing
- All 203 existing tests pass ✅
- Added comprehensive test fixtures for all new commands
- Tests cover both parsing and encoding for each command

### Backward Compatibility
- 0xE3E3 maintains full backward compatibility with existing 2-byte format
- No breaking changes to existing smart-bus API
- All new commands follow existing smart-bus patterns

### Code Style
- Follows smart-bus coding conventions
- Uses same buffer manipulation patterns as existing code
- Comments added for clarity on buffer layouts

---

## Documentation Issues Found

### 0xE801 Duration Units
**Issue:** Conflicting documentation on duration units
- Line 117: "Duration in deciseconds"
- Line 120: "configured duration in centiseconds"

**Resolution:** Implemented as centiseconds based on test fixture analysis

### 0x6F00 Buffer Format
**Issue:** Documentation shows 8-byte format but implementation uses 4-byte format
- Docs show: `[0-1] = Command, [2] = Subnet, [3] = Channels, [4-5] = Mask, [6-7] = Additional`
- Actual: `[0] = Subnet, [1] = Channels, [2-3] = Mask`

**Note:** The `[0-1] = Command (0x6F00)` in documentation likely refers to the protocol header, not the payload (smart-bus strips this)

---

## Recommendations for Homey App

### 1. Verify 0xE3D9 Usage
Investigate whether:
- Different device models use 0xE3D9 for different purposes
- Firmware versions affect 0xE3D9 parsing
- Documentation accurately reflects your deployed devices

### 2. Update CONTRIBUTING Documentation
- Fix unit inconsistencies (deciseconds vs centiseconds)
- Clarify buffer format documentation vs actual payload
- Add device/firmware version information for variant commands

### 3. Test Integration
After updating to smart-bus with these commands:
- Remove custom command implementations from the Homey app
- Test thoroughly with actual HDL devices
- Monitor for any parsing errors in production

### 4. Consider Versioning
If HDL devices have protocol variants:
- Consider adding device type or firmware version detection
- May need command-specific parsing based on context

---

## Files Modified

### lib/commands.js
- Enhanced 0xE3E3 with duration support
- Added 0xE800 Get Curtain Duration Request
- Added 0xE801 Get Curtain Duration Response  
- Added 0x6F00 Dry Contact Multi-Channel Status

### test/fixtures/commands.js
- Added test fixtures for 0xE3E3 duration field
- Added test fixtures for 0xE800
- Added test fixtures for 0xE801
- Added test fixtures for 0x6F00

---

## Test Results

```
203 passing (51ms)
0 failing
```

All tests pass including:
- All new command parsers
- All new command encoders
- Backward compatibility tests
- Existing regression tests

---

## Next Steps

1. ✅ **Completed:** Implement curtain duration commands (0xE800, 0xE801, fixed 0xE3E3)
2. ✅ **Completed:** Implement dry contact multi-channel status (0x6F00)
3. ⏭️ **Pending:** Resolve 0xE3D9 conflict with smart-bus maintainers or HDL documentation
4. ⏭️ **Pending:** Update Homey app to use standard smart-bus implementations
5. ⏭️ **Pending:** Remove CONTRIBUTING_TO_SMART_BUS.md entries for completed commands

---

## Contact & References

- [smart-bus Repository](https://github.com/caligo-mentis/smart-bus)
- [HDL Automation Documentation](http://hdlautomation.com/)
- Original Requirements: CONTRIBUTING_TO_SMART_BUS.md

---

*Generated during smart-bus command implementation*
*Date: Based on implementation session*

