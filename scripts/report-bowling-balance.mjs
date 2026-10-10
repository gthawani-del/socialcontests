import {writeFile} from 'node:fs/promises';
import {BOWLERS,LENGTHS} from '../src/cricket-pinball/game/bowling-rules.js';
import {simulate} from '../tests/helpers/stadium-cpu-simulation.mjs';
const samples=Math.max(1,Number(process.env.BALANCE_SAMPLES)||100),rows=[];
for(const difficulty of ['EASY','MEDIUM','HARD'])for(const [bowler,profile] of Object.entries(BOWLERS))for(const type of profile.types)for(const length of Object.keys(LENGTHS)){
 const outcomes={};let contacts=0;
 for(let seed=1;seed<=samples;seed++){const result=simulate({difficulty,bowler,type,length,seed});outcomes[result.outcome]=(outcomes[result.outcome]||0)+1;if(result.hits)contacts++;}
 rows.push({difficulty,bowler,type,length,line:'CENTRE',power:.6,deliveries:samples,contacts,outcomes});
}
const report={fixture:`Seeded CPU versus centre deliveries. Seeds 1–${samples} per cell; 120Hz physics; production difficulty presets, standard initial CPU (no repeated-delivery adaptation), full innings/chase strategy not represented. Offline simulation, not player telemetry.`,rows};
await writeFile('docs/qa/bowling-profile-balance.json',JSON.stringify(report,null,2)+'\n');
console.log(`${rows.length*samples} simulated deliveries; ${rows.reduce((sum,r)=>sum+(r.outcomes.UNRESOLVED||0),0)} unresolved.`);
