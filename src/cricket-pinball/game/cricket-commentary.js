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
  let enabled = false, epoch = 0, currentAudio = null, currentUrl = null, busy = false;
  const cache = new Map();
  const clearAudio = () => {
    if (currentAudio) { currentAudio.pause(); currentAudio.src=''; currentAudio=null; }
    if (currentUrl) { URL.revokeObjectURL(currentUrl); currentUrl=null; }
  };
  const stop = () => { epoch++; busy=false; clearAudio(); };
  button.addEventListener('click', () => {
    enabled = !enabled;
    if (!enabled) stop();
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
    const id = epoch;
    busy = true;
    try {
      let blob = cache.get(type);
      if (!blob) {
        const response = await fetch('/api/cricket-commentary', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:type}) });
        if (!response.ok) throw new Error('Commentary unavailable');
        blob = await response.blob();
        cache.set(type,blob);
      }
      if (!enabled || id !== epoch || document.hidden) return;
      currentUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(currentUrl);
      currentAudio.playbackRate = 1;
      currentAudio.onended = () => clearAudio();
      currentAudio.onerror = () => clearAudio();
      await currentAudio.play();
    } catch { clearAudio(); } finally { busy=false; }
  }
  document.addEventListener('visibilitychange', () => { if(document.hidden)stop(); });
  return {handle};
}
