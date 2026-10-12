import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch} from '../src/football-pinball/core/match-engine.js';
import {MODE_RULES} from '../src/football-pinball/modes/rules.js';
import {verifyReplay} from '../src/football-pinball/core/replay.js';
const step=(e,n)=>{for(let i=0;i<n;i++)e.step();};
async function setup(){const e=await createMatch({mode:'pvp',seed:11,opponent:'human',format:'classic'});e.start();step(e,120);e.command({type:'choose',choice:'kickoff'});step(e,180);return e;}
function place(e,x,z,vx=0,vz=0){const b=e.balls[0];b.body.setTranslation({x,y:.15,z},true);b.body.setLinvel({x:vx,y:0,z:vz},true);b.body.setAngvel({x:0,y:0,z:0},true);b.stillTicks=0;return b;}

for(const swap of [false,true])for(const team of ['blue','red'])for(const role of ['defender','midfielder','striker'])
test(`${team} ${role} receives a rear friendly pass without a goalward rebound, swapped=${swap}`,async()=>{
 const e=await setup();try{
  if(swap){e.bottomTeam='red';e.assignSides();}
  const t=e.targets.find(t=>t.team===team&&t.role===role),gap=t.radius+e.ballRadius+.12;
  const ball=place(e,t.x,-t.y-t.homeSign*gap,0,t.homeSign*12);ball.controlTeam=team;
  let received=false,last=ball.body.translation();
  for(let i=0;i<60&&e.state==='active';i++){
   const n=e.events.length;e.step();const p=ball.body.translation();
   assert(Math.hypot(p.x-last.x,p.z-last.z)<.3,'no reception teleport');last=p;
   const reception=e.events.slice(n).find(v=>v.type==='PLAYER_KICK'&&v.targetId===t.id);
   if(reception){assert(reception.payload.friendlyReception);assert(ball.body.linvel().z*t.homeSign>=-1e-5);received=true;break;}
  }
  assert(received,'real rear contact receives a controlled friendly pass');
 }finally{e.dispose();}
});

for(const end of [-1,1])test(`slow ball trapped at end ${end} restarts without creating a goal`,async()=>{
 const e=await setup();try{
  place(e,0,end*4.55,0,end*.2);step(e,45);
  const event=e.events.find(v=>v.type==='BALL_OUT_OF_PLAY');
  assert.equal(event?.payload.reason,'trapped-ball');assert.equal(event.actorId,end>0?'blue':'red');
  assert.equal(e.state,'relaunch');assert.deepEqual(e.score,{blue:0,red:0});
  assert(!e.events.some(v=>v.type==='BALL_UNSTUCK'));
 }finally{e.dispose();}
});

test('all six player bodies move within separate lanes, settle on approach and pause exactly',async()=>{
 const e=await setup();try{
  const players=e.targets.filter(t=>t.type==='player'),moved=new Set();
  for(let i=0;i<360;i++){
   if(e.state==='relaunch')while(e.state==='relaunch')e.step();
   const before=players.map(t=>t.x);e.step();
   for(let j=0;j<players.length;j++){
    const t=players[j],tuning=MODE_RULES.pvp.playerMotion[t.role];
    assert(Math.abs(t.x-t.baseX)<=tuning.range+1e-8);assert(Math.abs(t.x-before[j])<=tuning.speed/120+1e-8);
    assert(Math.abs(t.body.translation().x-t.x)<1e-6);if(Math.abs(t.x-t.baseX)>.05)moved.add(t.id);
    for(const other of players.filter(q=>q!==t))assert(Math.hypot(t.x-other.x,t.y-other.y)>t.radius+other.radius+e.ballRadius*2);
   }
  }
  assert.equal(moved.size,6);
  const t=players[0],ball=place(e,t.x,-t.y+.65),x=t.x;e.movePlayers();assert.equal(t.x,x,'receiving player settles');
  e.pause();const before=e.snapshot();step(e,120);assert.deepEqual(e.snapshot(),before);
 }finally{e.dispose();}
});

test('a legitimate slow shot still crosses the goal line without a recovery boost or cancellation',async()=>{
 const e=await setup();try{
  place(e,0,-4.1,0,-1.5);step(e,120);
  assert.equal(e.score.blue,1);assert(!e.events.some(v=>v.type==='BALL_UNSTUCK'||v.type==='BALL_OUT_OF_PLAY'));
 }finally{e.dispose();}
});

test('movement and controlled receptions replay deterministically from real inputs',async()=>{
 const e=await createMatch({mode:'pvp',seed:33,opponent:'cpu',format:'classic'});try{
  e.start();for(let i=0;i<7200;i++){
   if(e.state==='choice')e.command({type:'choose',choice:'kickoff'});
   if(e.state==='active')for(const b of e.boots.filter(b=>b.team==='blue'))e.setInput(b.id,(i+(b.x>0?17:0))%55<12);
   e.step();
  }
  assert(e.events.some(v=>v.type==='PLAYER_KICK'&&v.payload.friendlyReception),'exercise real friendly receptions');
  const result=await verifyReplay(e.exportReplay());assert.equal(result.valid,true,JSON.stringify(result));
 }finally{e.dispose();}
});
