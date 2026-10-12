import {mkdir, writeFile, readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.argv[2]||'.', output=process.argv[3]||'docs/football-pinball/evidence-pvp-quality/current.json';
const {createMatch}=await import(pathToFileURL(resolve(root,'src/football-pinball/core/match-engine.js')));
const results=[];
for(const difficulty of ['easy','medium','hard']) for(const strategy of ['periodic','reactive']) for(const seed of [11,22,33,44]) {
 const e=await createMatch({mode:'pvp',format:'quick',difficulty,seed});
 let live=0,slow=0,speedSum=0,kick=null,opponentTouch=false,ownGoals=0,goals=0,recoveries=0,bootShots=0,attacks=0,attacked=false;
 let lastBootTick=0,maxBootGap=0,lastContactTick=0,maxQuiet=0,playerMovement=0;
 const initial=e.targets.filter(t=>t.type==='player').map(t=>({id:t.id,x:t.x}));
 const emit=e.emit;
 e.emit=function(type,payload={}){
  if(type==='BALL_LAUNCHED'){kick=null;opponentTouch=false;attacked=false;lastContactTick=this.activeTicks;}
  if(type==='COLLISION'){
   const t=this.boots.find(b=>b.id===payload.targetId)||this.targets.find(t=>t.id===payload.targetId);
   if(t?.team){lastContactTick=this.activeTicks;if(kick&&t.team!==kick.team)opponentTouch=true;}
  }
  if(type==='BOOT_STRIKE'||type==='PLAYER_KICK'){
   kick={team:payload.actorId,tick:this.activeTicks};opponentTouch=false;attacked=false;
   if(type==='BOOT_STRIKE'){bootShots++;maxBootGap=Math.max(maxBootGap,this.activeTicks-lastBootTick);lastBootTick=this.activeTicks;}
  }
  if(type==='GOAL_SCORED'){goals++;if(kick&&kick.team!==payload.actorId&&!opponentTouch)ownGoals++;}
  if(type==='BALL_UNSTUCK')recoveries++;
  return emit.call(this,type,payload);
 };
 e.start();
 for(let i=0;i<36000&&e.state!=='ended';i++){
  if(e.state==='choice')e.command({type:'choose',choice:'kickoff'});
  if(e.state==='active'){
   const b=e.balls[0],p=b?.body.translation(),v=b?.body.linvel();
   if(v){const s=Math.hypot(v.x,v.z);live++;speedSum+=s;if(s<6)slow++;
    if(kick&&!attacked){const direction=kick.team===e.bottomTeam?-1:1;
     if(p.z*direction>2.5&&v.z*direction>2){attacks++;attacked=true;}}
   }
   maxQuiet=Math.max(maxQuiet,e.activeTicks-lastContactTick);
   for(const boot of e.boots.filter(b=>b.team==='blue')){
    const down=strategy==='periodic'?(i+(boot.x>0?17:0))%55<12:!!p&&Math.abs(-p.z-boot.y)<.55&&Math.abs(p.x-boot.x)<1.9&&i%36<12;
    e.setInput(boot.id,down);
   }
   for(const t of e.targets.filter(t=>t.type==='player'))playerMovement=Math.max(playerMovement,Math.abs(t.x-initial.find(q=>q.id===t.id).x));
  }
  e.step();
 }
 results.push({difficulty,strategy,seed,state:e.state,seconds:e.tick/120,activeSeconds:live/120,score:{...e.score},goals,uncontestedOwnGoals:ownGoals,
  meanSpeed:speedSum/live,belowKickoffSpeedFraction:slow/live,bootShots,attacks,recoveries,maxQuietSeconds:maxQuiet/120,maxBootGapSeconds:maxBootGap/120,playerMovement});
 e.dispose();
}
const total=k=>results.reduce((n,r)=>n+r[k],0), duration=total('activeSeconds'),times=results.map(r=>r.seconds).sort((a,b)=>a-b);
const summary={matches:results.length,finished:results.filter(r=>r.state==='ended').length,medianSeconds:(times[11]+times[12])/2,maxSeconds:times.at(-1),
 goals:total('goals'),uncontestedOwnGoals:total('uncontestedOwnGoals'),meanSpeed:results.reduce((n,r)=>n+r.meanSpeed*r.activeSeconds,0)/duration,
 belowSixFraction:results.reduce((n,r)=>n+r.belowKickoffSpeedFraction*r.activeSeconds,0)/duration,
 attacksPerMinute:total('attacks')/duration*60,bootShotsPerMinute:total('bootShots')/duration*60,recoveriesPerMinute:total('recoveries')/duration*60,
 longestNoPlayerContactSeconds:Math.max(...results.map(r=>r.maxQuietSeconds))};
const report={method:'24 seeded production-physics matches; blue uses periodic or proximity-based inputs against each CPU difficulty. No ball/state/score overrides. Uncontested own goal = conceding side made the last powered kick, with no opposing player/boot contact afterward. Attack = that kick reaches the attacking third moving forward. Speed below six is a constant before/after benchmark, not a device FPS measurement. Five-minute observation limit.',summary,results};
await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify(summary,null,2));
if(process.argv[4]){
 const baseline=JSON.parse(await readFile(process.argv[4],'utf8')).summary;
 assert.equal(summary.finished,summary.matches,'every game must finish through goals');
 assert(summary.uncontestedOwnGoals/summary.goals<baseline.uncontestedOwnGoals/baseline.goals*.5,'reduce unforced own-goal sequences');
 assert(summary.belowSixFraction<baseline.belowSixFraction*.6,'reduce low-speed playing time');
 assert(summary.attacksPerMinute>baseline.attacksPerMinute*1.5,'more forward attacks must reach the attacking third');
 assert(summary.bootShotsPerMinute>baseline.bootShotsPerMinute*1.5,'boots must remain actively involved');
 assert(summary.longestNoPlayerContactSeconds<8,'no long midfield orbits');
 assert(results.every(r=>r.playerMovement>.1),'outfield players must move');
 console.log('Rally quality comparison passed.');
}
