import {run} from '../tests/helpers/stadium-manual-simulation.mjs';
import {writeFile} from 'node:fs/promises';
const rows=[];
for(const [bowler,power] of [['MEDIUM',.5],['FAST',.8]])for(const side of ['left','right','both']){
 const bounce=run({bowler,power}).bounce;
 const samples=[];
 for(let offset=-300;offset<=150;offset+=10){
  const r=run({bowler,power,side,start:bounce+offset,hold:180,details:true,batConfig:process.env.STROKE_BASELINE?{driveWindow:null,strokeHoldMs:110}:null});
  samples.push({offset,outcome:r.outcome,hit:r.hit,furthestZ:r.furthestZ,drive:!!r.hit&&r.hit.speed*(r.hit.id==='left'?1:-1)>100&&r.furthestZ<1});
 }
 const successful=samples.filter(r=>r.drive).map(r=>r.offset);
 let longest=0,streak=0;for(const sample of samples){streak=sample.drive?streak+10:0;longest=Math.max(longest,streak);}
 rows.push({bowler,power,side,driveSamples:successful.length,longestContiguousMs:longest,offsets:successful,samples});
 console.log(JSON.stringify({bowler,side,driveSamples:successful.length,longestContiguousMs:longest,offsets:successful}));
}
await writeFile(process.env.STROKE_OUTPUT||'docs/qa/centre-stroke.json',JSON.stringify({fixture:'Fixed centre delivery, Easy physics, deterministic RNG .5, input offsets relative to bounce, 180ms press, 10ms sampling. Drive = first bat contact moving in attacking direction >100 deg/s and ball reaches z<1. Durations are sampled spans, not human success rates.',rows},null,2)+'\n');
