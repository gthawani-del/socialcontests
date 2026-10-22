import test from 'node:test';
import assert from 'node:assert/strict';
import {run} from './helpers/stadium-manual-simulation.mjs';
for(const [bowler,power] of [['MEDIUM',.5],['FAST',.8]])for(const side of ['left','right','both']){
 test(`${bowler}/${side}: shaped stroke widens actual upfield attacking shots`,()=>{
  const bounce=run({bowler,power}).bounce;
  const sweep=batConfig=>{
   let longest=0,streak=0,count=0,maxRuns=0;
   const runs={ONE:1,TWO:2,FOUR:4,SIX:6};
   for(let offset=-300;offset<=150;offset+=10){
    const r=run({bowler,power,side,start:bounce+offset,hold:180,details:true,batConfig});
    maxRuns=Math.max(maxRuns,runs[r.outcome]||0);
    const drive=r.hit&&r.hit.speed*(r.hit.id==='left'?1:-1)>100&&r.furthestZ<1;
    streak=drive?streak+10:0;longest=Math.max(longest,streak);if(drive)count++;
   }return {longest,count,maxRuns};
  };
  const before=sweep({driveWindow:null,strokeHoldMs:110}),after=sweep(null);
  assert(after.count>before.count,JSON.stringify({before,after}));
  assert(after.longest>before.longest,JSON.stringify({before,after}));
  for(const repeatEvery of [100,125]){
   const mash=run({bowler,power,side,start:0,hold:40,repeatEvery});
   assert(({ONE:1,TWO:2,FOUR:4,SIX:6}[mash.outcome]||0)<=after.maxRuns,'8–10 presses per second cannot outperform the best timed shot in this fixture');
  }
  const input={bowler,power,side,start:bounce,hold:180};
  assert.deepEqual(run({...input,role:'cpu'}),run(input),'identical input has identical physics for either side');
  assert.equal(run({bowler,power}).outcome,'WICKET','no input still exposes the wicket');
  assert.equal(run({bowler,power,start:bounce+180,hold:180}).outcome,'WICKET','late input still misses');
 });
}

test('centre-shot diagnostics distinguish first-hit direction from rebound-assisted progress',()=>{
 const bounce=run().bounce;
 const left=run({side:'left',start:bounce,hold:180,details:true});
 const right=run({side:'right',start:bounce,hold:180,details:true});
 assert(left.initialVelocity.z>0&&right.initialVelocity.z>0,'first contact is not an upfield drive');
 assert(Math.abs(left.initialVelocity.x+right.initialVelocity.x)<.001);
 assert(Math.abs(left.initialVelocity.z-right.initialVelocity.z)<.001);
 for(const [result,opposite] of [[left,'right'],[right,'left']]){
  assert(result.furthestZ<1);
  assert(result.subsequentContacts.some(c=>c.event==='flipper-hit'&&c.id===opposite));
 }
 assert.notEqual(left.reason,'SKILL_REJECTED');
});
