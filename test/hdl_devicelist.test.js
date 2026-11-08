const HdlDevicelist = require('../hdl/hdl_devicelist');

/**
 * Test suite for HdlDevicelist
 * Tests device type mapping and configuration lookups
 */
describe('HdlDevicelist', () => {
  let devicelist;

  beforeEach(() => {
    devicelist = new HdlDevicelist();
  });

  describe('typeOfDevice', () => {
    test('should return correct device type for known IDs', async () => {
      expect(await devicelist.typeOfDevice('16')).toBe('dimmer');
      expect(await devicelist.typeOfDevice('150')).toBe('relay');
      expect(await devicelist.typeOfDevice('491')).toBe('relay');
      expect(await devicelist.typeOfDevice('124')).toBe('tempsensor');
      expect(await devicelist.typeOfDevice('48')).toBe('panel');
      expect(await devicelist.typeOfDevice('207')).toBe('floorheater');
      expect(await devicelist.typeOfDevice('213')).toBe('floorheater');
      expect(await devicelist.typeOfDevice('214')).toBe('floorheater');
      expect(await devicelist.typeOfDevice('215')).toBe('floorheater');
      expect(await devicelist.typeOfDevice('305')).toBe('multisensor');
      expect(await devicelist.typeOfDevice('700')).toBe('curtain');
    });

    test('should return null for unknown device IDs', async () => {
      expect(await devicelist.typeOfDevice('9999')).toBe(null);
      expect(await devicelist.typeOfDevice('unknown')).toBe(null);
    });
  });

  describe('numberOfChannels', () => {
    test('should return correct channel counts', async () => {
      expect(await devicelist.numberOfChannels('16')).toBe(48);
      expect(await devicelist.numberOfChannels('150')).toBe(12);
      expect(await devicelist.numberOfChannels('491')).toBe(1);
      expect(await devicelist.numberOfChannels('124')).toBe(2);
      expect(await devicelist.numberOfChannels('355')).toBe(4);
    });

    test('should return 0 for devices without channels', async () => {
      expect(await devicelist.numberOfChannels('48')).toBe(0);
      expect(await devicelist.numberOfChannels('305')).toBe(0);
    });

    test('should return null for unknown devices', async () => {
      expect(await devicelist.numberOfChannels('9999')).toBe(null);
    });
  });

  describe('sensorChannels', () => {
    test('should return floor heater sensor channels', async () => {
      const expected = [13, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62];
      expect(await devicelist.sensorChannels('207')).toEqual(expected);
      expect(await devicelist.sensorChannels('213')).toEqual(expected);
      expect(await devicelist.sensorChannels('214')).toEqual(expected);
      expect(await devicelist.sensorChannels('215')).toEqual(expected);
    });

    test('should return empty array for devices without sensor channels', async () => {
      expect(await devicelist.sensorChannels('16')).toEqual([]);
      expect(await devicelist.sensorChannels('9999')).toEqual([]);
    });
  });

  describe('relayChannels', () => {
    test('should return two relay channels for the 12in1 multisensors', async () => {
      expect(await devicelist.relayChannels('308')).toBe(2);
      expect(await devicelist.relayChannels('321')).toBe(2);
    });

    test('should return zero for multisensors and devices without relay outputs', async () => {
      expect(await devicelist.relayChannels('314')).toBe(0);
      expect(await devicelist.relayChannels('16')).toBe(0);
      expect(await devicelist.relayChannels('9999')).toBe(0);
    });
  });

  describe('numberOfZones', () => {
    test('should return correct zone counts', async () => {
      expect(await devicelist.numberOfZones('4300')).toBe(16);
      expect(await devicelist.numberOfZones('16')).toBe(0);
    });

    test('should return null for unknown devices', async () => {
      expect(await devicelist.numberOfZones('9999')).toBe(null);
    });
  });

  describe('mainCapability', () => {
    test('should return correct main capability for multisensors', async () => {
      expect(await devicelist.mainCapability('305')).toBe('alarm_motion');
      expect(await devicelist.mainCapability('310')).toBe('measure_humidity');
    });

    test('should return null for devices without main capability', async () => {
      expect(await devicelist.mainCapability('16')).toBe(null);
      expect(await devicelist.mainCapability('9999')).toBe(null);
    });
  });

  describe('excludeCapabilities', () => {
    test('should return exclude list for dry contacts', async () => {
      const excludes = await devicelist.excludeCapabilities('355');
      expect(excludes).toContain('alarm_motion');
      expect(excludes).toContain('measure_temperature');
      expect(excludes).toContain('measure_luminance');
      expect(excludes).toContain('measure_humidity');
    });

    test('should return empty array for devices without excludes', async () => {
      const excludes = await devicelist.excludeCapabilities('305');
      expect(excludes).toEqual([]);
    });

    test('should return null for unknown devices', async () => {
      expect(await devicelist.excludeCapabilities('9999')).toBe(null);
    });
  });
});
