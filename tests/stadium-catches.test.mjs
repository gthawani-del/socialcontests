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
test('Ground stays grounded; intentional Loft gains height from contact quality',()=>{
 const engine=new StadiumEngine(structuredClone(table));
 assert.equal(engine.beginShotFlight({shotIntent:'ATTACK',timing:'EARLY',quality:.8}),false);
 engine.shotMode='LOFT';
 assert.equal(engine.beginShotFlight({shotIntent:'ATTACK',timing:'PERFECT',quality:1}),true);
 const strong=engine.verticalVelocity;
 engine.beginShotFlight({shotIntent:'SAFE',timing:'LATE',quality:.1});
 assert(engine.verticalVelocity<strong);
 engine.resetBall();assert.equal(engine.shotMode,'LOFT');assert.equal(engine.shotFlight,null);
});

test('an actual landing before reaching a fielder produces a dot, never a catch',()=>{
 const config=structuredClone(table);config.walls=[];config.ramps=[];
 const engine=new StadiumEngine(config),match=new CricketMatchEngine({players:[{id:'a'},{id:'b'}]});
 match.assignRoles({battingPlayerId:'a',bowlingPlayerId:'b'});match.startInnings();match.beginDelivery();
 const adapter=createCricketGameplayAdapter({engine,matchEngine:match,tableConfig:config,cricketRules:rules});adapter.armDelivery();
 Object.assign(engine.launcher,{awaitingLaunch:false,inLane:false,deliveryGuideActive:false});engine.ball.active=true;
 engine.emit('flipper-hit',{pressed:true,impact:2});
 const f=config.fielders[0];engine.ball.position={x:f.x,z:f.z+.7};engine.ball.velocity={x:0,z:-3};
 engine.shotFlight={lofted:true,bounced:false,groundContacts:0};engine.ball.height=.02;engine.verticalVelocity=-1;
 let landed=0;engine.on('shot-ground-contact',()=>landed++);
 for(let i=0;i<120&&!match.deliveryHistory.length;i++)adapter.step(1/120);
 assert.equal(landed,1);assert.equal(match.deliveryHistory[0].reason,'FIELDED');assert.equal(match.currentInnings.wickets,0);assert.equal(match.currentInnings.balls,1);
 adapter.dispose();
});

for(const fixture of [{delay:165,line:'LEFT',power:.24,runs:6,reason:'AERIAL_SIX'},{delay:153,line:'CENTRE',power:.5,runs:4,reason:'GROUND_BOUNDARY'}])test(`real delivery, bat and loft score ${fixture.runs} at the boundary`,()=>{
 const engine=new StadiumEngine(structuredClone(table)),match=new CricketMatchEngine({players:[{id:'a'},{id:'b'}]});
 match.assignRoles({battingPlayerId:'a',bowlingPlayerId:'b'});match.startInnings();match.beginDelivery();
 const adapter=createCricketGameplayAdapter({engine,matchEngine:match,tableConfig:engine.config,cricketRules:rules});adapter.armDelivery();engine.shotMode='LOFT';engine.releaseLaunch({line:fixture.line,charge:fixture.power});
 let contacts=0;engine.on('flipper-hit',()=>contacts++);
 for(let i=0;i<1400&&!match.deliveryHistory.length;i++){if(i===fixture.delay)engine.setFlipper('left',true);if(i===fixture.delay+18)engine.setFlipper('left',false);adapter.step(1/120);}
 assert(contacts>0);assert.equal(match.currentInnings.runs,fixture.runs);assert.equal(match.currentInnings.balls,1);assert.equal(match.deliveryHistory[0].reason,fixture.reason);
 assert.equal(engine.shotFlight.bounced,fixture.runs===4);
 for(let i=0;i<120;i++)adapter.step(1/120);assert.equal(match.currentInnings.balls,1);adapter.dispose();
});

test('field placement persists per delivery, rejects occupied/invalid slots and locks while live',()=>{
 const engine=new StadiumEngine(structuredClone(table));
 assert.equal(engine.setFieldPosition('cover','point'),true);
 engine.resetBall();assert.equal(engine.config.fielders[0].x,-1.15);
 assert.equal(engine.setFieldPosition('midwicket','point'),false);
 assert.equal(engine.setFieldPosition('cover','unknown'),false);
 engine.releaseLaunch({line:'CENTRE',charge:.6});assert.equal(engine.setFieldPosition('cover','cover'),false);
 engine.resetBall();assert.equal(engine.resetFieldPositions(),true);assert.equal(engine.config.fielders[0].x,-.85);
});

test('a real lofted shot is caught by a fielder moved to deep cover before launch',()=>{
 const engine=new StadiumEngine(structuredClone(table)),match=new CricketMatchEngine({players:[{id:'a'},{id:'b'}]});
 match.assignRoles({battingPlayerId:'a',bowlingPlayerId:'b'});match.startInnings();match.beginDelivery();
 const adapter=createCricketGameplayAdapter({engine,matchEngine:match,tableConfig:engine.config,cricketRules:rules});adapter.armDelivery();
 assert.equal(engine.setFieldPosition('cover','deep-cover'),true);engine.shotMode='LOFT';engine.releaseLaunch({line:'CENTRE',charge:.5});
 let contacts=0,landings=0;engine.on('flipper-hit',()=>contacts++);engine.on('shot-ground-contact',()=>landings++);
 for(let i=0;i<1400&&!match.deliveryHistory.length;i++){if(i===151)engine.setFlipper('left',true);if(i===169)engine.setFlipper('left',false);adapter.step(1/120);}
 assert(contacts>0);assert.equal(landings,0);assert.equal(match.deliveryHistory[0].reason,'CAUGHT_OUT');assert.equal(match.deliveryHistory[0].fielderId,'cover');
 assert.equal(match.currentInnings.wickets,1);assert.equal(match.currentInnings.balls,1);assert.equal(match.currentInnings.complete,false);adapter.dispose();
});
