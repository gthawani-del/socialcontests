import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch} from '../src/football-pinball/core/match-engine.js';

const step = (e, n) => { for (let i = 0; i < n; i++) e.step(); };
async function setup(options = {}) {
  const e = await createMatch({mode:'pvp', seed:11, opponent:'human', ...options});
  e.start(); step(e, 120);
  if (e.state === 'choice') e.command({type:'choose',choice:'kickoff'});
  step(e, 180);
  return e;
}
function place(e, x, y, vx = 0, vy = 0, height = .15, lift = 0) {
  const ball = e.balls[0];
  ball.body.setTranslation({x, y:height, z:-y}, true);
  ball.body.setLinvel({x:vx, y:lift, z:-vy}, true);
  ball.body.setAngvel({x:0,y:0,z:0}, true);
  return ball;
}
function bootBall(e, boot, along = .65, front = .48) {
  const spin = Math.sign(boot.active - boot.rest);
  return place(e, boot.x + Math.cos(boot.rest) * along - Math.sin(boot.rest) * spin * front,
    boot.y + Math.sin(boot.rest) * along + Math.cos(boot.rest) * spin * front);
}

for (const id of ['blue-left','blue-right','red-left','red-right']) {
  test(`${id}: real swing drives a strong forward shot and one power event`, async () => {
    const e = await setup();
    try {
      const boot = e.boots.find(b => b.id === id), ball = bootBall(e, boot);
      e.setInput(id, true);
      let strike;
      for (let i=0;i<8;i++) {
        e.step();
        strike = e.events.find(v => v.type === 'BOOT_STRIKE' && v.targetId === id);
        if (strike) break;
      }
      assert(strike, 'real Rapier contact must produce a powered shot');
      const v = ball.body.linvel();
      assert(Math.hypot(v.x,v.z) >= 10, JSON.stringify(v));
      assert(v.z * Math.sign(boot.y) > 8, 'shot travels toward opposing goal');
      assert(strike.payload.power >= 62, 'power feedback reflects horizontal shot');
      step(e, 12);
      assert.equal(e.events.filter(v=>v.type==='BOOT_STRIKE'&&v.targetId===id).length, 1);
    } finally { e.dispose(); }
  });
}

test('pressing while already in contact strikes; passive contact does not report power', async () => {
  const e = await setup();
  try {
    const boot = e.boots.find(b=>b.id==='blue-left');
    bootBall(e, boot, .75, .47);
    step(e, 2);
    assert(e.events.some(v=>v.type==='COLLISION'&&v.targetId===boot.id));
    assert.equal(e.events.filter(v=>v.type==='BOOT_STRIKE').length, 0);
    assert.equal(e.points.blue, 0, 'passive boot contact is not a scoring kick');
    e.setInput(boot.id,true); step(e, 8);
    assert.equal(e.events.filter(v=>v.type==='BOOT_STRIKE'&&v.targetId===boot.id).length,1);
  } finally { e.dispose(); }
});

test('limiting vertical lift preserves legal forward speed', async () => {
  const e = await setup();
  try {
    const ball = place(e, 0, 0, 14, 0, .7, 12);
    e.step();
    const v=ball.body.linvel();
    assert(v.y <= 2.20001);
    assert(v.x > 13.5, `forward speed was incorrectly reduced: ${v.x}`);
    assert(Math.hypot(v.x,v.y,v.z) <= 16.00001);
  } finally {e.dispose();}
});

for (const speed of [0, .12, 1]) test(`ball creeping at ${speed} recovers within half a second without points`, async () => {
  const e = await setup();
  try {
    const ball = place(e, 0, 0, speed);
    step(e, 48);
    assert(e.events.some(v=>v.type==='BALL_UNSTUCK'));
    assert(Math.hypot(ball.body.linvel().x, ball.body.linvel().z)>5);
    assert.deepEqual(e.score,{blue:0,red:0});
    assert.deepEqual(e.points,{blue:0,red:0});
  } finally {e.dispose();}
});

test('slow ball on top of a boot recovers without waiting to touch the pitch',async()=>{
  const e=await setup();
  try{
    const boot=e.boots.find(b=>b.id==='blue-right');
    place(e,boot.x+Math.cos(boot.rest),boot.y+Math.sin(boot.rest),0,0,.49);
    const start=e.events.length;
    step(e,90);
    assert(e.events.slice(start).some(v=>v.type==='BALL_UNSTUCK'));
    assert.deepEqual(e.points,{blue:0,red:0});
  }finally{e.dispose();}
});

for (const sign of [-1,1]) for (const swapped of [false,true]) {
  test(`escaped ball behind end ${sign}, swapped=${swapped}: one restart for defender, no goal`, async () => {
    const e=await setup();
    try {
      if(swapped){e.bottomTeam='red';e.assignSides();}
      const defender=sign<0?e.bottomTeam:e.bottomTeam==='blue'?'red':'blue';
      e.kickoffTeam=defender==='blue'?'red':'blue';
      place(e,1.7,sign*5.45);
      e.step();
      assert.equal(e.state,'relaunch');
      assert.equal(e.kickoffTeam,defender);
      assert.deepEqual(e.score,{blue:0,red:0});
      assert.equal(e.balls.length,0);
      assert.equal(e.snapshot().restart.team,defender);
      assert.equal(e.transitionTick-e.tick,60);
      step(e,59);assert.equal(e.balls.length,0);
      e.step();
      assert.equal(e.state,'active');
      assert.equal(e.balls.length,1);
      assert.equal(e.events.filter(v=>v.type==='BALL_OUT_OF_PLAY').length,1);
      assert.equal(e.events.filter(v=>v.type==='GOAL_SCORED').length,0);
      assert.equal(e.events.findLast(v=>v.type==='KICKOFF').actorId,defender);
    }finally{e.dispose();}
  });
}

test('goal-post rebound stays live without awarding a goal or restart',async()=>{
  const e=await setup();
  try{
    const ball=place(e,1.15,4.65,0,5);
    for(let i=0;i<18;i++){
      e.step();
      if(e.events.some(v=>v.type==='COLLISION'&&/^(goal-side-|end-)/.test(v.targetId)))break;
    }
    assert(e.events.some(v=>v.type==='COLLISION'&&/^(goal-side-|end-)/.test(v.targetId)));
    assert.equal(e.state,'active');
    assert.deepEqual(e.score,{blue:0,red:0});
    assert.equal(e.events.filter(v=>v.type==='BALL_OUT_OF_PLAY').length,0);
    assert(ball.body.linvel().z>0,'post returns ball to playfield');
  }finally{e.dispose();}
});

for(const sign of [-1,1]) test(`shot past boots at end ${sign} scores through an open goal`,async()=>{
  const e=await setup();
  try{
    assert.deepEqual(e.snapshot().keepers,[]);
    assert(![...e.names.values()].some(n=>n.type==='keeper'),'no invisible keeper collider');
    place(e,0,sign*4.05,0,sign*5);
    for(let i=0;i<40&&e.state==='active';i++)e.step();
    assert.equal(e.state,'relaunch');
    assert.equal(e.events.filter(v=>v.type==='KEEPER_SAVE').length,0);
    assert.equal(e.events.filter(v=>v.type==='GOAL_SCORED').length,1);
    const scoringTeam=sign>0?'blue':'red',concedingTeam=sign>0?'red':'blue';
    assert.equal(e.score[scoringTeam],1);
    assert.equal(e.points[scoringTeam],500);
    assert.equal(e.kickoffTeam,concedingTeam);
    assert.equal(e.transitionTick-e.tick,60,'half-second goal restart');
    step(e,59);assert.equal(e.balls.length,0);
    e.step();assert.equal(e.state,'active');assert.equal(e.balls.length,1);
    assert(Math.hypot(e.balls[0].body.linvel().x,e.balls[0].body.linvel().z)>=6);
  }finally{e.dispose();}
});

for(const role of ['defender','midfielder','striker']) for(const team of ['blue','red'])
 test(`${team} ${role} preserves a fast incoming shot through physical contact`,async()=>{
  const e=await setup();
  try{
    const t=e.targets.find(t=>t.type==='player'&&t.team===team&&t.role===role);
    const receiver=e.targets.find(r=>r.type==='player'&&r.team===team&&r.role===(role==='defender'?'midfielder':'striker'));
    const dest=role==='striker'?{x:t.x>0?-.62:.62,y:-t.homeSign*5}:receiver;
    const dx=dest.x-t.x,dy=dest.y-t.y,n=Math.hypot(dx,dy),gap=t.radius+e.ballRadius+.1;
    const ball=place(e,t.x+dx/n*gap,t.y+dy/n*gap,-dx/n*14,-dy/n*14);
    let kick;
    for(let i=0;i<12;i++){
      e.step();kick=e.events.find(v=>v.type==='PLAYER_KICK'&&v.targetId===t.id);if(kick)break;
    }
    assert(kick,'physical front contact must trigger the pass');
    const v=ball.body.linvel();assert(Math.hypot(v.x,v.z)>13.8,JSON.stringify(v));
    assert(v.x*dx-v.z*dy>0,'fast pass must still aim toward the receiver');
    assert.equal(e.events.filter(v=>v.type==='PLAYER_KICK'&&v.targetId===t.id).length,1);
  }finally{e.dispose();}
 });

test('pass target preserves incoming shot momentum',async()=>{
  const e=await setup();
  try{
    const t=e.targets.find(t=>t.type==='pass');
    const ball=place(e,t.x-t.radius-e.ballRadius-.1,t.y,14,0);
    let hit;
    for(let i=0;i<12;i++){
      e.step();hit=e.events.find(v=>v.type==='TARGET_HIT'&&v.targetId===t.id);if(hit)break;
    }
    assert(hit);assert(Math.hypot(ball.body.linvel().x,ball.body.linvel().z)>13.8);
  }finally{e.dispose();}
});

for(const difficulty of ['easy','medium','hard']) test(`CPU ${difficulty} times real approaching balls and returns them with power`,async()=>{
  let hits=0;
  for(const seed of [11,22,33]) {
    const e=await setup({opponent:'cpu',difficulty,seed});
    try{
    const boot=e.boots.find(b=>b.team==='red'&&b.id.endsWith('left'));
    const spin=Math.sign(boot.active-boot.rest), nx=-Math.sin(boot.rest)*spin, ny=Math.cos(boot.rest)*spin;
    place(e,boot.x+Math.cos(boot.rest)*.95+nx*1.3,boot.y+Math.sin(boot.rest)*.95+ny*1.3,-nx*4,-ny*4);
    let strike;
    for(let i=0;i<150&&e.state==='active';i++){
      e.step();strike=e.events.find(v=>v.type==='BOOT_STRIKE'&&v.actorId==='red');if(strike)break;
    }
    if(strike){hits++;assert(strike.payload.power>=62);}
    step(e,24);
    assert(!boot.pressed,'CPU releases after the shot');
    }finally{e.dispose();}
  }
  // Easy has an intentional 30% decision miss; success need not be universal.
  assert(hits >= (difficulty==='easy'?1:2),`${difficulty}: only ${hits}/3 physical returns`);
});
