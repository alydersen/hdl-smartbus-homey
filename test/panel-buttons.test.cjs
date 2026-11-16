const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {pressPanelButton}=require('../hdl/dlp-buttons');
function fixture(subnet=2){
 const bus=new EventEmitter(),locks=new Map(),packets=[];
 const app={log(){},isBusConnected:()=>true,bus:()=>bus,dlpService(address){if(!locks.has(address))locks.set(address,{busy:false});return locks.get(address);},controller:()=>({subnet,id:3,send(p,cb){packets.push(p);cb(null);}})};
 const device=address=>({getData:()=>({id:address})});
 const ack=(address,b)=>{const [subnet,id]=address.split('.').map(Number);bus.emit('command',{sender:{subnet,id},target:{subnet:255,id:255},code:0xe3d9,payload:Buffer.from([18,b,1])});};
 return {app,bus,locks,packets,device,ack};
}
for(const [address,b,hex] of [['1.100',1,'1201010036'],['2.103',9,'120901009f'],['2.109',17,'1211010075'],['2.105',25,'12190100f5'],['2.105',32,'12200100c7']])test(`routes ${b} to selected ${address}`,async()=>{
 const h=fixture(Number(address.split('.')[0]));const p=pressPanelButton(h.app,h.device(address),String(b),100);
 assert.equal(h.packets[0].target,address);assert.equal(h.packets[0].payload.toString('hex'),hex);
 h.ack(address,b);assert.equal(await p,true);assert.equal(h.locks.get(address).busy,false);assert.equal(h.bus.listenerCount('command'),0);
});
test('foreign panel and wrong button cannot acknowledge selected panel',async()=>{
 const h=fixture();const p=pressPanelButton(h.app,h.device('2.100'),'20',100);
 h.ack('1.100',20);h.ack('2.103',20);h.ack('2.100',19);assert.equal(h.locks.get('2.100').busy,true);
 h.ack('2.100',20);assert.equal(await p,true);assert.equal(h.packets.length,1);
});
test('shared address lock blocks overlapping operations while separate panels work',async()=>{
 const h=fixture();const p=pressPanelButton(h.app,h.device('2.100'),'1',100);
 await assert.rejects(pressPanelButton(h.app,h.device('2.100'),'2',100),/busy/);
 const q=pressPanelButton(h.app,h.device('2.101'),'2',100);h.ack('2.101',2);h.ack('2.100',1);await Promise.all([p,q]);assert.equal(h.packets.length,2);
});
for(const address of ['1.100','2.0','2.255','2.999','2.01','garbage'])test(`rejects invalid or foreign subnet ${address} before send`,async()=>{
 const h=fixture();await assert.rejects(pressPanelButton(h.app,h.device(address),'1',100));assert.equal(h.packets.length,0);
});
test('timeout sends once and releases lock',async()=>{
 const h=fixture();await assert.rejects(pressPanelButton(h.app,h.device('2.100'),'28',30),/No 0xE3D9/);assert.equal(h.packets.length,1);assert.equal(h.locks.get('2.100').busy,false);assert.equal(h.bus.listenerCount('command'),0);
});
test('new device card matches manifest and preserves legacy target card',()=>{
 const card=require('../.homeycompose/flow/actions/panel_press_button.json');const app=require('../app.json');
 assert.equal(card.args[0].filter,'driver_id=panel');assert.deepEqual(card.args[1].values.map(v=>v.id),Array.from({length:32},(_,i)=>String(i+1)));
 const generated=app.flow.actions.find(c=>c.id==='panel_press_button');assert.deepEqual(generated,{id:'panel_press_button',...card});
});
