import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createMatch} from '../src/football-pinball/core/match-engine.js';

const results=[],dir='docs/football-pinball/evidence-pvp-pacing';
const scenarios=[];
for(const difficulty of ['easy','medium','hard']) for(const strategy of ['periodic','reactive'])
  for(const seed of [11,22,33,44,55,66]) scenarios.push({format:'quick',difficulty,strategy,seed});
for(const strategy of ['idle','periodic','reactive']) for(const seed of [11,22,33])
  scenarios.push({format:'classic',difficulty:'medium',strategy,seed});
for(const config of scenarios){
  const {strategy,...options}=config;
  const e=await createMatch({mode:'pvp',...options});e.start();
  let slow=0,maxSlow=0,totalSpeed=0,samples=0;
  for(let i=0;i<36000&&e.state!=='ended';i++){
    if(e.state==='choice')e.command({type:'choose',choice:'kickoff'});
    if(e.state==='active'){
      const b=e.balls[0],p=b?.body.translation(),v=b?.body.linvel();
      if(v){const speed=Math.hypot(v.x,v.z);totalSpeed+=speed;samples++;slow=speed<2.5?slow+1:0;maxSlow=Math.max(maxSlow,slow);}
      for(const boot of e.boots.filter(b=>b.team==='blue')){
        const down=config.strategy==='periodic'?(i+(boot.x>0?17:0))%55<12:
          config.strategy==='reactive'&&!!p&&Math.abs(-p.z-boot.y)<.55&&Math.abs(p.x-boot.x)<1.9&&i%36<12;
        e.setInput(boot.id,down);
      }
    }else slow=0;
    e.step();
  }
  results.push({...config,state:e.state,score:{...e.score},elapsedSeconds:e.tick/120,activeSeconds:e.activeTicks/120,
    meanBallSpeed:totalSpeed/samples,longestSlowSeconds:maxSlow/120,
    goals:e.events.filter(v=>v.type==='GOAL_SCORED').length,
    bootShots:e.events.filter(v=>v.type==='BOOT_STRIKE').length,
    keeperSaves:e.events.filter(v=>v.type==='KEEPER_SAVE').length});
  e.dispose();
}
const quick=results.filter(r=>r.format==='quick'),times=quick.map(r=>r.elapsedSeconds).sort((a,b)=>a-b);
const baseline=JSON.parse(await readFile('docs/football-pinball/evidence-pvp-gameplay/rallies.json','utf8'));
const comparison=baseline.results.filter(r=>r.format==='quick').map(old=>({seed:old.seed,beforeSeconds:old.elapsedSeconds,
  afterSeconds:quick.find(r=>r.seed===old.seed&&r.difficulty==='medium'&&r.strategy==='periodic').elapsedSeconds}));
const summary={quickMatches:quick.length,medianSeconds:(times[17]+times[18])/2,p90Seconds:times[Math.ceil(times.length*.9)-1],
  shortestSeconds:times[0],longestSeconds:times.at(-1),comparison};
await mkdir(dir,{recursive:true});
await writeFile(`${dir}/matches.json`,JSON.stringify({method:'Production Rapier physics at 120 Hz, 36 first-to-three scenarios across all CPU difficulties and six seeds, plus nine timed rounds. Blue uses periodic/proximity-triggered taps (or idle in timed controls). No ball, score, clock or state overrides. Five-minute diagnostic limit; no new gameplay timeout. Match durations are simulated play, not human difficulty or iPhone performance measurements.',summary,results},null,2));
console.log(JSON.stringify(summary,null,2));
console.table(results.map(({format,difficulty,strategy,seed,score,elapsedSeconds,longestSlowSeconds})=>({format,difficulty,strategy,seed,score,elapsedSeconds,longestSlowSeconds})));
assert(results.every(r=>r.state==='ended'),'all scenarios must finish within the diagnostic limit');
assert(quick.every(r=>Math.max(r.score.blue,r.score.red)===3),'quick games must end from real goals');
assert(results.every(r=>r.keeperSaves===0),'no PvP keeper or save interruptions');
assert(results.every(r=>r.longestSlowSeconds<1),'no prolonged slow-ball stall');
assert(summary.medianSeconds<180,'median first-to-three pacing must be under three minutes');
assert(comparison.every(r=>r.afterSeconds<r.beforeSeconds*.6),'matched scenarios must improve materially');
