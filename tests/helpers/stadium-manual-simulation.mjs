// Scripted player input against real flight, collisions and scoring; no forced outcomes.
import fs from 'node:fs';
import {StadiumEngine} from '../../src/cricket-pinball/game/stadium-engine.js';
import {createStadiumTable} from '../../src/cricket-pinball/game/stadium-layout.js';
import {CricketMatchEngine} from '../../src/cricket-pinball/match/match-engine.js';
import {createCricketGameplayAdapter} from '../../src/cricket-pinball/game/gameplay-adapter.js';
const rules=JSON.parse(fs.readFileSync(new URL('../../public/game/cricket-rules.json',import.meta.url))),base=JSON.parse(fs.readFileSync(new URL('../../public/game/cricket-table.json',import.meta.url)));
export function run({difficulty='EASY',power=.5,bowler='MEDIUM',length='GOOD',target=null,type='PACE',start=Infinity,hold=Infinity,side='both',role='player',batConfig=null,details=false,repeatEvery=Infinity,returnGuide=true}={}){
 const table=createStadiumTable(base);
 if(batConfig)for(const bat of table.flippers)Object.assign(bat,batConfig);
 if(!returnGuide)for(const route of table.ramps)delete route.returnPoints;
 const engine=new StadiumEngine(table,{random:()=>.5});engine.setDifficulty(difficulty,rules.difficultyGameplay[difficulty]);
 const match=new CricketMatchEngine({format:'ONE_OVER',difficulty,players:[{id:'player'},{id:'cpu'}],maxWickets:2});match.assignRoles({battingPlayerId:role,bowlingPlayerId:role==='player'?'cpu':'player'});match.startInnings();
 let result=null,bounce=null,hit=null,used=false,released=false,furthestZ=Infinity,initialVelocity=null;
 const subsequentContacts=[];
 for(const event of ['flipper-hit','wall-hit','bumper-hit','slingshot-hit'])engine.on(event,e=>{if(initialVelocity)subsequentContacts.push({event,id:e.id,ms:engine.simTime*1000});});
 engine.on('delivery-bounce',()=>bounce=engine.simTime*1000);engine.on('flipper-hit',e=>{if(e.pressed&&!hit)hit={id:e.id,ms:engine.simTime*1000,z:e.z,angle:e.angleDeg,speed:e.angularVelocityDegPerSec}});
 const a=createCricketGameplayAdapter({engine,matchEngine:match,tableConfig:table,cricketRules:rules,random:()=>.5,onBatContact:()=>{initialVelocity={...engine.ball.velocity};},onResolved:(outcome,m)=>result={outcome,reason:m.reason},onDeadBall:()=>result={outcome:'DEAD'}});
 const selection={line:'CENTRE',power,type,bowler,length,target};match.beginDelivery(selection);a.armDelivery();engine.releaseLaunch({...selection,charge:power,deliveryType:type});
 for(let i=0;i<1800&&!result;i++){
  const ms=engine.simTime*1000;
  if(released&&ms>=start+repeatEvery){start+=repeatEvery;used=false;released=false;}
  if(!used&&ms>=start){for(const id of side==='both'?['left','right']:[side])engine.setFlipper(id,true);used=true;}
  if(used&&!released&&ms>=start+hold){engine.setFlipper('left',false);engine.setFlipper('right',false);released=true;}
  a.step(table.physics.fixedStep);
  if(hit)furthestZ=Math.min(furthestZ,engine.ball.position.z);
 }
 a.dispose();return {...result,bounce,hit,end:engine.simTime*1000,...(details?{furthestZ,initialVelocity,subsequentContacts}: {})};
}
