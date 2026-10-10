import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetryState, reduceTelemetryEvent, summarizeTelemetry } from '../src/cricket-pinball/game/playtest-telemetry.js';

const fixedNow = (() => {
  let t = 1_700_000_000_000;
  return () => (t += 250);
})();

test('telemetry records a complete delivery from launch through result', () => {
  const state = createTelemetryState({ model: 'r12' }, []);
  reduceTelemetryEvent(state, {
    type: 'DELIVERY_LAUNCH',
    selection: { line: 'LEFT', type: 'SWING_RIGHT', power: .72 },
    match: { format: 'ONE_OVER', difficulty: 'HARD', innings: 1, score: { balls: 0 }, battingPlayerId: 'player', bowlingPlayerId: 'cpu' }
  }, fixedNow);
  reduceTelemetryEvent(state, {
    type: 'BAT_CONTACT',
    feedback: { timing: 'PERFECT', quality: .81, timingScore: .95, angleScore: .8, impactScore: .9, shotIntent: 'ATTACK', attackRisk: .05, swingProgress: .6 },
    hit: { id: 'left', z: 1.93 }
  }, fixedNow);
  reduceTelemetryEvent(state, {
    type: 'OUTCOME',
    outcome: 'FOUR',
    metadata: { reason: 'DELIVERY_ZONE', zoneId: 'four-ramp' },
    match: { score: { runs: 4, wickets: 0, balls: 1 }, target: null }
  }, fixedNow);

  assert.equal(state.deliveries.length, 1);
  const row = state.deliveries[0];
  assert.equal(row.line, 'LEFT');
  assert.equal(row.deliveryType, 'SWING_RIGHT');
  assert.equal(row.timing, 'PERFECT');
  assert.equal(row.contactQuality, .81);
  assert.equal(row.shotIntent, 'ATTACK');
  assert.equal(row.targetAttempted, 'FOUR');
  assert.equal(row.zoneId, 'four-ramp');
  assert.equal(row.result, 'FOUR');
  assert.equal(row.wicketReason, null);
});

test('telemetry records wicket reason and rejected target attempts', () => {
  const state = createTelemetryState({}, []);
  reduceTelemetryEvent(state, {
    type: 'DELIVERY_LAUNCH',
    selection: { line: 'CENTRE', type: 'CUTTER_LEFT', power: .88 },
    match: { innings: 2, score: { balls: 2 }, battingPlayerId: 'player', bowlingPlayerId: 'cpu' }
  }, fixedNow);
  reduceTelemetryEvent(state, {
    type: 'BAT_CONTACT',
    feedback: { timing: 'EARLY', quality: .48, shotIntent: 'ATTACK', attackRisk: .2 },
    hit: { id: 'right', z: 1.52 }
  }, fixedNow);
  reduceTelemetryEvent(state, {
    type: 'OUTCOME',
    outcome: 'WICKET',
    metadata: { reason: 'RISK_WICKET', attemptedOutcome: 'SIX', zoneId: 'six-ramp' },
    match: { score: { runs: 5, wickets: 1, balls: 3 }, target: 10 }
  }, fixedNow);

  const row = state.deliveries[0];
  assert.equal(row.targetAttempted, 'SIX');
  assert.equal(row.result, 'WICKET');
  assert.equal(row.wicketReason, 'RISK_WICKET');
});

test('summary calculates contact and boundary conversion rates', () => {
  const summary = summarizeTelemetry([
    { timing: 'PERFECT', contactQuality: .8, shotIntent: 'ATTACK', deliveryType: 'PACE', targetAttempted: 'FOUR', result: 'FOUR' },
    { timing: 'EARLY', contactQuality: .4, shotIntent: 'ATTACK', deliveryType: 'SWING_LEFT', targetAttempted: 'SIX', result: 'DOT' },
    { timing: null, contactQuality: null, shotIntent: null, deliveryType: 'PACE', targetAttempted: null, result: 'WICKET', wicketReason: 'WICKET_DRAIN' }
  ]);

  assert.equal(summary.deliveries, 3);
  assert.equal(summary.contacts, 2);
  assert.equal(summary.contactRate, 2 / 3);
  assert.equal(summary.timing.PERFECT, 1);
  assert.equal(summary.intent.ATTACK, 2);
  assert.equal(summary.boundaryAttempts, 2);
  assert.equal(summary.boundaries, 1);
  assert.equal(summary.boundaryConversion, .5);
  assert.equal(summary.wickets.WICKET_DRAIN, 1);
});

test('balance groups separate bowler, length, difficulty and power, excluding dead balls from rates', async () => {
  const {summarizeTelemetryGroups,telemetryPowerBand}=await import('../src/cricket-pinball/game/playtest-telemetry.js');
  const base={bowler:'FAST',length:'FULL',difficulty:'MEDIUM',deliveryType:'PACE',line:'CENTRE',power:.6,battingPlayerId:'cpu'};
  const grouped=summarizeTelemetryGroups([
    {...base,result:'WICKET',reason:'WICKET_DRAIN',wicketReason:'WICKET_DRAIN'},
    {...base,result:'FOUR',timing:'PERFECT',contactQuality:.9},
    {...base,result:'DEAD_BALL',reason:'LAUNCH_FAILED'},
    {...base,bowler:'SPINNER',length:'SHORT',power:.9,result:'DOT'},
    {...base,difficulty:'HARD',result:'SIX'},
    {...base,practice:'bowl',result:'TWO'}
  ]);
  const cell=grouped.combinations.find(row=>row.bowler==='FAST' && row.difficulty==='MEDIUM' && row.practice==='MATCH');
  assert.equal(cell.attempts,3);assert.equal(cell.deliveries,2);assert.equal(cell.deadBalls,1);
  assert.equal(cell.wicketRate,.5);assert.equal(cell.runsPerBall,2);assert.equal(cell.contactRate,.5);
  assert.equal(cell.reasons.LAUNCH_FAILED,1);assert.equal(grouped.combinations.length,4);
  assert.equal(telemetryPowerBand(.44),'LOW');assert.equal(telemetryPowerBand(.45),'MEDIUM');
  assert.equal(telemetryPowerBand(.75),'HIGH');assert.equal(telemetryPowerBand(null),'UNKNOWN');
  assert.equal(telemetryPowerBand(60),'UNKNOWN');
});

test('telemetry records new selection dimensions and stays capped at 200 completed deliveries',()=>{
  const state=createTelemetryState({practice:'bowl'});
  for(let i=0;i<205;i++){
    reduceTelemetryEvent(state,{type:'DELIVERY_LAUNCH',selection:{bowler:'SPINNER',length:'GOOD',type:'FLIPPER',power:.8}},fixedNow);
    reduceTelemetryEvent(state,{type:'OUTCOME',outcome:'DOT'},fixedNow);
  }
  assert.equal(state.deliveries.length,200);
  const row=state.deliveries.at(-1);
  assert.equal(row.bowler,'SPINNER');assert.equal(row.length,'GOOD');assert.equal(row.powerBand,'HIGH');assert.equal(row.practice,'bowl');
});
