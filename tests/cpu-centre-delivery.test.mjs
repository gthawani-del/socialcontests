import test from 'node:test';
import assert from 'node:assert/strict';
import {simulate} from './helpers/stadium-cpu-simulation.mjs';

// Real stadium geometry, 120Hz physics, AI swings and scoring adapter.
// Each seed is an independent delivery; no forced contacts or outcomes.
for(const difficulty of ['EASY','MEDIUM','HARD']) {
 test(`${difficulty}: centre is defendable across speeds and movement`,()=>{
  for(const type of ['PACE','SWING_LEFT','SWING_RIGHT','CUTTER_LEFT','CUTTER_RIGHT','SPIN_LEFT','SPIN_RIGHT'])for(const power of [.24,.6,1]){
   let wickets=0,contacts=0;
   for(let seed=1;seed<=100;seed++){
    const r=simulate({difficulty,type,power,seed});
    assert.notEqual(r.outcome,'UNRESOLVED');
    wickets+=r.outcome==='WICKET';contacts+=r.hits>0;
   }
   assert(wickets<85,`${type}/${power}: centre must not be an automatic wicket (${wickets}/100)`);
   assert(contacts>0,`${type}/${power}: CPU must make physical bat contact`);
  }
 });
}
test('default straight delivery retains wickets and rewards stronger CPU timing',()=>{
 const counts=[];
 for(const difficulty of ['EASY','MEDIUM','HARD']){
  let wickets=0;
  for(let seed=1;seed<=100;seed++)wickets+=simulate({difficulty,power:.6,seed}).outcome==='WICKET';
  assert(wickets>0&&wickets<80);counts.push(wickets);
 }
 assert(counts[0]>counts[1]&&counts[1]>counts[2],`difficulty progression: ${counts}`);
});
