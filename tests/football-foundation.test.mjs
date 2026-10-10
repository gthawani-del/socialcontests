import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/football-pinball/core/engine.js';
import { BOOTS, FOUNDATION as R } from '../src/football-pinball/modes/foundation.js';
async function run(fn) { const e = await createEngine(); try { await fn(e); } finally { e.dispose(); } }
const steps = (e, n) => { for(let i=0;i<n;i++) e.step(); };

test('ball moves from a real serve; duplicate serve rejected', () => run(e => {
  assert.equal(e.serve(), true); assert.equal(e.serve(), false);
  steps(e, 60); assert(e.ball.translation().y < -2);
}));

test('fixed timestep independent of render partition; pause ignores time and held input', async () => {
  const a=await createEngine(), b=await createEngine();
  try {
    a.serve();b.serve();
    for(let i=0;i<60;i++) a.advance(1/60);
    for(let i=0;i<30;i++) b.advance(1/30);
    assert.deepEqual(a.snapshot(),b.snapshot());
    a.setInput('blue-left',true);a.setPaused(true);
    const snap=a.snapshot();a.advance(100);assert.deepEqual(a.snapshot(),snap);
    assert(!a.boots.some(x=>x.pressed));
    a.setPaused(false);const tick=a.tick;a.advance(20);assert.equal(a.tick-tick,12);
  } finally {a.dispose();b.dispose();}
});

test('four boots rotate independently and return on release', () => run(e => {
  for(const boot of e.boots) {
    e.setInput(boot.id,true);steps(e,20);assert.equal(boot.angle,boot.active);
    assert(e.boots.filter(b=>b.id!==boot.id).every(b=>b.angle===b.rest));
    e.setInput(boot.id,false);steps(e,20);assert.equal(boot.angle,boot.rest);
  }
}));

for(const boot of BOOTS) test(`${boot.id}: swept collider contact imparts velocity towards opponent`, () => run(e => {
  e.serve();
  const side=boot.team==='blue'?1:-1;
  e.placeBall({x:boot.x+Math.cos(boot.rest)*0.95,y:boot.y+Math.sin(boot.rest)*0.95+side*0.34},{x:0,y:0});
  e.setInput(boot.id,true);steps(e,10);
  assert(e.events.some(event=>event.type==='COLLISION'&&event.targetId===boot.id));
  assert(e.ball.linvel().y*side>1,JSON.stringify(e.snapshot()));
}));

test('side rails rebound and high-speed CCD prevents tunnelling', () => run(e => {
  e.serve();e.placeBall({x:2.6,y:0},{x:80,y:0});steps(e,5);
  assert(e.ball.translation().x<3-R.ballRadius+0.03);
  assert(e.ball.linvel().x<0);
  assert(e.events.some(x=>x.type==='COLLISION'&&x.targetId==='right-rail'));
}));

test('end rail outside mouth bounces without scoring', () => run(e => {
  e.serve();e.placeBall({x:2.6,y:4.65},{x:0,y:12});steps(e,8);
  assert(e.ball.linvel().y<0);assert.deepEqual(e.score,{blue:0,red:0});
}));

for(const sign of [-1,1]) test(`goal ${sign}: full ball plane, exactly one score, next serve and reset`, () => run(e => {
  e.serve();e.placeBall({x:0,y:sign*4.95},{x:0,y:sign*3});steps(e,4);
  assert.deepEqual(e.score,{blue:0,red:0}); // center crosses, trailing edge has not
  steps(e,8);const team=sign>0?'blue':'red';assert.equal(e.score[team],1);
  assert.equal(e.state,'goal');steps(e,200);assert.equal(e.score[team],1);
  assert.equal(e.events.filter(x=>x.type==='GOAL_SCORED').length,1);
  assert(e.serve());assert.equal(e.score[team],1);
  e.reset();assert.deepEqual(e.score,{blue:0,red:0});assert.equal(e.state,'ready');
}));

test('goal post grazing is not a goal', () => run(e => {
  e.serve();e.placeBall({x:1.12,y:4.65},{x:0,y:8});steps(e,14);
  assert.deepEqual(e.score,{blue:0,red:0});
  assert(e.events.some(x=>x.type==='COLLISION'));
}));

test('repeatable inputs reproduce physical events; bounded diagnostics', async () => {
  const a=await createEngine(),b=await createEngine();
  try {
    for(const e of [a,b]) {
      e.serve();
      for(let i=0;i<1800;i++) {if(i%30===0)e.setInput('blue-left',i%60===0);e.step();}
    }
    assert.deepEqual(a.snapshot(),b.snapshot());
    for(let i=0;i<700;i++)a.emit('TEST');assert.equal(a.events.length,512);
  }finally{a.dispose();b.dispose();}
});
