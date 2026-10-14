import {FEED,bootContact,stepFeed} from './contact.js';
import { createKeeper, stepKeeper, requestDive, keeperSaves, keeperPose, GOAL } from './keeper.js';
// Normalised goal coordinates: x=0 left post, y=0 crossbar.
// CPU decisions use visible flight only; the human aim is never read by the CPU.
// The ball is staged on the pitch side of the boots, never in the rear drain.
export const BALL_START = Object.freeze({x:FEED.x,y:FEED.y});
export const LEVELS = {
  rookie: { reaction: .30, error: .20, flight: .95 },
  pro: { reaction: .23, error: .12, flight: .82 },
  elite: { reaction: .17, error: .07, flight: .72 },
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function matchWinner(history, total) {
  const a = history.you, b = history.cpu;
  const goals = list => list.filter(v => v === 'goal').length;
  const x = goals(a), y = goals(b);
  if (a.length <= total && b.length <= total) {
    if (x > y + total - b.length) return 'you';
    if (y > x + total - a.length) return 'cpu';
  }
  if (a.length >= total && a.length === b.length && x !== y) return x > y ? 'you' : 'cpu';
  return null;
}
export function createDuel({ total = 5, difficulty = 'rookie', format = 'standard', random = Math.random } = {}) {
  total = total === 3 ? 3 : 5;
  difficulty = LEVELS[difficulty] ? difficulty : 'rookie';
  const level = LEVELS[difficulty];
  const s = { phase:'setup', aspect:1.5, paused:false, total, difficulty, format:format==='fixed'?'fixed':'standard', elapsed:0, turn:'you',
    history:{you:[],cpu:[]}, aim:{x:.5,y:.5}, keeper:createKeeper(), dive:null, charge:null,
    flight:null, ball:{...FEED}, swing:null, cue:null, pressure:'', boots:{left:0,right:0}, events:[], winner:null, message:'' };
  let carry = 0, tick = 0, eventId = 0;
  const emit = (type, extra = {}) => { s.events.push({ id:++eventId, type, tick, ...extra }); if(s.events.length>32)s.events.shift(); };
  const phase = value => { s.phase=value; s.elapsed=0; };
  function beginAttempt() {
    s.aim={x:.5,y:.72}; s.keeper=createKeeper(s.turn==='you'?.35+random()*.3:.5); s.dive=null; s.flight=null;
    s.charge=null;s.swing=null;s.cue=null;s.ball={...FEED};s.cpuPlan=s.turn==='cpu'?{side:random()<.5?'left':'right',power:.4+random()*.45,releaseAt:.65+random()*.7,height:random()<.5?.22:.72}:null;
    s.message=s.turn==='you'?'Hold a boot. Release as the ball reaches it.':'Watch the winding boot. Move, then dive.';s.pressure=matchPressure(s);
    s.keeper.target=s.turn==='you'?(random()-.5)*1.0:null;
    s.boots={left:0,right:0}; phase('aim'); emit('ATTEMPT', {turn:s.turn});
  }
  function choose(first) {
    if(s.phase!=='choice' || !['you','cpu'].includes(first))return;
    s.first=first; s.turn=first; phase('countdown');
  }
  function dive(x, y) {
    if(s.dive || !['aim','flight'].includes(s.phase))return false;
    if(!requestDive(s.keeper,x,y))return false; s.dive=s.keeper.dive;
    emit('DIVE', {turn:s.turn}); return true;
  }
  function launch(contact) {
    const goalY=.165+.135*s.aim.y, duration=(goalY-s.ball.y)/contact.vy;
    const target={x:(s.ball.x+contact.vx*duration-.215)/.57,y:s.aim.y};
    const feedback=contact.stroke<.25?'Early contact':contact.stroke>.45?'Late contact':'Clean strike';
    s.flight={target,duration,elapsed:0,from:{x:s.ball.x,y:s.ball.y},keeperStartX:s.keeper.x,vx:contact.vx,vy:contact.vy,feedback,contact};
    s.charge=null;s.message=`${feedback} · ${Math.round(contact.power*100)}% power`;phase('flight');emit('BOOT_CONTACT',{...contact,ball:{...s.ball}});emit('KICK',{turn:s.turn,target:{...target}});
  }
  function startCharge(side) {
    if(s.phase!=='aim'||s.turn!=='you'||s.paused||s.charge||s.swing||!['left','right'].includes(side))return false;
    s.charge={side,elapsed:0,power:0};return true;
  }
  function releaseCharge(side) {
    if(!s.charge||s.charge.side!==side||s.paused||s.phase!=='aim')return false;
    const q=s.charge;s.charge=null;
    s.swing={side,power:q.power,age:0,stroke:s.boots[side],hit:false};
    s.message='Boot swinging';emit('SWING',{side,power:q.power});return true;
  }

  function finish(outcome, feedback) {
    if(!['aim','flight'].includes(s.phase))return;
    s.history[s.turn].push(outcome); s.outcome=outcome;
    s.message=feedback; s.winner=s.format==='fixed'?fixedWinner(s.history,s.first,total):matchWinner(s.history,total);
    emit('RESULT',{turn:s.turn,outcome}); phase('result');
  }
  function resolve() {
    const {target,feedback}=s.flight;
    if(target.x<.025 || target.x>.975 || target.y<.03 || target.y>.99) {
      const post=target.x>=-.035 && target.x<=1.035 && target.y>=-.035 && target.y<=1.035;
      finish('miss',post?'Off the frame':feedback+' · wide');return;
    }
    const saved=keeperSaves(s.keeper,target),pose=keeperPose(s.keeper);
    const point={x:(target.x-.5)*GOAL.width,z:(1-target.y)*GOAL.height};
    const glove=['lh','rh'].some(id=>Math.hypot(point.x-pose[id].x,point.z-pose[id].z)<.24);
    const wrongFoot=s.dive&&Math.sign(s.dive.dir)!==Math.sign(point.x-s.flight.keeperStartX);
    const outcomeText=saved?(glove?'Fingertip save':'Body behind the ball'):wrongFoot?'Keeper wrong-footed':'Beat the keeper';
    finish(saved?'save':'goal',`${outcomeText} · ${feedback}`);
  }
  function stepBoots(dt){
    for(const side of ['left','right'])if(!s.swing||s.swing.side!==side){
      const target=s.charge?.side===side?-.10*s.charge.power:0;
      s.boots[side]+=(target-s.boots[side])*Math.min(1,dt*18);
    }
    if(!s.swing)return;
    const b=s.swing;b.age+=dt;const speed=3.2+b.power*3.8;
    const before=b.stroke;b.stroke=b.age<.22?Math.min(.88,b.stroke+speed*dt):Math.max(0,b.stroke-dt*5);
    s.boots[b.side]=b.stroke;
    if(s.phase==='aim'&&!b.hit&&b.stroke>before){
      const contact=bootContact(s.ball,b.side,b.stroke,speed,b.power,s.aspect);
      if(contact){b.hit=true;launch(contact);}
    }
    if(b.age>=.42){s.swing=null;if(!b.hit&&s.phase==='aim')finish('miss','Missed the ball · release closer to contact');}
  }

  function step(dt) {
    if(s.paused || ['setup','choice','ended'].includes(s.phase))return;
    tick++; s.elapsed+=dt;
    stepBoots(dt);
    stepKeeper(s.keeper,dt);
    if(s.phase==='toss' && s.elapsed>=2.1){phase('choice');if(s.toss.winner==='cpu')choose(random()<.5?'cpu':'you');}
    else if(s.phase==='countdown' && s.elapsed>=1.8)beginAttempt();
    else if(s.phase==='aim'){
      stepFeed(s.ball,dt);
      if(s.charge){s.charge.elapsed+=dt;s.charge.power=clamp(s.charge.elapsed/.9,0,1);}
      if(s.turn==='cpu'&&s.cpuPlan){
        const p=s.cpuPlan,remaining=p.releaseAt-s.elapsed;
        s.cue=remaining<.65?{side:p.side,stage:remaining<.16?'strike':'windup'}:null;
        if(!s.charge&&!s.swing&&remaining>0)s.charge={side:p.side,elapsed:0,power:p.power};
        if(s.charge)s.charge.power=p.power;
        if(remaining<=0&&!s.swing){s.aim.y=p.height;s.charge={side:p.side,power:p.power};releaseCharge(p.side);}
      }
      if(s.elapsed>=8&&!s.swing)finish('miss','No strike · shot clock expired');
    } else if(s.phase==='flight'){
      const f=s.flight; f.elapsed+=dt; const p=clamp(f.elapsed/f.duration,0,1);
      // Visible flight projects directly to the goal coordinates used for saves.
      s.ball={x:f.from.x+f.vx*Math.min(f.elapsed,f.duration),y:f.from.y+f.vy*Math.min(f.elapsed,f.duration)-.035*Math.sin(Math.PI*p)};
      if(s.turn==='you' && !s.dive && f.elapsed>=level.reaction){
        // Observe ball displacement after reaction delay; extrapolate visible flight.
        const observedX=(s.ball.x-f.from.x)/p+f.from.x;
        const observedY=(s.ball.y+.035*Math.sin(Math.PI*p)-f.from.y)/p+f.from.y;
        dive((observedX-.215)/.57+(random()-.5)*level.error*2,(observedY-.165)/.135+(random()-.5)*level.error*2);
      }
      if(p>=1)resolve();
    } else if(s.phase==='result' && s.elapsed>=1.5){
      if(s.winner){phase('ended');emit('END',{winner:s.winner});}
      else {if(s.format==='standard')s.turn=s.turn==='you'?'cpu':'you';beginAttempt();}
    }
  }
  return {
    state:s,
    resizeArena(width,height){if(width>0&&height>0)s.aspect=height/width;},
    toss(call) { if(s.phase!=='setup')return;const face=random()<.5?'heads':'tails';s.toss={face,call,winner:call===face?'you':'cpu'};phase('toss'); },
    choose, startCharge, releaseCharge, cancelCharge(){if(s.turn==='you')s.charge=null;},
    kick(side){return releaseCharge(side);},
    aim(x,y){if(s.phase==='aim'&&s.turn==='you'&&!s.paused)s.aim.y=clamp(y,.12,.85);},
    position(x){if(['aim','flight'].includes(s.phase)&&s.turn==='cpu'&&!s.dive&&!s.paused){s.keeper.target=(clamp(x,.05,.95)-.5)*GOAL.width;s.keeper.move=0;}},
    moveKeeper(direction){if(['aim','flight'].includes(s.phase)&&s.turn==='cpu'&&!s.dive&&!s.paused){s.keeper.target=null;s.keeper.move=clamp(direction,-1,1);}},
    stopKeeper(){s.keeper.move=0;s.keeper.target=null;},
    dive(x,y){return s.turn==='cpu' && !s.paused ? dive(x,y) : false;},
    pause(value){s.paused=!!value;s.charge=null;s.keeper.move=0;s.keeper.target=null;carry=0;},
    advance(dt){carry+=clamp(dt,0,.05);while(carry>=1/120){step(1/120);carry-=1/120;}},
    snapshot(){return structuredClone(s);},
  };
}

export function duelScore(s) {
  const goals=t=>s.history[t].filter(x=>x==='goal').length;
  if(s.format!=='fixed')return {you:goals('you'),cpu:goals('cpu')};
  const shooter=s.first||s.turn, defender=shooter==='you'?'cpu':'you';
  return {[shooter]:goals(shooter),[defender]:s.history[shooter].length-goals(shooter)};
}
export function fixedWinner(history,shooter,total){
  const goals=history[shooter].filter(x=>x==='goal').length, stops=history[shooter].length-goals;
  return goals>total/2?shooter:stops>total/2?(shooter==='you'?'cpu':'you'):null;
}

// Evaluate real possible results, including paired sudden death, without guessing.
export function matchPressure(s){
 const hypothetical=outcome=>{const history={you:[...s.history.you],cpu:[...s.history.cpu]};history[s.turn].push(outcome);return s.format==='fixed'?fixedWinner(history,s.first,s.total):matchWinner(history,s.total);};
 const goal=hypothetical('goal'),stop=hypothetical('save');
 if(s.turn==='you'){if(goal==='you')return 'SCORE TO WIN';if(stop==='cpu')return 'SCORE TO STAY IN';}
 else {if(stop==='you')return 'SAVE TO WIN';if(goal==='cpu')return 'SAVE TO STAY IN';}
 return s.history.you.length>=s.total&&s.history.cpu.length>=s.total?'SUDDEN DEATH · PAIRED SHOTS':'';
}
