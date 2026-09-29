import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateScoringOpportunity } from '../src/cricket-pinball/game/scoring-skill.js';

const cfg = {
  enabled: true,
  minQuality: { ONE: 0, TWO: .10, FOUR: .42, SIX: .52 },
  minImpactScore: { ONE: 0, TWO: .08, FOUR: .45, SIX: .65 },
  directionalOutcomes: ['FOUR', 'SIX'],
  directionalZoneMinX: .2,
  minDirectionalAlignment: .15
};

test('one stays forgiving while six requires strong contact', () => {
  const weak = { quality: .16, impactScore: .2, directionBias: -.9 };
  assert.equal(evaluateScoringOpportunity({ outcome: 'ONE', position: [-.6, 0] }, weak, cfg).qualified, true);
  assert.equal(evaluateScoringOpportunity({ outcome: 'SIX', position: [.6, 0] }, weak, cfg).qualified, false);
});

test('four and six require the correct shot side', () => {
  const strongLeft = { quality: .7, impactScore: .9, directionBias: -.8 };
  assert.equal(evaluateScoringOpportunity({ outcome: 'FOUR', position: [-.7, 0] }, strongLeft, cfg).qualified, true);
  assert.equal(evaluateScoringOpportunity({ outcome: 'SIX', position: [.7, 0] }, strongLeft, cfg).qualified, false);
});

test('centre four ignores left-right bias but still requires quality', () => {
  const strong = { quality: .55, impactScore: .8, directionBias: -1 };
  const weak = { quality: .25, impactScore: .8, directionBias: -1 };
  assert.equal(evaluateScoringOpportunity({ outcome: 'FOUR', position: [0, 0] }, strong, cfg).qualified, true);
  assert.equal(evaluateScoringOpportunity({ outcome: 'FOUR', position: [0, 0] }, weak, cfg).qualified, false);
});

test('missing contact metadata keeps legacy synthetic tests valid', () => {
  assert.equal(evaluateScoringOpportunity({ outcome: 'SIX', position: [.7, 0] }, null, cfg).qualified, true);
});
