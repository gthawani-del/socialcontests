import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrashBallMotion } from '../src/football-pinball/view/crash-ball-motion.js';

function simulate({pressed=false,seconds=50}={}){
  const motion=createCrashBallMotion();
  motion.reset('qa-round');
  if(pressed){motion.input(0,true);motion.input(1,true);}
  let maxHits=0,maxScore=0;
  for(let i=0;i<seconds*120;i++){
    const state=motion.step(1/120);
    assert.ok(Number.isFinite(state.x)&&Number.isFinite(state.z)&&Number.isFinite(state.speed),'finite physics');
    assert.ok(state.speed<=15.000001,'velocity capped for VFX');
    maxHits=Math.max(maxHits,state.bootHits);
    maxScore=Math.max(maxScore,state.score);
  }
  return {motion,maxHits,maxScore};
}

test('Crash ball only counts a kick when a boot is pressed',()=>{
  const idle=simulate({pressed:false,seconds:50});
  assert.equal(idle.maxHits,0,'unpressed boots must never score kicks');
  const active=simulate({pressed:true,seconds:50});
  assert.ok(active.maxHits>0,'pressed boots must make physical ball contact');
});

test('Crash target hits accumulate a separate board score',()=>{
  const {motion,maxScore}=simulate({pressed:true,seconds:50});
  assert.ok(maxScore>=100,'gameplay produces target scoring');
  assert.ok(motion.snapshot().score%100===0);
});

test('Crash round reset clears collision and scoring state',()=>{
  const {motion}=simulate({pressed:true,seconds:10});
  motion.reset('next-round');
  const state=motion.snapshot();
  assert.equal(state.bootHits,0);
  assert.equal(state.score,0);
  assert.equal(state.powerShots,0);
  assert.equal(state.powerActive,false);
  assert.equal(state.history.length,0);
});
