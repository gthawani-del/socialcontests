import {createMatch} from '../src/football-pinball/core/match-engine.js';
import {writeFileSync} from 'node:fs';
const results=[];
for(const strategy of ['idle','periodic','reactive'])for(const seed of [11,22,33]){
 const e=await createMatch({mode:'pvp',seed,format:'classic'});e.start();let maxHeight=0,maxCpuHold=0;const held=new Map();
 for(let i=0;i<80000&&e.state!=='ended';i++){
  if(e.state==='choice')e.command({type:'choose',choice:'kickoff'});
  if(e.state==='active'){
   const p=e.balls[0]?.body.translation();if(p)maxHeight=Math.max(maxHeight,p.y);
   for(const b of e.boots){
    if(b.team==='blue'){
     const down=strategy==='periodic'?(i+(b.x>0?17:0))%55<12:strategy==='reactive'&&!!p&&Math.abs(-p.z-b.y)<.55&&Math.abs(p.x-b.x)<1.9&&i%36<12;
     e.setInput(b.id,down);
    }else{held.set(b.id,b.pressed?(held.get(b.id)||0)+1:0);maxCpuHold=Math.max(maxCpuHold,held.get(b.id));}
   }
  }else held.clear();
  e.step();
 }
 results.push({strategy,seed,state:e.state,score:{...e.score},maxHeight,maxCpuHold,events:e.events.reduce((a,v)=>(a[v.type]=(a[v.type]||0)+1,a),{})});e.dispose();
}
const report={method:'Nine complete seeded classic PvP engine rounds. Idle, periodic and proximity-triggered automated blue inputs; CPU red. No score, ball, clock or state overrides. Diagnostic comparison, not human balancing or a phone performance benchmark.',results};
writeFileSync(process.argv[2]||'docs/football-pinball/evidence-balancing/after.json',JSON.stringify(report,null,2));
console.table(results.map(r=>({strategy:r.strategy,seed:r.seed,score:`${r.score.blue}:${r.score.red}`,goals:r.events.GOAL_SCORED||0,outs:r.events.BALL_OUT_OF_PLAY||0,maxCpuHold:r.maxCpuHold,maxHeight:r.maxHeight.toFixed(2)})));
if(results.some(r=>r.state!=='ended'))process.exitCode=1;
