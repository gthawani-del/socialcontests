import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlungerCharge} from '../src/cricket-pinball/game/plunger-charge.js';
const near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-10,`${actual} matches ${expected}`);

test('power follows current displacement; easing forward reduces it without firing',()=>{
 const p=createPlungerCharge();p.begin(100);p.move(200);assert.equal(p.power,1);
 p.move(150);near(p.power,.6);assert.equal(p.dragging,true);
 near(p.release(),.6);assert.equal(p.power,0);assert.equal(p.release(),null);
});
test('holding the same position cannot add power; small and full pulls release their own charge',()=>{
 for(const [distance,power] of [[10,.28],[50,.6],[100,1]]){
  const p=createPlungerCharge();p.begin(100);p.move(100+distance);
  for(let i=0;i<1200;i++)p.move(100+distance);
  near(p.power,power);near(p.release(),power);assert.equal(p.dragging,false);
 }
});
test('tap, forward movement, return to zero and cancellation never bowl',()=>{
 const p=createPlungerCharge();p.begin(100);assert.equal(p.release(),null);
 p.begin(100);p.move(70);assert.equal(p.release(),null);
 p.begin(100);p.move(200);p.move(100);assert.equal(p.release(),null);
 p.begin(100);p.move(180);p.cancel();p.move(160);assert.equal(p.release(),null);assert.equal(p.power,0);
});
test('short-screen stroke and keyboard reduction use the same current-power rule',()=>{
 const p=createPlungerCharge();p.begin(300,40);p.move(340);assert.equal(p.power,1);
 p.move(320);near(p.release(),.6);
 p.set(1);p.set(.5);near(p.release(),.6);
 p.set(.02);assert.equal(p.release(),null);assert.equal(p.charge,0);
});
