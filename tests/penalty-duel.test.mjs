import test from 'node:test';
import assert from 'node:assert/strict';
import { createDuel, matchWinner, duelScore, BALL_START } from '../src/football-pinball/penalty/engine.js';
const run=(e,seconds)=>{for(let i=0;i<seconds*120;i++)e.advance(1/120);};
const start=(first='you',total=5,format='standard')=>{const e=createDuel({format,total,random:()=>.25});e.toss('heads');run(e,2.2);e.choose(first);run(e,1.9);return e;};
test('toss controls first role, both roles alternate and a shot only counts once',()=>{
 const e=start();e.aim(.95,.15);e.startCharge('left');run(e,.315);assert(e.releaseCharge('left'));assert(!e.kick('right'));run(e,1);
 assert.equal(e.state.history.you.length,1);assert.equal(e.state.history.cpu.length,0);
 assert(e.state.events.some(x=>x.type==='BOOT_CONTACT'));run(e,1.6);assert.equal(e.state.turn,'cpu');
 run(e,4);assert.equal(e.state.history.cpu.length,1);
});
test('three-shot and five-shot match cannot end on first failed kick',()=>{
 for(const total of [3,5]){const e=start('you',total);run(e,12.1);assert.equal(e.state.winner,null);assert.equal(e.state.history.you.length,1);}
});
test('early clinch and paired sudden death use equal opportunities',()=>{
 assert.equal(matchWinner({you:['goal','goal','goal'],cpu:['miss','miss','miss']},5),'you');
 assert.equal(matchWinner({you:['goal','goal','goal','goal'],cpu:['goal','goal','goal']},3),null);
 assert.equal(matchWinner({you:['goal','goal','goal','goal'],cpu:['goal','goal','goal','miss']},3),'you');
 assert.equal(matchWinner({you:['miss','miss'],cpu:['goal','goal']},3),'cpu');
});
test('save first, position clamp and single committed dive',()=>{
 const e=start('cpu');e.position(0);assert.equal(e.state.keeper.x,0);run(e,.3);assert(e.state.keeper.x<-.4);assert(e.dive(.02,.2));assert(!e.dive(.9,.8));run(e,.5);assert.equal(e.state.keeper.mode,'airborne');assert(e.state.keeper.z>.8);
});
test('CPU does not dive before it can observe a kicked ball',()=>{
 const e=start();e.aim(.95,.1);e.startCharge('left');run(e,.315);assert.equal(e.state.dive,null);e.releaseCharge('left');run(e,.2);assert.equal(e.state.dive,null);run(e,.15);assert(e.state.dive);
});
test('paused match freezes ball, timers and rejects controls',()=>{
 const e=start();run(e,.5);const before=e.snapshot();e.pause(true);run(e,20);assert.equal(e.state.elapsed,before.elapsed);assert.deepEqual(e.state.ball,before.ball);assert(!e.kick('left'));e.pause(false);run(e,.2);assert(e.state.elapsed>before.elapsed);
});
test('production defaults reach a final result without stale attempts',()=>{
 let seed=18;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(const difficulty of ['rookie','pro','elite']){
  const e=createDuel({random,difficulty,total:5});e.toss('heads');
  for(let i=0;i<120*150 && e.state.phase!=='ended';i++){
   if(e.state.phase==='choice')e.choose('you');
   if(e.state.phase==='aim'&&e.state.turn==='you'){e.aim(.92,.1);if(!e.state.charge)e.startCharge('right');else if(e.state.charge.elapsed>=.315)e.releaseCharge('right');}
   e.advance(1/120);
  }
  assert.equal(e.state.phase,'ended');const count=e.state.history.you.length+e.state.history.cpu.length;run(e,20);assert.equal(e.state.history.you.length+e.state.history.cpu.length,count);
 }
});
test('fixed roles persist and award a point for each attempt',()=>{
 for(const first of ['you','cpu']){const e=start(first,3,'fixed');run(e,first==='you'?12.1:3.1);const points=duelScore(e.state);assert.equal(points.you+points.cpu,1);run(e,1.6);assert.equal(e.state.turn,first);}
});
test('charging changes speed, cancellation and pause never shoot',()=>{
 const e=start();e.startCharge('left');run(e,.7);e.cancelCharge();assert.equal(e.state.flight,null);e.startCharge('right');run(e,1.41);assert.equal(e.state.charge.power,1);e.releaseCharge('right');assert.equal(e.state.flight.duration,.55);assert(!e.releaseCharge('right'));
 const p=start();p.startCharge('left');p.pause(true);assert.equal(p.state.charge,null);
});
import {createKeeper,stepKeeper,requestDive,keeperPose,keeperSaves,GOAL} from '../src/football-pinball/penalty/keeper.js';
test('keeper accelerates, brakes, dives under gravity and recovers',()=>{
 const k=createKeeper();k.move=1;stepKeeper(k,1/120);assert(k.vx>0&&k.vx<.2);for(let i=0;i<50;i++)stepKeeper(k,1/120);assert(k.x>.5);const pose=keeperPose(k);k.move=0;for(let i=0;i<40;i++)stepKeeper(k,1/120);assert.equal(k.vx,0);requestDive(k,.9,.1);for(let i=0;i<30;i++)stepKeeper(k,1/120);assert.equal(k.mode,'airborne');assert(k.vz>0);assert.notDeepEqual(keeperPose(k).lh,pose.lh);for(let i=0;i<250;i++)stepKeeper(k,1/120);assert.equal(k.mode,'settled');assert.equal(k.vz,0);
});
test('save collision follows the visible hand pose',()=>{
 const k=createKeeper(),hand=keeperPose(k).lh;assert(keeperSaves(k,{x:hand.x/GOAL.width+.5,y:1-hand.z/GOAL.height}));assert(!keeperSaves(k,{x:.02,y:.02}));
});
test('positioning in front of a reachable CPU shot produces a save',()=>{
 const e=start('cpu');e.position(.23);run(e,3.1);assert.equal(e.state.history.cpu[0],'save');assert.equal(e.state.events.filter(x=>x.type==='RESULT').length,1);
});

test('ball stays ahead of boots through setup, charging, both shots and role switches',()=>{
 for(const side of ['left','right']){
  const e=start();assert.deepEqual(e.state.ball,BALL_START);e.startCharge(side);run(e,.315);assert.deepEqual(e.state.ball,BALL_START);e.releaseCharge(side);
  let previous=e.state.ball.y;
  for(let i=0;i<120*7;i++){
   const flight=e.state.phase==='flight';e.advance(1/120);
   assert(e.state.ball.y<=BALL_START.y+1e-9,'no ball behind staging line');
   if(flight&&e.state.phase==='flight')assert(e.state.ball.y<=previous+1e-9,'flight moves toward goal');
   previous=e.state.ball.y;
  }
  assert(e.state.history.you.length===1&&e.state.history.cpu.length===1);
 }
});
