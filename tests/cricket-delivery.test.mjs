import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PinballEngine} from '../src/physics/pinball-engine.js';
import {CricketMatchEngine} from '../src/cricket-pinball/match/match-engine.js';
import {createCricketGameplayAdapter} from '../src/cricket-pinball/game/gameplay-adapter.js';
const table=JSON.parse(fs.readFileSync(new URL('../public/game/cricket-table.json',import.meta.url)));
const rules=JSON.parse(fs.readFileSync(new URL('../public/game/cricket-rules.json',import.meta.url)));
for(const line of ['LEFT','CENTRE','RIGHT'])for(const power of [.2,.5,1])test(`countable delivery: ${line}, power ${power}`,()=>{
 const engine=new PinballEngine(structuredClone(table));
 const match=new CricketMatchEngine({players:[{id:'a'},{id:'b'}]});match.assignRoles({battingPlayerId:'a',bowlingPlayerId:'b'});match.startInnings();
 let result;const adapter=createCricketGameplayAdapter({engine,matchEngine:match,tableConfig:table,cricketRules:rules,onResolved:x=>result=x,onDeadBall:x=>result=x});
 match.beginDelivery({line,power});adapter.armDelivery();engine.releaseLaunch({charge:power,line,deliveryType:'PACE'});
 for(let i=0;i<2400&&!result;i++)adapter.step(1/120);
 assert(result,'delivery must resolve');assert.equal(match.currentInnings.balls,1);adapter.dispose();
});

// Isolate scoring geometry from obstacles so the same fast flight is repeatable.
function flight(zone,contact=true) {
 const config=structuredClone(table);
 config.physics.gravity=[0,0];config.physics.linearDamping=0;
 config.walls=[];config.bumpers=[];config.slingshots=[];config.flippers=[];
 config.ball.maxSpeed=30;
 const engine=new PinballEngine(config);
 const match=new CricketMatchEngine({players:[{id:'a'},{id:'b'}]});
 match.assignRoles({battingPlayerId:'a',bowlingPlayerId:'b'});match.startInnings();match.beginDelivery();
 const adapter=createCricketGameplayAdapter({engine,matchEngine:match,tableConfig:{...config,deliveryZones:[zone]},cricketRules:rules});
 adapter.armDelivery();engine.launcher.awaitingLaunch=false;engine.launcher.inLane=false;engine.launcher.deliveryGuideActive=false;
 engine.ball.active=true;engine.ball.position={x:zone.position[0],z:zone.position[1]+.5};engine.ball.velocity={x:0,z:-20};
 if(contact)engine.emit('flipper-hit',{pressed:true,impact:2});
 return {engine,match,adapter};
}
for(const outcome of ['ONE','TWO','FOUR','SIX'])test(`${outcome} is counted once even between rendered frames`,()=>{
 const zone={id:'test-run',outcome,position:[0,0],radius:.22,terminal:true,direction:'RETURN'};
 const {match,adapter}=flight(zone);adapter.step(.05);
 assert.equal(match.deliveryHistory[0]?.result.type,outcome);assert.equal(match.currentInnings.balls,1);
 adapter.step(.05);assert.equal(match.currentInnings.balls,1);adapter.dispose();
});
test('crossing a run zone without a legal bat hit never scores',()=>{
 const {match,adapter}=flight({id:'test-run',outcome:'SIX',position:[0,0],radius:.22,terminal:true,direction:'RETURN'},false);
 adapter.step(.05);assert.equal(match.currentInnings.runs,0);assert.equal(match.currentInnings.balls,0);adapter.dispose();
});
test('pre-bat drain is a dead ball; legal contact followed by drain is a wicket',()=>{
 for(const contact of [false,true]){
  const {engine,match,adapter}=flight({id:'test-run',outcome:'SIX',position:[0,0],radius:.22,terminal:true},contact);
  engine.emit('drain');engine.emit('drain');
  assert.equal(match.currentInnings.balls,contact?1:0);assert.equal(match.currentInnings.wickets,contact?1:0);adapter.dispose();
 }
});
test('a safety reset after bat contact is a dot, never a wicket',()=>{
 const {engine,match,adapter}=flight({id:'test-run',outcome:'SIX',position:[0,0],radius:.22,terminal:true});
 engine.emit('drain',{safetyReset:true});assert.equal(match.currentInnings.balls,1);assert.equal(match.currentInnings.wickets,0);assert.equal(match.currentInnings.runs,0);adapter.dispose();
});

test('contacted ball resolves on the shorter post-contact timeout',()=>{
 const config=structuredClone(table);
 config.physics.gravity=[0,0];config.physics.linearDamping=0;config.physics.rollingFriction=0;
 config.walls=[];config.bumpers=[];config.slingshots=[];config.flippers=[];
 config.playfield.drain={minX:-1,maxX:1,z:100};
 config.playfield.safetyBounds={minX:-100,maxX:100,minZ:-100,maxZ:100};
 const engine=new PinballEngine(config);
 const match=new CricketMatchEngine({players:[{id:'a'},{id:'b'}]});
 match.assignRoles({battingPlayerId:'a',bowlingPlayerId:'b'});match.startInnings();match.beginDelivery();
 let resolvedMetadata=null;
 const adapter=createCricketGameplayAdapter({
   engine,matchEngine:match,tableConfig:{...config,deliveryZones:[]},cricketRules:rules,
   onResolved:(type,metadata)=>{resolvedMetadata={type,metadata};}
 });
 adapter.armDelivery();
 Object.assign(engine.launcher,{awaitingLaunch:false,inLane:false,deliveryGuideActive:false});
 engine.ball.active=true;engine.ball.position={x:0,z:1.9};engine.ball.velocity={x:.5,z:0};
 engine.emit('flipper-hit',{id:'left',pressed:true,impact:3,x:0,z:1.9,swingProgress:.5});
 for(let i=0;i<650&&!match.deliveryHistory.length;i++)adapter.step(1/120);
 assert.equal(match.deliveryHistory[0]?.result.type,'DOT');
 assert.equal(resolvedMetadata?.metadata.reason,'POST_CONTACT_TIMEOUT');
 assert(resolvedMetadata.metadata.elapsedAfterContactMs>=rules.delivery.postContactMaxMs);
 assert(resolvedMetadata.metadata.elapsedAfterContactMs<rules.delivery.maxLiveMs);
 adapter.dispose();
});
