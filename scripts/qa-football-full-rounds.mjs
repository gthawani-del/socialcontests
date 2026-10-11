import {createMatch} from '../src/football-pinball/core/match-engine.js';
import {writeFileSync} from 'node:fs';
const results=[];
for(const mode of ['pvp','penalty','crash','arcade-rush'])for(const seed of [11,22,33]){
 const e=await createMatch({mode,seed,format:'classic'});e.start();let slow=0,maxSlow=0;
 for(let i=0;i<80000&&e.state!=='ended';i++){
  if(e.state==='choice')e.command({type:'choose',choice:'kickoff'});
  if(e.state==='active'){
   for(const boot of e.boots.filter(b=>b.team==='blue'))e.setInput(boot.id,(i+(boot.x>0?17:0))%55<12);
   const b=e.snapshot().balls[0];
   if(b&&Math.hypot(b.vx||0,b.vy||0)<.025)slow++;else slow=0;maxSlow=Math.max(slow,maxSlow);
  }
  e.step();
 }
 const s=e.snapshot();results.push({mode,seed,state:s.state,tick:s.tick,result:s.result,events:e.events.reduce((a,v)=>(a[v.type]=(a[v.type]||0)+1,a),{}),maxSlowTicks:maxSlow});e.dispose();
}
writeFileSync('docs/football-pinball/evidence-visual/full-rounds.json',JSON.stringify({method:'Full engine rounds with periodic blue boot input; no state, score, ball placement or clock overrides. Not a human skill or rendering benchmark.',results},null,2));
console.log(results.map(r=>({mode:r.mode,seed:r.seed,state:r.state,tick:r.tick,goals:r.events.GOAL_SCORED||0})));
if(results.some(r=>r.state!=='ended'||(['pvp','arcade-rush'].includes(r.mode)&&r.maxSlowTicks>480)))process.exitCode=1;
