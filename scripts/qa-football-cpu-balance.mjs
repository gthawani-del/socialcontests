import assert from 'node:assert/strict';
import {createMatch} from '../src/football-pinball/core/match-engine.js';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const count=Number(process.env.MATCHES || 60), results=[];
const seedFor=i=>createHash('sha256').update(`football-balance-v1:${i}`).digest().readUInt32LE();
function input(e,team,strategy,i){
 const p=e.balls[0]?.body.translation();
 for(const b of e.boots.filter(b=>b.team===team)) {
 const down=strategy==='periodic'?(i+(b.x>0?17:0))%55<12:
 !!p&&Math.abs(-p.z-b.y)<.55&&Math.abs(p.x-b.x)<1.9&&i%36<12;
 e.setInput(b.id,down);
 }
}
for(const difficulty of ['easy','medium','hard'])for(const strategy of ['periodic','reactive']) {
 const r={difficulty,strategy,matches:count,cpuWins:0,playerWins:0,draws:0,unfinished:0,cpuTossWins:0,timeLimits:[]};
 for(let n=0;n<count;n++) {
 const e=await createMatch({mode:'pvp',seed:seedFor(n),difficulty,format:'quick'});e.start(n%2?'tails':'heads');
 r.cpuTossWins+=Number(e.toss.winner==='red');
 for(let i=0;i<216100&&e.state!=='ended';i++){
 if(e.state==='choice')e.command({type:'choose',choice:'kickoff'});
 if(e.state==='active')input(e,'blue',strategy,i);
 e.step();
 }
 if(e.result?.reason==='time-limit'){
 assert.equal(e.result.winner,e.score.blue===e.score.red?null:e.score.blue>e.score.red?'blue':'red');
 r.timeLimits.push({seed:seedFor(n),score:{...e.score}});
 }
 if(e.state!=='ended')r.unfinished++;else if(e.result.winner==='red')r.cpuWins++;else if(e.result.winner==='blue')r.playerWins++;else r.draws++;
 e.dispose();
 }results.push(r);console.log(JSON.stringify(r));
}
// Identical controllers on both teams: swap team assignments between paired runs.
const symmetry={pairs:count,nearWins:0,farWins:0,draws:0};
for(let n=0;n<count;n++){
 for(const swapped of [false,true]){
 const e=await createMatch({mode:'pvp',opponent:'human',seed:seedFor(n),format:'quick'});
 if(swapped){e.bottomTeam='red';e.assignSides();}
 e.start(n%2?'tails':'heads');
 for(let i=0;i<216100&&e.state!=='ended';i++){
 if(e.state==='choice')e.command({type:'choose',choice:'kickoff'});
 if(e.state==='active'){input(e,'blue','reactive',i);input(e,'red','reactive',i);}e.step();
 }
 const winner=e.result?.winner;
 if(!winner)symmetry.draws++;else if(winner===e.bottomTeam)symmetry.nearWins++;else symmetry.farWins++;
 e.dispose();
 }
}
console.log(JSON.stringify({symmetry}));
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify({method:'Complete first-to-3 engine matches, SHA256-spread seeds, alternating toss calls. Scripted player inputs, not humans. Symmetry fixtures explicitly swap team ends before start. No ball, score or clock overrides.',results,symmetry},null,2));
if(results.some(r=>r.unfinished))process.exitCode=1;
