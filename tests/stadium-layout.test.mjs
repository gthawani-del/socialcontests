import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PinballEngine } from '../src/physics/pinball-engine.js';
import { createStadiumTable, stadiumPoint } from '../src/cricket-pinball/game/stadium-layout.js';

const base = JSON.parse(fs.readFileSync(new URL('../public/game/cricket-table.json', import.meta.url)));
const table = createStadiumTable(base);
function movingBall(position, velocity) {
  const engine = new PinballEngine(structuredClone(table));
  Object.assign(engine.launcher, { awaitingLaunch: false, inLane: false, deliveryGuideActive: false });
  Object.assign(engine.ball, { position: { x: position[0], z: position[1] }, velocity: { x: velocity[0], z: velocity[1] }, active: true });
  return engine;
}
test('prototype leaves production configuration unchanged', () => {
  assert.equal(base.ball.radius, .095);
  assert.equal(base.walls.length, 5);
  assert.deepEqual(table.deliveryZones.map(z => z.outcome), base.deliveryZones.map(z => z.outcome));
});
test('a missed central ball passes resting bats and reaches the drain once', () => {
  const engine = movingBall(stadiumPoint(0, -3.8), [0, 2]);
  let drains = 0;
  engine.on('drain', event => { assert(!event.safetyReset); drains++; });
  for (let i = 0; i < 240; i++) engine.step(1 / 120);
  assert.equal(drains, 1);
});
for (const side of [-1, 1]) test(`oval boundary reflects ${side < 0 ? 'left' : 'right'} flight`, () => {
  const engine = movingBall([side * 1.45, 0], [side * 3, 0]);
  let boundaryHit = false;
  engine.on('wall-hit', hit => { if (hit.id.startsWith('stadium-boundary')) boundaryHit = true; });
  for (let i = 0; i < 12; i++) engine.step(1 / 120);
  assert(boundaryHit, 'the ball must hit the oval boundary, even if a lane rail then rebounds it again');
  assert(engine.ball.active);
});
for (const side of ['left', 'right']) test(`${side} bat makes contact with an approaching ball`, () => {
  const engine = movingBall([side === 'left' ? -.60 : .60, 1.9], [0, 2]);
  let contacts = 0;
  engine.on('flipper-hit', hit => { if (hit.id === side) contacts++; });
  engine.setFlipper(side, true);
  for (let i = 0; i < 60; i++) engine.step(1 / 120);
  assert(contacts > 0);
});
