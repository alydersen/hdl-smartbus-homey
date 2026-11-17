'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function load(file) {
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{
    module,Buffer,require:()=>({Device:class{},Driver:class{}})
  });return new module.exports();
}
test('standalone Panel reads ambient channel once, paired Heater suppresses extra read',async()=>{
  const d=load('drivers/panel/device.js');const sent=[];let heaters=[];
  d.getData=()=>({id:'2.103'});d.error=()=>{};
  d.homey={app:{isBusConnected:()=>true,controller:()=>({send:p=>sent.push(p)})},
    drivers:{getDriver:()=>({getDevices:()=>heaters})}};
  await d.requestUpdate();assert.equal(sent.length,1);assert.equal(sent[0].target,'2.103');
  assert.equal(sent[0].command,0x1948);assert.equal(sent[0].data.channel,1);
  heaters=[{getData:()=>({id:'2.103'})}];await d.requestUpdate();assert.equal(sent.length,1);
});
test('Panel consumes raw Celsius temperature independently of thermostat mode and legacy notifications',async()=>{
  const d=load('drivers/panel/driver.js');const values=[];
  d.getDevices=()=>[{getData:()=>({id:'2.103'}),setCapabilityValue:async(k,v)=>values.push([k,v])}];
  d.homey={app:{valueOK:(k,v)=>v>=-40&&v<=80}};
  await d.updateValues({sender:{subnet:2,id:103},code:0x1945,payload:Buffer.from([0,0x85,1,2,20,18,16,12])});
  await d.updateValues({sender:{subnet:2,id:103},code:0x1949,data:{temperature:21.5}});
  await d.updateValues({sender:{subnet:1,id:103},code:0x1949,data:{temperature:30}});
  await d.updateValues({sender:{subnet:2,id:103},code:0x1947,payload:Buffer.from([0xf8,0,1,1,20,18,16,12])});
  assert.deepEqual(values,[['measure_temperature',-5],['measure_temperature',21.5]]);
});
