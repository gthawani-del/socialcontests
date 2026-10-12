import './ui/cricket-pinball.css';
import { installHowToPinCricket } from './ui/how-to-pin-cricket.js';

const STORAGE_KEY = 'cricket-pinball-preferences-v1';
const app = document.querySelector('#cricketPinballApp');
const formats = { LAST_3: '3 balls', ONE_OVER: '1 over', TWO_OVER: '2 overs' };
const difficulties = { EASY: 'Easy', MEDIUM: 'Normal', HARD: 'Hard' };
const iconPaths = {
  back: '<path d="m14 5-7 7 7 7"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  check: '<circle cx="12" cy="12" r="10" class="selection-disc"/><path d="m7 12 3 3 7-7"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4M9 12h6"/>',
  ball: '<circle cx="12" cy="12" r="10"/><path d="m4 18 14-14M6 20 20 6"/>',
  wickets: '<path d="M5 21V5h14v16M12 5v16M4 2h7m2 0h7"/>',
  toss: '<ellipse cx="12" cy="6" rx="8" ry="4"/><path d="M4 6v12c0 5 16 5 16 0V6M4 12c0 5 16 5 16 0"/>',
  bat: '<path d="m14 8 6-6 2 2-6 6M3 15l8-8 6 6-8 8a2 2 0 0 1-3 0l-3-3a2 2 0 0 1 0-3Z"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${iconPaths[name]}</svg>`;
const options = (key, values) => Object.entries(values).map(([value, label]) =>
  `<button type="button" data-${key}="${value}" aria-pressed="false"><span>${label}</span>${icon('check')}</button>`
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
      <a class="infinite-brand" href="/" aria-label="Infinite Pinball home"><img src="/homepage/logos/01_logo_horizontal_transparent.webp" alt="Infinite Pinball" width="142" height="40"></a>
    </header>
    <a class="worlds-link" href="/">${icon('back')}All games</a>
    <section class="cricket-lobby" aria-labelledby="cricketLobbyTitle">
      <div class="cricket-identity"><span class="cricket-eyebrow">ARCADE CRICKET</span><h1 id="cricketLobbyTitle">Cricket <span>Pinball</span></h1><p>Time your shots. Defend your score.</p></div>
      <figure class="stadium-preview"><img src="/assets/cricket/world/cricket-settings-stadium.webp" alt="Cricket pinball stadium with wooden bat flippers, a red cricket ball and gold scoring ramps" width="1200" height="800" fetchpriority="high"><figcaption hidden>Stadium preview unavailable. Your match is ready to start.</figcaption></figure>
      <section class="cricket-lobby-panel" aria-labelledby="matchSetupTitle">
        <div class="match-heading"><h2 id="matchSetupTitle">Your match</h2><span>${icon('cpu')}You vs CPU</span></div>
        <fieldset><legend>Match length</legend><div class="cricket-segmented">${options('format', formats)}</div></fieldset>
        <fieldset><legend>Difficulty</legend><div class="cricket-segmented">${options('difficulty', difficulties)}</div></fieldset>
        <ul class="match-note" id="matchNote" aria-label="Match rules" aria-live="polite" aria-atomic="true">
          <li>${icon('ball')}<span><strong id="matchBalls">6 balls</strong><br>per innings</span></li>
          <li>${icon('wickets')}<span>2 wickets</span></li>
          <li>${icon('toss')}<span>Toss to start</span></li>
        </ul>
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
  for(const key of ['format','difficulty']) app.querySelectorAll(`[data-${key}]`).forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset[key]===state[key]));
  });
  const balls={LAST_3:3,ONE_OVER:6,TWO_OVER:12}[state.format];
  app.querySelector('#matchBalls').textContent=`${balls} balls`;
}
app.addEventListener('click',event=>{
  for(const key of ['format','difficulty']) {
    const button=event.target.closest(`[data-${key}]`);
    if(button){state[key]=button.dataset[key];sync();return;}
  }
  if(event.target.closest('#cricketStart')){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify({...state,mode:'CPU',hasPlayed:true}));}catch{}
    location.assign(`/cricket-pinball/play/?${new URLSearchParams({...state,mode:'CPU'})}`);
  }
});
sync();
