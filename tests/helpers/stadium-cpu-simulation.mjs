import fs from 'node:fs';
import {StadiumEngine} from '../../src/cricket-pinball/game/stadium-engine.js';
import {createStadiumTable} from '../../src/cricket-pinball/game/stadium-layout.js';
import {normalizeBowling} from '../../src/cricket-pinball/game/bowling-rules.js';
import {createCpuBattingAI} from '../../src/cricket-pinball/game/cpu-opponent.js';
import {CricketMatchEngine} from '../../src/cricket-pinball/match/match-engine.js';
import {createCricketGameplayAdapter} from '../../src/cricket-pinball/game/gameplay-adapter.js';
const rules=JSON.parse(fs.readFileSync(new URL('../../public/game/cricket-rules.json',import.meta.url)));
const base=JSON.parse(fs.readFileSync(new URL('../../public/game/cricket-table.json',import.meta.url)));
export function simulate({difficulty='MEDIUM',line='CENTRE',power=.6,type='PACE',bowler,length,seed=1,config=rules.cpu,trace=false,frameHz=60,repeats=0}={}) {
 let n=seed;const random=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
 for(let i=0;i<32;i++)random();
 const table=createStadiumTable(base),engine=new StadiumEngine(table,{random});
 engine.setDifficulty(difficulty,rules.difficultyGameplay[difficulty]);
 const cpu=createCpuBattingAI({engine,tableConfig:table,difficulty,cpuConfig:config,random});
 const match=new CricketMatchEngine({format:'ONE_OVER',difficulty,players:[{id:'player'},{id:'cpu'}],maxWickets:2});
 match.assignRoles({battingPlayerId:'cpu',bowlingPlayerId:'player'});match.startInnings();
 let result=null,hits=0,events=[];engine.on('flipper-hit',e=>{hits++;if(trace)events.push({kind:'hit',...e,height:engine.ball.height});});
 const adapter=createCricketGameplayAdapter({engine,matchEngine:match,tableConfig:table,cricketRules:rules,random,onResolved:(outcome,m)=>result={outcome,reason:m.reason},onDeadBall:()=>result={outcome:'DEAD'}});
 const selection=normalizeBowling({line,power,type,bowler:bowler || (['SPIN_LEFT','SPIN_RIGHT','FLIPPER','FLIGHTED'].includes(type)?'SPINNER':'MEDIUM'),length:length || 'GOOD'});
 for(let repeat=0;repeat<=repeats;repeat++)cpu.observeDelivery(selection);match.beginDelivery(selection);adapter.armDelivery();engine.releaseLaunch({...selection,charge:power,deliveryType:type});
 // Match the production accumulator: CPU decisions run at fixed physics
 // frequency even when rendering only runs at 30 Hz.
 let accumulator=0, previousSwing=null;
 if(trace)engine.on('delivery-bounce',()=>events.push({kind:'bounce',ms:engine.simTime*1000}));
 for(let frame=0;frame<15*frameHz&&!result;frame++) {
  accumulator+=Math.min(1/frameHz,table.physics.maxFrameDelta);
  while(accumulator>=table.physics.fixedStep&&!result) {
   cpu.update(engine.simTime*1000,true);
   if(trace){const state=cpu.getState();if(state.scheduledSwingAt!==previousSwing){events.push({kind:'decision',ms:engine.simTime*1000,...state});previousSwing=state.scheduledSwingAt;}}
   adapter.step(table.physics.fixedStep);
   accumulator-=table.physics.fixedStep;
  }
 }
 adapter.dispose();return {...(result||{outcome:'UNRESOLVED'}),hits,...(trace?{events}:{})};
}
