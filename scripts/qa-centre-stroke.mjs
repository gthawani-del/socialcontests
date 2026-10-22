import {run} from '../tests/helpers/stadium-manual-simulation.mjs';
import {writeFile} from 'node:fs/promises';
const rows=[];
for(const [bowler,power] of [['MEDIUM',.5],['FAST',.8]])for(const side of ['left','right','both']){
 const bounce=run({bowler,power}).bounce;
 const samples=[];
 for(let offset=-300;offset<=150;offset+=10){
  const r=run({bowler,power,side,start:bounce+offset,hold:180,details:true,batConfig:process.env.STROKE_BASELINE?{driveWindow:null,strokeHoldMs:110}:null});
  samples.push({offset,outcome:r.outcome,hit:r.hit,furthestZ:r.furthestZ,initialVelocity:r.initialVelocity,initiallyUpfield:!!r.initialVelocity&&r.initialVelocity.z<0,directStraight:!!r.initialVelocity&&r.initialVelocity.z<0&&Math.abs(r.initialVelocity.x)<=-r.initialVelocity.z*Math.tan(Math.PI/6),subsequentContacts:r.subsequentContacts,drive:!!r.hit&&r.hit.speed*(r.hit.id==='left'?1:-1)>100&&r.furthestZ<1});
 }
 const successful=samples.filter(r=>r.drive).map(r=>r.offset);
 let longest=0,streak=0;for(const sample of samples){streak=sample.drive?streak+10:0;longest=Math.max(longest,streak);}
 rows.push({bowler,power,side,initiallyUpfieldSamples:samples.filter(s=>s.initiallyUpfield).length,directStraightSamples:samples.filter(s=>s.directStraight).length,reboundAssistedUpfieldSamples:samples.filter(s=>s.drive&&!s.initiallyUpfield&&s.subsequentContacts.length).length,driveSamples:successful.length,longestContiguousMs:longest,offsets:successful,samples});
 console.log(JSON.stringify({bowler,side,driveSamples:successful.length,longestContiguousMs:longest,offsets:successful}));
}
await writeFile(process.env.STROKE_OUTPUT||'docs/qa/centre-stroke.json',JSON.stringify({fixture:'Fixed centre delivery, Easy physics, deterministic RNG .5, input offsets relative to bounce, 180ms press, 10ms sampling. Drive is a legacy eventual-upfield metric, NOT a direct straight drive; directStraight means the initial velocity is within 30 degrees of the upfield axis (a reporting convention, not a gameplay rule). initialVelocity is measured after bat skill response, and subsequentContacts lists later rebounds. Drive = first bat contact moving in attacking direction >100 deg/s and ball reaches z<1. Durations are sampled spans, not human success rates.',rows},null,2)+'\n');
