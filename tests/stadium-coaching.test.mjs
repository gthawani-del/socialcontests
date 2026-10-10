import test from 'node:test';
import assert from 'node:assert/strict';
import {coachingStep} from '../src/cricket-pinball/game/stadium-coaching.js';
import {matchSituation,matchResultSummary,deliveryCommentary} from '../src/cricket-pinball/game/match-presentation.js';
test('coaching follows actual actions and physical events, dead balls do not complete it',()=>{
 let step=coachingStep('bowl',0,{type:'BOWLING_SELECTION'});assert.equal(step,1);
 step=coachingStep('bowl',step,{type:'LEVER_PULL'});assert.equal(step,2);
 step=coachingStep('bowl',step,{type:'DELIVERY_LAUNCH'});assert.equal(step,3);
 assert.equal(coachingStep('bowl',step,{type:'OUTCOME',outcome:'DEAD_BALL'}),3);
 assert.equal(coachingStep('bowl',step,{type:'DELIVERY_BOUNCE'}),4);
 assert.equal(coachingStep('bat',3,{type:'BAT_CONTACT'}),4);
 assert.equal(coachingStep('bat',3,{type:'BAT_INPUT',pressed:false}),3);
 assert.equal(coachingStep('bat',4,{type:'OUTCOME',outcome:'DOT'}),5);
});
test('final-ball tension uses match state and stops after result',()=>{
 const state={innings:2,roundInnings:2,target:12,requiredRuns:4,ballsRemaining:1};
 assert.equal(matchSituation(state),'4 needed from 1 ball · FINAL BALL');
 assert.equal(matchSituation({...state,result:{type:'TIE'}}),'');
 assert.equal(matchResultSummary({result:{winnerId:'player',margin:1,marginType:'RUNS'}}),'You won · 1 run');
});
test('dismissal commentary does not invent a wicket cause when metadata is absent',()=>{
 assert.equal(deliveryCommentary('WICKET'),'Wicket recorded.');
 assert.match(deliveryCommentary('WICKET',{reason:'WICKET_DRAIN'}),/wicket drain/);
});
