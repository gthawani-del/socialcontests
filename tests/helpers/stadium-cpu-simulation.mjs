import fs from 'node:fs';
import {StadiumEngine} from '../../src/cricket-pinball/game/stadium-engine.js';
import {createStadiumTable} from '../../src/cricket-pinball/game/stadium-layout.js';
import {createCpuBattingAI} from '../../src/cricket-pinball/game/cpu-opponent.js';
import {CricketMatchEngine} from '../../src/cricket-pinball/match/match-engine.js';
import {createCricketGameplayAdapter} from '../../src/cricket-pinball/game/gameplay-adapter.js';
const rules=JSON.parse(fs.readFileSync(new URL('../../public/game/cricket-rules.json',import.meta.url)));
const base=JSON.parse(fs.readFileSync(new URL('../../public/game/cricket-table.json',import.meta.url)));
export function simulate({difficulty='MEDIUM',line='CENTRE',power=.6,type='PACE',bowler,length,seed=1,config=rules.cpu}={}) {
 let n=seed;const random=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
 for(let i=0;i<32;i++)random();
 const table=createStadiumTable(base),engine=new StadiumEngine(table);
 engine.setDifficulty(difficulty,rules.difficultyGameplay[difficulty]);
 const cpu=createCpuBattingAI({engine,tableConfig:table,difficulty,cpuConfig:config,random});
 const match=new CricketMatchEngine({format:'ONE_OVER',difficulty,players:[{id:'player'},{id:'cpu'}],maxWickets:2});
 match.assignRoles({battingPlayerId:'cpu',bowlingPlayerId:'player'});match.startInnings();
 let result=null,hits=0;engine.on('flipper-hit',()=>hits++);
 const adapter=createCricketGameplayAdapter({engine,matchEngine:match,tableConfig:table,cricketRules:rules,random,onResolved:(outcome,m)=>result={outcome,reason:m.reason},onDeadBall:()=>result={outcome:'DEAD'}});
 const selection={line,power,type,...(bowler?{bowler}:{}),...(length?{length}:{})};
 cpu.observeDelivery(selection);match.beginDelivery(selection);adapter.armDelivery();engine.releaseLaunch({...selection,charge:power,deliveryType:type});
 for(let i=0;i<1800&&!result;i++) {cpu.update(engine.simTime*1000,true);adapter.step(1/120);}
 adapter.dispose();return {...(result||{outcome:'UNRESOLVED'}),hits};
}
