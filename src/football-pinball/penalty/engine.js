// Normalised goal coordinates: x=0 left post, y=0 crossbar.
// CPU decisions use visible flight only; the human aim is never read by the CPU.
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
export function createDuel({ total = 5, difficulty = 'rookie', random = Math.random } = {}) {
  total = total === 3 ? 3 : 5;
  difficulty = LEVELS[difficulty] ? difficulty : 'rookie';
  const level = LEVELS[difficulty];
  const s = { phase:'setup', paused:false, total, difficulty, elapsed:0, turn:'you',
    history:{you:[],cpu:[]}, aim:{x:.5,y:.5}, keeper:{x:.5,y:.65}, dive:null,
    flight:null, ball:{x:.5,y:.67}, boots:{left:0,right:0}, events:[], winner:null, message:'' };
  let carry = 0, tick = 0, eventId = 0;
  const emit = (type, extra = {}) => { s.events.push({ id:++eventId, type, tick, ...extra }); if(s.events.length>32)s.events.shift(); };
  const phase = value => { s.phase=value; s.elapsed=0; };
  function beginAttempt() {
    s.aim={x:.5,y:.5}; s.keeper={x:s.turn==='you'?.35+random()*.3:.5,y:.65}; s.dive=null; s.flight=null;
    s.ball={x:.5,y:.67}; s.message=s.turn==='you'?'Drag inside the goal to aim':'Position your keeper. Watch the kick.';
    s.boots={left:0,right:0}; phase('aim'); emit('ATTEMPT', {turn:s.turn});
  }
  function choose(first) {
    if(s.phase!=='choice' || !['you','cpu'].includes(first))return;
    s.first=first; s.turn=first; phase('countdown');
  }
  function dive(x, y) {
    if(s.dive || !['aim','flight'].includes(s.phase))return false;
    const from={...s.keeper};
    s.dive={from, to:{x:clamp(x,Math.max(.04,from.x-.33),Math.min(.96,from.x+.33)),y:clamp(y,.2,.82)},elapsed:0};
    emit('DIVE', {turn:s.turn}); return true;
  }
  function launch(target, duration, feedback) {
    s.flight={ target, duration, elapsed:0, from:{...s.ball}, feedback };
    phase('flight'); emit('KICK',{turn:s.turn,target:{...target}});
  }
  function kick(side) {
    if(s.phase!=='aim' || s.turn!=='you' || s.paused || !['left','right'].includes(side))return false;
    s.boots[side]=1;
    // Actual ball must overlap the boot contact zone. Early swings can be retried.
    if(s.ball.y<.82 || s.ball.y>.94){ emit('SWING',{side});s.message='Too early — wait for the ball';return false; }
    const error=clamp((s.ball.y-.88)/.06,-1,1), sign=side==='left'?1:-1;
    const target={x:s.aim.x+error*.24*sign,y:s.aim.y+Math.abs(error)*.20};
    const feedback=Math.abs(error)<.22?'Clean contact':error<0?'Early contact':'Late contact';
    emit('BOOT_CONTACT',{side,ball:{...s.ball},error});
    launch(target,.64+Math.abs(error)*.26,feedback); return true;
  }
  function finish(outcome, feedback) {
    if(!['aim','flight'].includes(s.phase))return;
    s.history[s.turn].push(outcome); s.outcome=outcome;
    s.message=feedback; s.winner=matchWinner(s.history,total);
    emit('RESULT',{turn:s.turn,outcome}); phase('result');
  }
  function resolve() {
    const {target,feedback}=s.flight;
    if(target.x<.025 || target.x>.975 || target.y<.03 || target.y>.99) {
      const post=target.x>=-.035 && target.x<=1.035 && target.y>=-.035 && target.y<=1.035;
      finish('miss',post?'Off the frame':feedback+' · wide');return;
    }
    const dx=(target.x-s.keeper.x)/.13, dy=(target.y-s.keeper.y)/.26;
    finish(dx*dx+dy*dy<=1?'save':'goal',dx*dx+dy*dy<=1?'Saved by the keeper':feedback);
  }
  function step(dt) {
    if(s.paused || ['setup','choice','ended'].includes(s.phase))return;
    tick++; s.elapsed+=dt;
    for(const side of ['left','right']) s.boots[side]=Math.max(0,s.boots[side]-dt*4);
    if(s.dive){s.dive.elapsed+=dt; const t=clamp(s.dive.elapsed/.36,0,1);s.keeper={x:s.dive.from.x+(s.dive.to.x-s.dive.from.x)*t,y:s.dive.from.y+(s.dive.to.y-s.dive.from.y)*t};}
    if(s.phase==='toss' && s.elapsed>=2.1){phase('choice');if(s.toss.winner==='cpu')choose(random()<.5?'cpu':'you');}
    else if(s.phase==='countdown' && s.elapsed>=1.8)beginAttempt();
    else if(s.phase==='aim'){
      s.ball={x:.5,y:.67+Math.min(s.elapsed,3.3)*.085};
      if(s.turn==='cpu' && s.elapsed>=2){
        // CPU target selected independently of the human keeper's position.
        const target={x:.06+random()*.88,y:.13+random()*.77};
        const mistake=(random()-.5)*level.error;
        target.x+=mistake; target.y+=Math.abs(mistake)*.2;
        s.boots[random()<.5?'left':'right']=1;launch(target,level.flight,'CPU shot');
      } else if(s.elapsed>=3.3)finish('miss','No contact');
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
      else {s.turn=s.turn==='you'?'cpu':'you';beginAttempt();}
    }
  }
  return {
    state:s,
    toss(call) { if(s.phase!=='setup')return;const face=random()<.5?'heads':'tails';s.toss={face,call,winner:call===face?'you':'cpu'};phase('toss'); },
    choose, kick,
    aim(x,y){if(s.phase==='aim' && s.turn==='you' && !s.paused)s.aim={x:clamp(x,.04,.96),y:clamp(y,.04,.96)};},
    position(x){if(s.phase==='aim' && s.turn==='cpu' && !s.dive && !s.paused)s.keeper.x=clamp(x,.30,.70);},
    dive(x,y){return s.turn==='cpu' && !s.paused ? dive(x,y) : false;},
    pause(value){s.paused=!!value;carry=0;},
    advance(dt){carry+=clamp(dt,0,.05);while(carry>=1/120){step(1/120);carry-=1/120;}},
    snapshot(){return structuredClone(s);},
  };
}
