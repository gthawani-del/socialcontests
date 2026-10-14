import test from 'node:test';
import assert from 'node:assert/strict';
import {createDuel,matchWinner,duelScore,matchPressure} from '../src/football-pinball/penalty/engine.js';
import {createKeeper,stepKeeper,requestDive,keeperPose,keeperSaves,GOAL} from '../src/football-pinball/penalty/keeper.js';
import {bootContact,BALL_RADIUS,BOOT} from '../src/football-pinball/penalty/contact.js';
const run=(e,t)=>{for(let i=0;i<Math.round(t*120);i++)e.advance(1/120);};
const start=(first='you',total=5,format='standard')=>{const e=createDuel({total,format,random:()=>.25});e.toss('heads');run(e,2.2);e.choose(first);run(e,1.82);return e;};
function shot(side,release=.6,chargeAt=0){const e=start();run(e,chargeAt);e.startCharge(side);run(e,release-chargeAt);e.releaseCharge(side);run(e,.3);return e;}
test('release swings first; contact launches once and roles switch',()=>{
 const e=start();e.startCharge('left');run(e,.6);assert(e.releaseCharge('left'));assert.equal(e.state.flight,null);assert.equal(e.state.phase,'aim');assert(!e.releaseCharge('right'));run(e,.3);assert(e.state.flight);assert(e.state.flight.contact.distance<=BALL_RADIUS+BOOT.radius);run(e,2.5);assert.equal(e.state.history.you.length,1);assert.equal(e.state.turn,'cpu');assert.equal(e.state.events.filter(x=>x.type==='BOOT_CONTACT').length,1);
});
test('release timing and boot choice produce different physical angles',()=>{
 const early=shot('left',.3),late=shot('left',.7),right=shot('right',.3);
 assert(early.state.flight.target.x<late.state.flight.target.x-.1);assert(right.state.flight.target.x>early.state.flight.target.x+.4);
});
test('holding longer transfers more speed, without a separate timing meter',()=>{
 const strong=shot('right',.7),soft=shot('right',.7,.5);
 assert(strong.state.flight.duration<soft.state.flight.duration);assert(strong.state.flight.contact.surfaceSpeed>soft.state.flight.contact.surfaceSpeed);assert(!('timing' in (strong.state.charge||{})));
});
test('missing the contact area cannot manufacture a kick',()=>{
 assert.equal(bootContact({x:.5,y:.5,vx:0,vy:.1},'left',.2,4,.5),null);
 const e=shot('left',1.4);run(e,.5);assert.equal(e.state.flight,null);assert.equal(e.state.history.you[0],'miss');assert(!e.state.events.some(x=>x.type==='KICK'));
});
test('feed and both launched shots stay ahead of the flippers',()=>{
 for(const side of ['left','right']){const e=start();run(e,3);assert(e.state.ball.y<=.795);e.startCharge(side);run(e,.6);e.releaseCharge(side);for(let i=0;i<120*6;i++){e.advance(1/120);assert(e.state.ball.y<=.795+1e-9);}}
});
test('cancel and pause do not shoot and freeze input-driven movement',()=>{
 const e=start();e.startCharge('right');run(e,.3);e.cancelCharge();run(e,.1);assert(!e.state.swing&&!e.state.flight);e.startCharge('left');e.pause(true);const before=e.snapshot();run(e,10);assert.deepEqual(e.state.ball,before.ball);assert.equal(e.state.charge,null);assert(!e.releaseCharge('left'));e.pause(false);run(e,.1);assert(e.state.elapsed>before.elapsed);
});
test('CPU shows its windup before real boot contact; keeper can move during flight',()=>{
 const e=start('cpu');run(e,.45);assert(e.state.cue);assert.equal(e.state.flight,null);run(e,.7);assert(e.state.flight);assert(e.state.events.some(x=>x.type==='BOOT_CONTACT'));e.position(.65);const x=e.state.keeper.x;run(e,.05);assert(e.state.keeper.x>x);
});
test('CPU keeper observes flight before committing and dive locks direction',()=>{
 const e=shot('left');assert.equal(e.state.dive,null);run(e,.3);assert(e.state.dive);
 const k=start('cpu');assert(k.dive(.1,.2));assert(!k.dive(.9,.8));run(k,.3);assert.equal(k.state.keeper.mode,'airborne');
});
test('early victory and sudden death give equal opportunities',()=>{
 assert.equal(matchWinner({you:['goal','goal','goal'],cpu:['miss','miss','miss']},5),'you');
 assert.equal(matchWinner({you:['goal','goal','goal','goal'],cpu:['goal','goal','goal']},3),null);
 assert.equal(matchWinner({you:['goal','goal','goal','goal'],cpu:['goal','goal','goal','miss']},3),'you');
});
test('match pressure is based on actual win/elimination outcomes',()=>{
 const s={format:'standard',total:3,turn:'you',history:{you:['goal','miss'],cpu:['goal','goal','miss']}};assert.equal(matchPressure(s),'SCORE TO STAY IN');
 s.history={you:['goal','goal'],cpu:['miss','miss','goal']};assert.equal(matchPressure(s),'SCORE TO WIN');
 s.turn='cpu';s.history={you:['goal','goal','miss'],cpu:['goal','miss']};assert.equal(matchPressure(s),'SAVE TO WIN');
 s.format='fixed';s.first='cpu';s.history={you:[],cpu:['goal']};assert.equal(matchPressure(s),'SAVE TO STAY IN');
});
test('both formats and all difficulties finish, count once and keep fixed roles',()=>{
 for(const format of ['standard','fixed'])for(const difficulty of ['rookie','pro','elite'])for(const first of ['you','cpu']){
  let seed=81;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const e=createDuel({format,difficulty,total:3,random});e.toss('heads');
  for(let i=0;i<120*180&&e.state.phase!=='ended';i++){
   const s=e.state;if(s.phase==='choice')e.choose(first);
   if(s.phase==='aim'&&s.turn==='you'&&!s.swing){if(!s.charge)e.startCharge('right');else if(s.elapsed>=.55)e.releaseCharge('right');}
   if(format==='fixed'&&['aim','flight','result'].includes(s.phase))assert.equal(s.turn,s.first);
   e.advance(1/120);
  }
  assert.equal(e.state.phase,'ended',`${format}/${difficulty}/${first}`);const count=e.state.history.you.length+e.state.history.cpu.length;run(e,10);assert.equal(e.state.history.you.length+e.state.history.cpu.length,count);
  if(format==='fixed'){const score=duelScore(e.state);assert.equal(score.you+score.cpu,count);}
 }
});
test('keeper accelerates, brakes, dives under gravity, recovers; saves follow hands',()=>{
 const k=createKeeper();k.move=1;stepKeeper(k,1/120);assert(k.vx>0&&k.vx<.2);for(let i=0;i<50;i++)stepKeeper(k,1/120);assert(k.x>.5);k.move=0;for(let i=0;i<40;i++)stepKeeper(k,1/120);assert.equal(k.vx,0);requestDive(k,.9,.1);for(let i=0;i<30;i++)stepKeeper(k,1/120);assert.equal(k.mode,'airborne');assert(k.vz>0);for(let i=0;i<250;i++)stepKeeper(k,1/120);assert.equal(k.mode,'settled');
 const p=createKeeper(),hand=keeperPose(p).lh;assert(keeperSaves(p,{x:hand.x/GOAL.width+.5,y:1-hand.z/GOAL.height}));assert(!keeperSaves(p,{x:.02,y:.02}));
});
