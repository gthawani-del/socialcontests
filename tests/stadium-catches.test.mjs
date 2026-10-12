import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {StadiumEngine} from '../src/cricket-pinball/game/stadium-engine.js';
import {createStadiumTable} from '../src/cricket-pinball/game/stadium-layout.js';
import {CricketMatchEngine} from '../src/cricket-pinball/match/match-engine.js';
import {createCricketGameplayAdapter} from '../src/cricket-pinball/game/gameplay-adapter.js';
const table=createStadiumTable(JSON.parse(fs.readFileSync('public/game/cricket-table.json')));
const rules=JSON.parse(fs.readFileSync('public/game/cricket-rules.json'));
for(const kind of ['airborne','ground','bounced','above-reach','miss'])test(`fielder interception: ${kind}`,()=>{
 const engine=new StadiumEngine(structuredClone(table));
 const match=new CricketMatchEngine({players:[{id:'a'},{id:'b'}]});
 match.assignRoles({battingPlayerId:'a',bowlingPlayerId:'b'});match.startInnings();match.beginDelivery();
 const adapter=createCricketGameplayAdapter({engine,matchEngine:match,tableConfig:table,cricketRules:rules});adapter.armDelivery();
 Object.assign(engine.launcher,{awaitingLaunch:false,inLane:false,deliveryGuideActive:false});
 engine.ball.active=true;
 // Seed a contact fixture; integrate the actual movement through the fielder sensor.
 engine.emit('flipper-hit',{pressed:true,impact:2});
 const f=table.fielders[0];
 engine.ball.position={x:f.x+(kind==='miss'?.4:0),z:f.z+.3};engine.ball.velocity={x:0,z:-5};
 engine.ball.height=kind==='above-reach'?1:kind==='airborne'?.3:0;
 engine.shotFlight={lofted:kind!=='ground',bounced:kind==='bounced'};engine.verticalVelocity=0;
 for(let i=0;i<10;i++)adapter.step(1/120);
 if(['above-reach','miss'].includes(kind)){assert.equal(match.currentInnings.balls,0);}
 else {assert.equal(match.currentInnings.balls,1);assert.equal(match.currentInnings.wickets,kind==='airborne'?1:0);assert.equal(match.deliveryHistory[0].reason,kind==='airborne'?'CAUGHT_OUT':'FIELDED');}
 for(let i=0;i<20;i++)adapter.step(1/120);
 if(!['above-reach','miss'].includes(kind))assert.equal(match.currentInnings.balls,1,'one interception counts once');
 engine.resetBall();assert.equal(engine.shotFlight,null);assert.equal(engine.fielded,false);adapter.dispose();
});
test('contact timing and direction, not power alone, determine loft',()=>{
 const engine=new StadiumEngine(structuredClone(table));
 assert.equal(engine.beginShotFlight({shotIntent:'ATTACK',timing:'PERFECT',lateralRatioAfter:.2}),false);
 assert.equal(engine.beginShotFlight({shotIntent:'ATTACK',timing:'EARLY',lateralRatioAfter:.2}),true);
 assert.equal(engine.beginShotFlight({shotIntent:'SAFE',timing:'LATE',lateralRatioAfter:.2}),false);
 assert.equal(engine.beginShotFlight({shotIntent:'ATTACK',timing:'LATE',lateralRatioAfter:.95}),false);
});
test('real delivery and mistimed left-bat contact produce a catch',()=>{
 const engine=new StadiumEngine(structuredClone(table));const match=new CricketMatchEngine({players:[{id:'a'},{id:'b'}]});
 match.assignRoles({battingPlayerId:'a',bowlingPlayerId:'b'});match.startInnings();match.beginDelivery();
 let contacts=0,peak=0;engine.on('flipper-hit',()=>contacts++);
 const adapter=createCricketGameplayAdapter({engine,matchEngine:match,tableConfig:table,cricketRules:rules});adapter.armDelivery();engine.releaseLaunch({line:'LEFT',charge:.24});
 for(let i=0;i<1400&&!match.deliveryHistory.length;i++){
  if(i===191)engine.setFlipper('left',true);if(i===209)engine.setFlipper('left',false);
  adapter.step(1/120);if(engine.shotFlight)peak=Math.max(peak,engine.ball.height);
 }
 assert(contacts>0);assert(peak>.2);assert.equal(match.deliveryHistory[0].reason,'CAUGHT_OUT');assert.equal(match.currentInnings.wickets,1);assert.equal(match.currentInnings.balls,1);assert.equal(match.currentInnings.complete,false);adapter.dispose();
});
