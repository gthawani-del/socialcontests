// Graybox tuning only. Later mode scoring is deliberately not implemented here.
export const FOUNDATION = Object.freeze({
  version: 'foundation-1', step: 1 / 120, maxFrame: 0.1,
  halfWidth: 3, goalPlane: 5, goalHalfWidth: 1.1,
  ballRadius: 0.13, maxSpeed: 16, bootLength: 1.55, bootRadius: 0.16,
});
export const MODE_IDS = Object.freeze(['pvp', 'crash', 'penalty', 'arcade-rush']);
export const BOOTS = Object.freeze([
  { id: 'blue-left', team: 'blue', x: -1.95, y: -3.7, rest: -0.35, active: 0.55 },
  { id: 'blue-right', team: 'blue', x: 1.95, y: -3.7, rest: Math.PI + 0.35, active: Math.PI - 0.55 },
  { id: 'red-left', team: 'red', x: -1.95, y: 3.7, rest: 0.35, active: -0.55 },
  { id: 'red-right', team: 'red', x: 1.95, y: 3.7, rest: Math.PI - 0.35, active: Math.PI + 0.55 },
]);
export const RAILS = Object.freeze([
  { id: 'left-rail', x: -3.1, y: 0, hx: 0.1, hy: 5.15 },
  { id: 'right-rail', x: 3.1, y: 0, hx: 0.1, hy: 5.15 },
  ...[-1, 1].flatMap(y => [-1, 1].map(x => ({
    id: `end-${x}-${y}`, x: x * 2.1, y: y * 5.1, hx: 1, hy: 0.1,
  }))),
  ...[-1, 1].flatMap(y => [-1, 1].map(x => ({
    id: `goal-side-${x}-${y}`, x: x * 1.2, y: y * 5.45, hx: 0.1, hy: 0.35,
  }))),
  ...[-1, 1].map(y => ({ id: `goal-back-${y}`, x: 0, y: y * 5.8, hx: 1.3, hy: 0.1 })),
]);
