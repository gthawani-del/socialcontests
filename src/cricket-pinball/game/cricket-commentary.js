// Opt-in commentary, independent of the match engine and stadium sound system.
export function createCricketCommentary() {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'cricketCommentaryToggle';
  button.setAttribute('aria-label', 'Start cricket commentary');
  button.setAttribute('aria-pressed', 'false');
  button.title = 'Start cricket commentary';
  button.textContent = '🔊';
  Object.assign(button.style, { position:'fixed',top:'72px',right:'12px',zIndex:'100',width:'42px',height:'42px',borderRadius:'50%',border:'1px solid #d7b66b',background:'#10251f',color:'#fff',fontSize:'21px',cursor:'pointer',touchAction:'manipulation' });
  document.body.append(button);
  const status = document.createElement('span');
  status.id = 'cricketCommentaryStatus';
  status.setAttribute('role','status');
  Object.assign(status.style,{position:'fixed',top:'117px',right:'12px',zIndex:'100',fontSize:'11px',maxWidth:'180px',textAlign:'right',color:'#f1dfad',pointerEvents:'none'});
  document.body.append(status);
  const report = message => { status.textContent = message; };
  let enabled = false, epoch = 0, currentAudio = null, currentUrl = null, busy = false;
  let audioContext = null;
  let gainNode = null;
  const ensureAudio = async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Audio not supported');
    audioContext ||= new AudioContextClass();
    gainNode ||= audioContext.createGain();
    if (!gainNode.numberOfOutputs) throw new Error('Audio unavailable');
    if (!gainNode.__connected) { gainNode.connect(audioContext.destination); gainNode.__connected = true; }
    await audioContext.resume();
  };
  const cache = new Map();
  const clearAudio = () => {
    if (currentAudio) { currentAudio.pause(); currentAudio.src=''; currentAudio=null; }
    if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl=null; }
  };
  const stop = () => { epoch++; busy=false; clearAudio(); };
  button.addEventListener('click', async () => {
    enabled = !enabled;
    if (!enabled) { stop(); report('Commentary off'); }
    else { try { await ensureAudio(); report('Commentary on · waiting for delivery'); } catch (error) { report(error.message); } }
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Stop cricket commentary' : 'Start cricket commentary');
    button.title = enabled ? 'Stop cricket commentary' : 'Start cricket commentary';
    button.style.background = enabled ? '#176c51' : '#10251f';
  });
  async function handle(event) {
    if (!enabled) return;
    if (event?.type === 'MATCH_RESET') { stop(); return; }
    if (event?.type !== 'OUTCOME') return;
    const type = String(event.outcome || '').toUpperCase();
    if (!['SIX','FOUR','WICKET','DOT','ONE','TWO','THREE','DEAD_BALL'].includes(type)) return;
    // Do not queue stale commentary or interrupt a currently playing reaction.
    if (busy || currentAudio) return;
    report('Generating ' + type.toLowerCase() + ' commentary…');
    const id = epoch;
    busy = true;
    try {
      let blob = cache.get(type);
      if (!blob) {
        const response = await fetch('/api/cricket-commentary', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:type}) });
        if (!response.ok) { const error = await response.json().catch(()=>({})); throw new Error(error.error || `Commentary HTTP ${response.status}`); }
        blob = await response.blob();
        cache.set(type,blob);
      }
      if (!enabled || id !== epoch || document.hidden) return;
      currentUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(currentUrl);
      currentAudio.playbackRate = 1;
      await ensureAudio();
      const source = audioContext.createMediaElementSource(currentAudio);
      source.connect(gainNode);
      currentAudio.onended = () => clearAudio();
      currentAudio.onerror = () => clearAudio();
      await currentAudio.play();
      report('Commentary playing');
    } catch (error) { report('Commentary: ' + error.message); clearAudio(); } finally { busy=false; }
  }
  document.addEventListener('visibilitychange', () => { if(document.hidden)stop(); });
  return {handle};
}
