/** Event-driven synthesized match sounds; no downloads or recurring API costs. */
export function createAudio(root) {
  let context,master,muted=false,lastEvent=0,played=0;
  const voices=new Set(),cooldowns=new Map();
  try{muted=localStorage.getItem('football-audio')==='off';}catch{}
  const button=document.createElement('button');button.id='fp-audio';button.type='button';button.dataset.footballAudio='';root.querySelector('.fp-actions').append(button);
  const label=()=>{for(const b of root.querySelectorAll('[data-football-audio]')){(b.querySelector('[data-audio-label]')||b).textContent=muted?'Sound off':'Sound on';b.setAttribute('aria-pressed',String(!muted));}};
  const stop=()=>{for(const node of voices){try{node.stop();}catch{}}voices.clear();};
  // Crowd recording is intentionally absent until the supplied audio is available.
  const visibility=()=>{if(document.hidden)stop();};
  document.addEventListener('visibilitychange',visibility);
  function activate(){
    if(muted)return;
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio){muted=true;button.disabled=true;label();return;}
    context??=new Audio();
    if(!master){master=context.createGain();master.gain.value=.22;master.connect(context.destination);}
    context.resume().catch(()=>{});
  }
  root.addEventListener('pointerdown',activate);root.addEventListener('keydown',activate);
  label();button.onclick=()=>{muted=!muted;if(muted)stop();else activate();try{localStorage.setItem('football-audio',muted?'off':'on');}catch{}label();};
  function voice(frequency,duration=.1,kind='sine',volume=.15,delay=0,end=frequency){
    if(voices.size>=20)return;
    const start=context.currentTime+delay,gain=context.createGain();let source;
    if(kind==='noise'){
      source=context.createBufferSource();const buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.65;
      source.buffer=buffer;const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=frequency;source.connect(filter);filter.connect(gain);
      source.onended=()=>{voices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};
    }else{
      source=context.createOscillator();source.type=kind;source.frequency.setValueAtTime(frequency,start);source.frequency.exponentialRampToValueAtTime(Math.max(20,end),start+duration);source.connect(gain);
      source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();};
    }
    gain.gain.setValueAtTime(.001,start);gain.gain.linearRampToValueAtTime(volume,start+.006);gain.gain.exponentialRampToValueAtTime(.001,start+duration);gain.connect(master);
    voices.add(source);source.start(start);source.stop(start+duration);
  }
  function sound(type){
    if(muted||!context||context.state!=='running'||document.hidden)return;
    const now=context.currentTime,minGap=type==='COLLISION'?.075:.04;
    if(now-(cooldowns.get(type)??-10)<minGap)return;cooldowns.set(type,now);
    switch(type){
      case 'PLAYER_KICK':voice(110,.09,'triangle',.19,0,55);voice(1000,.045,'noise',.08);break;
      case 'FLIP_DOWN':voice(180,.045,'triangle',.12,0,75);break;
      case 'COLLISION':voice(160,.045,'sine',.13,0,65);break;
      case 'BALL_UNSTUCK':voice(440,.12,'sine',.1);break;
      case 'TARGET_HIT':voice(680,.09,'sine',.15,0,1000);break;
      case 'PERFECT_KICK':voice(260,.12,'triangle',.14,0,650);voice(1800,.05,'noise',.06);break;
      case 'KEEPER_SAVE':voice(650,.12,'noise',.2);voice(100,.1,'sine',.12);break;
      case 'KICKOFF':case 'HALFTIME':voice(2300,.18,'sine',.045);voice(2500,.15,'sine',.035,.22);break;
      case 'GOAL_SCORED':
        [523,659,784,1047].forEach((f,i)=>voice(f,.22,'triangle',.15,i*.11));break;
      case 'BANK_ACCEPTED':case 'MULTIBALL_STARTED':case 'TIME_EXTENDED':
        [440,660,880].forEach((f,i)=>voice(f,.17,'sine',.13,i*.09));break;
      case 'BALL_DRAINED':voice(200,.23,'triangle',.11,0,60);break;
      case 'ROUND_ENDED':[660,523,784].forEach((f,i)=>voice(f,.25,'sine',.12,i*.15));break;
      default:return;
    }
    played++;
  }
  return {
    update(events,state){for(const event of events||[]){if(event.eventId<=lastEvent)continue;lastEvent=event.eventId;sound(event.type);}},
    reset(){lastEvent=0;cooldowns.clear();stop();},
    metrics:()=>({muted,played,activeVoices:voices.size,crowd:false,state:context?.state||'locked'}),
    dispose(){document.removeEventListener('visibilitychange',visibility);stop();root.removeEventListener('pointerdown',activate);root.removeEventListener('keydown',activate);context?.close();button.remove();},
  };
}
