import assert from 'node:assert/strict';
import {run} from '../tests/helpers/stadium-manual-simulation.mjs';
import {writeFile} from 'node:fs/promises';
const rows=[];
for(const bowler of ['MEDIUM','FAST'])for(const power of [.2,.35,.5,.65,.8,1]){
 const bounce=run({bowler,power}).bounce;
 for(const side of ['left','right']){
  const samples=[];
  for(let offset=-100;offset<=100;offset+=10){
   const input={bowler,power,side,start:bounce+offset,hold:180,details:true};
   const result=run(input),cpu=run({...input,role:'cpu'});
   if(JSON.stringify(result)!==JSON.stringify(cpu))throw Error('Player/CPU physics mismatch');
   const before=run({...input,returnGuide:false});
   samples.push({offset,outcome:result.outcome,reason:result.reason,hit:!!result.hit,before:{outcome:before.outcome,reason:before.reason}});
  }
  const runs={ONE:1,TWO:2,FOUR:4,SIX:6};
  rows.push({bowler,power,side,contacts:samples.filter(s=>s.hit).length,runs:samples.reduce((n,s)=>n+(runs[s.outcome]||0),0),wickets:samples.filter(s=>s.outcome==='WICKET').length,escapes:samples.filter(s=>s.reason==='SAFETY_DRAIN').length,samples});
 }
}
const summary=['left','right'].map(side=>{const r=rows.filter(r=>r.side===side);return {side,samples:r.reduce((n,r)=>n+r.samples.length,0),contacts:r.reduce((n,r)=>n+r.contacts,0),runs:r.reduce((n,r)=>n+r.runs,0),wickets:r.reduce((n,r)=>n+r.wickets,0),escapes:r.reduce((n,r)=>n+r.escapes,0),beforeEscapes:r.reduce((n,r)=>n+r.samples.filter(s=>s.before.reason==='SAFETY_DRAIN').length,0),beforeRuns:r.reduce((n,r)=>n+r.samples.reduce((n,s)=>n+({ONE:1,TWO:2,FOUR:4,SIX:6}[s.before.outcome]||0),0),0)};});
assert(summary.every(s=>s.escapes===0),'sampled shots must stay within the table');
assert.equal(summary[0].contacts,summary[1].contacts);
assert.equal(summary[0].wickets,summary[1].wickets);
console.log(JSON.stringify(summary));
await writeFile('docs/qa/ramp-return-balance.json',JSON.stringify({fixture:'Easy, RNG .5, straight centre delivery; 2 bowler speeds x 6 powers x 21 timing offsets per side. Exact replay for player and CPU. Scripted coverage, not player win rates.',summary,rows},null,2)+'\n');
