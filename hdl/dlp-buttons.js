// B25-B32: Test_08_IP1_ID103_knapp_25-32.pcapng, LC 1.10 -> DLP 1.103.
// B17-B24: Test_05_IP1_ID103_knapp_17-24.pcapng, LC 1.10 -> DLP 1.103.
// B9-B16: measured LC -> DLP 1.103 E3D8 payloads; final byte is not extrapolated.
'use strict';

// Direct DLP button command, sent once. Byte 5 remains unexplained.
async function testButton(app, button, extra, timeoutMs, address = '1.103') {
  const payload = Buffer.from([0x12, button, 1, 0, extra]);
  const service = app.dlpService(address);
  if (service.busy) throw new Error('The DLP is busy. Wait for the current operation to finish.');
  if (!app.isBusConnected()) throw new Error('The HDL connection is not ready.');
  service.busy = true;
  try {
    return await new Promise((resolve, reject) => {
      const bus = app.bus();
      const controller = app.controller();
      const started = Date.now();
      let ack = false;
      let finished = false;
      let timer;
      const finish = error => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        bus.removeListener('command', onCommand);
        bus.removeListener('close', onClose);
        bus.removeListener('error', onError);
        app.logDlpDebug?.(() => `[H006S/01 B${button}] END ack=${ack} elapsed=${Date.now() - started}ms`);
        if (error) app.log(`[DLP] Panel button ${button}: ${error.message}`);
        if (error) reject(error); else resolve(true);
      };
      const onClose = () => finish(new Error('The HDL connection closed during the button command.'));
      const onError = error => finish(error);
      const onCommand = signal => {
        if (`${Number(signal.sender?.subnet)}.${Number(signal.sender?.id)}` !== address) return;
        if (signal.code !== 0xe3d9 || !Buffer.isBuffer(signal.payload)) return;
        const p = signal.payload;
        const target = `${Number(signal.target?.subnet)}.${Number(signal.target?.id)}`;
        app.logDlpDebug?.(() => `[H006S/01 B${button}] RX +${Date.now() - started}ms ${address} -> ${target} ${signal.code.toString(16)} ${p.toString('hex')}`);
        if (signal.code === 0xe3d9 && target === '255.255'
            && p.equals(Buffer.from([0x12, button, 1]))) ack = true;
        if (ack) finish();
      };
      bus.on('command', onCommand);
      bus.on('close', onClose);
      bus.on('error', onError);
      timer = setTimeout(() => finish(new Error(
        `No 0xE3D9 acknowledgement for button ${button}. The command was not repeated.`
      )), timeoutMs);
      try {
        app.logDlpDebug?.(() => `[H006S/01 B${button}] TX ${controller.subnet}.${controller.id} -> ${address} E3D8 ${payload.toString('hex')} (one write)`);
        controller.send({ target: address, command: 0xe3d8,
          payload }, error => {
          if (error) finish(error);
        });
      } catch (error) { finish(error); }
    });
  } finally { service.busy = false; }
}

const testButton1 = (app, timeoutMs = 8000) => testButton(app, 1, 0x36, timeoutMs);
const testButton2 = (app, timeoutMs = 8000) => testButton(app, 2, 0x42, timeoutMs);
async function pressButton(app, selection, timeoutMs = 8000, address = '1.103') {
  // Literal values measured from LC 1.10 on 2026-09-22, Page 1.
  // B1/B2 verified directly from Homey; B3-B8 experimental.
  // The final byte is unknown: do not derive values for other buttons/pages.
  const observed = { '1': 0x36, '2': 0x42, '3': 0x9e, '4': 0x83,
    '5': 0x5f, '6': 0x2b, '7': 0xf7, '8': 0x6a,'9':0x9f,'10':0xeb,'11':0x37,'12':0x2a,'13':0xf6,'14':0x82,'15':0x5e,'16':0x80,'17':0x75,'18':0x01,'19':0xdd,'20':0xc0,'21':0x1c,'22':0x68,'23':0xb4,'24':0x29,'25':0xf5,'26':0x81,'27':0x5d,'28':0xeb,'29':0x37,'30':0x43,'31':0x9f,'32':0xc7 };
  if (typeof selection !== 'string' || !Object.prototype.hasOwnProperty.call(observed, selection)) {
    throw new Error('Choose a button from 1 to 32. No command sent.');
  }
  return testButton(app, Number(selection), observed[selection], timeoutMs, address);
}
async function pressPanelButton(app, device, selection, timeoutMs = 8000) {
  const address = device?.getData()?.id;
  if (typeof address !== 'string' || !/^[1-9]\d{0,2}\.[1-9]\d{0,2}$/.test(address)
      || address.split('.').some(n => Number(n) > 254))
    throw new Error('The panel has an invalid HDL address. No command sent.');
  if (Number(address.split('.')[0]) !== Number(app.controller()?.subnet))
    throw new Error('The panel subnet does not match the app subnet. No command sent.');
  return pressButton(app, selection, timeoutMs, address);
}
module.exports = { testButton1, testButton2, pressButton, pressPanelButton };
