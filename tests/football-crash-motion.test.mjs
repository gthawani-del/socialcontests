import test from 'node:test';
import assert from 'node:assert/strict';
import {createCrashBallMotion} from '../src/football-pinball/view/crash-ball-motion.js';

function simulate(seconds=60){
  const motion=createCrashBallMotion();
  motion.reset('autonomous-qa');
  let maxHits=0,maxScore=0;
  for(let i=0;i<seconds*120;i++){
    const state=motion.step(1/120);
    assert.ok(Number.isFinite(state.x)&&Number.isFinite(state.z)&&Number.isFinite(state.speed));
    assert.ok(state.speed<=15.000001,'speed cap');
    maxHits=Math.max(maxHits,state.bootHits);
    maxScore=Math.max(maxScore,state.score);
  }
  return {motion,maxHits,maxScore};
}
test('Crash flippers activate autonomously without player input',()=>{
  const {maxHits}=simulate();
  assert.ok(maxHits>=2,'automatic boots must produce repeated collision hits');
});
test('Autonomous target impacts increment separate board score',()=>{
  const {maxScore}=simulate();
  assert.ok(maxScore>=100,'board must award points on target hits');
});
test('New round clears autonomous gameplay state',()=>{
  const {motion}=simulate(15);
  motion.reset('next');
  const s=motion.snapshot();
  assert.equal(s.bootHits,0);
  assert.equal(s.score,0);
  assert.equal(s.powerShots,0);
  assert.equal(s.powerActive,false);
  assert.equal(s.history.length,0);
});
