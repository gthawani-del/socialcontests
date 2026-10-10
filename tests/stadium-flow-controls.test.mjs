import test from 'node:test';
import assert from 'node:assert/strict';
import {createStadiumMatch} from '../src/cricket-pinball/game/stadium-match.js';
import {BOWLERS} from '../src/cricket-pinball/game/bowling-rules.js';

function fixture(practice){
 const old={document:globalThis.document,location:globalThis.location,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 const elements=new Map(),timers=new Map();let timerId=0;
 const element=id=>{if(elements.has(id))return elements.get(id);const el={id,value:'',disabled:false,hidden:false,dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},append(){},getAnimations(){return[];},querySelector(selector){return element(selector.slice(1));},querySelectorAll(){return[];}};elements.set(id,el);return el;};
 globalThis.document={querySelector:selector=>element(selector.slice(1)),createElement:()=>element('matchPanel')};
 globalThis.location={search:'?format=ONE_OVER'};
 globalThis.setTimeout=fn=>{timers.set(++timerId,fn);return timerId;};globalThis.clearTimeout=id=>timers.delete(id);
 const engine={simTime:0,flippers:new Map(['left','right'].map(side=>[side,{pressed:false}])),on:()=>()=>{},resetBall(){},setDifficulty(){},setFlipper(side,pressed){this.flippers.get(side).pressed=pressed;},releaseLaunch(selection){this.lastLaunch=selection;},updateFlippers(){}};
 const events=[];
 const rules={maxWickets:2,superOver:{enabled:false,ballsPerInnings:3},cpu:{},delivery:{cpuPlungerMs:10,cpuDeliveryDelayMs:10},toss:{}};
 const flow=createStadiumMatch({engine,table:{physics:{maxFrameDelta:.05,fixedStep:1/120}},rules,render(){},onReset(){},onFeedback:event=>events.push(event),practice});
 flow.reset();
 return {flow,engine,events,element,timers,restore(){for(const [key,value] of Object.entries(old))globalThis[key]=value;}};
}

test('bowling practice requires bowler confirmation, blocks player bats, respects length and legal deliveries',()=>{
 const f=fixture('bowl');try{
  assert.equal(f.flow.launch(),false);assert.equal(f.element('bowl').disabled,true);
  f.flow.bat('left',true);assert.equal(f.engine.flippers.get('left').pressed,false);
  f.element('confirmBowler').onclick();assert.equal(f.element('bowl').disabled,false);
  f.element('line').value='CENTRE';f.element('length').value='SHORT';f.element('deliveryType').value='SPIN_LEFT';f.element('power').value='70';
  assert.equal(f.flow.launch(),true);assert.equal(f.engine.lastLaunch.length,'SHORT');
  assert.equal(f.engine.lastLaunch.bowler,'MEDIUM');assert(BOWLERS.MEDIUM.types.includes(f.engine.lastLaunch.deliveryType));
  assert.equal(f.element('length').disabled,true);assert.equal(f.flow.launch(),false);
  f.flow.reset();assert.equal(f.flow.launch(),false);assert.equal(f.timers.size,0);
 }finally{f.restore();}
});
test('pause reasons cannot resume each other or enable controls during interruptions',()=>{
 const f=fixture('bowl');try{
  f.element('confirmBowler').onclick();f.flow.setPaused(true,'interruption');f.flow.setPaused(true);
  f.flow.setPaused(false);assert.equal(f.flow.paused,true);assert.deepEqual(f.flow.pauseReasons,['interruption']);assert.equal(f.flow.launch(),false);
  assert.equal(f.element('line').disabled,true);f.flow.setPaused(false,'interruption');assert.equal(f.flow.paused,false);assert.equal(f.element('line').disabled,false);
  f.flow.setPaused(true,'interruption');f.flow.reset();assert.equal(f.flow.paused,true);assert.equal(f.flow.launch(),false);
 }finally{f.restore();}
});
test('batting practice uses CPU bowling and disables bats after the sixth delivery',()=>{
 const f=fixture('bat');try{
  assert.equal(f.flow.match.battingPlayerId,'player');assert.equal(f.element('bowl').disabled,true);assert.equal(f.element('length').disabled,true);
  f.flow.bat('left',true);assert.equal(f.engine.flippers.get('left').pressed,true);
  assert.equal(f.flow.launch(),true);assert(BOWLERS[f.flow.bowler].types.includes(f.engine.lastLaunch.deliveryType));
  f.flow.match.resolveDelivery('DOT');for(let i=1;i<6;i++){f.flow.match.beginDelivery({});f.flow.match.resolveDelivery('DOT');}
  f.flow.bat('left',false);f.flow.bat('left',true);assert.equal(f.engine.flippers.get('left').pressed,false);assert.equal(f.flow.launch(),false);
 }finally{f.restore();}
});
