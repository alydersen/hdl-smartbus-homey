const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { testButton1, testButton2, pressButton } = require('../hdl/dlp-buttons');
function fixture(mode, button = 1) {
 const bus=new EventEmitter(), service={busy:false}, packets=[];
 const app={dlpService:()=>service,isBusConnected:()=>true,bus:()=>bus,log(){},controller:()=>({subnet:1,id:2,send(p,cb){
  packets.push(p);cb(null);
  setImmediate(()=>{
   const emit=(code,payload,target,sender={subnet:1,id:103})=>bus.emit('command',{code,payload:Buffer.from(payload),target,sender});
   if(mode==='close'){bus.emit('close');return;}
   if(mode==='silent')return;
   if(mode!=='uvOnly') emit(0xe3d9,[0x12,button,1],mode==='wrongTarget'?{subnet:1,id:1}:{subnet:255,id:255},mode==='wrongSender'?{subnet:1,id:100}:undefined);
   if(mode!=='ackOnly')emit(0xe01c,[119+button,0,0,0,button],{subnet:1,id:mode==='wrongTarget'?2:1});
  });
 }})};return {app,bus,service,packets};
}
test('button sends exact payload once and succeeds with DLP ack only',async()=>{
 const h=fixture('ackOnly');const p=testButton1(h.app,100);
 assert.equal(h.service.busy,true);
 await assert.rejects(testButton1(h.app,100));
 assert.equal(await p,true);
 assert.equal(h.packets.length,1);
 assert.equal(h.packets[0].payload.toString('hex'),'1201010036');
 assert.equal(h.packets[0].target,'1.103');
 assert.equal(h.service.busy,false);assert.equal(h.bus.listenerCount('command'),0);
});
for(const mode of ['silent','uvOnly','wrongSender','wrongTarget','close'])test(mode+' fails without repeating write',async()=>{
 const h=fixture(mode);await assert.rejects(testButton1(h.app,30));
 assert.equal(h.packets.length,1);assert.equal(h.service.busy,false);
 assert.equal(h.bus.listenerCount('command'),0);
});
test('disconnected sends nothing',async()=>{
 const h=fixture();h.app.isBusConnected=()=>false;
 await assert.rejects(testButton1(h.app));assert.equal(h.packets.length,0);
});

test('B2 sends observed bytes once and confirms B2 without UV',async()=>{
 const h=fixture('ackOnly',2);
 assert.equal(await testButton2(h.app,100),true);
 assert.equal(h.packets.length,1);
 assert.equal(h.packets[0].payload.toString('hex'),'1202010042');
 assert.equal(h.service.busy,false);
 assert.equal(h.bus.listenerCount('command'),0);
});
test('B1 replies cannot complete B2',async()=>{
 const h=fixture();await assert.rejects(testButton2(h.app,30));
 assert.equal(h.packets.length,1);assert.equal(h.service.busy,false);
});
test('B1 and B2 share operation lock',async()=>{
 const h=fixture('ackOnly',2);const pending=testButton2(h.app,100);
 await assert.rejects(testButton1(h.app,100));await pending;
 assert.equal(h.packets.length,1);
});

for (const [selection, button, hex] of [['1',1,'1201010036'],['2',2,'1202010042'],['3',3,'120301009e'],['4',4,'1204010083'],['5',5,'120501005f'],['6',6,'120601002b'],['7',7,'12070100f7'],['8',8,'120801006a'],['9',9,'120901009f'],['10',10,'120a0100eb'],['11',11,'120b010037'],['12',12,'120c01002a'],['13',13,'120d0100f6'],['14',14,'120e010082'],['15',15,'120f01005e'],['16',16,'1210010080'],['17',17,'1211010075'],['18',18,'1212010001'],['19',19,'12130100dd'],['20',20,'12140100c0'],['21',21,'121501001c'],['22',22,'1216010068'],['23',23,'12170100b4'],['24',24,'1218010029'],['25',25,'12190100f5'],['26',26,'121a010081'],['27',27,'121b01005d'],['28',28,'121c0100eb'],['29',29,'121d010037'],['30',30,'121e010043'],['31',31,'121f01009f'],['32',32,'12200100c7']]) {
 test(`dropdown ${selection} sends exact known payload`,async()=>{
  const h=fixture('ackOnly',button);
  assert.equal(await pressButton(h.app,selection,100),true);
  assert.equal(h.packets.length,1);
  assert.equal(h.packets[0].payload.toString('hex'),hex);
 });
}
for (const value of ['33','34','0','01','__proto__',1,null,undefined]) {
 test(`reject unsupported dropdown value ${value} without sending`,async()=>{
  const h=fixture();await assert.rejects(pressButton(h.app,value));
  assert.equal(h.packets.length,0);assert.equal(h.service.busy,false);
 });
}
test('dropdown rejects another button acknowledgement',async()=>{
 const h=fixture('ackOnly',1);
 await assert.rejects(pressButton(h.app,'2',30));
 assert.equal(h.packets.length,1);
});
test('dropdown contains only measured B1-B32 and generated manifest matches',()=>{
 const fs=require('node:fs'), path=require('node:path');
 const root=path.join(__dirname,'..');
 const card=JSON.parse(fs.readFileSync(path.join(root,'.homeycompose/flow/actions/panel_press_button.json')));
 assert.equal(card.args[1].type,'dropdown');
 assert.deepEqual(card.args[1].values.map(v=>v.id),["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32"]);
 const app=JSON.parse(fs.readFileSync(path.join(root,'app.json')));
 assert.deepEqual(app.flow.actions.find(c=>c.id==='panel_press_button').args,card.args);
});

for (let button=3;button<=32;button++) test(`B${button} rejects B1 response without resend`,async()=>{
 const h=fixture('ackOnly',1);
 await assert.rejects(pressButton(h.app,String(button),30));
 assert.equal(h.packets.length,1);
 assert.equal(h.service.busy,false);
 assert.equal(h.bus.listenerCount('command'),0);
});
