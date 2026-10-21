import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BOWLERS,LENGTHS,normalizeBowling} from '../src/cricket-pinball/game/bowling-rules.js';
import {chooseTacticalBowling,createCpuBattingAI} from '../src/cricket-pinball/game/cpu-opponent.js';
import {StadiumEngine} from '../src/cricket-pinball/game/stadium-engine.js';
import {createStadiumTable} from '../src/cricket-pinball/game/stadium-layout.js';
import {simulate} from './helpers/stadium-cpu-simulation.mjs';
const table=createStadiumTable(JSON.parse(fs.readFileSync(new URL('../public/game/cricket-table.json',import.meta.url))));

test('bowler restrictions are enforced at physics launch, including invalid caller input',()=>{
 for(const bowler of Object.keys(BOWLERS))for(const type of Object.keys(table.launcher.deliveryTypes)){
  const engine=new StadiumEngine(structuredClone(table));engine.releaseLaunch({bowler,deliveryType:type,length:'INVALID',charge:2});
  assert.ok(BOWLERS[bowler].types.includes(engine.deliveryVariation.type));
  assert.equal(engine.deliveryVariation.length,'GOOD');
 }
 assert.equal(normalizeBowling({bowler:'FAST',type:'SPIN_LEFT'}).type,'PACE');
 assert.equal(normalizeBowling({bowler:'SPINNER',type:'SWING_LEFT'}).type,'SPIN_LEFT');
});

test('CPU only commits legal deliveries and breaks repeated delivery plans',()=>{
 for(const bowler of Object.keys(BOWLERS))for(const roll of [.01,.25,.5,.75,.99]){
  const previous=BOWLERS[bowler].types[0];
  const selection=chooseTacticalBowling('MEDIUM',{}, {bowler,random:()=>roll,history:[{selection:{type:previous}},{selection:{type:previous}}]});
  assert.ok(BOWLERS[bowler].types.includes(selection.type));assert.notEqual(selection.type,previous);
  assert.ok(LENGTHS[selection.length]);
 }
});

// Neutral accuracy sample isolates baseline trajectories; power tests cover both error extremes.
test('all legal bowler deliveries and lengths bounce once and arrive within blade height',()=>{
 for(const [bowler,profile] of Object.entries(BOWLERS))for(const type of profile.types)for(const [length,definition] of Object.entries(LENGTHS))for(const line of ['LEFT','CENTRE','RIGHT'])for(const charge of [.24,.6,1]){
  const engine=new StadiumEngine(structuredClone(table),{random:()=>.5});const impacts=[];let arrivalHeight=null,peak=0;
  engine.on('delivery-bounce',event=>impacts.push(event));engine.releaseLaunch({bowler,deliveryType:type,length,line,charge});
  for(let frame=0;frame<1200&&engine.ball.active;frame++){
   engine.step(1/120);if(engine.launcher.inLane)continue;
   peak=Math.max(peak,engine.ball.height);
   if(engine.ball.velocity.z>0&&engine.ball.position.z>=2.02&&arrivalHeight===null)arrivalHeight=engine.ball.height;
   if(arrivalHeight!==null&&!engine.deliveryFlight)break;
  }
  const label=`${bowler}/${type}/${length}/${line}/${charge}`;
  assert.equal(impacts.length,1,label);assert.ok(Math.abs(impacts[0].z-definition.bounceZ)<.16,`${label} bounce z=${impacts[0].z}`);
  assert.ok(peak>.04,`${label} visible flight`);assert.notEqual(arrivalHeight,null,`${label} reaches bats`);
  assert.ok(arrivalHeight<=.06,`${label} hittable height=${arrivalHeight}`);
 }
});

test('bowler speed hierarchy and slower/flipper variants change launch speed',()=>{
 const speed=(bowler,type)=>{const e=new StadiumEngine(structuredClone(table));e.releaseLaunch({bowler,deliveryType:type,charge:.6});return Math.hypot(e.ball.velocity.x,e.ball.velocity.z);};
 assert.ok(speed('FAST','PACE')>speed('MEDIUM','PACE'));assert.ok(speed('MEDIUM','PACE')>speed('SPINNER','PACE'));
 assert.ok(speed('FAST','SLOWER')<speed('FAST','PACE'));assert.ok(speed('MEDIUM','SLOWER')<speed('MEDIUM','PACE'));
 assert.ok(speed('SPINNER','FLIPPER')>speed('SPINNER','PACE'));
});

test('seeded centre deliveries allow actual CPU contact across every bowler and length',()=>{
 for(const bowler of Object.keys(BOWLERS))for(const length of Object.keys(LENGTHS)){
  const results=Array.from({length:40},(_,i)=>simulate({bowler,length,seed:i+1}));
  assert.ok(results.filter(r=>r.hits>0).length>=20,`${bowler}/${length}: at least half are playable contacts`);
  assert.ok(results.filter(r=>r.outcome==='WICKET').length<24,`${bowler}/${length}: no dominant automatic wicket`);
  assert.ok(results.every(r=>r.outcome!=='UNRESOLVED'),`${bowler}/${length}: every delivery resolves`);
 }
});


test('repeated deliveries do not secretly improve CPU reaction or change physics',()=>{
 const schedule=(difficulty,repeats)=>{
  const engine={ball:{active:true,position:{x:.5,z:1.9},velocity:{x:0,z:3}},launcher:{},isAwaitingLaunch:()=>false,setFlipper:()=>{}};
  const before=structuredClone(engine.ball);
  const ai=createCpuBattingAI({engine,difficulty,random:()=>.99});
  for(let i=0;i<repeats;i++)ai.observeDelivery({bowler:'FAST',line:'RIGHT',type:'PACE',length:'GOOD'});
  ai.update(1000,true);assert.deepEqual(engine.ball,before);return ai.getState().scheduledSwingAt;
 };
 assert.equal(schedule('MEDIUM',5),schedule('MEDIUM',1));
 assert.equal(schedule('EASY',5),schedule('EASY',1));
});
