import './ui/cricket-pinball.css';
import { installHowToPinCricket } from './ui/how-to-pin-cricket.js';

const STORAGE_KEY = 'cricket-pinball-preferences-v1';
const app = document.querySelector('#cricketPinballApp');
const formats = { LAST_3: '3 balls', ONE_OVER: '1 over', TWO_OVER: '2 overs' };
const difficulties = { EASY: 'Easy', MEDIUM: 'Normal', HARD: 'Hard' };
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
      <a class="worlds-link" href="/">All games</a>
    </header>
    <section class="cricket-lobby" aria-labelledby="cricketLobbyTitle">
      <div class="cricket-identity"><h1 id="cricketLobbyTitle">Cricket Pinball</h1><p>Cricket strategy. Pinball reflexes.</p></div>
      <figure class="stadium-preview"><img src="/assets/cricket/world/stadium-lobby-r28.png" alt="Night stadium with two flipper bats, scoring ramps and a right-side bowling lane" width="600" height="842" fetchpriority="high"><figcaption hidden>Stadium preview unavailable. Your match is ready to start.</figcaption></figure>
      <section class="cricket-lobby-panel" aria-labelledby="matchSetupTitle">
        <div class="match-heading"><h2 id="matchSetupTitle">Your match</h2><span>You vs CPU</span></div>
        <fieldset><legend>Match length</legend><div class="cricket-segmented">${Object.entries(formats).map(([value,label])=>`<button type="button" data-format="${value}" aria-pressed="false">${label}</button>`).join('')}</div></fieldset>
        <fieldset><legend>Difficulty</legend><div class="cricket-segmented">${Object.entries(difficulties).map(([value,label])=>`<button type="button" data-difficulty="${value}" aria-pressed="false">${label}</button>`).join('')}</div></fieldset>
        <button type="button" id="cricketStart" class="cricket-start">Play match <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button>
        <p class="match-note" id="matchNote"></p>
      </section>
    </section>
  </main>`;
installHowToPinCricket({root:app,context:'lobby'});
const help = app.querySelector('.how-pin-trigger');
help.innerHTML = 'How to play';
app.querySelector('.cricket-sitebar').append(help);
app.querySelector('.stadium-preview img').addEventListener('error',event=>{
  event.target.hidden=true;app.querySelector('figcaption').hidden=false;
});
function sync() {
  for(const key of ['format','difficulty']) app.querySelectorAll(`[data-${key}]`).forEach(button=>{
    button.setAttribute('aria-pressed',String(button.dataset[key]===state[key]));
  });
  const balls={LAST_3:3,ONE_OVER:6,TWO_OVER:12}[state.format];
  app.querySelector('#matchNote').textContent=`${balls} balls per innings · 2 wickets · Toss to start`;
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
