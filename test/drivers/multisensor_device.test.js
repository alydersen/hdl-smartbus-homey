'use strict';

const MultisensorDevice = require('../../drivers/multisensor/device');

function makeDevice() {
  const device = new MultisensorDevice(
    { id: '1.42' },
    null
  );
  device.homey = {
    app: {
      log: jest.fn(),
      isBusConnected: jest.fn().mockReturnValue(true),
      controller: jest.fn().mockReturnValue({ send: jest.fn() })
    }
  };
  return device;
}

function sentCommands(aDevice) {
  return aDevice.homey.app.controller().send.mock.calls.map((call) => call[0].command);
}

describe('MultisensorDevice', () => {
  let device;

  beforeEach(async () => {
    device = makeDevice();
    await device.onInit();
  });

  describe('onInit', () => {
    test('shows the HDL bus address in the device settings on init', async () => {
      expect(await device.getSettings()).toEqual({ hdl_address: '1.42' });
    });

    test('does not register relay listeners when the device has no relay capabilities', () => {
      expect(device._capabilityListeners['relay_1']).toBeUndefined();
      expect(device._capabilityListeners['relay_2']).toBeUndefined();
    });

    test('registers a listener for each relay capability the device has', async () => {
      const sensorDevice = makeDevice();
      await sensorDevice.addCapability('relay_1');
      await sensorDevice.onInit();
      expect(sensorDevice._capabilityListeners['relay_1']).toBeDefined();
      expect(sensorDevice._capabilityListeners['relay_2']).toBeUndefined();
    });
  });

  describe('registerRelayListener', () => {
    test('registers only one listener per capability', () => {
      const spy = jest.spyOn(device, 'registerCapabilityListener');
      device.registerRelayListener('relay_1', 1);
      device.registerRelayListener('relay_1', 1);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('relay control (12in1 relay outputs)', () => {
    let relayDevice;

    beforeEach(async () => {
      relayDevice = makeDevice();
      await relayDevice.addCapability('relay_1');
      await relayDevice.onInit();
    });

    test('turning relay_1 on sends Single Channel Control channel 1 at 100%', async () => {
      await relayDevice._capabilityListeners['relay_1'](true, {});
      expect(relayDevice.homey.app.controller().send).toHaveBeenCalledWith(
        expect.objectContaining({
          target: '1.42',
          command: 0x0031,
          data: { channel: 1, level: 100 }
        }),
        expect.any(Function)
      );
    });

    test('turning relay_2 off sends Single Channel Control channel 2 at 0%', async () => {
      relayDevice.registerRelayListener('relay_2', 2);
      await relayDevice._capabilityListeners['relay_2'](false, {});
      expect(relayDevice.homey.app.controller().send).toHaveBeenCalledWith(
        expect.objectContaining({
          target: '1.42',
          command: 0x0031,
          data: { channel: 2, level: 0 }
        }),
        expect.any(Function)
      );
    });

    test('does not send when the bus is not connected', async () => {
      relayDevice.homey.app.isBusConnected.mockReturnValue(false);
      await relayDevice._capabilityListeners['relay_1'](true, {});
      expect(relayDevice.homey.app.controller().send).not.toHaveBeenCalled();
    });
  });

  describe('requestUpdate', () => {
    test('polls only sensor status for devices without relay capabilities', () => {
      device.requestUpdate();
      expect(sentCommands(device)).toEqual([0xdb00, 0x1645, 0x1604]);
    });

    test('also reads channel status for devices with relay outputs', async () => {
      const relayDevice = makeDevice();
      await relayDevice.addCapability('relay_1');
      await relayDevice.onInit();
      relayDevice.requestUpdate();
      expect(sentCommands(relayDevice)).toEqual([0xdb00, 0x1645, 0x1604, 0x0033]);
    });
  });
});
