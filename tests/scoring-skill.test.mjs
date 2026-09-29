import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateScoringOpportunity } from '../src/cricket-pinball/game/scoring-skill.js';

const cfg = {
  enabled: true,
  minQuality: { ONE: 0, TWO: .10, FOUR: .42, SIX: .55 },
  minImpactScore: { ONE: 0, TWO: .08, FOUR: .45, SIX: .65 },
  directionalOutcomes: ['FOUR', 'SIX'],
  directionalZoneMinX: .2,
  minDirectionalAlignment: .15,
  requiredIntent: { FOUR: 'ATTACK', SIX: 'ATTACK' }
};

test('one stays forgiving while six requires strong contact', () => {
  const weak = { quality: .16, impactScore: .2, directionBias: -.9, shotIntent: 'SAFE' };
  assert.equal(evaluateScoringOpportunity({ outcome: 'ONE', position: [-.6, 0] }, weak, cfg).qualified, true);
  assert.equal(evaluateScoringOpportunity({ outcome: 'SIX', position: [.6, 0] }, weak, cfg).qualified, false);
});

test('four and six require the correct shot side', () => {
  const strongLeft = { quality: .7, impactScore: .9, directionBias: -.8, shotIntent: 'ATTACK' };
  assert.equal(evaluateScoringOpportunity({ outcome: 'FOUR', position: [-.7, 0] }, strongLeft, cfg).qualified, true);
  assert.equal(evaluateScoringOpportunity({ outcome: 'SIX', position: [.7, 0] }, strongLeft, cfg).qualified, false);
});

test('centre four ignores left-right bias but still requires quality', () => {
  const strong = { quality: .55, impactScore: .8, directionBias: -1, shotIntent: 'ATTACK' };
  const weak = { quality: .25, impactScore: .8, directionBias: -1, shotIntent: 'SAFE' };
  assert.equal(evaluateScoringOpportunity({ outcome: 'FOUR', position: [0, 0] }, strong, cfg).qualified, true);
  assert.equal(evaluateScoringOpportunity({ outcome: 'FOUR', position: [0, 0] }, weak, cfg).qualified, false);
});

test('missing contact metadata keeps legacy synthetic tests valid', () => {
  assert.equal(evaluateScoringOpportunity({ outcome: 'SIX', position: [.7, 0] }, null, cfg).qualified, true);
});

test('safe intent cannot unlock a boundary even with enough raw impact', () => {
  const safe = { quality: .7, impactScore: .9, directionBias: -.8, shotIntent: 'SAFE' };
  const result = evaluateScoringOpportunity({ outcome: 'FOUR', position: [-.7, 0] }, safe, cfg);
  assert.equal(result.qualified, false);
  assert.equal(result.reason, 'SHOT_INTENT');
});

test('physical ramp route is directional proof even when contact bias disagrees', () => {
  const perfectButNeutral = { quality: .97, impactScore: 1, directionBias: .04, shotIntent: 'ATTACK' };
  const four = evaluateScoringOpportunity(
    { id: 'four-ramp', outcome: 'FOUR', position: [-1.1, -1.9], requiresRoute: 'four-ramp' },
    perfectButNeutral,
    cfg
  );
  const six = evaluateScoringOpportunity(
    { id: 'six-ramp', outcome: 'SIX', position: [1.1, -1.9], requiresRoute: 'six-ramp' },
    perfectButNeutral,
    cfg
  );
  assert.equal(four.qualified, true);
  assert.equal(four.routeProvesDirection, true);
  assert.equal(six.qualified, true);
  assert.equal(six.routeProvesDirection, true);
});

test('non-route boundary still uses contact direction', () => {
  const wrongWay = { quality: .8, impactScore: .9, directionBias: .8, shotIntent: 'ATTACK' };
  const result = evaluateScoringOpportunity(
    { id: 'open-four', outcome: 'FOUR', position: [-.7, 0] },
    wrongWay,
    cfg
  );
  assert.equal(result.qualified, false);
  assert.equal(result.reason, 'SHOT_DIRECTION');
});
