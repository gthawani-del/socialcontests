import { createPredictionStore } from '../fantasy/prediction-store.js';
import { createMockMatchFeed } from './match-feed.js';
import '../ui/watch.css';

const app = document.querySelector('#cricketWatchApp');
if (!app) throw new Error('Cricket Pinball spectator root not found.');

const matchId = window.location.pathname.match(/\/watch\/([^/]+)/)?.[1] || 'demo';
const predictions = createPredictionStore(matchId);
const feed = createMockMatchFeed(matchId);

app.innerHTML = `
  <main class="watch-shell">
    <header><a href="/cricket-pinball">← CRICKET PINBALL</a><div><span>LIVE SPECTATOR</span><strong>MATCH ${escapeHtml(matchId.toUpperCase())}</strong></div></header>
    <section class="watch-scoreboard">
      <div class="watch-player"><span>PLAYER 1</span><strong id="player1">—</strong></div>
      <div class="watch-score"><small id="format">—</small><strong id="score">0/0</strong><span id="matchState">MATCH AVAILABLE</span></div>
      <div class="watch-player right"><span>PLAYER 2</span><strong id="player2">—</strong></div>
    </section>
    <section class="watch-grid">
      <article class="match-card">
        <h2>Match state</h2>
        <dl>
          <div><dt>Innings</dt><dd id="innings">—</dd></div>
          <div><dt>Target</dt><dd id="target">—</dd></div>
          <div><dt>Balls remaining</dt><dd id="balls">—</dd></div>
          <div><dt>Current batter</dt><dd id="batter">—</dd></div>
          <div><dt>Current bowler</dt><dd id="bowler">—</dd></div>
          <div><dt>Toss</dt><dd id="toss">—</dd></div>
        </dl>
      </article>
      <article class="pick-card">
        <p>FAN PICK</p>
        <h1>PREDICT THE WINNER</h1>
        <span>Your pick is for fan points only. No money or prizes.</span>
        <div class="pick-buttons">
          <button type="button" data-pick="p1">PLAYER 1</button>
          <button type="button" data-pick="p2">PLAYER 2</button>
        </div>
        <button type="button" id="confirmPick" disabled>CONFIRM PICK</button>
        <strong id="pickStatus">Choose before the first delivery.</strong>\n        <div class="fan-stats"><span>POINTS <b id="fanPoints">0</b></span><span>STREAK <b id="fanStreak">0</b></span></div>
      </article>
    </section>
    <section class="demo-strip" id="demoStrip"><span>LOCAL MOCK FEED · architecture ready for authoritative match events</span><button id="startDemo" type="button">START DEMO MATCH</button></section>
  </main>
`;

let selected = predictions.get()?.playerId || null;
let lastState = null;

document.querySelectorAll('[data-pick]').forEach((button) => {
  button.addEventListener('click', () => {
    if (predictions.get()?.locked) return;
    selected = button.dataset.pick;
    predictions.select(selected);
    renderPick();
  });
});

document.querySelector('#confirmPick').addEventListener('click', () => {
  predictions.confirm();
  renderPick();
});

document.querySelector('#startDemo').addEventListener('click', () => {
  const pick = predictions.get();
  if (pick?.confirmed) predictions.lock();
  feed.startDemo();
  renderPick();
});

const unsubscribe = feed.subscribe((state) => {
  lastState = state;
  if (state.status !== 'MATCH_AVAILABLE' && predictions.get()?.confirmed) predictions.lock();
  if (state.status === 'MATCH_OVER' && state.winnerId) predictions.resolve(state.winnerId);
  renderMatch(state);
  renderPick();
});

window.addEventListener('pagehide', () => {
  unsubscribe();
  feed.dispose();
}, { once: true });

function renderMatch(state) {
  setText('player1', state.player1.name);
  setText('player2', state.player2.name);
  setText('format', state.format);
  setText('score', `${state.score.runs}/${state.score.wickets}`);
  setText('matchState', state.status.replaceAll('_', ' '));
  setText('innings', String(state.innings));
  setText('target', state.target ?? '—');
  setText('balls', String(state.ballsRemaining));
  setText('batter', state.batterId === 'p1' ? state.player1.name : state.player2.name);
  setText('bowler', state.bowlerId === 'p1' ? state.player1.name : state.player2.name);
  setText('toss', state.toss);
  document.querySelector('#startDemo').disabled = state.status !== 'MATCH_AVAILABLE';
}

function renderPick() {
  const pick = predictions.get();
  document.querySelectorAll('[data-pick]').forEach((button) => {
    button.classList.toggle('active', button.dataset.pick === selected);
    button.disabled = Boolean(pick?.locked);
  });
  const confirm = document.querySelector('#confirmPick');
  confirm.disabled = !selected || Boolean(pick?.confirmed) || Boolean(pick?.locked);

  let status = 'Choose before the first delivery.';
  if (pick?.result) status = pick.result === 'CORRECT' ? 'CORRECT PICK · +1 POINT' : 'INCORRECT PICK';
  else if (pick?.locked) status = 'PICK LOCKED · MATCH IN PROGRESS';
  else if (pick?.confirmed) status = 'PICK CONFIRMED · locks on first delivery';
  else if (pick) status = `${pick.playerId === 'p1' ? 'PLAYER 1' : 'PLAYER 2'} SELECTED`;
  document.querySelector('#pickStatus').textContent = status;
}

function setText(id, value) {
  document.querySelector('#' + id).textContent = value;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
