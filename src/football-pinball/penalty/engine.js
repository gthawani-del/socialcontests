import { createKeeper, stepKeeper, requestDive, keeperSaves, GOAL } from './keeper.js';
// Normalised goal coordinates: x=0 left post, y=0 crossbar.
// CPU decisions use visible flight only; the human aim is never read by the CPU.
// The ball is staged on the pitch side of the boots, never in the rear drain.
export const BALL_START = Object.freeze({x:.5,y:.765});
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
  const s = { phase:'setup', paused:false, total, difficulty, format:format==='fixed'?'fixed':'standard', elapsed:0, turn:'you',
    history:{you:[],cpu:[]}, aim:{x:.5,y:.5}, keeper:createKeeper(), dive:null, charge:null,
    flight:null, ball:{...BALL_START}, boots:{left:0,right:0}, events:[], winner:null, message:'' };
  let carry = 0, tick = 0, eventId = 0;
  const emit = (type, extra = {}) => { s.events.push({ id:++eventId, type, tick, ...extra }); if(s.events.length>32)s.events.shift(); };
  const phase = value => { s.phase=value; s.elapsed=0; };
  function beginAttempt() {
    s.aim={x:.5,y:.5}; s.keeper=createKeeper(s.turn==='you'?.35+random()*.3:.5); s.dive=null; s.flight=null;
    s.charge=null; s.ball={...BALL_START}; s.message=s.turn==='you'?'Aim. Hold a boot to charge. Release to shoot.':'Drag the keeper or hold arrows. Tap a diagonal to dive.';
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
  function launch(target, duration, feedback) {
    s.flight={ target, duration, elapsed:0, from:{...s.ball}, feedback };
    phase('flight'); emit('KICK',{turn:s.turn,target:{...target}});
  }
  function startCharge(side) {
    if(s.phase!=='aim'||s.turn!=='you'||s.paused||s.charge||!['left','right'].includes(side))return false;
    s.charge={side,elapsed:0,power:0,timing:0,window:.24};return true;
  }
  function releaseCharge(side) {
    if(!s.charge||s.charge.side!==side||s.paused||s.phase!=='aim')return false;
    const q=s.charge; s.charge=null;
    const error=(q.timing-.5)*2, excess=Math.max(0,Math.abs(error)-q.window);
    const target={x:s.aim.x+Math.sign(error)*excess*.28*(side==='left'?1:-1),y:s.aim.y+excess*.15};
    s.boots[side]=1;
    emit('BOOT_CONTACT',{side,power:q.power,timing:q.timing,error,ball:{...s.ball}});
    launch(target,1.05-.5*q.power,excess<.04?'Perfect timing':error<0?'Early release':'Late release');return true;
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
    const saved=keeperSaves(s.keeper,target);
    finish(saved?'save':'goal',saved?'Saved by the keeper':feedback);
  }
  function step(dt) {
    if(s.paused || ['setup','choice','ended'].includes(s.phase))return;
    tick++; s.elapsed+=dt;
    for(const side of ['left','right']) s.boots[side]=Math.max(0,s.boots[side]-dt*4);
    stepKeeper(s.keeper,dt);
    if(s.phase==='toss' && s.elapsed>=2.1){phase('choice');if(s.toss.winner==='cpu')choose(random()<.5?'cpu':'you');}
    else if(s.phase==='countdown' && s.elapsed>=1.8)beginAttempt();
    else if(s.phase==='aim'){
      s.ball={...BALL_START};
      if(s.charge){const q=s.charge;q.elapsed+=dt;q.power=clamp(q.elapsed/1.4,0,1);q.timing=(1-Math.cos(q.elapsed*5))/2;q.window=.30-.18*q.power;}
      if(s.turn==='cpu' && s.elapsed>=2){
        // CPU target selected independently of the human keeper's position.
        const target={x:.06+random()*.88,y:.13+random()*.77};
        const mistake=(random()-.5)*level.error;
        target.x+=mistake; target.y+=Math.abs(mistake)*.2;
        s.boots[random()<.5?'left':'right']=1;launch(target,level.flight,'CPU shot');
      } else if(s.elapsed>=12)finish('miss','Shot clock expired');
    } else if(s.phase==='flight'){
      const f=s.flight; f.elapsed+=dt; const p=clamp(f.elapsed/f.duration,0,1);
      // Visible flight projects directly to the goal coordinates used for saves.
      s.ball={x:f.from.x+(.215+.57*f.target.x-f.from.x)*p,y:f.from.y+(.165+.135*f.target.y-f.from.y)*p-.065*Math.sin(Math.PI*p)};
      if(s.turn==='you' && !s.dive && f.elapsed>=level.reaction){
        // Observe ball displacement after reaction delay; extrapolate visible flight.
        const observedX=(s.ball.x-f.from.x)/p+f.from.x;
        const observedY=(s.ball.y+.065*Math.sin(Math.PI*p)-f.from.y)/p+f.from.y;
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
    toss(call) { if(s.phase!=='setup')return;const face=random()<.5?'heads':'tails';s.toss={face,call,winner:call===face?'you':'cpu'};phase('toss'); },
    choose, startCharge, releaseCharge, cancelCharge(){s.charge=null;},
    kick(side){return releaseCharge(side);},
    aim(x,y){if(s.phase==='aim' && s.turn==='you' && !s.paused)s.aim={x:clamp(x,.04,.96),y:clamp(y,.04,.96)};},
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
