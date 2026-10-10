import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bowlingPowerBand,bowlingDispersion,BOWLERS,LENGTHS} from '../src/cricket-pinball/game/bowling-rules.js';
import {StadiumEngine} from '../src/cricket-pinball/game/stadium-engine.js';
import {createStadiumTable} from '../src/cricket-pinball/game/stadium-layout.js';
const table=createStadiumTable(JSON.parse(fs.readFileSync(new URL('../public/game/cricket-table.json',import.meta.url))));
test('meter and control loss share thresholds; no error at or below red boundary',()=>{
 for(const [bowler,profile] of Object.entries(BOWLERS))for(const type of profile.types){
  const s={bowler,type},band=bowlingPowerBand(s);
  assert.deepEqual(bowlingDispersion({...s,power:band.red},()=>0),{x:0,z:0,risk:0});
  assert.equal(bowlingPowerBand({...s,power:band.ideal}).zone,'cyan');
  const a=bowlingDispersion({...s,power:1},()=>0),b=bowlingDispersion({...s,power:1},()=>1);
  assert(a.x<0&&a.z<0&&b.x>0&&b.z>0);assert.equal(a.x,-b.x);assert.equal(a.risk,1);
  assert(bowlingDispersion({...s,power:(1+band.red)/2},()=>1).x<b.x);
 }
});
test('red-zone extremes stay playable, bounce once and do not mutate subsequent controlled deliveries',()=>{
 for(const [bowler,profile] of Object.entries(BOWLERS))for(const type of profile.types)for(const length of Object.keys(LENGTHS))for(const line of ['LEFT','CENTRE','RIGHT'])for(const random of [()=>0,()=>1]){
  const engine=new StadiumEngine(structuredClone(table),{random}),impacts=[];
  engine.on('delivery-bounce',e=>impacts.push(e));engine.releaseLaunch({bowler,deliveryType:type,length,line,charge:1});
  let arrival=null;
  for(let i=0;i<1200&&engine.ball.active;i++){engine.step(1/120);if(!engine.launcher.inLane&&engine.ball.velocity.z>0&&engine.ball.position.z>=2.02){arrival=engine.ball.height;break;}}
  const label=`${bowler}/${type}/${length}/${line}`;
  assert.equal(impacts.length,1,label);assert.notEqual(arrival,null,label);assert(arrival<=.06,`${label} height ${arrival}`);
  assert.equal(table.launcher.bowlingLines[line].target[0],engine.config.launcher.bowlingLines[line].target[0]);
  engine.resetBall();engine.releaseLaunch({bowler,deliveryType:type,length,line,charge:.24});assert.equal(engine.deliveryVariation.accuracy.risk,0);
 }
});
