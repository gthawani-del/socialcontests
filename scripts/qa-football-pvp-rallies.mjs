import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createMatch} from '../src/football-pinball/core/match-engine.js';

const results=[];
for(const format of ['classic','quick']) for(const strategy of format==='classic'?['idle','periodic','reactive']:['periodic']) for(const seed of [11,22,33]) {
  const e=await createMatch({mode:'pvp',seed,format});e.start();
  let slow=0,maxSlow=0;
  for(let i=0;i<108000&&e.state!=='ended';i++){
    if(e.state==='choice')e.command({type:'choose',choice:'kickoff'});
    if(e.state==='active'){
      const ball=e.balls[0],p=ball?.body.translation(),v=ball?.body.linvel();
      slow=v&&Math.hypot(v.x,v.z)<1.5?slow+1:0;maxSlow=Math.max(maxSlow,slow);
      for(const b of e.boots.filter(b=>b.team==='blue')){
        const down=strategy==='periodic'?(i+(b.x>0?17:0))%55<12:strategy==='reactive'&&!!p&&Math.abs(-p.z-b.y)<.55&&Math.abs(p.x-b.x)<1.9&&i%36<12;
        e.setInput(b.id,down);
      }
    }else slow=0;
    e.step();
  }
  const strikes=e.events.filter(v=>v.type==='BOOT_STRIKE');
  results.push({format,strategy,seed,state:e.state,score:{...e.score},elapsedSeconds:e.tick/120,activeSeconds:e.activeTicks/120,
    longestSlowSeconds:maxSlow/120,strikes:strikes.length,minRecordedPower:Math.min(...strikes.map(v=>v.payload.power)),
    goals:e.events.filter(v=>v.type==='GOAL_SCORED').length,recoveries:e.events.filter(v=>v.type==='BALL_UNSTUCK').length});
  e.dispose();
}
const dir='docs/football-pinball/evidence-pvp-gameplay';await mkdir(dir,{recursive:true});
await writeFile(`${dir}/rallies.json`,JSON.stringify({method:'Production physics, 120 Hz, seeded default-medium CPU. Blue inputs are idle, periodic or proximity-triggered; no ball, score, clock or match-state overrides. First-to-three scenarios have a fifteen-minute diagnostic limit; this is not a gameplay time limit or a target match length. These are regression scenarios, not human balancing or device performance measurements.',results},null,2));
console.table(results);
assert(results.every(r=>r.state==='ended'),'every classic and quick match must complete');
assert(results.filter(r=>r.format==='quick').every(r=>Math.max(r.score.blue,r.score.red)===3),'quick matches must end from real goals');
assert(results.every(r=>r.longestSlowSeconds<1),'no sustained dead-ball stall');
assert(results.filter(r=>r.format==='classic'&&r.strategy!=='idle').every(r=>r.goals>0),'active-input rounds must create scoring chances');
