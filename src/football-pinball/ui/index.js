import './ui.css';

export const MODE_UI = Object.freeze({
  pvp: { title: 'PvP Match', tag: 'Head to head', description: 'Defend your goal. Find the opening.', accent: 'blue', icon: 'match', help: 'Use the left and right boots to strike the ball. A goal counts only when the whole ball crosses the goal line. Blue defends the near goal; red defends the far goal.' },
  penalty: { title: 'Penalty Shootout', tag: 'Skill · Accuracy', description: 'Five shots. Beat the keeper.', accent: 'red', icon: 'goal', help: 'Time each boot strike to direct your shot around the keeper. Your main result is goals out of five; precision bonuses add points.' },
  crash: { title: 'Crash', tag: 'Survival · Timing', description: 'Keep the ball alive. Bank points.', accent: 'gold', icon: 'rise', help: 'Build points by hitting targets while the survival multiplier rises. Bank Points secures your round and ends the run. Draining loses unbanked points. These are virtual points with no cash value.' },
  'arcade-rush': { title: 'Arcade Rush', tag: 'Time · High score', description: '90 seconds. Make every hit count.', accent: 'green', icon: 'clock', help: 'Hit targets, build combos and score before time runs out. A drain relaunches the ball while the timer continues. Time targets and multiball extend your scoring opportunities.' },
});
const symbols = {
  match: '<path d="M8 5h8v7a4 4 0 0 1-8 0V5Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v5m-4 0h8"/>',
  goal: '<path d="M3 20V5h18v15M3 9h18M7 5v15m5-15v15m5-15v15M3 14h18"/><circle cx="12" cy="17" r="3"/>',
  rise: '<path d="m4 18 6-6 4 3 6-10m-6 0h6v6"/>',
  clock: '<circle cx="12" cy="14" r="8"/><path d="M9 2h6m-3 0v4m0 3v5l3 2m4-10 2-2"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbols[name]}</svg>`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const number = value => Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US');
const clock = value => { const s = Math.max(0, Math.ceil(Number(value) || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const header = (mode) => `<header class="fp-topbar"><a class="fp-back" href="${mode ? '/football-pinball/' : '/'}" aria-label="${mode ? 'Choose a football mode' : 'Back to Infinite Pinball'}"><span aria-hidden="true">‹</span> ${mode ? 'Modes' : 'Games'}</a><div class="fp-wordmark">FOOTBALL<span>PINBALL</span></div><span class="fp-build-label">${mode ? 'PLAY' : 'FOUR MODES'}</span></header>`;

export function renderLobby(root = document.querySelector('#footballApp')) {
  root.className = 'fp-lobby';
  root.innerHTML = `${header()}<section class="fp-lobby-intro"><p class="fp-eyebrow">FOOTBALL PINBALL</p><h1>Choose your game.</h1><p>Four ways to play. One table sport.</p></section><section class="fp-mode-grid" aria-label="Game modes">${Object.entries(MODE_UI).map(([key, mode], index) => `<a class="fp-mode-card fp-accent-${mode.accent}" href="?mode=${key}"><div class="fp-card-top"><span class="fp-mode-icon">${icon(mode.icon)}</span><span class="fp-mode-number">0${index + 1}</span></div><h2>${mode.title}</h2><p>${mode.description}</p><div class="fp-card-footer"><span>${mode.tag}</span><span class="fp-card-arrow" aria-hidden="true">↗</span></div></a>`).join('')}</section><details class="fp-how"><summary>How to play</summary><p>Tap and hold a boot control to flip; release to return it. On a keyboard, use A and D for your left and right boots.</p><p>Each mode has its own scoring and match rules. Open its rules panel before playing.</p></details><p class="fp-lobby-note">Virtual points only. No deposits or withdrawals.</p>`;
}

const stat = (id, label, value, extra = '') => `<div class="fp-stat ${extra}"><span>${label}</span><strong id="${id}">${value}</strong></div>`;
function hud(mode) {
  if (mode === 'pvp') return `${stat('blueScore', 'BLUE', '0', 'fp-blue')}${stat('fp-time', 'MATCH', '—')}${stat('redScore', 'RED', '0', 'fp-red')}`;
  if (mode === 'crash') return `${stat('fp-multiplier', 'SURVIVAL', '1.00×')}${stat('fp-base', 'BASE POINTS', '0')}${stat('fp-bank-value', 'BANK VALUE', '0')}`;
  if (mode === 'penalty') return `${stat('fp-shots', 'SHOTS', '0 / 5')}${stat('fp-goals', 'GOALS', '0')}${stat('fp-points', 'POINTS', '0')}${stat('fp-streak', 'STREAK', '0')}`;
  return `${stat('fp-time', 'TIME LEFT', '1:30')}${stat('fp-points', 'POINTS', '0')}${stat('fp-combo', 'COMBO', '1×')}`;
}
export function renderGameShell(root, mode = 'pvp', { localControls = false } = {}) {
  if (!MODE_UI[mode]) throw new Error(`Unknown football mode: ${mode}`);
  const data = MODE_UI[mode];
  root.className = `fp-game fp-accent-${data.accent}`;
  root.dataset.mode = mode;
  root.innerHTML = `${header(mode)}<div class="fp-mode-heading"><h1>${data.title}</h1><span id="fp-session-label">LOCAL PLAY</span></div><section class="fp-hud" aria-label="Game statistics">${hud(mode)}</section><div id="fp-arena"><p id="fp-loading" role="status">Preparing physics…</p></div><p id="fp-status" role="status">Preparing game…</p><section class="fp-controls" aria-label="Boot controls">${mode === 'pvp' && localControls ? '<div class="fp-opponent-controls"><button data-boot="red-left" aria-pressed="false" disabled>Red left <kbd>J</kbd></button><button data-boot="red-right" aria-pressed="false" disabled>Red right <kbd>L</kbd></button></div>' : ''}<div><button data-boot="blue-left" aria-pressed="false" disabled><span aria-hidden="true">↖</span> Left boot <kbd>A</kbd></button><button data-boot="blue-right" aria-pressed="false" disabled>Right boot <span aria-hidden="true">↗</span> <kbd>D</kbd></button></div></section><nav class="fp-actions" aria-label="Game actions"><button id="fp-serve" disabled>Start</button>${mode === 'crash' ? '<button id="fp-bank" disabled>Bank Points</button>' : ''}<button id="fp-pause" disabled>Pause</button><button id="fp-reset" disabled>Restart</button></nav><details class="fp-how"><summary>Rules & controls</summary><p>${data.help}</p><p>Hold the left or right boot, then release. Keyboard: A / D.${localControls ? ' Red team: J / L.' : ''} Pause freezes play.</p></details><section id="fp-results" class="fp-results" aria-label="Match results" hidden></section>`;
  return { arena: root.querySelector('#fp-arena'), status: root.querySelector('#fp-status') };
}

/** Values are supplied by the game controller; this layer never calculates scores. */
export function updateHud(root, state = {}) {
  const set = (id, value) => { const el = root.querySelector(`#${id}`); if (el && el.textContent !== String(value)) el.textContent = value; };
  if (state.score?.blue != null) set('blueScore', number(state.score.blue));
  if (state.score?.red != null) set('redScore', number(state.score.red));
  if (state.remainingSeconds != null) set('fp-time', clock(state.remainingSeconds));
  if (state.multiplier != null) set('fp-multiplier', `${Number(state.multiplier).toFixed(2)}×`);
  if (state.basePoints != null) set('fp-base', number(state.basePoints));
  if (state.bankValue != null) set('fp-bank-value', number(state.bankValue));
  if (state.points != null) set('fp-points', number(state.points));
  if (state.combo != null) set('fp-combo', `${state.combo}×`);
  if (state.shots != null) set('fp-shots', `${number(state.shots)} / ${number(state.totalShots ?? 5)}`);
  if (state.goals != null) set('fp-goals', number(state.goals));
  if (state.streak != null) set('fp-streak', number(state.streak));
  if (state.status != null) set('fp-status', state.status);
  if (state.sessionLabel != null) set('fp-session-label', state.sessionLabel);
  if (state.paused != null) set('fp-pause', state.paused ? 'Resume' : 'Pause');
  if (state.serveLabel != null) set('fp-serve', state.serveLabel);
  for (const [id, key] of [['fp-serve','canServe'],['fp-bank','canBank'],['fp-pause','canPause'],['fp-reset','canReset']]) {
    const button = root.querySelector(`#${id}`);
    if (button && key in state) button.disabled = !state[key];
  }
  if ('canFlip' in state) root.querySelectorAll('[data-boot]').forEach(button => { button.disabled = !state.canFlip; });
  root.classList.toggle('fp-final-rush', Boolean(state.finalRush));
}
export function renderResults(root, { title = 'Match complete', summary = '', points, rows = [] } = {}) {
  const results = root.querySelector('#fp-results');
  results.hidden = false;
  results.innerHTML = `<h2 tabindex="-1">${escape(title)}</h2><p>${escape(summary)}</p>${points != null ? `<strong class="fp-result-points">${number(points)} <small>points</small></strong>` : ''}${rows.length ? `<dl>${rows.map(row => `<div><dt>${escape(row.label)}</dt><dd>${escape(row.value)}</dd></div>`).join('')}</dl>` : ''}<p>Use Restart to play again, or <a href="/football-pinball/">choose another mode</a>.</p>`;
  results.querySelector('h2').focus({ preventScroll: true });
  results.scrollIntoView({ behavior: 'auto', block: 'nearest' });
}
