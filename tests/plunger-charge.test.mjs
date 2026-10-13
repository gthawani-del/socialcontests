import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlungerCharge} from '../src/cricket-pinball/game/plunger-charge.js';

test('pull latches power; lift never fires; forward push fires stored peak exactly once',()=>{
 const p=createPlungerCharge();p.begin(100);assert.equal(p.move(200),null);p.hold();
 assert.equal(p.power,1);assert.equal(p.dragging,false);
 p.begin(200);assert.equal(p.move(190),null);assert.equal(p.power,1);
 assert.equal(p.move(184),1);assert.equal(p.move(150),null);assert.equal(p.power,0);
});
test('partial pull and slow or fast push deliver the same stored power',()=>{
 for(const steps of [[140,135,130,124],[140,120]]){
  const p=createPlungerCharge();p.begin(100);p.move(140);let fired;
  for(const y of steps)fired=p.move(y)??fired;
  assert.equal(fired,.52);assert.equal(p.power,0);
 }
});
test('tap and forward push without charge do not launch; cancel restores prior latch',()=>{
 const p=createPlungerCharge();p.begin(100);assert.equal(p.move(70),null);p.hold();assert.equal(p.release(),null);
 p.begin(100);p.move(150);p.hold();const previous=p.power;
 p.begin(100);p.move(140);p.cancel();assert.equal(p.power,previous);
 p.begin(100);p.move(120);p.reset();assert.equal(p.move(50),null);assert.equal(p.power,0);
});
