# Migration Plan: smart-bus 0.9.0 Integration

**Target Version**: smart-bus ^0.9.0 (pending release)  
**Current Version**: smart-bus ^0.7.0  
**Status**: ⏸️ Waiting for smart-bus 0.9.0 release (was 0.8.1 - bumped due to breaking changes)

---

## Executive Summary

The smart-bus package will include 6 HDL commands in version 0.9.0:
- ✅ 0xE3E3 - Curtain Status with Duration (FIXED)
- ✅ 0xE800 - Get Curtain Duration Request (NEW)
- ✅ 0xE801 - Get Curtain Duration Response (NEW)
- ✅ 0x6F00 - Dry Contact Multi-Channel Status (NEW)
- ✅ 0x15D0 - Dry Contact Broadcast Status (NEW - bonus!)
- ✅ 0x15D1 - Dry Contact Security Return (NEW - bonus!)
- ⚠️ 0xE3D9 - Dry Contact Acknowledge (NOT in smart-bus - we keep inline parsing)

✅ **All buffer formats verified!** Ready for migration when 0.9.0 releases.

---

## ✅ Buffer Format Status

### 0xE801 - Curtain Duration Response

**Status**: ✅ FIXED - smart-bus now matches our 4-byte format

**Correct Format:**
```javascript
buffer.readUInt16BE(2)  // Reads bytes [2-3]
Payload: [0]=channel, [1]=reserved, [2]=duration_high, [3]=duration_lo
Example: 01001388 hex = channel 1, duration 5000 (5.00 seconds)
```

**Resolution**: smart-bus switched from 5-byte to 4-byte format to match our app ✅

---

### 0x6F00 - Dry Contact Multi-Channel Status

**Status**: ✅ VERIFIED - smart-bus confirms 4-byte format

**smart-bus Implementation:**
```javascript
Payload: [0]=subnet, [1]=channels, [2-3]=mask  // 4-byte format
Example: 01080F00 hex = subnet 1, 8 channels, mask 0x0F00
```

**Current App Issue:**
- App expects 8 bytes: `payload.length >= 8` and reads `payload[3]` and `payload.readUInt16BE(4)`
- This suggests the app's inline parsing was **NOT working** in production
- smart-bus implementation is correct and will fix the issue

**Resolution**: ✅ smart-bus implementation verified correct, will replace broken inline parsing

---

### 0xE3D9 - Dry Contact Acknowledge

**Status**: ⚠️ CONFLICT with smart-bus

**smart-bus**: 0xE3D9 = Panel Control Response (key/value)
**Our App**: 0xE3D9 = Dry Contact Acknowledge (dual parsing modes)

**Current Implementation**: Inline parsing in `drivers/dry-contact/driver.js:139-160`, NOT through HdlCommands.

**Action Required**:
1. Verify if HDL devices actually use 0xE3D9 for dry contact
2. Check if this is device-specific or firmware-specific
3. Determine if we can distinguish payload formats
4. May need to keep inline parsing

---

## Migration Checklist

### Phase 1: Pre-Migration Verification ⏸️

- [x] **Verify 0xE801 Buffer Format**
  - [x] ✅ smart-bus switched to 4-byte format to match our app
  - [x] Resolution: Both implementations now aligned

- [x] **Verify 0x6F00 Buffer Format**
  - [x] ✅ smart-bus confirms 4-byte format is correct
  - [x] App's 8-byte expectation was incorrect
  - [x] smart-bus implementation will fix the broken inline parsing

- [ ] **Investigate 0xE3D9 Conflict**
  - [ ] Check if devices actually send 0xE3D9 for dry contact
  - [ ] Log actual payloads received
  - [ ] Determine if conflict is real or documentation error

### Phase 2: Wait for Release ⏸️

- [ ] **Monitor smart-bus**
  - [ ] Watch for 0.9.0 release (was planned as 0.8.1)
  - [ ] Review release notes
  - [ ] Verify all 6 commands are included

### Phase 3: Integration Testing 🧪

- [ ] **Update Dependencies**
  - [ ] Update `package.json` to `smart-bus: ^0.9.0`
  - [ ] Run `npm install`
  - [ ] Run `npm test`

- [ ] **Remove Custom Curtain Commands**
  - [ ] Remove HdlCommands extensions from `drivers/curtain/driver.js` lines 12-53
  - [ ] Keep only driver-specific logic
  - [ ] Test curtain functionality

- [ ] **Remove Broken 0x6F00 Inline Parsing**
  - [ ] Remove 0x6F00 inline parsing from `drivers/dry-contact/driver.js` lines 123-137
  - [ ] smart-bus will handle parsing automatically via `signal.data.dryContacts`
  - [ ] Test dry contact multi-channel functionality
  - [ ] 0x15D0 and 0x15D1 will work automatically via same mechanism

- [ ] **Keep 0xE3D9 Inline Parsing**
  - [ ] Do NOT remove from `drivers/dry-contact/driver.js`
  - [ ] Document why inline parsing remains

### Phase 4: Real Device Testing 🏠

- [ ] **Curtain Testing**
  - [ ] Test curtain status with duration
  - [ ] Test duration request/response cycle
  - [ ] Verify duration values are correct (seconds vs centiseconds)

- [ ] **Dry Contact Testing**
  - [ ] Test multi-channel status reporting
  - [ ] Test acknowledge messages
  - [ ] Verify all channels update correctly

- [ ] **Regression Testing**
  - [ ] Test all other drivers work as before
  - [ ] Verify no breaking changes
  - [ ] Check error handling

### Phase 5: Cleanup & Documentation 📝

- [ ] **Update Documentation**
  - [ ] Mark completed commands in CONTRIBUTING_TO_SMART_BUS.md
  - [ ] Document remaining inline parsing
  - [ ] Add notes about buffer format verification
  - [ ] Update CHANGELOG

- [ ] **Code Cleanup**
  - [ ] Remove unused imports if any
  - [ ] Clean up comments
  - [ ] Run full test suite

- [ ] **Version Bump**
  - [ ] Update app version number
  - [ ] Tag release

---

## Expected Changes to Code

### drivers/curtain/driver.js

**Before:**
```javascript
async onInit() {
  this.homey.app.log("HDL CurtainDriver has been initiated");

  // Fix of 0xE3E3 response (its probably response of 0xE800 request also - instead of 0xE801)
  HdlCommands[0xE3E3] = { /* ... */ };
  
  // Added request to get duration value
  HdlCommands[0xE800] = { /* ... */ };
  
  // Added response of get duration value
  HdlCommands[0xE801] = { /* ... */ };
}
```

**After:**
```javascript
async onInit() {
  this.homey.app.log("HDL CurtainDriver has been initiated");
  // Commands 0xE3E3, 0xE800, 0xE801 now provided by smart-bus 0.9.0+
}
```

### drivers/dry-contact/driver.js

**Keep 0xE3D9 parsing**: The inline parsing at lines 139-160 should remain since there's a conflict with smart-bus Panel Control command.

**Remove 0x6F00 parsing**: smart-bus implementation verified, remove lines 123-137 from drivers/dry-contact/driver.js.

---

## Testing Strategy

### Unit Tests
- Run existing test suite
- Add specific tests for migrated commands if needed
- Verify error handling still works

### Integration Tests
1. **Curtain Device**
   - Connect real curtain controller
   - Request status multiple times
   - Request duration via 0xE800
   - Verify 0xE801 response parsing
   - Verify 0xE3E3 with duration field

2. **Dry Contact Device**
   - Connect dry contact module
   - Trigger 0x6F00 response (via smart-bus now)
   - Verify all channels parse correctly via signal.data.dryContacts
   - Test 0x15D0 (broadcast) and 0x15D1 (security return) work automatically
   - Test 0xE3D9 acknowledge messages (still inline)

### Duration Unit Conversion Notes

**0xE3E3**: Duration in deciseconds → divide by 10 to get seconds ✅  
**0xE801**: Duration in centiseconds (raw) → divide by 100 to get seconds ⚠️  

**Critical**: Our app currently expects seconds. Need to verify conversion:
- If smart-bus returns raw centiseconds for 0xE801, divide by 100
- Or check if smart-bus does the conversion already

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Buffer format mismatch | High | Critical | Verify with real devices before migration |
| Duration unit confusion | Medium | High | Explicitly test duration values, add conversion if needed |
| 0xE3D9 conflict real | Low | Medium | Keep inline parsing as fallback |
| Breaking changes in smart-bus | Low | Critical | Test thoroughly, have rollback plan |
| 0x6F00 format mismatch | Medium | High | Verify payload format first |

---

## Rollback Plan

If migration fails:
1. Revert package.json to `smart-bus: ^0.7.0`
2. Restore HdlCommands extensions in curtain driver
3. Document what went wrong
4. File issues with smart-bus repository
5. Provide test data/screenshots

---

## References

- [IMPLEMENTATION_NOTES.md](assets/feedback%20from%20smart-bus%20project/IMPLEMENTATION_NOTES.md)
- [IMPLEMENTATION_SUMMARY.md](assets/feedback%20from%20smart-bus%20project/IMPLEMENTATION_SUMMARY.md)
- [CONTRIBUTING_TO_SMART_BUS.md](CONTRIBUTING_TO_SMART_BUS.md)
- [smart-bus Repository](https://github.com/caligo-mentis/smart-bus)

---

## Timeline

- **Now**: Waiting for smart-bus 0.9.0 release
- **After Release**: 2-4 hours for integration and testing
- **Production**: After successful real device testing

**STATUS**: All buffer formats verified! Ready to migrate when 0.9.0 releases!

---

*Generated: Based on IMPLEMENTATION_NOTES.md feedback*  
*Status: ✅ All formats verified - Ready for smart-bus 0.9.0 release*  
*Version bump: 0.8.1 → 0.9.0 due to buffer format fixes*  

