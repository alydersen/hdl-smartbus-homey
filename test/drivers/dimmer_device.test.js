'use strict';

const DimmerDevice = require('../../drivers/dimmer/device');

function makeDevice() {
  const device = new DimmerDevice(
    { id: '1.42.1', address: '1.42', channel: 1 },
    null
  );
  device.updateDeviceByBus = jest.fn();
  device.homey = {
    app: {
      log: jest.fn(),
      isBusConnected: jest.fn().mockReturnValue(false),
      controller: jest.fn().mockReturnValue(null)
    }
  };
  return device;
}

describe('DimmerDevice', () => {
  let device;
  let listener;

  beforeEach(async () => {
    device = makeDevice();
    await device.onInit();
    listener = device._capabilityListeners['onoff+dim'];
  });

  describe('onInit', () => {
    test('couples onoff and dim into one debounced listener', () => {
      expect(listener).toBeDefined();
    });

    test('shows the HDL bus address in the device settings on init', async () => {
      expect(await device.getSettings()).toEqual({ hdl_address: '1.42.1' });
    });
  });

  describe('onCapabilityOnoffDim', () => {
    test('onoff + dim from one flow sends a single command at the dim level', async () => {
      await listener({ onoff: true, dim: 0.5 }, {});
      expect(device.updateDeviceByBus).toHaveBeenCalledTimes(1);
      expect(device.updateDeviceByBus).toHaveBeenCalledWith(0.5);
      expect(await device.getCapabilityValue('onoff')).toBe(true);
    });

    test('dim only (setOnDim disabled) sends one command without a 100% flash', async () => {
      await listener({ dim: 0.5 }, {});
      expect(device.updateDeviceByBus).toHaveBeenCalledTimes(1);
      expect(device.updateDeviceByBus).toHaveBeenCalledWith(0.5);
      expect(await device.getCapabilityValue('onoff')).toBe(true);
    });

    test('dim to zero turns the light off', async () => {
      await listener({ dim: 0 }, {});
      expect(device.updateDeviceByBus).toHaveBeenCalledWith(0);
      expect(await device.getCapabilityValue('onoff')).toBe(false);
    });

    test('onoff false overrides a dim value', async () => {
      await listener({ onoff: false, dim: 0.5 }, {});
      expect(device.updateDeviceByBus).toHaveBeenCalledWith(0);
    });

    test('turning off sends level zero and updates dim', async () => {
      await listener({ onoff: false }, {});
      expect(device.updateDeviceByBus).toHaveBeenCalledWith(0);
      expect(await device.getCapabilityValue('dim')).toBe(0);
    });

    test('turning on without a known level goes to full on', async () => {
      await listener({ onoff: true }, {});
      expect(device.updateDeviceByBus).toHaveBeenCalledWith(1);
    });

    test('turning on restores the current dim level', async () => {
      await device.setCapabilityValue('dim', 0.7);
      await listener({ onoff: true }, {});
      expect(device.updateDeviceByBus).toHaveBeenCalledTimes(1);
      expect(device.updateDeviceByBus).toHaveBeenCalledWith(0.7);
    });

    test('dim with duration ramps in ten steps', async () => {
      jest.useFakeTimers();
      try {
        await device.setCapabilityValue('dim', 0);
        await listener({ dim: 1 }, { dim: { duration: 10 } });
        expect(device.updateDeviceByBus).not.toHaveBeenCalled();
        jest.runAllTimers();
        expect(device.updateDeviceByBus).toHaveBeenCalledTimes(10);
        expect(device.updateDeviceByBus).toHaveBeenNthCalledWith(1, 0.1);
        expect(device.updateDeviceByBus).toHaveBeenLastCalledWith(1);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
