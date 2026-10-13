import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {StadiumEngine} from '../src/cricket-pinball/game/stadium-engine.js';
import {createStadiumTable} from '../src/cricket-pinball/game/stadium-layout.js';
import {BOWLERS,normalizeBowling,describePitchTarget} from '../src/cricket-pinball/game/bowling-rules.js';
const table=createStadiumTable(JSON.parse(fs.readFileSync(new URL('../public/game/cricket-table.json',import.meta.url))));

test('continuous pitch coordinates land inside the ring across bowlers, lengths, lines and powers',()=>{
 for(const [bowler,profile] of Object.entries(BOWLERS))for(const type of profile.types)
 for(const x of [-.5,.137,.5])for(const z of [1.12,1.537,1.93])for(const charge of [.24,.6,1]) {
  const engine=new StadiumEngine(structuredClone(table),{random:()=>.5}),impacts=[];
  engine.on('delivery-bounce',e=>impacts.push(e));
  engine.releaseLaunch({bowler,deliveryType:type,target:{x,z},...describePitchTarget({x,z}),charge});
  let previous={...engine.ball.position},peak=0;
  for(let i=0;i<1200 && !impacts.length && engine.ball.active;i++) {
   engine.step(1/120);const p=engine.ball.position;
   assert(Math.hypot(p.x-previous.x,p.z-previous.z)<.13,'continuous path through shooter lane and flight');
   previous={...p};if(!engine.launcher.inLane)peak=Math.max(peak,engine.ball.height);
  }
  assert.equal(impacts.length,1,`${bowler}/${type}/${x}/${z}/${charge}`);
  assert(Math.hypot(impacts[0].x-x,impacts[0].z-z)<.035,'first impact matches chosen coordinates');
  assert(peak>.05,'ball visibly airborne before bounce');
  const kick=impacts[0].velocity.x-impacts[0].beforeVelocity.x;
  if(type==='SPIN_LEFT')assert(kick<-.7);if(type==='SPIN_RIGHT')assert(kick>.7);
 }
});

test('red-zone spread affects the actual first bounce and reset removes the custom target',()=>{
 for(const random of [()=>0,()=>1]) {
  const engine=new StadiumEngine(structuredClone(table),{random});let impact;
  engine.on('delivery-bounce',e=>impact=e);
  engine.releaseLaunch({bowler:'SPINNER',deliveryType:'PACE',target:{x:.13,z:1.55},charge:1});
  for(let i=0;i<1200&&!impact;i++)engine.step(1/120);
  const {target,accuracy}=engine.deliveryVariation;
  assert(Math.hypot(impact.x-target.x,impact.z-target.z)<.035);
  assert(Math.abs(impact.x-.13)>.16);assert.equal(accuracy.risk,1);
  engine.resetBall();engine.releaseLaunch({bowler:'MEDIUM',deliveryType:'PACE',line:'CENTRE',charge:.6});
  assert.equal(engine.deliveryVariation.target,null,'CPU/preset path remains separate after reset');
 }
});

test('invalid target coordinates cannot escape the playable bowling area',()=>{
 assert.deepEqual(normalizeBowling({target:{x:500,z:-300}}).target,{x:.5,z:1.12});
 assert.equal(normalizeBowling({target:{x:NaN,z:1.5}}).target,null);
});
