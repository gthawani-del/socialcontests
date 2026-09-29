import test from 'node:test';
import assert from 'node:assert/strict';
import {CricketMatchEngine, FORMAT_BALLS} from '../src/cricket-pinball/match/match-engine.js';
import {createTossController} from '../src/cricket-pinball/toss/toss-controller.js';
const players=[{id:'human'},{id:'cpu'}];
function game(format='LAST_3',first='human') { const m=new CricketMatchEngine({format,players});m.assignRoles({battingPlayerId:first,bowlingPlayerId:first==='human'?'cpu':'human'});m.startInnings();return m; }
function ball(m,outcome){assert.equal(m.beginDelivery(),true);assert.equal(m.resolveDelivery(outcome),true);assert.equal(m.resolveDelivery(outcome),false);}
function finish(m,outcome='DOT'){while(!m.currentInnings.complete)ball(m,outcome);}
for(const format of Object.keys(FORMAT_BALLS))for(const first of ['human','cpu']) {
 test(`${format}, ${first} bats first: dead ball, innings switch, successful chase`,()=>{
  const m=game(format,first);m.beginDelivery();m.abortDelivery();assert.equal(m.currentInnings.balls,0);
  finish(m,'ONE');assert.equal(m.status,'INNINGS_BREAK');assert.equal(m.target,FORMAT_BALLS[format]+1);
  assert.equal(m.startSecondInnings(),true);finish(m,'SIX');assert.equal(m.status,'MATCH_OVER');assert.notEqual(m.result.winnerId,first);
 });
}
test('two wickets end an innings and a failed chase declares the defender',()=>{const m=game();ball(m,'FOUR');ball(m,'WICKET');ball(m,'WICKET');m.startSecondInnings();ball(m,'WICKET');ball(m,'WICKET');assert.equal(m.result.winnerId,'human');assert.equal(m.result.margin,4)});
test('tie starts a configured three-ball Super Over and preserves regulation innings',()=>{
 const m=game();finish(m);m.startSecondInnings();finish(m);assert.equal(m.status,'SUPER_OVER');
 assert(m.startSuperOver());assert.equal(m.startSuperOver(),false);assert.equal(m.ballsPerInnings,3);assert.equal(m.battingPlayerId,'cpu');
 finish(m,'ONE');assert.equal(m.target,4);m.startSecondInnings();finish(m,'SIX');
 assert.equal(m.status,'MATCH_OVER');assert.equal(m.result.winnerId,'human');assert.equal(m.innings.length,4);assert.equal(m.innings[0].runs,0);
});
test('a tied Super Over allows another round with fresh target and scores',()=>{
 const m=game();for(let round=0;round<2;round++){finish(m);m.startSecondInnings();finish(m);assert.equal(m.status,'SUPER_OVER');assert(m.startSuperOver());}
 assert.equal(m.superOverRound,2);assert.equal(m.target,null);assert.equal(m.currentInnings.runs,0);ball(m,'FOUR');finish(m);m.startSecondInnings();finish(m);assert.equal(m.result.margin,4);
});
for(const value of [.1,.9])for(const call of ['HEADS','TAILS'])test(`toss ${value}, ${call}: face, winner and lock`,()=>{
 const t=createTossController({random:()=>value});const result=t.perform(call,'human','cpu');assert.equal(result.result,value<.5?'HEADS':'TAILS');assert.equal(result.winnerId,call===result.result?'human':'cpu');assert.equal(t.perform(call,'human','cpu'),null);
});

test('invalid transitions cannot reset roles, skip balls, or create extra innings', () => {
 const m=game();
 assert.equal(m.startInnings(),false);
 assert.equal(m.startSecondInnings(),false);
 assert.equal(m.startSuperOver(),false);
 assert.equal(m.finishInnings(),false);
 assert.equal(m.finishMatch(),false);
 assert.equal(m.setToss({winnerId:'cpu'}),false);
 assert.equal(m.assignRoles({battingPlayerId:'cpu',bowlingPlayerId:'human'}),false);
 assert.equal(m.innings.length,1);assert.equal(m.battingPlayerId,'human');
 m.beginDelivery();assert.equal(m.startInnings(),false);m.resolveDelivery('SIX');
 finish(m);assert.equal(m.beginDelivery(),false);m.startSecondInnings();finish(m);
 assert.equal(m.status,'MATCH_OVER');assert.equal(m.startInnings(),false);assert.equal(m.beginDelivery(),false);
});
test('one terminal result per ball, including reentrant delivery listeners', () => {
 const m=game();let launches=0;m.on('delivery:resolved',()=>{if(m.beginDelivery())launches++});
 m.beginDelivery();m.resolveDelivery('FOUR',{result:{runs:999},ballNumber:99});
 assert.equal(launches,0);assert.equal(m.currentInnings.runs,4);assert.equal(m.currentInnings.balls,1);
 assert.equal(m.deliveryHistory[0].result.runs,4);assert.equal(m.deliveryHistory[0].ballNumber,1);
 assert.equal(m.abortDelivery(),false);assert.equal(m.resolveDelivery('SIX'),false);
});
test('chase stops immediately on the winning ball',()=>{
 const m=game('TWO_OVER');ball(m,'ONE');ball(m,'WICKET');ball(m,'WICKET');m.startSecondInnings();ball(m,'TWO');
 assert.equal(m.status,'MATCH_OVER');assert.equal(m.currentInnings.balls,1);assert.equal(m.beginDelivery(),false);
});
test('ties may end without a tie-break, or use a configured six-ball round',()=>{
 for(const enabled of [false,true]) {
  const m=new CricketMatchEngine({format:'LAST_3',players,superOver:enabled,superOverBalls:6});
  m.assignRoles({battingPlayerId:'human',bowlingPlayerId:'cpu'});m.startInnings();finish(m);m.startSecondInnings();finish(m);
  assert.equal(m.status,enabled?'SUPER_OVER':'MATCH_OVER');assert.equal(m.startSuperOver(),enabled);
  if(enabled)assert.equal(m.ballsPerInnings,6);
 }
});
test('reject ambiguous players and invalid wicket or tie-break limits',()=>{
 assert.throws(()=>new CricketMatchEngine({players:[{id:'a'},{id:'a'}]}));
 assert.throws(()=>new CricketMatchEngine({players,maxWickets:0}));
 assert.throws(()=>new CricketMatchEngine({players,superOverBalls:0}));
});
