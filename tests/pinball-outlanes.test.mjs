import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PinballEngine } from '../src/physics/pinball-engine.js';

const config = JSON.parse(readFileSync(new URL('../public/game/table.json', import.meta.url), 'utf8'));

function liveBall(x, z, vx = 0, vz = 2) {
  const engine = new PinballEngine(config);
  engine.launcher.awaitingLaunch = false;
  engine.launcher.inLane = false;
  engine.ball.position = { x, z };
  engine.ball.velocity = { x: vx, z: vz };
  return engine;
}

test('left outlane drains and emits correct side', () => {
  const engine = liveBall(-1.20, 2.31);
  let detail;
  engine.on('drain', event => { detail = event; });
  engine.checkDrain();
  assert.equal(engine.ball.active, false);
  assert.equal(detail?.outlane, 'left');
});

test('right outlane drains and emits correct side', () => {
  const engine = liveBall(1.20, 2.31);
  let detail;
  engine.on('drain', event => { detail = event; });
  engine.checkDrain();
  assert.equal(engine.ball.active, false);
  assert.equal(detail?.outlane, 'right');
});

test('inlane above flippers remains in play', () => {
  const engine = liveBall(-0.80, 2.12);
  engine.checkDrain();
  assert.equal(engine.ball.active, true);
});

test('center drain still loses a ball', () => {
  const engine = liveBall(0, 2.70);
  engine.checkDrain();
  assert.equal(engine.ball.active, false);
});

test('stationary ball gets recovered, then eventually drained', () => {
  const engine = liveBall(0, 0, 0, 0);
  let attempts = 0;
  let drains = 0;
  engine.on('ball-unstuck', () => { attempts += 1; });
  engine.on('drain', () => { drains += 1; });
  for (let i = 0; i < 3; i++) {
    engine.ball.velocity = { x: 0, z: 0 };
    for (let n = 0; n < 900; n++) engine.checkStuckBall(1 / 120);
  }
  assert.equal(attempts, 2);
  assert.equal(drains, 1);
  assert.equal(engine.ball.active, false);
});

test('moving ball never triggers stuck recovery', () => {
  const engine = liveBall(0, 0, 1, 0);
  for (let i = 0; i < 3600; i++) engine.checkStuckBall(1 / 120);
  assert.equal(engine.ball.active, true);
  assert.equal(engine.stuckRecoveries, 0);
});
