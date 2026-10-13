import test from 'node:test';
import assert from 'node:assert/strict';
import { createDuel, matchWinner } from '../src/football-pinball/penalty/engine.js';
const run=(e,seconds)=>{for(let i=0;i<seconds*120;i++)e.advance(1/120);};
const start=(first='you',total=5)=>{const e=createDuel({total,random:()=>.25});e.toss('heads');run(e,2.2);e.choose(first);run(e,1.9);return e;};
test('toss controls first role, both roles alternate and a shot only counts once',()=>{
 const e=start();e.aim(.95,.15);run(e,2.4);assert(e.kick('left'));assert(!e.kick('right'));run(e,1);
 assert.equal(e.state.history.you.length,1);assert.equal(e.state.history.cpu.length,0);
 assert(e.state.events.some(x=>x.type==='BOOT_CONTACT'));run(e,1.6);assert.equal(e.state.turn,'cpu');
 run(e,4);assert.equal(e.state.history.cpu.length,1);
});
test('three-shot and five-shot match cannot end on first failed kick',()=>{
 for(const total of [3,5]){const e=start('you',total);run(e,3.4);assert.equal(e.state.winner,null);assert.equal(e.state.history.you.length,1);}
});
test('early clinch and paired sudden death use equal opportunities',()=>{
 assert.equal(matchWinner({you:['goal','goal','goal'],cpu:['miss','miss','miss']},5),'you');
 assert.equal(matchWinner({you:['goal','goal','goal','goal'],cpu:['goal','goal','goal']},3),null);
 assert.equal(matchWinner({you:['goal','goal','goal','goal'],cpu:['goal','goal','goal','miss']},3),'you');
 assert.equal(matchWinner({you:['miss','miss'],cpu:['goal','goal']},3),'cpu');
});
test('save first, position clamp and single committed dive',()=>{
 const e=start('cpu');e.position(0);assert.equal(e.state.keeper.x,.3);assert(e.dive(.02,.2));assert(!e.dive(.9,.8));run(e,.5);assert.equal(e.state.keeper.y,.2);
});
test('CPU does not dive before it can observe a kicked ball',()=>{
 const e=start();e.aim(.95,.1);run(e,2.4);assert.equal(e.state.dive,null);e.kick('left');run(e,.2);assert.equal(e.state.dive,null);run(e,.15);assert(e.state.dive);
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
   if(e.state.phase==='aim'&&e.state.turn==='you'){e.aim(.92,.1);if(e.state.ball.y>=.878)e.kick('right');}
   e.advance(1/120);
  }
  assert.equal(e.state.phase,'ended');const count=e.state.history.you.length+e.state.history.cpu.length;run(e,20);assert.equal(e.state.history.you.length+e.state.history.cpu.length,count);
 }
});
test('a correctly timed human dive saves a reachable CPU shot',()=>{
 const e=start('cpu');run(e,1.9);assert(e.dive(.28,.32));run(e,1.2);
 assert.equal(e.state.history.cpu[0],'save');assert.equal(e.state.events.filter(x=>x.type==='RESULT').length,1);
});
