import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { StadiumEngine } from '../src/cricket-pinball/game/stadium-engine.js';
import { createStadiumTable } from '../src/cricket-pinball/game/stadium-layout.js';
import { chooseDeliveryType, chooseCpuBowling } from '../src/cricket-pinball/game/cpu-opponent.js';

const table = createStadiumTable(JSON.parse(fs.readFileSync(new URL('../public/game/cricket-table.json', import.meta.url))));
const rules = JSON.parse(fs.readFileSync(new URL('../public/game/cricket-rules.json', import.meta.url)));

test('weighted delivery selection is deterministic at known rolls', () => {
  const mix = { PACE: .5, SWING_LEFT: .25, SWING_RIGHT: .25 };
  assert.equal(chooseDeliveryType(mix, 0), 'PACE');
  assert.equal(chooseDeliveryType(mix, .6), 'SWING_LEFT');
  assert.equal(chooseDeliveryType(mix, .9), 'SWING_RIGHT');
});

test('hard CPU bowling uses the configured variation mix', () => {
  const sequence = [.4, .5, .92];
  let i = 0;
  const choice = chooseCpuBowling('HARD', rules.cpu, () => sequence[i++]);
  assert(['LEFT', 'CENTRE', 'RIGHT'].includes(choice.line));
  assert(choice.power >= rules.cpu.HARD.bowlingPowerMin && choice.power <= rules.cpu.HARD.bowlingPowerMax);
  assert.equal(choice.type, 'CUTTER_RIGHT');
});

test('swing delivery bends after guide release and emits one bounce', () => {
  const engine = new StadiumEngine(structuredClone(table));
  let bounces = 0;
  engine.on('delivery-bounce', () => bounces++);
  engine.releaseLaunch({ line: 'CENTRE', charge: .5, deliveryType: 'SWING_LEFT' });
  engine.launcher.inLane = false;
  engine.launcher.deliveryGuideActive = false;
  engine.ball.position.z = 1.7;
  engine.ball.velocity = { x: 0, z: 5 };
  engine.applyDeliveryVariation(.1);
  assert(engine.ball.velocity.x < 0);
  assert.equal(bounces, 1);
  engine.applyDeliveryVariation(.1);
  assert.equal(bounces, 1);
});

test('pace delivery preserves the legacy straight post-guide path', () => {
  const engine = new StadiumEngine(structuredClone(table));
  engine.releaseLaunch({ line: 'CENTRE', charge: .5, deliveryType: 'PACE' });
  engine.launcher.inLane = false;
  engine.launcher.deliveryGuideActive = false;
  engine.ball.position.z = 1.7;
  engine.ball.velocity = { x: 0, z: 5 };
  engine.applyDeliveryVariation(.1);
  assert.equal(engine.ball.velocity.x, 0);
});

test('hard movement scale bends more than easy movement scale', () => {
  const easy = new StadiumEngine(structuredClone(table));
  const hard = new StadiumEngine(structuredClone(table));
  for (const [engine, movementScale] of [[easy, .65], [hard, 1.35]]) {
    engine.releaseLaunch({ line: 'CENTRE', charge: .5, deliveryType: 'SWING_LEFT', movementScale });
    engine.launcher.inLane = false;
    engine.launcher.deliveryGuideActive = false;
    engine.ball.position.z = 1.7;
    engine.ball.velocity = { x: 0, z: 5 };
    engine.applyDeliveryVariation(.1);
  }
  assert(Math.abs(hard.ball.velocity.x) > Math.abs(easy.ball.velocity.x));
});

test('CPU bowling exposes configured movement progression', () => {
  const easy = chooseCpuBowling('EASY', rules.cpu, () => .2);
  const medium = chooseCpuBowling('MEDIUM', rules.cpu, () => .2);
  const hard = chooseCpuBowling('HARD', rules.cpu, () => .2);
  assert(easy.movementScale < medium.movementScale);
  assert(medium.movementScale < hard.movementScale);
});
