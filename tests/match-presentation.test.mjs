import test from 'node:test';
import assert from 'node:assert/strict';
import {overs,deliveryCommentary} from '../src/cricket-pinball/game/match-presentation.js';
import {readFileSync} from 'node:fs';
test('scorecard over notation rolls over on the sixth ball',()=>{
 assert.equal(overs(0),'0.0');assert.equal(overs(5),'0.5');assert.equal(overs(6),'1.0');assert.equal(overs(12),'2.0');
});
test('commentary distinguishes rejected runs and dead balls from boundaries',()=>{
 assert.match(deliveryCommentary('DOT',{reason:'SKILL_REJECTED'}),/did not qualify/);
 assert.match(deliveryCommentary('DEAD_BALL'),/No score added/);
 assert.match(deliveryCommentary('WICKET',{reason:'RISK_WICKET'}),/mistimed/);
 assert.match(deliveryCommentary('SIX'),/SIX/);
 assert.notEqual(deliveryCommentary('ONE',{},1),deliveryCommentary('ONE',{},2));
});
test('bundled original effects contain valid non-silent PCM audio',()=>{
 for(const name of ['bat','flipper','rail','launch','wicket','crowd']){
  const b=readFileSync(new URL(`../public/audio/cricket/${name}.wav`,import.meta.url));
  assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');
  assert.equal(b.readUInt32LE(24),24000);assert.equal(b.readUInt16LE(34),16);
  assert(b.subarray(44).some(x=>x!==0));
 }
});
