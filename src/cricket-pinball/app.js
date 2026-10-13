import './ui/cricket-pinball.css';
import { installHowToPinCricket } from './ui/how-to-pin-cricket.js';

const STORAGE_KEY = 'cricket-pinball-preferences-v1';
const app = document.querySelector('#cricketPinballApp');
const formats = { LAST_3: '3 balls', ONE_OVER: '1 over', TWO_OVER: '2 overs' };
const difficulties = { EASY: 'Easy', MEDIUM: 'Normal', HARD: 'Hard' };
const difficultyHints = { EASY: 'A gentler challenge', MEDIUM: 'A balanced match', HARD: 'A tougher opponent' };
const iconPaths = {
  back: '<path d="m14 5-7 7 7 7"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4M9 12h6"/>',
  ball: '<circle cx="12" cy="12" r="10"/><path d="m4 18 14-14M6 20 20 6"/>',
  wickets: '<path d="M5 21V5h14v16M12 5v16M4 2h7m2 0h7"/>',
  toss: '<ellipse cx="12" cy="6" rx="8" ry="4"/><path d="M4 6v12c0 5 16 5 16 0V6M4 12c0 5 16 5 16 0"/>',
  bat: '<path d="m14 8 6-6 2 2-6 6M3 15l8-8 6 6-8 8a2 2 0 0 1-3 0l-3-3a2 2 0 0 1 0-3Z"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${iconPaths[name]}</svg>`;
const options = values => Object.entries(values).map(([value, label]) =>
  `<option value="${value}">${label}</option>`
).join('');
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch {}
const state = {
  format: Object.hasOwn(formats, saved.format) ? saved.format : 'ONE_OVER',
  difficulty: Object.hasOwn(difficulties, saved.difficulty) ? saved.difficulty : 'MEDIUM'
};
document.documentElement.dataset.product = 'cricket-pinball';
app.innerHTML = `
  <main class="cricket-pinball-shell">
    <header class="cricket-sitebar">
      <a class="worlds-link" href="/">${icon('back')}All games</a>
    </header>
    <section class="cricket-lobby" aria-labelledby="cricketLobbyTitle">
      <div class="cricket-identity"><span class="cricket-eyebrow">ARCADE CRICKET</span><h1 id="cricketLobbyTitle">Cricket <span>Pinball</span></h1><p>Time your shots. Defend your score.</p></div>
      <figure class="stadium-preview"><img src="/assets/cricket/world/cricket-settings-stadium.webp" alt="Cricket pinball stadium with wooden bat flippers, a red cricket ball and gold scoring ramps" width="1200" height="800" fetchpriority="high"><figcaption hidden>Stadium preview unavailable. Your match is ready to start.</figcaption></figure>
      <section class="cricket-lobby-panel" aria-labelledby="matchSetupTitle">
        <div class="match-heading"><h2 id="matchSetupTitle">Your match</h2><span>${icon('cpu')}You vs CPU</span></div>
        <div class="match-settings">
          <div class="setting-card">
            <label for="matchFormat">Match length</label>
            <span class="setting-value" aria-hidden="true"><span id="formatValue">1 over</span>${icon('chevron')}</span>
            <span class="setting-hint" id="formatHint"><span id="matchBalls">6 balls</span> per innings</span>
            <select id="matchFormat" data-setting="format" aria-describedby="formatHint">${options(formats)}</select>
          </div>
          <div class="setting-card">
            <label for="matchDifficulty">Difficulty</label>
            <span class="setting-value" aria-hidden="true"><span id="difficultyValue">Normal</span>${icon('chevron')}</span>
            <span class="setting-hint" id="difficultyHint">A balanced match</span>
            <select id="matchDifficulty" data-setting="difficulty" aria-describedby="difficultyHint">${options(difficulties)}</select>
          </div>
        </div>
        <ul class="match-note" id="matchNote" aria-label="Match rules">
          <li>${icon('wickets')}<span>2 wickets</span></li>
          <li>${icon('toss')}<span>Toss to start</span></li>
        </ul>
        <div style="text-align:center;margin:12px 0"><button type="button" id="cricketVoiceTest" style="background:none;border:0;color:#f5c46c;text-decoration:underline;font:inherit;cursor:pointer;padding:8px">♫ Test Navjot Voice</button><div id="cricketVoiceStatus" role="status" aria-live="polite" style="font-size:13px;color:#d3dce6"></div></div>
        <button type="button" id="cricketStart" class="cricket-start">Play match ${icon('arrow')}</button>
        <nav class="practice-links" aria-label="Practice"><a href="/cricket-pinball/play/?practice=bat">${icon('bat')}Practise batting</a><a href="/cricket-pinball/play/?practice=bowl">${icon('ball')}Practise bowling</a></nav>
      </section>
    </section>
  </main>`;
installHowToPinCricket({root:app,context:'lobby'});
const help = app.querySelector('.how-pin-trigger');
help.innerHTML = `${icon('help')}How to play`;
app.querySelector('.cricket-sitebar').append(help);
app.querySelector('.stadium-preview img').addEventListener('error',event=>{
  event.target.hidden=true;app.querySelector('figcaption').hidden=false;
});
function sync() {
  for(const key of ['format','difficulty']) app.querySelector(`[data-setting="${key}"]`).value=state[key];
  app.querySelector('#formatValue').textContent=formats[state.format];
  app.querySelector('#difficultyValue').textContent=difficulties[state.difficulty];
  app.querySelector('#difficultyHint').textContent=difficultyHints[state.difficulty];
  const balls={LAST_3:3,ONE_OVER:6,TWO_OVER:12}[state.format];
  app.querySelector('#matchBalls').textContent=`${balls} balls`;
}
app.addEventListener('change',event=>{
  const key=event.target.dataset.setting;
  if(key==='format'||key==='difficulty'){state[key]=event.target.value;sync();}
});
app.querySelector('#cricketVoiceTest').addEventListener('click', async () => {
  const button = app.querySelector('#cricketVoiceTest');
  const status = app.querySelector('#cricketVoiceStatus');
  button.disabled = true;
  status.textContent = 'Generating commentary…';
  const started = performance.now();
  try {
    const response = await fetch('/api/cricket-voice-test');
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error([data.error || `HTTP ${response.status}`, data.details].filter(Boolean).join(': '));
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
    await audio.play();
    status.textContent = `Voice playing · ${Math.round(performance.now() - started)} ms`;
  } catch (error) {
    status.textContent = `Voice test failed: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});
app.addEventListener('click',event=>{
  if(event.target.closest('#cricketStart')){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({...state,mode:'CPU',hasPlayed:true}));}catch{}
    location.assign(`/cricket-pinball/play/?${new URLSearchParams({...state,mode:'CPU'})}`);
  }
});
sync();
