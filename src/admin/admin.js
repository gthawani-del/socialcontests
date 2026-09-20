import './admin.css';

const root = document.querySelector('#adminApp');
const DRAFT_KEY = 'infinite-pinball-admin-draft-v1';
const ADMIN_PREFS_KEY = 'infinite-pinball-admin-display-v1';

const DEFAULT_DIFFICULTY = {
  easy: {
    label: 'Easy',
    flippers: {
      left: { restAngleDeg: 46, activeAngleDeg: 64, speedDegPerSec: 760, returnSpeedDegPerSec: 560, kick: 1.20 },
      right: { restAngleDeg: 134, activeAngleDeg: 116, speedDegPerSec: 760, returnSpeedDegPerSec: 560, kick: 1.20 }
    },
    launcher: { minPower: 6.15, maxPower: 8.5, tapCharge: 0.18 },
    nudge: { impulse: 0.78, maxWarnings: 4, windowMs: 2500 }
  },
  standard: {
    label: 'Standard',
    flippers: {
      left: { restAngleDeg: 49, activeAngleDeg: 66, speedDegPerSec: 700, returnSpeedDegPerSec: 520, kick: 1.15 },
      right: { restAngleDeg: 131, activeAngleDeg: 114, speedDegPerSec: 700, returnSpeedDegPerSec: 520, kick: 1.15 }
    },
    launcher: { minPower: 5.7, maxPower: 8.5, tapCharge: 0.12 },
    nudge: { impulse: 0.72, maxWarnings: 3, windowMs: 2500 }
  },
  hard: {
    label: 'Hard',
    flippers: {
      left: { restAngleDeg: 53, activeAngleDeg: 69, speedDegPerSec: 660, returnSpeedDegPerSec: 500, kick: 1.10 },
      right: { restAngleDeg: 127, activeAngleDeg: 111, speedDegPerSec: 660, returnSpeedDegPerSec: 500, kick: 1.10 }
    },
    launcher: { minPower: 5.55, maxPower: 8.5, tapCharge: 0.08 },
    nudge: { impulse: 0.68, maxWarnings: 2, windowMs: 2500 }
  }
};

const NAV = [
  ['overview', 'Overview', '⌂'],
  ['game-rules', 'Game Rules', '◎'],
  ['difficulty', 'Difficulty', '◫'],
  ['physics', 'Physics', '⌁'],
  ['ball-playfield', 'Ball & Playfield', '●'],
  ['flippers', 'Flippers', '⌇'],
  ['launcher', 'Launcher', '↟'],
  ['walls', 'Walls & Bounds', '□'],
  ['slingshots', 'Slingshots', '↗'],
  ['bumpers', 'Bumpers', '◉'],
  ['targets', 'Targets & Bank', '✦'],
  ['zones', 'Scoring Zones', '⊙'],
  ['audio', 'Audio', '◖'],
  ['vfx', 'Visual Effects', '✺'],
  ['advanced', 'Advanced', '⚙'],
  ['cricket-pinball', 'CRICKET PINBALL · PRODUCT', '◆']
];

let live = null;
let draft = null;
const requestedSection = new URLSearchParams(window.location.search).get('section');
let active = NAV.some(([id]) => id === requestedSection) ? requestedSection : 'overview';
let query = '';
let dirty = false;
let savedBaseline = null;

const displayPrefs = readAdminDisplayPrefs();
applyAdminDisplayPrefs(displayPrefs);

boot();

async function boot() {
  renderLoading();

  try {
    const [table, rules, cricketTable, cricketRules] = await Promise.all([
      fetchJson('/game/table.json'),
      fetchJson('/game/rules.json'),
      fetchJson('/game/cricket-table.json'),
      fetchJson('/game/cricket-rules.json')
    ]);

    live = {
      table,
      rules,
      difficulty: clone(DEFAULT_DIFFICULTY),
      cricketTable,
      cricketRules
    };

    const saved = safeParse(localStorage.getItem(DRAFT_KEY));
    draft = saved?.table && saved?.rules && saved?.difficulty
      ? {
          ...clone(live),
          ...saved,
          cricketTable: saved.cricketTable || clone(cricketTable),
          cricketRules: saved.cricketRules || clone(cricketRules)
        }
      : clone(live);
    savedBaseline = clone(draft);
    dirty = false;

    renderShell();
    renderActive();
    updateDirtyUi();
    observeAdminTextScale();
    applyAdminDisplayPrefs(displayPrefs);
  } catch (error) {
    root.innerHTML = `
      <main class="fatal">
        <div class="fatal-card">
          <span>ADMIN BOOT ERROR</span>
          <h1>Configuration could not be loaded.</h1>
          <p>${escapeHtml(error.message)}</p>
          <button onclick="location.reload()">Retry</button>
        </div>
      </main>`;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function renderLoading() {
  root.innerHTML = `
    <main class="loading-screen">
      <div class="loader-mark">IP</div>
      <strong>Loading control center…</strong>
      <span>Reading live game configuration</span>
    </main>`;
}

function renderShell() {
  root.innerHTML = `
    <div class="admin-shell">
      <aside class="sidebar">
        <div class="product">
          <div class="product-mark">IP</div>
          <div>
            <strong>Infinite Pinball</strong>
            <span>Control Center</span>
          </div>
        </div>

        <div class="environment-card">
          <i></i>
          <div>
            <strong>Production config</strong>
            <span>Draft editing mode</span>
          </div>
        </div>

        <nav id="sideNav">
          <div class="nav-section-label">GENERAL PINBALL</div>
          ${NAV.filter(([id]) => id !== 'cricket-pinball').map(([id, label, icon]) => `
            <button type="button" data-nav="${id}" class="${id === active ? 'active' : ''}">
              <span class="nav-icon">${icon}</span>
              <span>${label}</span>
            </button>
          `).join('')}
          <div class="nav-section-label product-label">PRODUCT GAMES</div>
          ${NAV.filter(([id]) => id === 'cricket-pinball').map(([id, label, icon]) => `
            <button type="button" data-nav="${id}" class="product-nav ${id === active ? 'active' : ''}">
              <span class="nav-icon">${icon}</span>
              <span>${label}</span>
            </button>
          `).join('')}
        </nav>

        <div class="sidebar-foot">
          <a href="/" target="_blank" rel="noreferrer">Open game ↗</a>
          <span>Config v${draft.table.version} · Rules v${draft.rules.version}</span>
        </div>
      </aside>

      <main class="workspace">
        <header class="topbar">
          <div class="search">
            <span>⌕</span>
            <input id="settingSearch" type="search" placeholder="Search settings…" autocomplete="off" />
            <kbd>⌘ K</kbd>
          </div>
          <div class="top-actions">
            <div class="display-controls" aria-label="Admin display controls">
              <button class="ghost theme-toggle" id="themeToggle" type="button" aria-pressed="false">LIGHT</button>
              <label class="text-scale-control" title="Admin text size">
                <span>A−</span>
                <input id="textScale" type="range" min="85" max="125" step="5" value="100" aria-label="Text size" />
                <span>A+</span>
                <b id="textScaleValue">100%</b>
              </label>
            </div>
            <span class="draft-status" id="draftStatus"><i></i>Saved</span>
            <button class="ghost" id="exportButton" type="button">Export JSON</button>
          </div>
        </header>

        <section class="page-head" id="pageHead"></section>
        <section class="content" id="content"></section>

        <footer class="savebar">
          <div>
            <strong id="changeCount">No unsaved changes</strong>
            <span>Draft changes are stored only in this browser until publishing is connected.</span>
          </div>
          <div class="save-actions">
            <button class="ghost" id="resetButton" type="button">Reset to live</button>
            <button class="primary" id="saveButton" type="button">Save draft</button>
          </div>
        </footer>
      </main>
    </div>
  `;

  root.querySelector('#sideNav').addEventListener('click', (event) => {
    const button = event.target.closest('[data-nav]');
    if (!button) return;
    active = button.dataset.nav;
    const url = new URL(window.location.href);
    if (active === 'overview') url.searchParams.delete('section');
    else url.searchParams.set('section', active);
    window.history.replaceState({}, '', url);
    query = '';
    const search = root.querySelector('#settingSearch');
    if (search) search.value = '';
    root.querySelectorAll('[data-nav]').forEach((node) => node.classList.toggle('active', node === button));
    renderActive();
  });

  const search = root.querySelector('#settingSearch');
  search.addEventListener('input', () => {
    query = search.value.trim().toLowerCase();
    renderActive();
  });

  root.querySelector('#saveButton').addEventListener('click', saveDraft);
  root.querySelector('#resetButton').addEventListener('click', resetLive);
  root.querySelector('#exportButton').addEventListener('click', exportDraft);
  bindDisplayControls();

  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      search.focus();
    }
  });
}

function renderActive() {
  const content = root.querySelector('#content');
  const head = root.querySelector('#pageHead');
  if (!content || !head) return;

  if (query) {
    head.innerHTML = `
      <div>
        <span class="eyebrow">GLOBAL SEARCH</span>
        <h1>Results for “${escapeHtml(query)}”</h1>
        <p>Matching configurable parameters across the gameplay engine.</p>
      </div>`;
    content.innerHTML = renderSearchResults(query);
    bindEditors(content);
    return;
  }

  const meta = pageMeta(active);
  head.innerHTML = `
    <div>
      <span class="eyebrow">${meta.kicker}</span>
      <h1>${meta.title}</h1>
      <p>${meta.description}</p>
    </div>
    <div class="page-badge">${meta.badge}</div>
  `;

  content.innerHTML = renderCategory(active);
  bindEditors(content);
}

function pageMeta(id) {
  const map = {
    overview: ['CONTROL CENTER', 'Gameplay configuration', 'A single view of the live table, difficulty and system tuning.', 'LIVE SOURCE'],
    'game-rules': ['SESSION', 'Game Rules', 'Control ball count, drain flow and session timing.', 'RULES.JSON'],
    difficulty: ['BALANCE', 'Difficulty Presets', 'Tune Easy, Standard and Hard without changing core engine code.', '3 PRESETS'],
    physics: ['ENGINE', 'Physics', 'Simulation cadence, gravity, damping and rolling behaviour.', 'FIXED STEP'],
    'ball-playfield': ['TABLE', 'Ball & Playfield', 'Ball dimensions, speed limits, surface height and drain geometry.', 'TABLE.JSON'],
    flippers: ['MECHANICS', 'Flippers', 'Geometry, travel, response speed, bounce and powered kick.', '2 FLIPPERS'],
    launcher: ['MECHANICS', 'Launcher', 'Spawn, charge curve, lane geometry and table-entry kick.', 'PLUNGER'],
    walls: ['GEOMETRY', 'Walls & Bounds', 'Collision rails and safety bounds that define playable space.', '5 WALLS'],
    slingshots: ['MECHANICS', 'Slingshots', 'Position, bounce, impulse, cooldown and score.', '2 SLINGS'],
    bumpers: ['MECHANICS', 'Bumpers', 'Placement, hit radius, energy, cooldown and scoring.', '3 BUMPERS'],
    targets: ['SCORING', 'Targets & Target Bank', 'Individual target response plus PARIS bank completion behaviour.', '6 TARGETS'],
    zones: ['SCORING', 'Scoring Zones', 'Non-blocking scoring areas with independent re-arm rules.', '1 ZONE'],
    audio: ['FEEDBACK', 'Audio', 'Master sound plus per-mechanic gain controls.', 'WEB AUDIO'],
    vfx: ['FEEDBACK', 'Visual Effects', 'Particles, pulse rings, ball trail, quality and shake intensity.', 'WEBGL'],
    advanced: ['SYSTEM', 'Advanced', 'Versioning and currently declared compatibility fields.', 'EXPERT'],
    'cricket-pinball': ['PRODUCT-SPECIFIC', 'Cricket Pinball', 'Cricket-only match rules and product systems. These do not replace the general pinball configuration.', 'CRICKET ONLY']
  };
  const item = map[id] || map.overview;
  return { kicker:item[0], title:item[1], description:item[2], badge:item[3] };
}

function renderCategory(id) {
  switch (id) {
    case 'overview': return renderOverview();
    case 'game-rules': return sectionGrid([
      card('Session format', 'Ball lifecycle and reset timing.', [
        number('Balls per game', 'rules.ballsPerGame', 1, 9, 1, 'balls'),
        slider('Drain reset delay', 'rules.drainResetDelayMs', 100, 2000, 50, 'ms'),
        number('Legacy game reset delay', 'rules.gameResetDelayMs', 250, 10000, 50, 'ms', 'Declared but not used by persistent Game Over flow.', 'inactive')
      ])
    ]);
    case 'difficulty': return renderDifficulty();
    case 'physics': return sectionGrid([
      card('Simulation', 'Core timestep and collision accuracy.', [
        number('Fixed step', 'table.physics.fixedStep', 0.004, 0.02, 0.0001, 'sec'),
        slider('Max frame delta', 'table.physics.maxFrameDelta', 0.016, 0.1, 0.001, 'sec'),
        slider('Collision substeps', 'table.physics.collisionSubsteps', 1, 4, 1, 'steps')
      ]),
      card('Forces & resistance', 'How the ball accelerates and loses energy.', [
        vector('Gravity', 'table.physics.gravity', -20, 20, 0.05, ['X','Z']),
        slider('Linear damping', 'table.physics.linearDamping', 0, 1, 0.01),
        slider('Rolling friction', 'table.physics.rollingFriction', 0, 0.5, 0.005)
      ])
    ]);
    case 'ball-playfield': return sectionGrid([
      card('Ball', 'Physical characteristics and speed envelope.', [
        slider('Radius', 'table.ball.radius', 0.04, 0.2, 0.005),
        slider('Restitution', 'table.ball.restitution', 0, 1.5, 0.01, '', 'Declared but not directly consumed by the current collision engine.', 'inactive'),
        slider('Maximum speed', 'table.ball.maxSpeed', 1, 25, 0.1),
        vector('Start position', 'table.ball.start', -5, 5, 0.05, ['X','Z'], 'Declared; runtime currently uses Launcher Spawn.', 'inactive'),
        vector('Initial velocity', 'table.ball.initialVelocity', -10, 10, 0.1, ['X','Z'], 'Declared but not currently consumed.', 'inactive')
      ]),
      card('Playfield & drain', 'Surface and ball-loss geometry.', [
        slider('Surface height', 'table.playfield.surfaceY', 0, 2, 0.01),
        number('Drain left edge', 'table.playfield.drain.minX', -3, 0, 0.01),
        number('Drain right edge', 'table.playfield.drain.maxX', 0, 3, 0.01),
        number('Drain depth', 'table.playfield.drain.z', 1, 4, 0.01)
      ])
    ]);
    case 'flippers': return repeatedCards('table.flippers', 'Flipper', [
      vectorSpec('Pivot', 'pivot', -5, 5, 0.01, ['X','Z']),
      sliderSpec('Length', 'length', 0.3, 1.5, 0.01),
      sliderSpec('Collision radius', 'radius', 0.04, 0.3, 0.005),
      sliderSpec('Rest angle', 'restAngleDeg', -180, 360, 1, '°'),
      sliderSpec('Active angle', 'activeAngleDeg', -180, 360, 1, '°'),
      sliderSpec('Upstroke speed', 'speedDegPerSec', 60, 1500, 10, '°/s'),
      sliderSpec('Return speed', 'returnSpeedDegPerSec', 60, 1500, 10, '°/s'),
      sliderSpec('Restitution', 'restitution', 0, 1.5, 0.01),
      sliderSpec('Powered kick', 'kick', 0, 6, 0.05)
    ]);
    case 'launcher': return sectionGrid([
      card('Plunger', 'Power curve and launch timing.', [
        vector('Spawn', 'table.launcher.spawn', -5, 5, 0.01, ['X','Z']),
        vector('Direction', 'table.launcher.direction', -1, 1, 0.05, ['X','Z']),
        slider('Minimum power', 'table.launcher.minPower', 1, 15, 0.1),
        slider('Maximum power', 'table.launcher.maxPower', 1, 20, 0.1),
        slider('Charge time', 'table.launcher.chargeTimeMs', 200, 3000, 50, 'ms'),
        slider('Tap charge', 'table.launcher.tapCharge', 0.1, 0.8, 0.01)
      ]),
      card('Launcher lane', 'How the ball is constrained and released onto the table.', [
        number('Lane min X', 'table.launcher.lane.minX', -3, 3, 0.01),
        number('Lane max X', 'table.launcher.lane.maxX', -3, 3, 0.01),
        number('Lane exit Z', 'table.launcher.lane.exitZ', -4, 1, 0.01),
        slider('Lane restitution', 'table.launcher.laneRestitution', 0, 1.2, 0.01),
        vector('Exit kick', 'table.launcher.exitKick', -6, 6, 0.05, ['X','Z'])
      ]),
      card('Nudge & tilt', 'Player table movement and abuse tolerance.', [
        slider('Nudge impulse', 'table.nudge.impulse', 0.1, 3, 0.05),
        slider('Warnings before tilt', 'table.nudge.maxWarnings', 2, 6, 1),
        slider('Tilt window', 'table.nudge.windowMs', 500, 10000, 100, 'ms')
      ])
    ]);
    case 'walls': return sectionGrid([
      card('Safety bounds', 'Fail-safe playfield limits.', [
        number('Minimum X', 'table.playfield.safetyBounds.minX', -10, 0, 0.1),
        number('Maximum X', 'table.playfield.safetyBounds.maxX', 0, 10, 0.1),
        number('Minimum Z', 'table.playfield.safetyBounds.minZ', -10, 0, 0.1),
        number('Maximum Z', 'table.playfield.safetyBounds.maxZ', 0, 10, 0.1)
      ])
    ]) + repeatedCards('table.walls', 'Wall', [
      vectorSpec('Point A', 'a', -5, 5, 0.01, ['X','Z']),
      vectorSpec('Point B', 'b', -5, 5, 0.01, ['X','Z']),
      sliderSpec('Restitution', 'restitution', 0, 1.5, 0.01)
    ], true);
    case 'slingshots': return repeatedCards('table.slingshots', 'Slingshot', [
      vectorSpec('Point A', 'a', -5, 5, 0.01, ['X','Z']),
      vectorSpec('Point B', 'b', -5, 5, 0.01, ['X','Z']),
      sliderSpec('Restitution', 'restitution', 0, 1.5, 0.01),
      sliderSpec('Impulse', 'impulse', 0.2, 8, 0.05),
      sliderSpec('Cooldown', 'cooldownMs', 20, 1000, 10, 'ms'),
      numberSpec('Score', 'score', 0, 100000, 50, 'pts')
    ]);
    case 'bumpers': return repeatedCards('table.bumpers', 'Bumper', [
      vectorSpec('Position', 'position', -5, 5, 0.01, ['X','Z']),
      sliderSpec('Radius', 'radius', 0.05, 0.8, 0.01),
      sliderSpec('Restitution', 'restitution', 0, 1.5, 0.01),
      sliderSpec('Impulse', 'impulse', 0.2, 10, 0.05),
      sliderSpec('Cooldown', 'cooldownMs', 20, 1000, 10, 'ms'),
      numberSpec('Score', 'score', 0, 100000, 50, 'pts')
    ]);
    case 'targets': return renderTargets();
    case 'zones': return repeatedCards('table.scoringZones', 'Scoring zone', [
      vectorSpec('Position', 'position', -5, 5, 0.01, ['X','Z']),
      sliderSpec('Trigger radius', 'radius', 0.05, 1, 0.01),
      sliderSpec('Re-arm radius', 'rearmRadius', 0.06, 1.5, 0.01),
      numberSpec('Score', 'score', 0, 100000, 50, 'pts')
    ]);
    case 'audio': return sectionGrid([
      card('Master', 'Global Web Audio controls.', [
        toggle('Audio enabled', 'rules.audio.enabled'),
        slider('Master volume', 'rules.audio.masterVolume', 0, 1, 0.01)
      ]),
      card('Mechanic mix', 'Relative gain for each event family.', [
        slider('Flippers', 'rules.audio.flipperGain', 0, 1, 0.01),
        slider('Walls', 'rules.audio.wallGain', 0, 1, 0.01),
        slider('Slingshots', 'rules.audio.slingshotGain', 0, 1, 0.01),
        slider('Bumpers', 'rules.audio.bumperGain', 0, 1, 0.01),
        slider('Drain', 'rules.audio.drainGain', 0, 1, 0.01),
        slider('Targets', 'rules.audio.targetGain', 0, 1, 0.01),
        slider('Launcher', 'rules.audio.launcherGain', 0, 1, 0.01),
        slider('Nudge', 'rules.audio.nudgeGain', 0, 1, 0.01),
        slider('Tilt', 'rules.audio.tiltGain', 0, 1, 0.01),
        slider('Rolling ball', 'rules.audio.rollGain', 0, 1, 0.01)
      ])
    ]);
    case 'vfx': return sectionGrid([
      card('Quality', 'Performance and visual feature switches.', [
        select('FX quality', 'rules.vfx.quality', [['auto','Auto'],['low','Low'],['medium','Medium'],['high','High'],['ultra','Ultra']]),
        toggle('Particles', 'rules.vfx.particles'),
        toggle('Pulse rings', 'rules.vfx.pulses'),
        toggle('Ball trail', 'rules.vfx.trail'),
        slider('Camera shake', 'rules.vfx.cameraShake', 0, 2, 0.05)
      ])
    ]);
    case 'advanced': return renderAdvanced();
    case 'cricket-pinball': return renderCricketPinballAdmin();
    default: return renderOverview();
  }
}


function renderCricketPinballAdmin() {
  return `
    <section class="product-admin-banner">
      <div>
        <span>PRODUCT-SPECIFIC CONFIGURATION</span>
        <h2>CRICKET PINBALL</h2>
        <p>These controls edit only the Cricket Pinball draft. General Pinball configuration above is separate and does not drive Cricket gameplay.</p>
      </div>
      <div class="product-admin-source">
        <strong>Dedicated sources</strong>
        <code>/game/cricket-table.json · v${draft.cricketTable.version}</code>
        <code>/game/cricket-rules.json · v${draft.cricketRules.version}</code>
      </div>
    </section>

    ${sectionGrid([
      card('Match format', 'Cricket innings and tie rules.', [
        number('Last 3 Balls', 'cricketRules.formats.LAST_3.ballsPerInnings', 1, 24, 1, 'balls'),
        number('1 Over', 'cricketRules.formats.ONE_OVER.ballsPerInnings', 1, 24, 1, 'balls'),
        number('2 Overs', 'cricketRules.formats.TWO_OVER.ballsPerInnings', 1, 36, 1, 'balls'),
        number('Max wickets', 'cricketRules.maxWickets', 1, 10, 1),
        toggle('Super Over enabled', 'cricketRules.superOver.enabled'),
        number('Super Over balls', 'cricketRules.superOver.ballsPerInnings', 1, 12, 1, 'balls')
      ]),
      card('Delivery lifecycle', 'One physical delivery produces one official cricket result.', [
        number('Max live time', 'cricketRules.delivery.maxLiveMs', 1000, 20000, 100, 'ms'),
        number('Result hold', 'cricketRules.delivery.resolveDelayMs', 200, 3000, 50, 'ms'),
        slider('Stalled speed', 'cricketRules.delivery.stalledSpeed', 0.05, 1, 0.01),
        number('Stalled for', 'cricketRules.delivery.stalledForMs', 200, 5000, 50, 'ms')
      ]),
      card('Toss & transitions', 'Visible toss and innings transition timing.', [
        number('Coin animation', 'cricketRules.toss.coinMs', 500, 4000, 50, 'ms'),
        number('Result hold', 'cricketRules.toss.resultHoldMs', 200, 3000, 50, 'ms'),
        number('Role confirmation', 'cricketRules.toss.roleConfirmMs', 200, 3000, 50, 'ms'),
        number('Innings intro', 'cricketRules.toss.inningsIntroMs', 200, 3000, 50, 'ms')
      ]),
      card('Cricket ball physics', 'Physics used only by the Cricket table config.', [
        slider('Ball radius', 'cricketTable.ball.radius', 0.04, 0.2, 0.005),
        slider('Max speed', 'cricketTable.ball.maxSpeed', 2, 16, 0.1),
        vector('Gravity', 'cricketTable.physics.gravity', -10, 10, 0.05, ['X','Z']),
        slider('Linear damping', 'cricketTable.physics.linearDamping', 0, 1, 0.01),
        slider('Rolling friction', 'cricketTable.physics.rollingFriction', 0, 0.5, 0.005)
      ]),
      card('Bowling launcher', 'Cricket bowling path, charge and release.', [
        vector('Bowling spawn', 'cricketTable.launcher.spawn', -4, 4, 0.01, ['X','Z']),
        vector('Bowling direction', 'cricketTable.launcher.direction', -1, 1, 0.01, ['X','Z']),
        slider('Minimum power', 'cricketTable.launcher.minPower', 1, 15, 0.1),
        slider('Maximum power', 'cricketTable.launcher.maxPower', 1, 18, 0.1),
        number('Charge time', 'cricketTable.launcher.chargeTimeMs', 200, 3000, 50, 'ms'),
        slider('Tap charge', 'cricketTable.launcher.tapCharge', 0.05, 0.9, 0.01)
      ])
    ])}

    <div class="repeat-grid">
      ${['LEFT','CENTRE','RIGHT'].map(line => card(
        `${line} bowling line`,
        'Line-specific trajectory tuning.',
        [
          slider('Direction offset X', `cricketTable.launcher.bowlingLines.${line}.directionOffsetX`, -0.6, 0.6, 0.01),
          slider('Exit kick X', `cricketTable.launcher.bowlingLines.${line}.exitKickX`, -3, 3, 0.05)
        ],
        true
      )).join('')}
    </div>

    <h2 style="margin:22px 0 10px">CRICKET BATS / FLIPPERS</h2>
    ${repeatedCards('cricketTable.flippers', 'Cricket bat', [
      vectorSpec('Pivot', 'pivot', -4, 4, 0.01, ['X','Z']),
      sliderSpec('Length', 'length', 0.3, 1.8, 0.01),
      sliderSpec('Collision radius', 'radius', 0.04, 0.35, 0.005),
      sliderSpec('Rest angle', 'restAngleDeg', -180, 360, 1, '°'),
      sliderSpec('Active angle', 'activeAngleDeg', -180, 360, 1, '°'),
      sliderSpec('Stroke speed', 'speedDegPerSec', 60, 1500, 10, '°/s'),
      sliderSpec('Return speed', 'returnSpeedDegPerSec', 60, 1500, 10, '°/s'),
      sliderSpec('Bat kick', 'kick', 0, 6, 0.05)
    ])}

    <h2 style="margin:22px 0 10px">OFFICIAL DELIVERY ZONES</h2>
    ${repeatedCards('cricketTable.deliveryZones', 'Cricket result zone', [
      vectorSpec('Position', 'position', -4, 4, 0.01, ['X','Z']),
      sliderSpec('Trigger radius', 'radius', 0.05, 0.8, 0.01)
    ], true)}
    <h2 style="margin:22px 0 10px">CRICKET THEME BINDINGS</h2>
    ${repeatedCards('cricketTable.skinBindings', 'Theme binding', [
      vectorSpec('Target position', 'targetPosition', -5, 5, 0.01, ['X','Y','Z']),
      vectorSpec('Target size', 'targetSize', 0.1, 8, 0.01, ['W','H']),
      sliderSpec('Max bind distance', 'maxDistance', 0.2, 4, 0.05)
    ], true)}


    <div class="repeat-grid" style="margin-top:14px">
      ${['EASY','MEDIUM','HARD'].map(level => card(
        `CPU · ${level}`,
        'Cricket CPU bowling and batting tuning.',
        [
          slider('Bowling power min', `cricketRules.cpu.${level}.bowlingPowerMin`, 0.1, 1, 0.01),
          slider('Bowling power max', `cricketRules.cpu.${level}.bowlingPowerMax`, 0.1, 1, 0.01),
          slider('Batting trigger Z', `cricketRules.cpu.${level}.battingTriggerZ`, 0.5, 2.5, 0.01),
          slider('Centre-ball band', `cricketRules.cpu.${level}.battingCentreBand`, 0.05, 0.5, 0.01),
          number('Bat hold', `cricketRules.cpu.${level}.battingHoldMs`, 40, 300, 5, 'ms'),
          number('Bat cooldown', `cricketRules.cpu.${level}.battingCooldownMs`, 50, 600, 5, 'ms'),
          slider('Miss chance', `cricketRules.cpu.${level}.battingMissChance`, 0, 0.75, 0.01)
        ],
        true
      )).join('')}
    </div>

    <section class="product-admin-note">
      <strong>STRICT CONFIG BOUNDARY</strong>
      <span>Cricket Pinball reads cricketTable/cricketRules only. Generic bumpers, PARIS targets, generic scoring zones and generic launcher geometry are not part of this product configuration.</span>
    </section>
  `;
}


function productAdminCard(title, description, tag) {
  return `
    <article class="product-admin-card">
      <span>${escapeHtml(tag)}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
      <small>CRICKET PINBALL ONLY</small>
    </article>
  `;
}

function readAdminDisplayPrefs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ADMIN_PREFS_KEY) || '{}');
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      textScale: Math.min(125, Math.max(85, Number(parsed.textScale) || 100))
    };
  } catch {
    return { theme: 'dark', textScale: 100 };
  }
}

function saveAdminDisplayPrefs(prefs) {
  try {
    localStorage.setItem(ADMIN_PREFS_KEY, JSON.stringify(prefs));
  } catch {}
}

function applyAdminDisplayPrefs(prefs) {
  document.documentElement.dataset.adminTheme = prefs.theme;
  document.documentElement.style.setProperty('--admin-text-scale', String(prefs.textScale / 100));
  if (root) {
    window.requestAnimationFrame(() => applyAdminTextScale(root, prefs.textScale / 100));
  }
}

function applyAdminTextScale(container, scale) {
  const selector = 'a,button,input,select,textarea,label,span,small,strong,p,h1,h2,h3,h4,kbd,code,dt,dd';
  container.querySelectorAll(selector).forEach((node) => {
    if (!node.dataset.adminBaseFontSize) {
      const size = Number.parseFloat(window.getComputedStyle(node).fontSize);
      if (Number.isFinite(size) && size > 0) {
        node.dataset.adminBaseFontSize = String(size);
      }
    }

    const base = Number(node.dataset.adminBaseFontSize);
    if (Number.isFinite(base) && base > 0) {
      node.style.fontSize = (base * scale).toFixed(2) + 'px';
    }
  });
}

function observeAdminTextScale() {
  if (window.__adminTextScaleObserver) return;
  const observer = new MutationObserver(() => {
    applyAdminTextScale(root, displayPrefs.textScale / 100);
  });
  observer.observe(root, { childList: true, subtree: true });
  window.__adminTextScaleObserver = observer;
}

function bindDisplayControls() {
  const themeButton = root.querySelector('#themeToggle');
  const textScale = root.querySelector('#textScale');
  const textScaleValue = root.querySelector('#textScaleValue');
  if (!themeButton || !textScale || !textScaleValue) return;

  const sync = () => {
    const isLight = displayPrefs.theme === 'light';
    themeButton.textContent = isLight ? 'DARK' : 'LIGHT';
    themeButton.setAttribute('aria-pressed', String(isLight));
    textScale.value = String(displayPrefs.textScale);
    textScaleValue.textContent = displayPrefs.textScale + '%';
  };

  themeButton.addEventListener('click', () => {
    displayPrefs.theme = displayPrefs.theme === 'light' ? 'dark' : 'light';
    applyAdminDisplayPrefs(displayPrefs);
    saveAdminDisplayPrefs(displayPrefs);
    sync();
  });

  textScale.addEventListener('input', () => {
    displayPrefs.textScale = Number(textScale.value);
    applyAdminDisplayPrefs(displayPrefs);
    saveAdminDisplayPrefs(displayPrefs);
    sync();
  });

  sync();
}

function renderOverview() {
  const t = draft.table;
  const r = draft.rules;
  const totalScorers = t.bumpers.length + t.slingshots.length + t.targets.length + t.scoringZones.length;

  return `
    <div class="metric-grid">
      ${metric('Balls / game', r.ballsPerGame, 'Session format')}
      ${metric('Max ball speed', t.ball.maxSpeed, 'Physics limit')}
      ${metric('Scoring objects', totalScorers, 'Across table')}
      ${metric('Collision substeps', t.physics.collisionSubsteps, 'Per fixed step')}
    </div>

    <div class="overview-grid">
      <article class="panel">
        <div class="panel-head">
          <div><span class="card-kicker">TABLE HEALTH</span><h2>Configuration coverage</h2></div>
          <span class="health-pill">Validated</span>
        </div>
        <div class="coverage-list">
          ${coverageRow('Physics engine', 'Configured', 'good')}
          ${coverageRow('Session rules', 'Configured', 'good')}
          ${coverageRow('Difficulty presets', '3 presets', 'good')}
          ${coverageRow('Audio / VFX', 'Config driven', 'good')}
          ${coverageRow('Theme switching', 'Partly hardcoded', 'warn')}
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <div><span class="card-kicker">DIFFICULTY</span><h2>Preset snapshot</h2></div>
        </div>
        <div class="preset-summary">
          ${Object.entries(draft.difficulty).map(([id,p]) => `
            <div>
              <span>${p.label}</span>
              <strong>${p.launcher.maxPower}</strong>
              <small>max launch</small>
              <em>${p.nudge.maxWarnings} tilt warnings</em>
            </div>
          `).join('')}
        </div>
      </article>
    </div>

    <article class="panel">
      <div class="panel-head">
        <div><span class="card-kicker">SCORING</span><h2>Current score economy</h2></div>
      </div>
      <div class="score-economy">
        ${t.bumpers.map(x => scoreChip(x.id, x.score, 'Bumper')).join('')}
        ${t.slingshots.map(x => scoreChip(x.id, x.score, 'Slingshot')).join('')}
        ${t.targets.map(x => scoreChip(x.id.toUpperCase(), x.score, 'Target')).join('')}
        ${t.scoringZones.map(x => scoreChip(x.id, x.score, 'Zone')).join('')}
        ${scoreChip('PARIS bank', t.targetBank.completionScore, 'Completion')}
      </div>
    </article>
  `;
}

function renderDifficulty() {
  return `
    <div class="preset-tabs">
      <button type="button" class="selected">Easy</button>
      <button type="button" class="selected">Standard</button>
      <button type="button" class="selected">Hard</button>
      <span>All presets editable below</span>
    </div>
    ${Object.entries(draft.difficulty).map(([id,preset]) => `
      <article class="panel difficulty-panel">
        <div class="panel-head">
          <div>
            <span class="card-kicker">${preset.label.toUpperCase()} PRESET</span>
            <h2>${preset.label} difficulty</h2>
          </div>
          ${id === 'standard' ? '<span class="default-pill">DEFAULT</span>' : ''}
        </div>
        <div class="subgrid">
          ${card('Left flipper', 'Rest, travel and power.', [
            slider('Rest angle', `difficulty.${id}.flippers.left.restAngleDeg`, -180, 360, 1, '°'),
            slider('Active angle', `difficulty.${id}.flippers.left.activeAngleDeg`, -180, 360, 1, '°'),
            slider('Upstroke speed', `difficulty.${id}.flippers.left.speedDegPerSec`, 60, 1500, 10, '°/s'),
            slider('Return speed', `difficulty.${id}.flippers.left.returnSpeedDegPerSec`, 60, 1500, 10, '°/s'),
            slider('Kick', `difficulty.${id}.flippers.left.kick`, 0, 6, 0.05)
          ], true)}
          ${card('Right flipper', 'Rest, travel and power.', [
            slider('Rest angle', `difficulty.${id}.flippers.right.restAngleDeg`, -180, 360, 1, '°'),
            slider('Active angle', `difficulty.${id}.flippers.right.activeAngleDeg`, -180, 360, 1, '°'),
            slider('Upstroke speed', `difficulty.${id}.flippers.right.speedDegPerSec`, 60, 1500, 10, '°/s'),
            slider('Return speed', `difficulty.${id}.flippers.right.returnSpeedDegPerSec`, 60, 1500, 10, '°/s'),
            slider('Kick', `difficulty.${id}.flippers.right.kick`, 0, 6, 0.05)
          ], true)}
          ${card('Launcher & nudge', 'Preset-specific assistance and risk.', [
            slider('Minimum launch', `difficulty.${id}.launcher.minPower`, 1, 15, 0.05),
            slider('Maximum launch', `difficulty.${id}.launcher.maxPower`, 1, 20, 0.05),
            slider('Tap charge', `difficulty.${id}.launcher.tapCharge`, 0.05, 0.8, 0.01),
            slider('Nudge impulse', `difficulty.${id}.nudge.impulse`, 0.1, 3, 0.05),
            slider('Tilt warnings', `difficulty.${id}.nudge.maxWarnings`, 2, 6, 1),
            slider('Tilt window', `difficulty.${id}.nudge.windowMs`, 500, 10000, 100, 'ms')
          ], true)}
        </div>
      </article>
    `).join('')}
  `;
}

function renderTargets() {
  return sectionGrid([
    card('Target bank', 'Completion bonus and reset behaviour.', [
      number('Completion score', 'table.targetBank.completionScore', 0, 1000000, 100, 'pts'),
      slider('Reset delay', 'table.targetBank.resetMs', 250, 10000, 50, 'ms'),
      number('Popup Z', 'table.targetBank.popupZ', -5, 5, 0.01)
    ])
  ]) + repeatedCards('table.targets', 'Target', [
    vectorSpec('Position', 'position', -5, 5, 0.01, ['X','Z']),
    sliderSpec('Width', 'width', 0.05, 1, 0.01),
    sliderSpec('Restitution', 'restitution', 0, 1.5, 0.01),
    sliderSpec('Minimum impact', 'minImpact', 0, 5, 0.01),
    numberSpec('Score', 'score', 0, 100000, 50, 'pts')
  ], true);
}

function renderAdvanced() {
  return sectionGrid([
    card('Versions', 'Schema/version identifiers.', [
      readonly('Table config version', draft.table.version),
      readonly('Rules config version', draft.rules.version)
    ]),
    card('Compatibility fields', 'Present in schema but currently inactive in runtime.', [
      readonly('ball.restitution', draft.table.ball.restitution, 'Declared, currently not directly consumed.'),
      readonly('ball.start', draft.table.ball.start.join(', '), 'Launcher spawn is used instead.'),
      readonly('ball.initialVelocity', draft.table.ball.initialVelocity.join(', '), 'Not currently consumed.'),
      readonly('rules.gameResetDelayMs', draft.rules.gameResetDelayMs, 'Persistent Game Over superseded auto-reset.')
    ])
  ]) + `
    <article class="panel warning-panel">
      <span class="card-kicker">ARCHITECTURE NOTE</span>
      <h2>Admin persistence is intentionally draft-only.</h2>
      <p>This UI reads the same production JSON used by the game, but browser-side editing cannot safely write repository configuration. “Save draft” stores your tuning locally; use Export JSON for handoff until authenticated publishing is added.</p>
    </article>`;
}

function renderSearchResults(q) {
  const catalog = searchCatalog();
  const results = catalog.filter(x => x.search.includes(q));
  if (!results.length) return `<div class="empty-state"><strong>No matching settings</strong><span>Try “flipper”, “score”, “audio”, “gravity” or “launch”.</span></div>`;

  return `
    <div class="search-results">
      ${results.map(item => `
        <button type="button" data-jump="${item.category}">
          <span>${item.categoryLabel}</span>
          <strong>${item.title}</strong>
          <small>${item.description}</small>
        </button>
      `).join('')}
    </div>`;
}

function searchCatalog() {
  return [
    ['game-rules','Game Rules','Balls per game','Ball count and reset timing'],
    ['difficulty','Difficulty','Easy / Standard / Hard','Flipper, launch and nudge presets'],
    ['physics','Physics','Gravity, damping & friction','Core simulation behaviour'],
    ['ball-playfield','Ball & Playfield','Ball radius, speed & drain','Ball envelope and playfield loss zone'],
    ['flippers','Flippers','Flipper geometry & power','Pivot, length, angles, speed, restitution and kick'],
    ['launcher','Launcher','Launcher & nudge','Spawn, power curve, lane, exit kick and tilt'],
    ['walls','Walls & Bounds','Walls & safety bounds','Collision rails and fail-safe limits'],
    ['slingshots','Slingshots','Slingshot tuning','Geometry, impulse, cooldown and score'],
    ['bumpers','Bumpers','Bumper tuning','Position, radius, impulse, cooldown and score'],
    ['targets','Targets & Bank','Targets and PARIS bank','Target geometry, impact, scores and completion bonus'],
    ['zones','Scoring Zones','City Light scoring zone','Trigger, re-arm and score'],
    ['audio','Audio','Sound mix','Master and per-mechanic volume'],
    ['vfx','Visual Effects','Particles, trail & shake','Rendering feedback controls'],
    ['advanced','Advanced','Compatibility fields','Declared parameters and versions'],
    ['cricket-pinball','Cricket Pinball','Cricket-only table & match controls','Bowling, bats, result zones, formats, toss and CPU tuning']
  ].map(([category,categoryLabel,title,description]) => ({
    category, categoryLabel, title, description,
    search: (categoryLabel+' '+title+' '+description).toLowerCase()
  }));
}

function bindEditors(container) {
  container.querySelectorAll('[data-jump]').forEach(button => {
    button.addEventListener('click', () => {
      active = button.dataset.jump;
      query = '';
      const search = root.querySelector('#settingSearch');
      if (search) search.value = '';
      root.querySelectorAll('[data-nav]').forEach(node => node.classList.toggle('active', node.dataset.nav === active));
      renderActive();
    });
  });

  container.querySelectorAll('[data-path]').forEach(input => {
    const handler = () => {
      const path = input.dataset.path;
      let value;

      if (input.type === 'checkbox') {
        value = input.checked;
      } else if (input.tagName === 'SELECT') {
        value = input.value;
      } else {
        value = Number(input.value);
        if (!Number.isFinite(value)) return;
      }

      setPath(draft, path, value);
      markDirty();

      const group = input.closest('.control');
      if (group) {
        group.querySelectorAll(`[data-path="${cssEscape(path)}"]`).forEach(peer => {
          if (peer === input || peer.type === 'checkbox' || peer.tagName === 'SELECT') return;
          peer.value = value;
        });
        const readout = group.querySelector('[data-readout]');
        if (readout) readout.textContent = formatValue(value, readout.dataset.unit || '');
      }
    };

    input.addEventListener(input.type === 'range' ? 'input' : 'change', handler);
    if (input.type === 'number') input.addEventListener('input', handler);
  });
}

function markDirty() {
  dirty = JSON.stringify(draft) !== JSON.stringify(savedBaseline);
  updateDirtyUi();
}

function updateDirtyUi() {
  const status = root.querySelector('#draftStatus');
  const count = root.querySelector('#changeCount');
  const save = root.querySelector('#saveButton');
  if (!status || !count || !save) return;

  status.classList.toggle('dirty', dirty);
  status.innerHTML = dirty ? '<i></i>Unsaved' : '<i></i>Saved';
  count.textContent = dirty ? 'Unsaved configuration changes' : 'No unsaved changes';
  save.disabled = !dirty;
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  savedBaseline = clone(draft);
  dirty = false;
  updateDirtyUi();
  toast('Draft saved in this browser');
}

function resetLive() {
  if (!confirm('Reset every admin setting back to the current live configuration?')) return;
  draft = clone(live);
  localStorage.removeItem(DRAFT_KEY);
  savedBaseline = clone(draft);
  dirty = false;
  renderActive();
  updateDirtyUi();
  toast('Reset to live configuration');
}

function exportDraft() {
  const payload = {
    exportedAt: new Date().toISOString(),
    table: draft.table,
    rules: draft.rules,
    difficulty: draft.difficulty,
    cricketTable: draft.cricketTable,
    cricketRules: draft.cricketRules
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'infinite-pinball-config-draft.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Configuration exported');
}

function sectionGrid(cards) {
  return `<div class="section-grid">${cards.join('')}</div>`;
}

function card(title, description, controls, compact = false) {
  return `
    <article class="panel setting-card ${compact ? 'compact' : ''}">
      <div class="panel-head">
        <div><h2>${title}</h2><p>${description}</p></div>
      </div>
      <div class="control-list">${controls.join('')}</div>
    </article>`;
}

function repeatedCards(basePath, label, specs, dense = false) {
  const items = getPath(draft, basePath) || [];
  return `
    <div class="repeat-grid ${dense ? 'dense' : ''}">
      ${items.map((item,index) => `
        <article class="panel repeat-card">
          <div class="repeat-head">
            <div>
              <span class="card-kicker">${label.toUpperCase()} ${index + 1}</span>
              <h2>${escapeHtml(String(item.id || index + 1).replaceAll('-', ' '))}</h2>
            </div>
            <code>${escapeHtml(String(item.id || 'item'))}</code>
          </div>
          <div class="control-list">
            ${specs.map(spec => renderSpec(spec, `${basePath}.${index}`)).join('')}
          </div>
        </article>
      `).join('')}
    </div>`;
}

function renderSpec(spec, base) {
  const path = `${base}.${spec.key}`;
  if (spec.type === 'vector') return vector(spec.label, path, spec.min, spec.max, spec.step, spec.axes);
  if (spec.type === 'number') return number(spec.label, path, spec.min, spec.max, spec.step, spec.unit);
  return slider(spec.label, path, spec.min, spec.max, spec.step, spec.unit);
}

function sliderSpec(label,key,min,max,step,unit='') { return {type:'slider',label,key,min,max,step,unit}; }
function numberSpec(label,key,min,max,step,unit='') { return {type:'number',label,key,min,max,step,unit}; }
function vectorSpec(label,key,min,max,step,axes=['X','Z']) { return {type:'vector',label,key,min,max,step,axes}; }

function slider(label, path, min, max, step, unit='', note='', state='') {
  const value = Number(getPath(draft,path));
  return `
    <div class="control ${state}">
      <div class="control-copy">
        <label>${label}</label>
        ${note ? `<small>${note}</small>` : ''}
      </div>
      <div class="slider-wrap">
        <input type="range" data-path="${path}" min="${min}" max="${max}" step="${step}" value="${value}">
        <div class="value-box">
          <input type="number" data-path="${path}" min="${min}" max="${max}" step="${step}" value="${value}">
          <span data-readout data-unit="${unit}">${formatValue(value,unit)}</span>
        </div>
      </div>
    </div>`;
}

function number(label, path, min, max, step, unit='', note='', state='') {
  const value = Number(getPath(draft,path));
  return `
    <div class="control ${state}">
      <div class="control-copy">
        <label>${label}</label>
        ${note ? `<small>${note}</small>` : ''}
      </div>
      <div class="number-wrap">
        <input type="number" data-path="${path}" min="${min}" max="${max}" step="${step}" value="${value}">
        <span>${unit}</span>
      </div>
    </div>`;
}

function vector(label, path, min, max, step, axes=['X','Z'], note='', state='') {
  const value = getPath(draft,path) || [0,0];
  return `
    <div class="control ${state}">
      <div class="control-copy">
        <label>${label}</label>
        ${note ? `<small>${note}</small>` : ''}
      </div>
      <div class="vector-wrap">
        ${value.map((v,i) => `
          <label><span>${axes[i] || i}</span><input type="number" data-path="${path}.${i}" min="${min}" max="${max}" step="${step}" value="${v}"></label>
        `).join('')}
      </div>
    </div>`;
}

function toggle(label,path) {
  const checked = Boolean(getPath(draft,path));
  return `
    <div class="control">
      <div class="control-copy"><label>${label}</label></div>
      <label class="switch">
        <input type="checkbox" data-path="${path}" ${checked ? 'checked' : ''}>
        <span></span>
      </label>
    </div>`;
}

function select(label,path,options) {
  const value = getPath(draft,path);
  return `
    <div class="control">
      <div class="control-copy"><label>${label}</label></div>
      <select class="select-control" data-path="${path}">
        ${options.map(([id,text]) => `<option value="${id}" ${id===value?'selected':''}>${text}</option>`).join('')}
      </select>
    </div>`;
}

function readonly(label,value,note='') {
  return `
    <div class="control inactive">
      <div class="control-copy"><label>${label}</label>${note ? `<small>${note}</small>` : ''}</div>
      <code class="readout">${escapeHtml(String(value))}</code>
    </div>`;
}

function metric(label,value,detail) {
  return `<article><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
}

function coverageRow(label,value,tone) {
  return `<div><span>${label}</span><strong class="${tone}"><i></i>${value}</strong></div>`;
}

function scoreChip(name,score,type) {
  return `<div><span>${escapeHtml(name)}</span><strong>${score.toLocaleString()}</strong><small>${type}</small></div>`;
}

function getPath(obj,path) {
  return path.split('.').reduce((acc,key) => acc == null ? undefined : acc[key], obj);
}

function setPath(obj,path,value) {
  const parts = path.split('.');
  let node = obj;
  for (let i=0;i<parts.length-1;i++) node = node[parts[i]];
  node[parts.at(-1)] = value;
}

function formatValue(value,unit) {
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(4));
  return unit ? `${rounded} ${unit}` : String(rounded);
}

function toast(message) {
  let node = document.querySelector('.admin-toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'admin-toast';
    document.body.appendChild(node);
  }
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 1800);
}

function safeParse(value) {
  try { return value ? JSON.parse(value) : null; }
  catch { return null; }
}

function clone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function cssEscape(value) {
  return window.CSS?.escape ? CSS.escape(value) : value.replaceAll('.', '\\.');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[char]);
}
