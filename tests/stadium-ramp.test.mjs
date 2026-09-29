import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { StadiumEngine } from '../src/cricket-pinball/game/stadium-engine.js';
import { createStadiumTable } from '../src/cricket-pinball/game/stadium-layout.js';
import { CricketMatchEngine } from '../src/cricket-pinball/match/match-engine.js';
import { createCricketGameplayAdapter } from '../src/cricket-pinball/game/gameplay-adapter.js';

const table = createStadiumTable(JSON.parse(fs.readFileSync(new URL('../public/game/cricket-table.json', import.meta.url))));
const rules = JSON.parse(fs.readFileSync(new URL('../public/game/cricket-rules.json', import.meta.url)));
for (const shot of [
  { line: 'LEFT', side: 'left', delay: 84, runs: 1 },
  { line: 'LEFT', side: 'left', delay: 72, runs: 4 },
  { line: 'CENTRE', side: 'left', delay: 84, runs: 6 }
]) test(`a real delivery and timed ${shot.side} bat can score ${shot.runs}`, () => {
  const { engine, match, adapter } = setup();
  engine.releaseLaunch({ line: shot.line, charge: .2 });
  for (let i = 0; i < 1400 && !match.deliveryHistory.length; i++) {
    if (i === shot.delay) engine.setFlipper(shot.side, true);
    if (i === shot.delay + 18) engine.setFlipper(shot.side, false);
    adapter.step(1 / 120);
  }
  assert.equal(match.currentInnings.runs, shot.runs);
  assert.equal(match.currentInnings.balls, 1);
  adapter.dispose();
});
function setup() {
  const engine = new StadiumEngine(structuredClone(table));
  const match = new CricketMatchEngine({ players: [{ id: 'a' }, { id: 'b' }] });
  match.assignRoles({ battingPlayerId: 'a', bowlingPlayerId: 'b' });
  match.startInnings(); match.beginDelivery();
  const adapter = createCricketGameplayAdapter({ engine, matchEngine: match, tableConfig: table, cricketRules: rules });
  adapter.armDelivery();
  return { engine, match, adapter };
}
function flight(engine, x, z, speed, contact = true) {
  Object.assign(engine.launcher, { awaitingLaunch: false, inLane: false, deliveryGuideActive: false });
  Object.assign(engine.ball, { position: { x, z }, velocity: { x: 0, z: -speed }, active: true });
  if (contact) engine.emit('flipper-hit', { pressed: true, impact: 2 });
}
test('four lane requires mouth entry and completion, not a side crossing at its finish', () => {
  for (const atFinish of [false, true]) {
    const { engine, match, adapter } = setup();
    const route = table.ramps.find(r => r.id === 'four-ramp');
    const p = atFinish ? route.points.at(-1) : route.points[0];
    flight(engine, p.x, p.z + .05, 7);
    for (let i = 0; i < (atFinish ? 12 : 240) && !match.deliveryHistory.length; i++) adapter.step(1 / 120);
    assert.equal(match.currentInnings.runs, atFinish ? 0 : 4);
    adapter.dispose();
  }
});
for (const index of [5, 10, 15, 20, 25, 29]) test(`ground ball rebounds from six-ramp support ${index}`, () => {
  const { engine, adapter } = setup(), p = table.ramps[0].points[index];
  flight(engine, p.x - .18, p.z, 0);
  engine.ball.velocity.x = 3;
  let supportHit = false;
  engine.on('wall-hit', hit => { if (hit.id.startsWith(`six-support-${index}-`)) supportHit = true; });
  for (let i = 0; i < 12; i++) adapter.step(1 / 120);
  // The first support is inside the low deck envelope, so the deck blocks first.
  if (index === 5) assert(engine.ball.velocity.x < 0);
  else assert(supportHit);
  assert.equal(engine.ball.height, 0); assert.equal(engine.ramp, null);
  adapter.dispose();
});
test('high span admits a ground ball between supports, low span blocks side entry', () => {
  for (const index of [2, 12]) {
    const { engine, adapter } = setup(), points = table.ramps[0].points;
    const x = (points[index].x + points[index + 1].x) / 2, z = (points[index].z + points[index + 1].z) / 2;
    flight(engine, x - .3, z, 0); engine.ball.velocity.x = 3;
    for (let i = 0; i < 18; i++) adapter.step(1 / 120);
    if (index === 2) assert(engine.ball.position.x < x - table.ramps[0].halfWidth);
    else assert(engine.ball.position.x > x);
    assert.equal(engine.ball.height, 0); assert.equal(engine.ramp, null);
    adapter.dispose();
  }
});
test('single gate scores through its mouth but rejects a shot aimed at a post', () => {
  for (const offset of [0, .14]) {
    const { engine, match, adapter } = setup();
    const gate = table.deliveryZones.find(z => z.id === 'one-gate');
    flight(engine, gate.position[0] + offset, gate.entryZ + .12, 3);
    for (let i = 0; i < 12; i++) adapter.step(1 / 120);
    assert.equal(match.currentInnings.runs, offset ? 0 : 1);
    adapter.dispose();
  }
});
test('strong ramp shot climbs to deck height and scores six only at the finish', () => {
  const { engine, match, adapter } = setup();
  const start = table.ramps[0].points[0], end = table.ramps[0].points.at(-1);
  flight(engine, start.x, start.z + .05, 7);
  let entered = 0, completed = 0, maxHeight = 0;
  engine.on('ramp-enter', () => entered++);
  engine.on('ramp-complete', () => completed++);
  for (let i = 0; i < 480 && !match.deliveryHistory.length; i++) {
    adapter.step(1 / 120); maxHeight = Math.max(maxHeight, engine.ball.height);
    if (!completed) assert.equal(match.currentInnings.runs, 0);
  }
  assert.equal(entered, 1); assert.equal(completed, 1);
  assert.equal(match.currentInnings.runs, 6); assert.equal(match.currentInnings.balls, 1);
  assert(Math.abs(maxHeight - end.height) < .001);
  const position = { ...engine.ball.position };
  adapter.step(.05); assert.deepEqual(engine.ball.position, position);
  assert.equal(match.currentInnings.runs, 6);
  engine.resetBall(); assert.equal(engine.ball.height, 0); assert.equal(engine.ramp, null); assert.equal(engine.completedRoute, null);
  adapter.dispose();
});
test('weak ramp shot rolls back onto the field without awarding six', () => {
  const { engine, match, adapter } = setup();
  const start = table.ramps[0].points[0];
  flight(engine, start.x, start.z + .02, 2);
  let rollback = false, rose = false;
  engine.on('ramp-exit', () => rollback = true);
  for (let i = 0; i < 480 && !rollback; i++) { adapter.step(1 / 120); rose ||= engine.ball.height > .05; }
  assert(rose); assert(rollback); assert.equal(engine.ball.height, 0);
  assert.equal(match.currentInnings.runs, 0); assert.equal(engine.completedRoute, null);
  adapter.dispose();
});
test('ground-level crossing beneath the six finish cannot score', () => {
  const { engine, match, adapter } = setup();
  const end = table.ramps[0].points.at(-1);
  flight(engine, end.x, end.z + .15, 3);
  for (let i = 0; i < 15; i++) adapter.step(1 / 120);
  assert.equal(match.currentInnings.runs, 0); assert.equal(engine.completedRoute, null);
  adapter.dispose();
});
test('ramp completion without bat contact does not award runs', () => {
  const { engine, match, adapter } = setup();
  const start = table.ramps[0].points[0];
  flight(engine, start.x, start.z + .05, 7, false);
  for (let i = 0; i < 240; i++) adapter.step(1 / 120);
  assert.equal(engine.completedRoute, 'six-ramp'); assert.equal(match.currentInnings.runs, 0);
  adapter.dispose();
});
for (const line of ['LEFT', 'CENTRE', 'RIGHT']) for (const charge of [.2, .5, 1]) {
  test(`stadium bowling ${line} at ${charge}: guidance releases before the bats, one counted ball`, () => {
    const { engine, match, adapter } = setup();
    engine.releaseLaunch({ line, charge });
    let release = null;
    for (let i = 0; i < 2400 && !match.deliveryHistory.length; i++) {
      const guided = engine.launcher.deliveryGuideActive;
      adapter.step(1 / 120);
      if (guided && !engine.launcher.deliveryGuideActive) release = { ...engine.ball.position };
    }
    assert(release); assert(release.z < 1.72);
    if (line === 'LEFT') assert(release.x < -.4);
    if (line === 'RIGHT') assert(release.x > .4);
    if (line === 'CENTRE') assert(Math.abs(release.x) < .01);
    assert.equal(match.currentInnings.balls, 1);
    assert.equal(match.currentInnings.runs, 0);
    adapter.dispose();
  });
}
