import test from 'node:test';
import assert from 'node:assert/strict';
import {createCrashRounds,crashThreshold,crashCommitment,verifyCrashReveal} from '../server/football-pinball/crash-rounds.mjs';
import {createFootballService} from '../server/football-pinball/index.mjs';
const seed='a'.repeat(64);
function fixture(options={}){let t=0;return{advance(value){t=value;},rounds:createCrashRounds({now:()=>t,wallNow:()=>100000,randomSeed:()=>seed,...options})};}
test('commitment hides threshold until terminal and reveal reproduces result',()=>{
 const f=fixture(),r=f.rounds.create(100);assert.equal(r.status,'ready');assert.equal(r.reveal,undefined);assert.equal(r.seed,undefined);assert.equal(r.commitment,crashCommitment(seed));
 f.advance(3000+10000*Math.log(crashThreshold(seed)));const end=f.rounds.get(r.roundId,r.token);assert.equal(end.status,'crashed');assert.equal(end.payout,0);assert.ok(verifyCrashReveal({commitment:end.commitment,...end.reveal}));assert.equal(verifyCrashReveal({commitment:'0'.repeat(64),...end.reveal}),false);
});
test('server time controls cashout; once only and wall-clock rollback cannot rewind',()=>{
 const f=fixture(),r=f.rounds.create(123);assert.throws(()=>f.rounds.cashout(r.roundId,r.token),{status:409});
 f.advance(3001);const live=f.rounds.get(r.roundId,r.token);assert.equal(live.status,'active');f.advance(0);assert.equal(f.rounds.get(r.roundId,r.token).status,'active');
 const end=f.rounds.cashout(r.roundId,r.token);assert.equal(end.status,'cashed_out');assert.equal(end.payout,123);assert.throws(()=>f.rounds.cashout(r.roundId,r.token),{status:409});
 f.advance(999999);assert.equal(f.rounds.get(r.roundId,r.token).status,'cashed_out');
});
test('crash wins exact boundary; cashout just before wins',()=>{
 const boundary=3000+10000*Math.log(crashThreshold(seed));
 const a=fixture(),ra=a.rounds.create(100);a.advance(boundary-.001);assert.equal(a.rounds.cashout(ra.roundId,ra.token).status,'cashed_out');
 const b=fixture(),rb=b.rounds.create(100);b.advance(boundary);assert.throws(()=>b.rounds.cashout(rb.roundId,rb.token),{status:409});assert.equal(b.rounds.get(rb.roundId,rb.token).status,'crashed');
});
test('stakes, tokens, request rates and retention bound abuse',()=>{
 const f=fixture({maxRounds:1,retentionMs:100});for(const value of[0,-1,1001,1.1,'100',NaN])assert.throws(()=>f.rounds.create(value),{status:400});
 const r=f.rounds.create(100);assert.throws(()=>f.rounds.create(1),{status:503});assert.throws(()=>f.rounds.get(r.roundId,'bad'),{status:401});
 for(let i=0;i<30;i++)f.rounds.get(r.roundId,r.token);assert.throws(()=>f.rounds.get(r.roundId,r.token),{status:429});
 f.advance(3000+10000*Math.log(crashThreshold(seed))+100);f.rounds.cleanup();assert.throws(()=>f.rounds.get(r.roundId,r.token),{status:404});assert.ok(f.rounds.create(1));
});
test('HTTP API rejects forged scores and unauthenticated access',async()=>{
 const service=await createFootballService({autoTick:false});const base=await service.listen();
 try{
  const post=(path,data,token)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});
  assert.equal((await post('/crash/rounds',{stake:10,seed:'fake'})).status,400);
  const res=await post('/api/crash/rounds',{stake:10});assert.equal(res.status,201);const r=await res.json();
  assert.equal((await fetch(base+'/crash/rounds/'+r.roundId)).status,401);
  assert.equal((await post('/crash/rounds/'+r.roundId+'/cashout',{multiplier:100},r.token)).status,400);
  assert.equal((await post('/crash/rounds/'+r.roundId+'/cashout',{},r.token)).status,409);
 }finally{await service.close();}
});
