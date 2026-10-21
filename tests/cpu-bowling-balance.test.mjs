import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate} from './helpers/stadium-cpu-simulation.mjs';

// Real launch route, physical contact and scoring, with seeded delivery
// dispersion as well as seeded AI. These are accelerated fixtures, not playtests.
for(const difficulty of ['EASY','MEDIUM','HARD']) {
 test(`${difficulty}: centre fast/flipper cannot dominate across power and length`,()=>{
  for(const [type,bowler] of [['PACE','FAST'],['FLIPPER','SPINNER']])
   for(const length of ['FULL','GOOD','SHORT'])for(const power of [.24,.4,.6,.8,1]) {
    const results=Array.from({length:100},(_,i)=>simulate({difficulty,type,bowler,length,power,seed:i+1}));
    const label=`${difficulty}/${type}/${length}/${power}`;
    assert(results.every(r=>r.outcome!=='UNRESOLVED'),`${label}: every ball resolves`);
    assert(results.filter(r=>r.outcome==='WICKET').length<90,`${label}: not a repeatable 90% wicket exploit`);
    assert(results.some(r=>r.hits>0),`${label}: real bat contact remains possible`);
   }
 });
}
test('production fixed-step CPU has identical outcomes at 30, 60 and 120 render Hz',()=>{
 for(const type of ['PACE','FLIPPER'])for(let seed=1;seed<=20;seed++) {
  const options={type,bowler:type==='PACE'?'FAST':'SPINNER',length:'GOOD',seed};
  const expected=simulate({...options,frameHz:120});
  assert.deepEqual(simulate({...options,frameHz:30}),expected);
  assert.deepEqual(simulate({...options,frameHz:60}),expected);
 }
});
test('repeating the same centre plan remains physically defendable',()=>{
 for(const difficulty of ['EASY','MEDIUM','HARD'])for(const type of ['PACE','FLIPPER']) {
  const results=Array.from({length:40},(_,i)=>simulate({difficulty,type,bowler:type==='PACE'?'FAST':'SPINNER',length:'GOOD',repeats:4,seed:i+1}));
  assert(results.filter(r=>r.outcome==='WICKET').length<36);
  assert(results.some(r=>r.hits>0));
 }
});
