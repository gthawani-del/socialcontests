/** Local crowd recording plus event-driven match effects. */
export function createAudio(root) {
  let context,master,muted=false,lastEvent=0,played=0,playing=false,disposed=false;
  let crowdBuffer,crowdSource,crowdGain,crowdLoad,crowdError=null,crowdLevel=0,crowdOffset=0,crowdStarted=0,crowdStarts=0;
  const download=new AbortController();
  const voices=new Set(),cooldowns=new Map(),clips=new Map();
  let pendingStart=false;
  let clipLoadStarted=false;
  function loadCrashClips(){
    if(clipLoadStarted||!context)return;
    clipLoadStarted=true;
    for(const [type,file] of [['CRASH_GAME_START','Game-start.mp3'],['CRASH_SOCCER_KICK','Soccer-kick.mp3']]){
      fetch('/football-pinball/audio/'+file,{signal:download.signal})
        .then(response=>{if(!response.ok)throw Error('Audio HTTP '+response.status);return response.arrayBuffer();})
        .then(data=>context.decodeAudioData(data))
        .then(buffer=>{if(!disposed){clips.set(type,buffer);if(type==='CRASH_GAME_START'&&pendingStart){pendingStart=false;clip(type,.9);played++;}}})
        .catch(()=>{});
    }
  }
  function clip(type,volume){
    const buffer=clips.get(type);if(!buffer)return false;
    const source=context.createBufferSource(),gain=context.createGain();
    source.buffer=buffer;gain.gain.value=volume;
    source.connect(gain);gain.connect(master);voices.add(source);
    source.onended=()=>{voices.delete(source);source.disconnect();gain.disconnect();};
    source.start();return true;
  }
  try{muted=localStorage.getItem('football-audio')==='off';}catch{}
  const button=document.createElement('button');button.id='fp-audio';button.type='button';button.dataset.footballAudio='';root.querySelector('.fp-actions').append(button);
  const label=()=>{for(const b of root.querySelectorAll('[data-football-audio]')){(b.querySelector('[data-audio-label]')||b).textContent=muted?'Sound off':'Sound on';b.setAttribute('aria-pressed',String(!muted));}};
  const stop=()=>{for(const node of voices){try{node.stop();}catch{}}voices.clear();};
  function stopCrowd(){
    if(!crowdSource)return;
    crowdOffset=(crowdOffset+context.currentTime-crowdStarted)%crowdBuffer.duration;
    crowdSource.stop();crowdSource.disconnect();crowdSource=null;
    crowdGain.disconnect();crowdGain=null;
  }
  function ambience(){
    const on=!disposed&&playing&&!muted&&!document.hidden&&context?.state==='running';
    if(!on){stopCrowd();return;}
    if(!crowdBuffer||crowdSource)return;
    crowdSource=context.createBufferSource();crowdGain=context.createGain();
    crowdSource.buffer=crowdBuffer;crowdSource.loop=true;
    crowdGain.gain.setValueAtTime(0,context.currentTime);
    crowdGain.gain.linearRampToValueAtTime(crowdLevel,context.currentTime+.15);
    crowdSource.connect(crowdGain);crowdGain.connect(context.destination);
    crowdStarted=context.currentTime;crowdSource.start(0,crowdOffset);crowdStarts++;
  }
  function loadCrowd(){
    if(crowdLoad||disposed)return;
    crowdLoad=fetch('/football-pinball/audio/crowd-cheering.mp3',{signal:download.signal})
      .then(r=>{if(!r.ok)throw Error('Crowd audio HTTP '+r.status);return r.arrayBuffer();})
      .then(data=>context.decodeAudioData(data))
      .then(buffer=>{
        if(disposed)return;
        // Soften the recorded loop boundary without modifying the uploaded file.
        const fade=Math.min(Math.floor(buffer.sampleRate*.08),Math.floor(buffer.length/2));
        let sum=0,peak=0;
        for(let c=0;c<buffer.numberOfChannels;c++){
          const data=buffer.getChannelData(c);
          for(let i=0;i<data.length;i++){
            data[i]*=Math.min(1,i/fade,(data.length-1-i)/fade);
            sum+=data[i]*data[i];peak=Math.max(peak,Math.abs(data[i]));
          }
        }
        const rms=Math.sqrt(sum/(buffer.length*buffer.numberOfChannels));
        // A quiet bed, with capped gain and peak headroom; effects retain their own mix.
        crowdLevel=Math.min(4,.02/Math.max(rms,.0001),.18/Math.max(peak,.0001));
        crowdBuffer=buffer;ambience();
      }).catch(error=>{if(!disposed)crowdError=error.message;});
  }
  const visibility=()=>{if(document.hidden)stop();ambience();};
  document.addEventListener('visibilitychange',visibility);
  function activate(){
    if(muted)return;
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio){muted=true;button.disabled=true;label();return;}
    if(!context){context=new Audio();context.addEventListener('statechange',ambience);}
    if(!master){master=context.createGain();master.gain.value=.22;master.connect(context.destination);}
    context.resume().then(ambience).catch(()=>{});
    loadCrowd();loadCrashClips();
  }
  root.addEventListener('pointerdown',activate);root.addEventListener('keydown',activate);
  label();button.onclick=()=>{muted=!muted;if(muted)stop();else activate();try{localStorage.setItem('football-audio',muted?'off':'on');}catch{}label();ambience();};
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
    if(type==='CRASH_GAME_START'){if(clip(type,.9))played++;else pendingStart=true;return;}
    if(type==='CRASH_SOCCER_KICK'){if(clip(type,.9))played++;return;}
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
    update(events,state){if(state)playing=state.state==='active'&&!state.paused;ambience();for(const event of events||[]){if(event.eventId<=lastEvent)continue;lastEvent=event.eventId;sound(event.type);}},
    reset(){playing=false;pendingStart=false;stopCrowd();crowdOffset=0;lastEvent=0;cooldowns.clear();stop();},
    metrics:()=>({muted,played,activeVoices:voices.size,crowd:!!crowdSource,crowdStatus:crowdError?'error':crowdBuffer?'ready':crowdLoad?'loading':'idle',crowdError,crowdDuration:crowdBuffer?.duration||0,crowdStarts,crowdLevel,crashClipsLoaded:[...clips.keys()],state:context?.state||'locked'}),
    dispose(){disposed=true;pendingStart=false;download.abort();stopCrowd();context?.removeEventListener('statechange',ambience);document.removeEventListener('visibilitychange',visibility);stop();root.removeEventListener('pointerdown',activate);root.removeEventListener('keydown',activate);context?.close();button.remove();},
  };
}
