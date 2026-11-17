'use strict';
const { DlpReadQueue } = require('../hdl/dlp-read-queue');
const App = require('../app');

describe('DLP full-status read queue', () => {
  let queue, read, connected, busy;
  beforeEach(() => {
    jest.useFakeTimers(); connected = true; busy = false;
    read = jest.fn(async device => ({ mode: 1, address: device.id }));
    queue = new DlpReadQueue({ connected: () => connected, busy: () => busy, read,
      delayMs: 10, waitMs: 50 });
  });
  afterEach(() => { queue.close(); jest.useRealTimers(); });

  test('simultaneous startup reads are serialized and coalesced by device', async () => {
    const a = { id: '2.100' }, b = { id: '2.103' };
    let release;
    read.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const first = queue.enqueue(a), duplicate = queue.enqueue(a), next = queue.enqueue(b);
    expect(first).toBe(duplicate);
    await jest.advanceTimersByTimeAsync(30);
    expect(read).toHaveBeenCalledTimes(1);
    release({ mode: 1 }); await first;
    await jest.advanceTimersByTimeAsync(10); await next;
    expect(read.mock.calls.map(([d]) => d.id)).toEqual(['2.100', '2.103']);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('startup waits for a connection and a write to release the bus', async () => {
    connected = false;
    const pending = queue.enqueue({});
    await jest.advanceTimersByTimeAsync(20); expect(read).not.toHaveBeenCalled();
    connected = true; busy = true;
    await jest.advanceTimersByTimeAsync(10); expect(read).not.toHaveBeenCalled();
    busy = false; await jest.advanceTimersByTimeAsync(10); await pending;
    expect(read).toHaveBeenCalledTimes(1);
  });

  test('a failed panel is retried behind the others, at most twice', async () => {
    const a = { id: 'silent' }, b = { id: 'working' };
    read.mockImplementation(async d => { if (d === a) throw Error('timeout'); return { mode: 2 }; });
    const bad = expect(queue.enqueue(a)).rejects.toThrow('timeout');
    const good = queue.enqueue(b);
    await jest.advanceTimersByTimeAsync(40); await good; await bad;
    expect(read.mock.calls.map(([d]) => d.id)).toEqual(['silent','working','silent']);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('a null result after a lock race is retried', async () => {
    read.mockResolvedValueOnce(null);
    const pending = queue.enqueue({});
    await jest.advanceTimersByTimeAsync(20); await pending;
    expect(read).toHaveBeenCalledTimes(2);
  });

  test.each(['disconnected', 'busy', 'null'])('%s cannot wait indefinitely', async reason => {
    if (reason === 'disconnected') connected = false;
    if (reason === 'busy') busy = true;
    if (reason === 'null') read.mockResolvedValue(null);
    const pending = expect(queue.enqueue({})).rejects.toThrow(/HDL/);
    await jest.advanceTimersByTimeAsync(70); await pending;
    expect(jest.getTimerCount()).toBe(0);
  });

  test('deletion cancels an unsent read', async () => {
    const device = {};
    const pending = expect(queue.enqueue(device)).rejects.toThrow(/stopped/);
    queue.cancel(device); await pending;
    await jest.advanceTimersByTimeAsync(100); expect(read).not.toHaveBeenCalled();
  });

  test('shutdown rejects pending work and ignores an in-flight result', async () => {
    let release;
    read.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const first = expect(queue.enqueue({})).rejects.toThrow(/stopped/);
    const next = expect(queue.enqueue({})).rejects.toThrow(/stopped/);
    await jest.advanceTimersByTimeAsync(10); queue.close();
    await first; await next; release({ mode: 1 });
    await jest.advanceTimersByTimeAsync(50); expect(read).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('real services initialize two panel addresses with only serialized 1944 reads', async () => {
    const { EventEmitter } = require('node:events');
    const { DlpHeaterService } = require('../hdl/dlp-heater-service');
    const app = new App(), packets = [], bus = new EventEmitter();
    app._bus = bus; app._busConnected = true;
    app.homey = {settings:{get:()=>1}};
    app._controller = {subnet:1,id:2,send(packet,callback) {
      packets.push(packet); callback(null);
      setTimeout(() => bus.emit('command', {code:0x1945,
        sender:{subnet:1,id:Number(packet.target.split('.')[1])},target:{subnet:1,id:2},
        payload:Buffer.from([0,22,1,1,19,24,17,12])}),1);
    }};
    const service1 = new DlpHeaterService(app,50,'1.100');
    const service2 = new DlpHeaterService(app,50,'1.103');
    const first = app.queueDlpRead({service:()=>service1});
    const second = app.queueDlpRead({service:()=>service2});
    await jest.advanceTimersByTimeAsync(600);
    expect((await first).normal).toBe(19); expect((await second).normal).toBe(19);
    expect(packets.map(p=>[p.target,p.command])).toEqual([['1.100',0x1944],['1.103',0x1944]]);
    expect(bus.listenerCount('command')).toBe(0); app._dlpReadQueue.close();
  });

  test('app only queues full-status reads, and rejects a replaced connection result', async () => {
    const app = new App(); app._bus = {}; app._busConnected = true;
    const readStatus = jest.fn(async () => { app._bus = {}; return { mode: 1 }; });
    const device = { service: () => ({ busy: false, readStatus }) };
    const pending = expect(app.queueDlpRead(device)).rejects.toThrow(/stopped/);
    await jest.advanceTimersByTimeAsync(250);
    expect(readStatus).toHaveBeenCalledWith({ retry: true });
    expect(app._dlpReadQueue.pending.size).toBe(1);
    app._dlpReadQueue.close(); await pending;
  });
});
