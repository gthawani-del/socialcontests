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
