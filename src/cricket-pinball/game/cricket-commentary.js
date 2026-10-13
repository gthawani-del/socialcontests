// Isolated, opt-in commentary. Gameplay events are read-only.
export function createCricketCommentary() {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'cricketCommentaryToggle';
  button.textContent = '🔊';
  button.setAttribute('aria-label', 'Start cricket commentary');
  button.setAttribute('aria-pressed', 'false');
  Object.assign(button.style, {position:'fixed',top:'72px',right:'12px',zIndex:'100',width:'42px',height:'42px',borderRadius:'50%',border:'1px solid #d7b66b',background:'#10251f',color:'#fff',fontSize:'21px',cursor:'pointer',touchAction:'manipulation'});
  const status = document.createElement('span');
  status.id = 'cricketCommentaryStatus';
  status.setAttribute('role','status');
  Object.assign(status.style,{position:'fixed',top:'117px',right:'12px',zIndex:'100',fontSize:'11px',maxWidth:'185px',textAlign:'right',color:'#f1dfad',pointerEvents:'none'});
  document.body.append(button,status);
  const report = message => { status.textContent = message; };
  const supported = new Set(['SIX','FOUR','WICKET','DOT','ONE','TWO','THREE','DEAD_BALL']);
  const preload = ['SIX','FOUR','WICKET','DOT'];
  const cache = new Map(), inflight = new Map();
  let enabled=false, generation=0, audioContext=null, current=null, currentUrl=null, lastOutcome=null;
  function stopAudio() {
    if(current){current.pause();current.removeAttribute('src');current.load();current=null;}
    if(currentUrl){URL.revokeObjectURL(currentUrl);currentUrl=null;}
  }
  function cancel() {generation++;stopAudio();lastOutcome=null;}
  async function fetchClip(type) {
    if(cache.has(type))return cache.get(type);
    if(inflight.has(type))return inflight.get(type);
    const request=(async()=>{
      const response=await fetch('/api/cricket-commentary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:type})});
      if(!response.ok){const error=await response.json().catch(()=>({}));throw new Error(error.error || 'HTTP '+response.status);}
      const blob=await response.blob();
      if(!blob.size || !blob.type.startsWith('audio/'))throw new Error('Invalid audio response');
      cache.set(type,blob);
      return blob;
    })();
    inflight.set(type,request);
    try{return await request;}finally{inflight.delete(type);}
  }
  function unlockAudio() {
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass)throw new Error('Audio unsupported');
    audioContext ||= new AudioContextClass();
    const resume=audioContext.resume();
    // Short audible acknowledgement also unlocks iOS audio in the tap handler.
    const oscillator=audioContext.createOscillator();
    const gain=audioContext.createGain();
    oscillator.frequency.value=660;
    gain.gain.setValueAtTime(0.035,audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,audioContext.currentTime+0.09);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();oscillator.stop(audioContext.currentTime+0.1);
    return resume;
  }
  button.addEventListener('click',()=>{
    enabled=!enabled;
    button.setAttribute('aria-pressed',String(enabled));
    button.setAttribute('aria-label',enabled?'Stop cricket commentary':'Start cricket commentary');
    button.style.background=enabled?'#176c51':'#10251f';
    if(!enabled){cancel();report('Commentary off');return;}
    // Run in the user's click gesture, before any network awaits.
    try { unlockAudio().catch(e=>report('Audio: '+e.message)); }
    catch(e){enabled=false;button.setAttribute('aria-pressed','false');report('Audio: '+e.message);return;}
    report('Commentary on · loading voice…');
    Promise.allSettled(preload.map(fetchClip)).then(results=>{
      if(!enabled)return;
      const ready=results.filter(r=>r.status==='fulfilled').length;
      report(ready ? 'Commentary ready · '+ready+'/4 clips' : 'Commentary unavailable: '+(results.find(r=>r.status==='rejected')?.reason?.message||'unknown error'));
    });
  });
  async function play(type,token) {
    try {
      report('Commentary: '+type+' · loading');
      const clip=await fetchClip(type);
      if(!enabled||token!==generation||document.hidden)return;
      stopAudio();
      currentUrl=URL.createObjectURL(clip);
      const player=new Audio();
      current=player;
      player.preload='auto';
      player.playbackRate=1;
      player.src=currentUrl;
      player.onended=()=>{if(current===player){stopAudio();report('Commentary ready');}};
      player.onerror=()=>{if(current===player){stopAudio();report('Audio decode failed');}};
      await player.play();
      if(token===generation)report('Commentary playing · '+type);
    }catch(e){if(token===generation){stopAudio();report('Commentary failed: '+e.message);}}
  }
  function handle(event) {
    if(!enabled)return;
    if(event?.type==='MATCH_RESET'){cancel();report('Commentary on · new match');return;}
    if(event?.type!=='OUTCOME')return;
    const type=String(event.outcome||'').toUpperCase();
    if(!supported.has(type))return;
    if(type===lastOutcome && current)return;
    lastOutcome=type;
    // Latest result wins; no stale commentary queue.
    const token=++generation;
    stopAudio();
    void play(type,token);
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancel();if(enabled)report('Commentary paused');}});
  window.addEventListener('pagehide',cancel);
  return {handle};
}
