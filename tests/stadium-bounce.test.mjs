import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { StadiumEngine } from '../src/cricket-pinball/game/stadium-engine.js';
import { createStadiumTable } from '../src/cricket-pinball/game/stadium-layout.js';
const table = createStadiumTable(JSON.parse(fs.readFileSync(new URL('../public/game/cricket-table.json', import.meta.url))));

for (const type of Object.keys(table.launcher.deliveryTypes)) {
  test(`${type}: real flight, one pitch impact, rebound and correct movement across lines/powers`, () => {
    for (const line of ['LEFT', 'CENTRE', 'RIGHT']) for (const charge of [.2, .5, 1]) {
      const engine = new StadiumEngine(structuredClone(table));
      const impacts = []; let peak = 0, rebound = false;
      engine.on('delivery-bounce', event => impacts.push(event));
      engine.releaseLaunch({line, charge, deliveryType:type});
      for (let i=0; i<800 && engine.ball.active; i++) {
        engine.step(1/120);
        if (!engine.launcher.inLane) peak = Math.max(peak, engine.ball.height);
        if (impacts.length && engine.ball.height > .01) rebound = true;
        assert(engine.ball.height >= 0);
      }
      assert(peak > .07, `${line}/${charge}: ball must visibly leave pitch`);
      assert.equal(impacts.length, 1, `${line}/${charge}: single delivery impact`);
      const impact = impacts[0];
      assert(impact.z > 1.4 && impact.z < 1.9, `pitch length: ${impact.z}`);
      assert.equal(impact.height, 0);
      assert(rebound, 'ball rises again after pitch impact');
      const dx = impact.velocity.x - impact.beforeVelocity.x;
      if (type === 'SPIN_LEFT') assert(dx < -.7);
      if (type === 'SPIN_RIGHT') assert(dx > .7);
      if (type === 'PACE') assert.equal(dx, 0);
    }
  });
}

test('airborne ball clears bat; same planar overlap at blade height makes contact', () => {
  for (const height of [.4, .02]) {
    const engine = new StadiumEngine(structuredClone(table));
    const bat = engine.flippers.get('left'); bat.angle = 0;
    Object.assign(engine.ball, {height, position:{x:bat.config.pivot[0]+bat.config.length/2,z:bat.config.pivot[1]-.03},velocity:{x:0,z:3}});
    let hits = 0; engine.on('flipper-hit', () => hits++);
    engine.resolveFlipperCollision(bat);
    assert.equal(hits, height > .06 ? 0 : 1);
  }
});

test('freeze and reset cannot carry airborne motion into next delivery', () => {
  const engine = new StadiumEngine(structuredClone(table));
  engine.releaseLaunch({charge:.5,deliveryType:'SPIN_LEFT'});
  while (engine.launcher.inLane) engine.step(1/120);
  engine.step(.05); engine.freezeBall();
  const height = engine.ball.height;
  engine.step(.05); assert.equal(engine.ball.height,height);
  engine.resetBall(); assert.equal(engine.verticalVelocity,0); assert.equal(engine.deliveryFlight,false);
  assert.equal(engine.deliveryVariation,null);
});
