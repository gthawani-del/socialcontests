import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createTossController } from '../toss/toss-controller.js';
import { createMatchEngine } from '../match/match-engine.js';
import '../ui/play.css';

const app = document.querySelector('#cricketPlayApp');
if (!app) throw new Error('Cricket Pinball play root not found.');

const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') === 'LOCAL' ? 'LOCAL' : 'CPU';
const format = ['LAST_3', 'ONE_OVER', 'TWO_OVER'].includes(params.get('format'))
  ? params.get('format')
  : 'ONE_OVER';
const difficulty = ['EASY', 'MEDIUM', 'HARD'].includes(params.get('difficulty'))
  ? params.get('difficulty')
  : 'MEDIUM';

const players = mode === 'LOCAL'
  ? [
      { id: 'p1', name: 'PLAYER 1', type: 'HUMAN' },
      { id: 'p2', name: 'PLAYER 2', type: 'HUMAN' }
    ]
  : [
      { id: 'p1', name: 'PLAYER 1', type: 'HUMAN' },
      { id: 'cpu', name: 'CPU', type: 'CPU' }
    ];

const caller = players[0];
const opponent = players[1];
const tossController = createTossController();
const matchEngine = createMatchEngine({
  format,
  difficulty,
  players,
  maxWickets: 2,
  superOverEnabled: true
});

const state = {
  phase: 'MATCH_INTRO',
  toss: null,
  battingPlayerId: null,
  bowlingPlayerId: null
};

app.innerHTML = `
  <main class="cricket-play-shell">
    <canvas id="cricketPlayWorld"></canvas>

    <header class="match-topbar">
      <a href="/cricket-pinball">← LOBBY</a>
      <div>
        <span>${formatLabel(format)}</span>
        <strong>${difficulty}</strong>
      </div>
    </header>

    <section class="match-intro" id="matchIntro">
      <p>MATCH INTRO</p>
      <div class="versus">
        <div><span>${players[0].type}</span><strong>${players[0].name}</strong></div>
        <b>VS</b>
        <div><span>${players[1].type}</span><strong>${players[1].name}</strong></div>
      </div>
      <button type="button" id="beginToss">BEGIN TOSS</button>
    </section>

    <section class="toss-panel" id="tossPanel" hidden>
      <div class="toss-copy">
        <p id="tossEyebrow">TOSS</p>
        <h1 id="tossTitle">${caller.name} CALLS</h1>
        <span id="tossInstruction">Choose Heads or Tails</span>
      </div>

      <div class="coin-stage" aria-hidden="true">
        <div class="coin" id="coin">
          <div class="coin-face coin-heads">H</div>
          <div class="coin-face coin-tails">T</div>
        </div>
      </div>

      <div class="toss-actions" id="callActions">
        <button type="button" data-call="HEADS">HEADS</button>
        <button type="button" data-call="TAILS">TAILS</button>
      </div>

      <div class="toss-actions" id="roleActions" hidden>
        <button type="button" data-role="BAT">BAT</button>
        <button type="button" data-role="BOWL">BOWL</button>
      </div>

      <div class="role-confirmation" id="roleConfirmation" hidden>
        <strong id="battingRole"></strong>
        <span id="bowlingRole"></span>
      </div>
    </section>

    <section class="stadium-scoreboard" id="stadiumScoreboard">
      <span>TOSS</span>
      <strong>READY</strong>
    </section>

    <section class="innings-intro" id="inningsIntro" hidden>
      <p>INNINGS 1</p>
      <strong id="inningsBatting"></strong>
      <span id="inningsBowling"></span>
    </section>
  </main>
`;

const intro = document.querySelector('#matchIntro');
const tossPanel = document.querySelector('#tossPanel');
const beginToss = document.querySelector('#beginToss');
const callActions = document.querySelector('#callActions');
const roleActions = document.querySelector('#roleActions');
const roleConfirmation = document.querySelector('#roleConfirmation');
const tossTitle = document.querySelector('#tossTitle');
const tossInstruction = document.querySelector('#tossInstruction');
const coin = document.querySelector('#coin');
const scoreboard = document.querySelector('#stadiumScoreboard');
const inningsIntro = document.querySelector('#inningsIntro');

let inputsLocked = false;

beginToss.addEventListener('click', () => {
  if (inputsLocked) return;
  intro.hidden = true;
  tossPanel.hidden = false;
  state.phase = 'TOSS';
});

document.querySelectorAll('[data-call]').forEach((button) => {
  button.addEventListener('click', () => resolveToss(button.dataset.call));
});

document.querySelectorAll('[data-role]').forEach((button) => {
  button.addEventListener('click', () => chooseRole(button.dataset.role));
});

async function resolveToss(call) {
  if (inputsLocked || tossController.isLocked()) return;
  inputsLocked = true;
  disableTossInputs(true);

  state.toss = tossController.perform(call, caller.id, opponent.id);
  callActions.hidden = true;
  tossTitle.textContent = `${caller.name} CALLED ${call}`;
  tossInstruction.textContent = 'Coin in the air…';
  scoreboard.innerHTML = '<span>TOSS</span><strong>COIN IN AIR</strong>';

  coin.classList.remove('show-heads', 'show-tails');
  coin.classList.add('is-flipping');

  await delay(1250);

  coin.classList.remove('is-flipping');
  coin.classList.add(state.toss.result === 'HEADS' ? 'show-heads' : 'show-tails');

  tossTitle.textContent = `${state.toss.result}`;
  tossInstruction.textContent =
    `${playerName(state.toss.winnerId)} WON THE TOSS`;
  scoreboard.innerHTML =
    `<span>TOSS RESULT</span><strong>${state.toss.result} · ${playerName(state.toss.winnerId)} WINS</strong>`;

  await delay(450);

  state.phase = 'ROLE_SELECT';
  const winner = getPlayer(state.toss.winnerId);

  if (winner.type === 'CPU') {
    tossInstruction.textContent = 'CPU is choosing…';
    await delay(500);
    chooseRole(cpuRoleChoice());
    return;
  }

  tossTitle.textContent = `${winner.name}: BAT OR BOWL?`;
  tossInstruction.textContent = 'Toss winner chooses';
  roleActions.hidden = false;
  inputsLocked = false;
  disableTossInputs(false);
}

async function chooseRole(choice) {
  if (inputsLocked) return;
  inputsLocked = true;
  disableTossInputs(true);
  roleActions.hidden = true;

  const winnerId = state.toss.winnerId;
  const loserId = players.find((player) => player.id !== winnerId).id;

  if (choice === 'BAT') {
    state.battingPlayerId = winnerId;
    state.bowlingPlayerId = loserId;
  } else {
    state.battingPlayerId = loserId;
    state.bowlingPlayerId = winnerId;
  }

  state.toss.choice = choice;
  state.phase = 'ROLE_CONFIRMATION';

  matchEngine.assignOpeningRoles({
    battingPlayerId: state.battingPlayerId,
    bowlingPlayerId: state.bowlingPlayerId
  });

  const battingName = playerName(state.battingPlayerId);
  const bowlingName = playerName(state.bowlingPlayerId);

  tossTitle.textContent = `${playerName(winnerId)} CHOOSES ${choice}`;
  tossInstruction.textContent = 'Roles confirmed';
  document.querySelector('#battingRole').textContent = `${battingName} BATTING`;
  document.querySelector('#bowlingRole').textContent = `${bowlingName} BOWLING`;
  roleConfirmation.hidden = false;

  scoreboard.innerHTML =
    `<span>TOSS</span><strong>${battingName} BAT · ${bowlingName} BOWL</strong>`;

  await delay(950);

  tossPanel.hidden = true;
  inningsIntro.hidden = false;
  state.phase = 'INNINGS_INTRO';
  document.querySelector('#inningsBatting').textContent = `${battingName} BATTING`;
  document.querySelector('#inningsBowling').textContent = `${bowlingName} BOWLING`;

  await delay(1100);

  const match = matchEngine.startMatch();
  matchEngine.readyDelivery();
  state.phase = 'FIRST_DELIVERY_READY';
  inningsIntro.querySelector('p').textContent = 'FIRST DELIVERY';
  inningsIntro.querySelector('span').textContent = `${match.ballsPerInnings} BALLS · ${playerName(match.bowlingPlayerId)} TO BOWL`;
  scoreboard.innerHTML = `<span>INNINGS ${match.innings}</span><strong>${playerName(match.battingPlayerId)} 0/0 · BALL 1/${match.ballsPerInnings}</strong>`;
}

function disableTossInputs(disabled) {
  document.querySelectorAll('[data-call], [data-role]').forEach((button) => {
    button.disabled = disabled;
  });
}

function cpuRoleChoice() {
  return Math.random() < 0.5 ? 'BAT' : 'BOWL';
}

function getPlayer(id) {
  return players.find((player) => player.id === id);
}

function playerName(id) {
  return getPlayer(id)?.name || 'PLAYER';
}

function formatLabel(value) {
  return {
    LAST_3: 'LAST 3 BALLS',
    ONE_OVER: '1 OVER',
    TWO_OVER: '2 OVERS'
  }[value] || '1 OVER';
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#cricketPlayWorld'),
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07110c);
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 6, 8.5);
camera.lookAt(0, 0.7, 0);

scene.add(new THREE.HemisphereLight(0xe4f0e8, 0x07110c, 2.3));
const key = new THREE.DirectionalLight(0xffffff, 3.5);
key.position.set(-3, 7, 5);
scene.add(key);
const pitchGlow = new THREE.PointLight(0x64b883, 10, 18, 2);
pitchGlow.position.set(0, 3, 0);
scene.add(pitchGlow);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
loader.load('/models/cricket-world-v2.glb', (gltf) => {
  const root = gltf.scene;
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  root.position.sub(center);
  root.position.y += size.y * 0.5;
  scene.add(root);
  frameWorld(size);
}, undefined, (error) => {
  console.error('Cricket world failed to load on play route:', error);
});

function frameWorld(size) {
  const span = Math.max(size.x, size.z, 1);
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.fov = aspect < 0.85 ? 48 : 42;
  camera.position.set(0, Math.max(size.y * 1.28, span * 0.72), Math.max(span * 1.28, 7));
  camera.lookAt(0, Math.max(size.y * 0.25, 0.45), 0);
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}, { passive: true });

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
