import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBatContact, applyBatContactSkill } from '../src/cricket-pinball/game/batting-skill.js';

const cfg = {
  idealContactZ: 1.92,
  perfectHalfWindow: .18,
  timingSpan: .58,
  idealSwingProgress: .58,
  strongImpact: 8,
  steeringStrength: .035,
  maxLateralRatio: .92,
  steeringActivationRatio: .82,
  minPowerMultiplier: .98,
  maxPowerMultiplier: 1.06
};

test('batting timing classifies early, perfect and late contact', () => {
  assert.equal(evaluateBatContact({ id: 'left', pressed: true, z: 1.5, swingProgress: .58, impact: 8 }, cfg).timing, 'EARLY');
  assert.equal(evaluateBatContact({ id: 'left', pressed: true, z: 1.92, swingProgress: .58, impact: 8 }, cfg).timing, 'PERFECT');
  assert.equal(evaluateBatContact({ id: 'left', pressed: true, z: 2.3, swingProgress: .58, impact: 8 }, cfg).timing, 'LATE');
});

test('perfect contact earns more power than a mistimed contact', () => {
  const perfect = evaluateBatContact({ id: 'left', pressed: true, z: 1.92, swingProgress: .58, impact: 8 }, cfg);
  const mistimed = evaluateBatContact({ id: 'left', pressed: true, z: 1.42, swingProgress: .1, impact: 2 }, cfg);
  assert(perfect.quality > mistimed.quality);
  assert(perfect.powerMultiplier > mistimed.powerMultiplier);
});

test('timing and bat side change shot direction bias', () => {
  const earlyLeft = evaluateBatContact({ id: 'left', pressed: true, z: 1.5, swingProgress: .58, impact: 8 }, cfg);
  const lateLeft = evaluateBatContact({ id: 'left', pressed: true, z: 2.3, swingProgress: .58, impact: 8 }, cfg);
  const earlyRight = evaluateBatContact({ id: 'right', pressed: true, z: 1.5, swingProgress: .58, impact: 8 }, cfg);
  assert(earlyLeft.directionBias < 0);
  assert(lateLeft.directionBias > 0);
  assert(earlyRight.directionBias > 0);
});

test('skill steering changes an uncommitted shot but protects a committed boundary shot', () => {
  const engine = {
    config: { ball: { maxSpeed: 9.5 } },
    ball: { velocity: { x: 1, z: -5 } },
    limitBallSpeed() {}
  };
  const before = engine.ball.velocity.x / Math.hypot(engine.ball.velocity.x, engine.ball.velocity.z);
  const feedback = applyBatContactSkill(engine, { id: 'left', pressed: true, z: 1.5, swingProgress: .58, impact: 8 }, cfg);
  assert(feedback.lateralRatioAfter < before);

  const committed = {
    config: { ball: { maxSpeed: 9.5 } },
    ball: { velocity: { x: -8.9, z: -3.4 } },
    limitBallSpeed() {}
  };
  const committedBefore = committed.ball.velocity.x / Math.hypot(committed.ball.velocity.x, committed.ball.velocity.z);
  const protectedFeedback = applyBatContactSkill(committed, { id: 'left', pressed: true, z: 1.5, swingProgress: .9, impact: 8 }, cfg);
  assert.equal(protectedFeedback.lateralRatioAfter, committedBefore);
});
