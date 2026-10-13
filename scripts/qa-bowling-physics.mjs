import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {StadiumEngine} from '../src/cricket-pinball/game/stadium-engine.js';
import {createStadiumTable} from '../src/cricket-pinball/game/stadium-layout.js';
const table=createStadiumTable(JSON.parse(await readFile('public/game/cricket-table.json','utf8')));
const rows=[];
for(const [bowler,type] of [['FAST','PACE'],['MEDIUM','SWING_LEFT'],['SPINNER','SPIN_RIGHT']]) {
 const series=[];
 for(const power of [.3,.6,1]) {
  const engine=new StadiumEngine(structuredClone(table),{random:()=>.5});let bounce,laneExit,peak=0,afterPeak=0;
  engine.on('delivery-bounce',event=>bounce=event);
  engine.releaseLaunch({bowler,deliveryType:type,target:{x:0,z:1.66},charge:power});
  const launchSpeed=Math.hypot(engine.ball.velocity.x,engine.ball.velocity.z);
  let previous={...engine.ball.position},maxStep=0,ticks=0;
  for(;ticks<1600&&!bounce;ticks++){
   engine.step(1/120);maxStep=Math.max(maxStep,Math.hypot(engine.ball.position.x-previous.x,engine.ball.position.z-previous.z));previous={...engine.ball.position};
   if(!engine.launcher.inLane){laneExit??=ticks/120;peak=Math.max(peak,engine.ball.height);}
  }
  assert(bounce);assert(maxStep<.13,'continuous launch lane and flight');
  assert(Math.hypot(bounce.x,bounce.z-1.66)<.035,'actual bounce at aimed point');
  const bounceSeconds=ticks/120;
  for(let i=0;i<200&&engine.ball.active;i++){engine.step(1/120);afterPeak=Math.max(afterPeak,engine.ball.height);}
  const spinKick=bounce.velocity.x-bounce.beforeVelocity.x;
  if(type==='SPIN_RIGHT')assert(spinKick>.7);if(type==='PACE')assert.equal(spinKick,0);
  assert(peak>.05);assert(afterPeak<.09,'low rebound remains hittable');
  const row={bowler,type,power,launchSpeed,laneExitSeconds:laneExit,bounceSeconds,flightSeconds:bounceSeconds-laneExit,peakHeight:peak,reboundHeight:afterPeak,spinKick,bounce:{x:bounce.x,z:bounce.z},maxStep};
  series.push(row);rows.push(row);
 }
 for(let i=1;i<series.length;i++){assert(series[i].launchSpeed>series[i-1].launchSpeed,'higher charge increases actual velocity');assert(series[i].bounceSeconds<series[i-1].bounceSeconds,'higher charge shortens delivery time');}
}
await writeFile('docs/qa/bowling-physics.json',JSON.stringify({fixture:'Deterministic engine simulation at 120 Hz; centred dispersion sample; native arena units, not km/h.',rows},null,2)+'\n');
console.table(rows.map(r=>({bowler:r.bowler,power:r.power,speed:r.launchSpeed.toFixed(3),bounceSeconds:r.bounceSeconds.toFixed(3),rebound:r.reboundHeight.toFixed(3)})));
