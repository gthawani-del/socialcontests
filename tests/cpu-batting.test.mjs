import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCpuBattingAI } from '../src/cricket-pinball/game/cpu-opponent.js';

const rules = JSON.parse(fs.readFileSync(new URL('../public/game/cricket-rules.json', import.meta.url)));

function fakeEngine() {
  const calls = [];
  return {
    calls,
    ball: {
      active: true,
      position: { x: .5, z: 1.9 },
      velocity: { x: 0, z: 3 }
    },
    launcher: { deliveryType: 'PACE' },
    isAwaitingLaunch: () => false,
    setFlipper(side, pressed) { calls.push({ side, pressed }); }
  };
}

test('CPU schedules a visible reaction before swinging', () => {
  const engine = fakeEngine();
  const ai = createCpuBattingAI({
    engine,
    difficulty: 'MEDIUM',
    cpuConfig: rules.cpu,
    random: () => .99
  });
  ai.update(1000, true);
  const scheduled = ai.getState();
  assert(scheduled.scheduledSwingAt > 1000);
  assert.equal(scheduled.scheduledSide, 'right');
  assert.equal(engine.calls.filter(x => x.pressed).length, 0);
  ai.update(scheduled.scheduledSwingAt + 1, true);
  assert(engine.calls.some(x => x.side === 'right' && x.pressed));
});

test('hard CPU reacts sooner than easy CPU to the same ball', () => {
  const easyEngine = fakeEngine(), hardEngine = fakeEngine();
  const easy = createCpuBattingAI({ engine: easyEngine, difficulty: 'EASY', cpuConfig: rules.cpu, random: () => .99 });
  const hard = createCpuBattingAI({ engine: hardEngine, difficulty: 'HARD', cpuConfig: rules.cpu, random: () => .99 });
  easy.update(2000, true); hard.update(2000, true);
  assert(hard.getState().scheduledSwingAt < easy.getState().scheduledSwingAt);
});

test('CPU prediction uses the projected ball side rather than a fixed outcome', () => {
  const engine = fakeEngine();
  engine.ball.position.x = .34;
  engine.ball.position.z = 1.6;
  engine.ball.velocity.x = -1.6;
  engine.ball.velocity.z = 3;
  const ai = createCpuBattingAI({ engine, difficulty: 'HARD', cpuConfig: rules.cpu, random: () => .5 });
  ai.update(0, true);
  assert.equal(ai.getState().scheduledSide, 'left');
});

test('CPU reset clears scheduled and active bat state', () => {
  const engine = fakeEngine();
  const ai = createCpuBattingAI({ engine, difficulty: 'MEDIUM', cpuConfig: rules.cpu, random: () => .99 });
  ai.update(0, true);
  ai.reset();
  const state = ai.getState();
  assert.equal(state.scheduledSwingAt, null);
  assert.equal(state.activeSide, null);
  assert(engine.calls.some(x => x.side === 'left' && !x.pressed));
  assert(engine.calls.some(x => x.side === 'right' && !x.pressed));
});
