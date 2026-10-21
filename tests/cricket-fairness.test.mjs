import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {run} from './helpers/stadium-manual-simulation.mjs';
import {StadiumEngine} from '../src/cricket-pinball/game/stadium-engine.js';
import {createStadiumTable} from '../src/cricket-pinball/game/stadium-layout.js';
import {createCpuBattingAI,chooseTacticalBowling} from '../src/cricket-pinball/game/cpu-opponent.js';
import {normalizeBowling,pitchTargetFor,PITCH_TARGET_BOUNDS} from '../src/cricket-pinball/game/bowling-rules.js';
const base=JSON.parse(fs.readFileSync(new URL('../public/game/cricket-table.json',import.meta.url)));
const rules=JSON.parse(fs.readFileSync(new URL('../public/game/cricket-rules.json',import.meta.url)));
for(const difficulty of ['EASY','MEDIUM','HARD'])test(`${difficulty}: early human defence covers straight pace and flipper; identical CPU input has identical results`,()=>{
 for(const length of ['FULL','GOOD','SHORT'])for(const power of [.24,.5,.8,1])
 for(const [type,bowler] of [['PACE','MEDIUM'],['PACE','FAST'],['FLIPPER','SPINNER']]){
  const options={difficulty,length,power,type,bowler,start:0};
  const player=run(options),cpu=run({...options,role:'cpu'});
  const label=JSON.stringify(options);
  assert(player.hit,label+' must make actual pressed bat contact');
  assert(['DOT','ONE','TWO'].includes(player.outcome),label+' held defence must survive without automatic boundaries');
  assert.deepEqual(cpu,player,label+' same controls and physics for both roles');
 }
});
test('early holding offers a broad input window, while no input still loses the wicket',()=>{
 for(const difficulty of ['EASY','MEDIUM','HARD']){
  const baseline=run({difficulty});assert.equal(baseline.outcome,'WICKET');assert.equal(baseline.hit,null);
  for(let lead=250;lead<=650;lead+=50){const result=run({difficulty,start:baseline.bounce-lead});assert(result.hit);assert.notEqual(result.outcome,'WICKET');}
 }
});
test('a held bat completes its attacking stroke, settles into guard, releases and can swing again',()=>{
 const engine=new StadiumEngine(createStadiumTable(base)),bat=engine.flippers.get('left');
 engine.setFlipper('left',true);for(let i=0;i<12;i++)engine.updateFlippers(1/120);
 assert(bat.angle> .9,'full attacking swing remains available');
 for(let i=0;i<30;i++)engine.updateFlippers(1/120);assert(Math.abs(bat.angle-6*Math.PI/180)<.001);
 engine.setFlipper('left',false);for(let i=0;i<30;i++)engine.updateFlippers(1/120);
 assert(Math.abs(bat.angle-bat.config.restAngleDeg*Math.PI/180)<.001);
 engine.setFlipper('left',true);for(let i=0;i<12;i++)engine.updateFlippers(1/120);assert(bat.angle>.9);
});
test('CPU uses the same pitch coordinates as player line and length presets',()=>{
 for(const difficulty of ['EASY','MEDIUM','HARD'])for(const bowler of ['FAST','MEDIUM','SPINNER'])for(const roll of [.01,.4,.8]){
  const cpu=chooseTacticalBowling(difficulty,rules.cpu,{bowler,random:()=>roll});
  assert.deepEqual(cpu.target,pitchTargetFor(cpu));assert(Math.abs(cpu.target.x)<=PITCH_TARGET_BOUNDS.maxX);
  const player=normalizeBowling({...cpu,target:pitchTargetFor(cpu)});
  const trajectories=[];
  for(const selection of [cpu,player]){const e=new StadiumEngine(createStadiumTable(base),{random:()=>.5});let bounce;
   e.on('delivery-bounce',hit=>bounce=hit);e.releaseLaunch({...selection,deliveryType:selection.type,charge:selection.power});
   for(let i=0;i<1200&&!bounce;i++)e.step(1/120);assert(bounce);trajectories.push(bounce);
  }
  assert.deepEqual(trajectories[0],trajectories[1],'same first bounce and velocity');
 }
});
test('CPU uses full timing error on centre balls and cannot retime a committed swing',()=>{
 const plan=roll=>{
  const engine={ball:{active:true,position:{x:0,z:1.2},velocity:{x:0,z:6}},launcher:{inLane:false},isAwaitingLaunch:()=>false,setFlipper(){}};
  const ai=createCpuBattingAI({engine,tableConfig:createStadiumTable(base),difficulty:'MEDIUM',cpuConfig:{MEDIUM:{battingReactionMs:20,battingTimingJitterMs:100,battingMissChance:0}},random:()=>roll});
  ai.update(1000,true);const scheduled=ai.getState().scheduledSwingAt;assert(scheduled>1000);
  engine.ball.velocity.z=7;engine.ball.position.z=1.3;ai.update(1001,true);
  assert.equal(ai.getState().scheduledSwingAt,scheduled,'plan stays fixed after ball movement');return scheduled;
 };
 assert(Math.abs(plan(.75)-plan(.25)-100)<.001,'full +/-100 ms range, without the old centre multiplier');
});
