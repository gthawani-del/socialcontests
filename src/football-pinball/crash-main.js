import {crashMeterMarkup,bindCrashMeter} from './ui/crash-meter.js';
import './ui/crash.css';
import { createAudio } from './ui/audio.js';
import { createCrashView } from './view/crash-scene.js';

// Crash has its own round lifecycle: multiplier growth is independent of pinball input.
export async function mountCrash() {
  const root = document.querySelector('#footballApp');
  const server = (import.meta.env.VITE_FOOTBALL_SERVER_URL || '').replace(/\/$/, '');
  root.className = 'fp-crash';
  root.dataset.mode = 'crash';
  root.innerHTML = `<header class="fc-header"><a href="/football-pinball/" aria-label="Game selection">‹ Modes</a><h1>FOOTBALL <span>CRASH</span></h1><button class="fc-menu" aria-label="Game controls">⚙</button></header>
    <section class="fc-setup"><p class="fc-kicker">MULTIPLIER CHALLENGE</p><h2>Know when to cash out.</h2><div class="fc-preview" aria-hidden="true"><svg viewBox="0 0 320 130" fill="none"><path d="M20 112H300M20 112V14" stroke="#3e6471"/><path d="M24 106Q154 106 284 20" stroke="#65d4b3" stroke-width="5"/><circle cx="284" cy="20" r="9" fill="#e7f9f1"/><path d="m276 16 8-5 8 5-3 10h-10Z" fill="#173b42"/></svg><strong>1.00× → ?</strong></div>
    <p>The multiplier rises automatically. Cash out before the crash to secure your virtual return. A crash before cashout returns zero.</p>
    <label>Round type<select id="fc-authority"><option value="server" ${server ? '' : 'disabled'}>Hosted practice${server ? '' : ' — unavailable'}</option><option value="local" selected>Local practice</option></select></label>
    <p class="fc-authority-note">Local practice runs on this device. It is not server-verified or provably fair.</p>

    <div class="fc-setup-actions"><div class="fp-actions"></div><button id="fc-enter">Continue</button></div></section>
    <section class="fc-play" hidden><div class="fc-round-header"><span id="fc-mode-label">LOCAL PRACTICE</span><span>Stake <b id="fc-stake-label">100</b> pts</span></div><div class="fc-game"><div id="fc-arena"><div class="fc-live"><span id="fc-round-state">Ready</span><strong id="fc-multiplier">1.00×</strong><span id="fc-countdown"></span></div></div><aside class="fc-ladder" aria-label="Multiplier milestones">${crashMeterMarkup()}<button id="fc-cashout" disabled>Cash out <strong id="fc-return">100 pts</strong></button></aside></div><form class="fc-round-actions"><label for="fc-stake">Points stake<input id="fc-stake" type="number" inputmode="numeric" min="1" max="1000" step="1" required value="100" aria-describedby="fc-stake-help"></label><button id="fc-start" type="submit">Play</button><small id="fc-stake-help">1–1,000 free points per round</small></form><p id="fc-message" role="status" aria-live="polite">Cash out before the multiplier crashes.</p><p class="fc-small">Virtual points only. No cash prizes.</p><details id="fc-proof" hidden><summary>Round verification</summary><p id="fc-proof-text"></p></details></section>
    <dialog id="fc-menu-dialog"><h2>Game controls</h2><p>Opening this menu does not pause a round.</p><div id="fc-menu-audio"></div><button id="fc-close">Close</button></dialog>`;
  const q = s => root.querySelector(s);
  // Vector control artwork stays sharp at all phone resolutions.
  q('.fc-menu').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m9 3-.5 2-2 .9-1.9-.6-2 3.4 1.5 1.5v2.3L2.6 14l2 3.4 2-.6 1.9 1 .5 2.2h4l.6-2.2 1.9-1 2 .6 2-3.4-1.5-1.5v-2.3l1.5-1.5-2-3.4-2 .6-1.9-.9L13 3Z"/><circle cx="11" cy="11.5" r="3"/></svg>';
  const audio = createAudio(root);
  const updateMeter=bindCrashMeter(root);
  let view, round, token, authority = 'local', busy = false, stopped = false;
  let frame = 0, pollTimer = 0, pollBusy = false, eventId = 0, priorStatus;
  let localCrashAt = 0, clockOffset = 0, lastPollAt = 0, nextPracticeCrash;
  const active = () => round && ['ready', 'active'].includes(round.status);
  const points = n => Number(n || 0).toLocaleString(undefined, {maximumFractionDigits: 2});
  const say = text => { q('#fc-message').textContent = text; };
  const event = type => audio.update([{eventId: ++eventId, type}], {state:'ended'});
  function update(snapshot) {
    if (stopped) return;
    if (round?.roundId === snapshot.roundId && round && !active() && ['ready','active'].includes(snapshot.status)) return;
    round = snapshot;
    if (snapshot.serverNow) clockOffset = snapshot.serverNow - Date.now();
    if (snapshot.status !== priorStatus) {
      if (snapshot.status === 'crashed') { say('Crashed. This round returned 0 points.'); event('BALL_DRAINED'); }
      if (snapshot.status === 'cashed_out') { say(`Cashed out at ${Number(snapshot.multiplier).toFixed(2)}×. Return: ${points(snapshot.payout)} virtual points.`); event('BANK_ACCEPTED'); }
      priorStatus = snapshot.status;
    }
    q('.fc-round-actions').hidden = !!active();
    q('#fc-stake').disabled = !!active();
    q('#fc-start').textContent = round && !active() ? 'Play again' : 'Play';
    if (!active()) {
      audio.update([], {state:'ended'});
      if (round.reveal) {
        q('#fc-proof').hidden = false;
        q('#fc-proof-text').textContent = `Commitment: ${round.commitment}. Seed: ${round.reveal.seed}. Crash multiplier: ${round.reveal.crashMultiplier}. Rules: ${round.rulesVersion}.`;
      }
    }
  }
  async function request(path, method = 'GET', body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(server + path, {method, signal:controller.signal, headers:{'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {})}, ...(body ? {body:JSON.stringify(body)} : {})});
      const data = await response.json();
      const snapshot = data.round || data;
      if (!response.ok && !(response.status === 409 && snapshot.status)) throw Error(data.error || 'Round request failed.');
      return snapshot;
    } finally { clearTimeout(timeout); }
  }
  async function poll() {
    if (stopped || pollBusy || authority !== 'server' || !round?.roundId || !active()) return;
    pollBusy = true;
    const requestedRoundId = round.roundId;
    try { const next = await request(`/crash/rounds/${encodeURIComponent(requestedRoundId)}`); if(stopped || round?.roundId !== requestedRoundId)return; lastPollAt = Date.now(); update(next); }
    catch { if(!stopped && round?.roundId === requestedRoundId)say('Connection interrupted. The hosted round continues; reconnecting…'); }
    finally { pollBusy = false; }
  }
  function settleLocal(now) {
    if (!active()) return;
    if (now >= localCrashAt) update({...round, status:'crashed', multiplier:round.crashMultiplier, payout:0});
    else if (now >= round.startAt && round.status === 'ready') update({...round,status:'active'});
  }
  function displayedMultiplier(now) {
    if (!round || round.status === 'ready') return 1;
    if (round.status !== 'active') return Number(round.multiplier || 1);
    return Math.min(100, Math.floor(Math.exp(Math.max(0, now-round.startAt)/10000)*100)/100);
  }
  function draw() {
    if (stopped) return;
    const now = authority === 'server' ? Date.now() + clockOffset : performance.now();
    if (authority === 'local') settleLocal(now);
    const multiplier = displayedMultiplier(now);
    q('#fc-multiplier').textContent = `${multiplier.toFixed(2)}×`;
    q('#fc-round-state').textContent = {ready:'Get ready',active:'Live',crashed:'CRASHED',cashed_out:'CASHED OUT'}[round?.status] || 'Ready';
    q('#fc-countdown').textContent = round?.status === 'ready' ? String(Math.max(0,Math.ceil((round.startAt-now)/1000))) : '';
    q('#fc-return').textContent = `${points(Math.floor((round?.stake || Number(q('#fc-stake').value))*multiplier))} pts`;
    // If hosted updates are stale, don't present an apparently actionable confirmed cashout.
    q('#fc-cashout').disabled = busy || round?.status !== 'active' || (authority === 'server' && Date.now()-lastPollAt > 2500);
    root.dataset.roundState = round?.status || 'idle';
    updateMeter(multiplier,round?.status);
    view?.update({multiplier,state:round?.status || 'ready'});
    audio.update([], {state:round?.status === 'active' ? 'active' : 'ended'});
    frame = requestAnimationFrame(draw);
  }
  q('#fc-authority').onchange = () => { q('.fc-authority-note').textContent = q('#fc-authority').value === 'server' ? 'The server determines the crash and cashout result. This is still free-point practice.' : 'Local practice runs on this device. It is not server-verified or provably fair.'; };
  q('#fc-enter').onclick = async () => {
    authority = q('#fc-authority').value;
    q('#fc-mode-label').textContent = authority === 'server' ? 'HOSTED PRACTICE' : 'LOCAL PRACTICE';
    q('#fc-stake-label').textContent = points(Number(q('#fc-stake').value));
    q('.fc-setup').hidden = true; q('.fc-play').hidden = false;
    q('#fc-menu-audio').append(q('#fp-audio'));
    if (!view) { try { view = await createCrashView(q('#fc-arena')); } catch { say('3D artwork could not load. Round controls remain available.'); } }
    window.dispatchEvent(new Event('resize')); q('#fc-start').focus();
  };
  q('#fc-stake').oninput = () => q('#fc-stake').setCustomValidity('');
  q('.fc-round-actions').onsubmit = async e => {
    e.preventDefault();
    if (busy || active()) return;
    const stake = Number(q('#fc-stake').value);
    if (!Number.isInteger(stake) || stake < 1 || stake > 1000) { q('#fc-stake').setCustomValidity('Enter a whole number from 1 to 1,000.'); q('#fc-stake').reportValidity(); return; }
    q('#fc-stake').disabled = true;
    q('#fc-stake-label').textContent = points(stake);
    busy = true; q('#fc-start').disabled = true; q('#fc-proof').hidden = true; audio.reset(); priorStatus = null; eventId = 0;
    try {
      if (authority === 'server') {
        token = undefined;
        const next = await request('/crash/rounds','POST',{stake});
        token = next.token; delete next.token;
        lastPollAt = Date.now(); update(next);
      } else {
        const random = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
        const crashMultiplier = nextPracticeCrash ?? Math.min(100,Math.max(1,Math.floor(1 / Math.max(.000001,1-random)*100)/100));
        nextPracticeCrash = undefined;
        const startAt = performance.now()+3000;
        localCrashAt = startAt + Math.log(crashMultiplier)*10000;
        update({roundId:crypto.randomUUID(),status:'ready',startAt,stake,multiplier:1,crashMultiplier,payout:0,authority:'local'});
      }
      say('The multiplier starts after the countdown. Cash out before it crashes.');
    } catch(error) { say(`${error.message} No round was confirmed. Check the connection before retrying.`); }
    finally { busy = false; q('#fc-start').disabled = false; q('#fc-stake').disabled = !!active(); }
  };
  q('#fc-cashout').onclick = async () => {
    if (busy || round?.status !== 'active') return;
    busy = true;
    try {
      if (authority === 'server') { update(await request(`/crash/rounds/${encodeURIComponent(round.roundId)}/cashout`,'POST',{})); lastPollAt = Date.now(); }
      else {
        const now = performance.now(); settleLocal(now);
        if (round.status === 'active') { const multiplier = displayedMultiplier(now); update({...round,status:'cashed_out',multiplier,payout:Math.floor(round.stake*multiplier)}); }
      }
    } catch { say('Cashout not confirmed. Reconnecting to obtain the server result…'); await poll(); }
    finally { busy = false; }
  };
  const dialog = q('#fc-menu-dialog');
  q('.fc-menu').onclick = () => { q('#fc-menu-audio').append(q('#fp-audio')); dialog.showModal(); };
  dialog.addEventListener('close',()=>{if(!q('.fc-setup').hidden)q('.fp-actions').append(q('#fp-audio'));}); q('#fc-close').onclick = () => dialog.close();
  const visibility = () => { if (!document.hidden) poll(); };
  document.addEventListener('visibilitychange',visibility);
  pollTimer = setInterval(poll,250); draw();
  const dispose = () => { stopped = true; cancelAnimationFrame(frame); clearInterval(pollTimer); document.removeEventListener('visibilitychange',visibility); view?.dispose(); audio.dispose(); };
  window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) window.__crash = {ready:true,snapshot:()=>round ? {...round} : null,get view(){return view;},get source(){return authority;},audio,dispose,setNextPracticeCrash(value){if(Number.isFinite(value)&&value>=1&&value<=100)nextPracticeCrash=value;}};
}
