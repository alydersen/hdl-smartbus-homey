'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {EventEmitter}=require('node:events');
const root=path.join(__dirname,'..');
function load(file, dependencies={}) {
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),{
    module,Buffer,setTimeout,clearTimeout,setInterval,clearInterval,
    require(name){
      if(name in dependencies)return dependencies[name];
      if(name==='homey')return {App:class{log(){}},Device:class{},Driver:class{}};
      if(name==='smart-bus')return class{};
      return require(path.resolve(path.dirname(path.join(root,file)),name));
    }
  });
  return new module.exports();
}
async function appFixture() {
  const app=load('app.js');const drivers={};const cards={};
  app.homey={app,settings:{get:k=>k==='hdl_subnet'?1:undefined,set(){}},
    flow:{getActionCard:id=>({registerRunListener:fn=>cards[id]=fn})},
    drivers:{getDriver:id=>{assert.ok(drivers[id],`missing driver ${id}`);return drivers[id];}}};
  await app.onInit();
  for(const id of app._driverlist)drivers[id]={getDevices:()=>[],updateValues:async()=>{}};
  return {app,drivers,cards};
}
test('upgrade preserves existing Panel identity, class and temperature capability',async()=>{
  const d=load('drivers/panel/device.js');const caps=new Set(['measure_temperature']);
  const identity={id:'1.103'};const cls='sensor';let available=false;
  d.setSettings=async()=>{}; d.getData=()=>identity;d.hasCapability=k=>caps.has(k);
  d.addCapability=async k=>caps.add(k); d.homey={app:{isBusConnected:()=>false}}; d.getClass=()=>cls;d.setAvailable=async()=>available=true;
  // No app or Heater exists: initialization and polling must need neither.
  await d.onInit();await d.onInit();await d.requestUpdate();
  assert.equal(caps.size,1);assert.equal(cls,'sensor');assert.equal(available,true);assert.equal(d.getData(),identity);
});
test('both drivers discover the same physical panel independently',async()=>{
  for(const id of ['panel','dlpheater']){
    const d=load(`drivers/${id}/driver.js`);
    d.homey={settings:{get:()=>1},app:{isBusConnected:()=>true,log(){},getDevicesOfType:type=>{
      assert.equal(type,'panel');return {103:{id:103,type:188}};
    }}};
    const devices=await d.onPairListDevices();assert.equal(devices.length,1);assert.equal(devices[0].data.id,'1.103');
    assert.equal(devices[0].capabilities.length,id==='panel'?1:7);
  }
});
test('one timer tick updates Heater once',async()=>{
  const {app,drivers}=await appFixture();let reads=0;
  drivers.panel.getDevices=()=>[];
  drivers.dlpheater.getDevices=()=>[{requestUpdate(o){assert.equal(o.periodic,true);reads++;}}];
  app._bus={};app._busConnected=true;
  await app.callForUpdate(); await new Promise(r=>setTimeout(r,5));assert.equal(reads,1);
  drivers.dlpheater.getDevices=()=>[];await app.callForUpdate();assert.equal(reads,1); app._clearUpdateTimeouts();
});
test('raw temperature feeds both drivers; button acknowledgement feeds Panel',async()=>{
  const {app,drivers}=await appFixture();const calls=[];
  for(const id of ['panel','dlpheater'])drivers[id].updateValues=async()=>calls.push(id);
  for(const [code,payload,expected] of [[0x1945,[0],'dlpheater'],[0x1947,[0xf8],'dlpheater'],
    [0xe3d9,[0x14,1],'dlpheater'],[0xe3d9,[0x19,20],'dlpheater'],[0xe3d9,[0x12,1,1],'panel']]){
    calls.length=0;
    await app._signalReceived({sender:{subnet:1,id:103,type:48},code,payload:Buffer.from(payload),get data(){throw Error('raw');}});
    assert.deepEqual(calls,code===0x1945?['dlpheater','panel']:[expected]);
  }
  assert.equal(app.getDevicesOfType('panel')[103].id,103);
});
test('real app services share lock: Panel works without Heater and Heater without Panel',async()=>{
  const {app,cards}=await appFixture();const bus=new EventEmitter();const packets=[];
  app._bus=bus;app._busConnected=true;
  app._controller={subnet:1,id:2,send(packet,cb){packets.push(packet);cb(null);}};
  const service=app.dlpService('1.103');
  const pending=cards.panel_press_button({device:{getData:()=>({id:'1.103'})},button:'1'});
  assert.equal(service.busy,true);assert.equal(await service.readStatus({retry:true}),null);
  await assert.rejects(service.setPower(true),/in progress/);
  bus.emit('command',{sender:{subnet:1,id:103},target:{subnet:255,id:255},code:0xe3d9,payload:Buffer.from([0x12,1,1])});
  assert.equal(await pending,true);assert.equal(packets.length,1);assert.equal(service.busy,false);
  const read=service.readStatus();await assert.rejects(cards.panel_press_button({device:{getData:()=>({id:'1.103'})},button:'2'}),/busy/);
  bus.emit('command',{sender:{subnet:1,id:103},target:{subnet:1,id:2},code:0x1945,payload:Buffer.from([0,19,1,1,20,18,16,12])});
  assert.equal((await read).normal,20);assert.equal(packets.length,2);assert.equal(bus.listenerCount('command'),0);
});
