import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { PinballEngine } from '../../physics/pinball-engine.js';
import { CricketMatchEngine } from '../match/match-engine.js';
import { createCricketGameplayAdapter } from './gameplay-adapter.js';
import { chooseCpuBowling, createCpuBattingAI } from './cpu-opponent.js';
import { createTossController } from '../toss/toss-controller.js';
import '../ui/play.css';

const WORLD_URL = '/models/cricket-world-v2.glb';
const WORLD_BYTES = 9271344;
const app = document.querySelector('#cricketPlayApp');
if (!app) throw new Error('Cricket Pinball play root not found.');

const params = new URLSearchParams(window.location.search);
const buildNonce = params.get('v') || String(Date.now());
const pathnameMatch = window.location.pathname.match(/\/cricket-pinball\/match\/([^/]+)/);
const matchId = pathnameMatch?.[1] || params.get('matchId') || 'local';
// Cricket Pinball is temporarily locked to the single-player match loop.
const mode = 'CPU';
const format = ['LAST_3', 'ONE_OVER', 'TWO_OVER'].includes(params.get('format')) ? params.get('format') : 'ONE_OVER';
const difficulty = ['EASY', 'MEDIUM', 'HARD'].includes(params.get('difficulty')) ? params.get('difficulty') : 'MEDIUM';

const players = [
  { id: 'p1', name: 'PLAYER 1', type: 'HUMAN' },
  { id: 'cpu', name: 'CPU', type: 'CPU' }
];

const tossController = createTossController();
const caller = tossController.pickCaller(players);
const opponent = players.find((player) => player.id !== caller.id);
const match = new CricketMatchEngine({ format, difficulty, players, maxWickets: 2, superOver: true });

let inputsLocked = true;
let engine = null;
let adapter = null;
let tableConfig = null;
let rulesConfig = null;
let modelRoot = null;
let ballVisual = null;
let leftFlipperVisual = null;
let rightFlipperVisual = null;
let scoreboardTexture = null;
let coinMesh = null;
let coinAnimation = null;
let selectedLine = 'CENTRE';
let deliveryResetTimer = null;
let cpuBattingAI = null;
let powerPressed = false;
let ballTrail = null;
let ballTrailPoints = [];
let ballGlow = null;
let deliveryCueTimer = null;
let aimGuide = null;
let aimMarker = null;
let cpuDeliveryCountdownToken = 0;

app.innerHTML = `
  <main class="cricket-play-shell">
    <canvas id="cricketPlayWorld"></canvas>

    <section class="play-loading" id="playLoading" aria-live="polite">
      <p>LOADING MATCH</p>
      <strong id="playLoadingPercent">0%</strong>
      <span id="playLoadingStatus">Preparing stadium…</span>
    </section>

    <header class="match-topbar">
      <a href="/cricket-pinball">← LOBBY</a>
      <div><span>${formatLabel(format)}</span><strong>${difficulty}</strong></div>
      <small>MATCH ${matchId.toUpperCase()}</small>
    </header>

    <section class="match-hud" id="matchHud" hidden>
      <div class="hud-score">
        <span id="hudBatter">— BATTING</span>
        <strong id="hudScore">0/0</strong>
        <small id="hudInnings">INNINGS 1</small>
      </div>
      <div class="hud-chase">
        <span id="hudTarget">TARGET —</span>
        <strong id="hudNeed">BALL 1 / ${match.ballsPerInnings}</strong>
        <small id="hudLast">LAST BALL —</small>
      </div>
      <div class="hud-role">
        <span id="hudRole">ROLE —</span>
        <strong id="hudBowler">— BOWLING</strong>
        <small id="hudState">MATCH INTRO</small>
      </div>
    </section>

    <section class="match-intro" id="matchIntro" hidden>
      <p>MATCH INTRO</p>
      <div class="versus">
        <div><span>${players[0].type}</span><strong>${players[0].name}</strong></div>
        <b>VS</b>
        <div><span>${players[1].type}</span><strong>${players[1].name}</strong></div>
      </div>
      <small>${caller.name} WILL CALL THE TOSS</small>
      <button type="button" id="beginToss">BEGIN TOSS</button>
    </section>

    <section class="toss-panel" id="tossPanel" hidden>
      <div class="toss-copy">
        <p id="tossEyebrow">TOSS · ${caller.name} CALLING</p>
        <h1 id="tossTitle">${caller.name} CALLS</h1>
        <span id="tossInstruction">Choose Heads or Tails</span>
      </div>
      <div class="coin-stage" id="coinStage" aria-live="polite">
        <div class="coin" id="tossCoin" aria-hidden="true">
          <div class="coin-face coin-heads">H</div>
          <div class="coin-face coin-tails">T</div>
        </div>
        <small id="coinStatus">READY FOR TOSS</small>
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
      <span>CRICKET PINBALL</span><strong>READY</strong>
    </section>

    <section class="innings-intro" id="inningsIntro" hidden>
      <p>INNINGS 1</p>
      <strong id="inningsBatting"></strong>
      <span id="inningsBowling"></span>
    </section>

    <section class="bowling-controls" id="bowlingControls" hidden>
      <div class="line-controls" aria-label="Bowling line">
        <button type="button" data-line="LEFT">LEFT</button>
        <button type="button" class="active" data-line="CENTRE">CENTRE</button>
        <button type="button" data-line="RIGHT">RIGHT</button>
      </div>
      <button class="power-control" id="powerControl" type="button">
        <span>HOLD TO CHARGE</span><strong id="powerValue">0%</strong>
        <i><b id="powerFill"></b></i>
      </button>
    </section>

    <section class="batting-controls" id="battingControls" hidden aria-label="Batter flipper controls">
      <button type="button" data-flipper="left">← LEFT BAT</button>
      <button type="button" data-flipper="right">RIGHT BAT →</button>
    </section>

    <aside class="next-ball-clock" id="nextBallClock" hidden aria-live="polite">
      <span>NEXT BALL</span>
      <strong id="nextBallSeconds">5</strong>
      <small>SECONDS</small>
    </aside>

    <section class="delivery-cue" id="deliveryCue" hidden aria-live="polite">
      <small id="deliveryCueLabel">DELIVERY</small>
      <strong id="deliveryCueValue">READY</strong>
    </section>

    <section class="match-result" id="matchResult" hidden>
      <p id="resultEyebrow">MATCH RESULT</p>
      <strong id="resultTitle"></strong>
      <span id="resultDetail"></span>
      <div><a href="/cricket-pinball">BACK TO LOBBY</a><button type="button" id="rematch">REMATCH</button></div>
    </section>
  </main>
`;

const canvas = document.querySelector('#cricketPlayWorld');
const loading = document.querySelector('#playLoading');
const loadingPercent = document.querySelector('#playLoadingPercent');
const loadingStatus = document.querySelector('#playLoadingStatus');
const intro = document.querySelector('#matchIntro');
const tossPanel = document.querySelector('#tossPanel');
const beginToss = document.querySelector('#beginToss');
const callActions = document.querySelector('#callActions');
const roleActions = document.querySelector('#roleActions');
const roleConfirmation = document.querySelector('#roleConfirmation');
const tossTitle = document.querySelector('#tossTitle');
const tossInstruction = document.querySelector('#tossInstruction');
const tossCoin = document.querySelector('#tossCoin');
const coinStatus = document.querySelector('#coinStatus');
const scoreboard = document.querySelector('#stadiumScoreboard');
const inningsIntro = document.querySelector('#inningsIntro');
const matchHud = document.querySelector('#matchHud');
const bowlingControls = document.querySelector('#bowlingControls');
const battingControls = document.querySelector('#battingControls');
const powerControl = document.querySelector('#powerControl');
const resultPanel = document.querySelector('#matchResult');
const deliveryCue = document.querySelector('#deliveryCue');
const deliveryCueLabel = document.querySelector('#deliveryCueLabel');
const deliveryCueValue = document.querySelector('#deliveryCueValue');
const nextBallClock = document.querySelector('#nextBallClock');
const nextBallSeconds = document.querySelector('#nextBallSeconds');
let nextBallCountdownTimer = null;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
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
const clock = new THREE.Clock();

bindUi();
boot();

async function boot() {
  try {
    loading.hidden = false;
    const [table, cricketRules, gltf] = await Promise.all([
      fetchJson('/game/cricket-table.json'),
      fetchJson('/game/cricket-rules.json'),
      loadWorld()
    ]);

    tableConfig = structuredClone(table);
    rulesConfig = cricketRules;
    tableConfig.launcher.bowlingLines = cricketRules.bowlingLines;
    applyConfiguredContent(cricketRules.content);

    modelRoot = gltf.scene;
    prepareWorld(modelRoot);
    scene.add(modelRoot);
    bindCricketWorldComponents(modelRoot);
    createMechanics();
    createCoin();
    setupStadiumScoreboard();
    engine = new PinballEngine(tableConfig);
    cpuBattingAI = createCpuBattingAI({
      engine,
      tableConfig,
      difficulty,
      cpuConfig: rulesConfig.cpu
    });
    adapter = createCricketGameplayAdapter({
      engine,
      matchEngine: match,
      tableConfig,
      cricketRules: rulesConfig,
      onResolved: onDeliveryResolved
    });

    loadingPercent.textContent = '100%';
    loadingStatus.textContent = 'Match ready';
    await delay(250);
    loading.hidden = true;
    intro.hidden = false;
    inputsLocked = false;
    updateScoreboards();

    if (caller.type === 'CPU') {
      beginToss.hidden = true;
      window.setTimeout(() => startTossFlow(), 700);
    }
  } catch (error) {
    console.error('Cricket Pinball boot failed:', error);
    loadingPercent.textContent = 'ERROR';
    loadingStatus.textContent = error.message || 'Cricket match could not load.';
    loading.classList.add('is-error');
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function loadWorld() {
  return new Promise((resolve, reject) => {
    loader.load(
      WORLD_URL,
      resolve,
      (progress) => {
        const total = progress.total || WORLD_BYTES;
        const pct = Math.min(99, Math.max(1, Math.round((progress.loaded / total) * 100)));
        loadingPercent.textContent = `${pct}%`;
        loadingStatus.textContent = 'Loading cricket-world-v2.glb…';
      },
      reject
    );
  });
}

function prepareWorld(root) {
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      normalizeEmbeddedMaterials(object, maxAnisotropy);
    }
  });
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  root.position.sub(center);
  root.position.y += size.y * 0.5;
  frameWorld(size);
}

function normalizeEmbeddedMaterials(object, maxAnisotropy) {
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  for (const material of materials) {
    if (!material) continue;
    if (material.map) {
      material.map.colorSpace = THREE.SRGBColorSpace;
      material.map.anisotropy = maxAnisotropy;
      material.map.needsUpdate = true;
    }
    material.needsUpdate = true;
  }
}

function findMappedMeshes(root, binding) {
  const names = new Set((binding.meshNames || []).map((name) => String(name).toLowerCase()));
  const tokens = (binding.matchTokens || []).map((token) => String(token).toLowerCase());
  const matches = [];

  root.traverse((object) => {
    if (!object.isMesh) return;
    const meshName = String(object.name || '').toLowerCase();
    const materialNames = (Array.isArray(object.material) ? object.material : [object.material])
      .map((material) => String(material?.name || '').toLowerCase());
    const haystack = [meshName, ...materialNames].join(' ');
    if (names.has(meshName) || tokens.some((token) => haystack.includes(token))) matches.push(object);
  });

  return [...new Set(matches)];
}

function bindCricketWorldComponents(root) {
  const bindings = tableConfig.world?.componentBindings || [];
  const registry = {};

  for (const binding of bindings) {
    const meshes = findMappedMeshes(root, binding);
    registry[binding.id] = meshes;
    meshes.forEach((mesh) => {
      mesh.userData.cricketComponent = binding.id;
      mesh.userData.cricketTreatment = binding.treatment;
      mesh.userData.cricketRole = binding.role || null;
    });
    console.info('[Cricket GLB]', binding.id, '→', meshes.map((mesh) => mesh.name));
  }

  modelRoot.userData.cricketComponents = registry;
}

function getCricketComponent(id) {
  return modelRoot?.userData?.cricketComponents?.[id] || [];
}

function createMechanics() {
  const ballRadius = tableConfig.ball.radius * 1.6;
  ballVisual = new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius, 32, 22),
    new THREE.MeshStandardMaterial({
      color: 0xc82131,
      emissive: 0x5a0810,
      emissiveIntensity: 1.0,
      roughness: 0.28,
      metalness: 0.04
    })
  );
  ballVisual.renderOrder = 12;
  scene.add(ballVisual);

  ballGlow = new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius * 1.8, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0xffd56a,
      transparent: true,
      opacity: 0.26,
      depthWrite: false
    })
  );
  ballGlow.renderOrder = 11;
  scene.add(ballGlow);

  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30 * 3), 3));
  trailGeometry.setDrawRange(0, 0);
  ballTrail = new THREE.Line(
    trailGeometry,
    new THREE.LineBasicMaterial({
      color: 0xffdc73,
      transparent: true,
      opacity: 0.86,
      depthWrite: false
    })
  );
  ballTrail.frustumCulled = false;
  ballTrail.renderOrder = 10;
  scene.add(ballTrail);

  // Use the authored GLB flipper/bat meshes as the visible controls.
  // Only create a fallback bat if a mapped GLB mesh is genuinely absent.
  const authoredLeftBat = getCricketComponent('bat-left')[0];
  const authoredRightBat = getCricketComponent('bat-right')[0];
  if (!engine.getFlipper('left') || !engine.getFlipper('right')) {
    throw new Error('Cricket flipper configuration is missing left/right engine bats.');
  }
  leftFlipperVisual = authoredLeftBat
    ? makeAuthoredBatPivot(authoredLeftBat, tableConfig.flippers[0])
    : makeCricketBatFlipper(tableConfig.flippers[0]);
  rightFlipperVisual = authoredRightBat
    ? makeAuthoredBatPivot(authoredRightBat, tableConfig.flippers[1])
    : makeCricketBatFlipper(tableConfig.flippers[1]);

  createAimGuide();
}

function makeAuthoredBatPivot(mesh, cfg) {
  // RCA: the GLB is recentered after load, so cfg.pivot is in PHYSICS space
  // while the authored mesh lives under modelRoot in MODEL space. The previous
  // scene-level wrapper mixed those coordinate spaces and then applied an
  // absolute physics angle to an authored mesh that already had its own rest
  // rotation. Input changed engine state, but the visible bat did not follow
  // that state correctly.
  //
  // Keep the authored mesh inside modelRoot's coordinate system and preserve
  // its exact rest transform. The wrapper only applies the DELTA between the
  // physics rest angle and the current physics angle.
  const parent = mesh.parent;
  if (!parent) return mesh;

  mesh.updateMatrix();
  const pivot = new THREE.Group();
  pivot.name = `CricketBatPivot_${cfg.id}`;
  pivot.position.copy(mesh.position);
  pivot.quaternion.copy(mesh.quaternion);
  pivot.scale.copy(mesh.scale);

  parent.add(pivot);
  parent.remove(mesh);
  mesh.position.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.set(1, 1, 1);
  pivot.add(mesh);

  pivot.userData.cricketAuthoredFlipper = true;
  pivot.userData.cricketFlipperMesh = mesh;
  pivot.userData.cricketRestAngle = cfg.restAngleDeg * Math.PI / 180;
  pivot.userData.cricketBaseQuaternion = pivot.quaternion.clone();
  return pivot;
}

function makeCricketBatFlipper(cfg) {
  const group = new THREE.Group();

  const bladeLength = cfg.length * 0.74;
  const bladeWidth = cfg.radius * 1.95;
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(bladeLength, 0.12, bladeWidth),
    new THREE.MeshStandardMaterial({
      color: 0xd6b06c,
      roughness: 0.48,
      metalness: 0.02
    })
  );
  blade.geometry.translate(bladeLength * 0.5, 0, 0);

  const toe = new THREE.Mesh(
    new THREE.BoxGeometry(bladeWidth * 0.55, 0.13, bladeWidth * 1.02),
    new THREE.MeshStandardMaterial({ color: 0xe7c985, roughness: 0.5 })
  );
  toe.position.x = bladeLength;

  const handleLength = cfg.length * 0.28;
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(cfg.radius * 0.28, cfg.radius * 0.28, handleLength, 12),
    new THREE.MeshStandardMaterial({ color: 0x352116, roughness: 0.9 })
  );
  handle.rotation.z = Math.PI / 2;
  handle.position.x = bladeLength + handleLength * 0.55;

  group.add(blade, toe, handle);
  group.position.set(cfg.pivot[0], tableConfig.playfield.surfaceY + 0.22, cfg.pivot[1]);
  group.userData.cricketFallbackFlipper = true;
  scene.add(group);
  return group;
}

function createAimGuide() {
  const points = [
    new THREE.Vector3(tableConfig.launcher.spawn[0], tableConfig.playfield.surfaceY + 0.16, tableConfig.launcher.spawn[1]),
    new THREE.Vector3(tableConfig.launcher.spawn[0], tableConfig.playfield.surfaceY + 0.16, tableConfig.launcher.lane.exitZ)
  ];
  aimGuide = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineDashedMaterial({
      color: 0xffd56a,
      dashSize: 0.16,
      gapSize: 0.10,
      transparent: true,
      opacity: 0.88,
      depthWrite: false
    })
  );
  aimGuide.computeLineDistances();
  aimGuide.renderOrder = 9;
  scene.add(aimGuide);

  aimMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.14, 0.19, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffd56a,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  aimMarker.rotation.x = -Math.PI / 2;
  aimMarker.position.set(
    tableConfig.launcher.spawn[0],
    tableConfig.playfield.surfaceY + 0.18,
    tableConfig.launcher.spawn[1]
  );
  aimMarker.renderOrder = 10;
  scene.add(aimMarker);
}


function resetBallTrail() {
  ballTrailPoints = [];
  if (ballTrail) ballTrail.geometry.setDrawRange(0, 0);
}

function pushBallTrailPoint() {
  if (!ballTrail || !engine?.ball?.active || engine.isAwaitingLaunch()) return;
  const y = tableConfig.playfield.surfaceY + tableConfig.ball.radius + 0.08;
  ballTrailPoints.push(new THREE.Vector3(engine.ball.position.x, y, engine.ball.position.z));
  if (ballTrailPoints.length > 30) ballTrailPoints.shift();

  const attribute = ballTrail.geometry.getAttribute('position');
  for (let i = 0; i < ballTrailPoints.length; i += 1) {
    const point = ballTrailPoints[i];
    attribute.setXYZ(i, point.x, point.y, point.z);
  }
  attribute.needsUpdate = true;
  ballTrail.geometry.setDrawRange(0, ballTrailPoints.length);
}

function showDeliveryCue(value, label = 'DELIVERY', holdMs = 0) {
  clearTimeout(deliveryCueTimer);
  deliveryCueLabel.textContent = label;
  deliveryCueValue.textContent = value;
  deliveryCue.hidden = false;
  deliveryCue.classList.remove('is-result');
  if (label === 'RESULT') deliveryCue.classList.add('is-result');

  if (holdMs > 0) {
    deliveryCueTimer = window.setTimeout(() => {
      deliveryCue.hidden = true;
    }, holdMs);
  }
}


function createCoin() {
  const material = [
    new THREE.MeshStandardMaterial({ color: 0xc69a38, metalness: 0.85, roughness: 0.22 }),
    new THREE.MeshStandardMaterial({ color: 0xf2ca62, metalness: 0.76, roughness: 0.2 }),
    new THREE.MeshStandardMaterial({ color: 0xd6aa44, metalness: 0.82, roughness: 0.2 })
  ];
  coinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.055, 48), material);
  coinMesh.rotation.z = Math.PI / 2;
  coinMesh.position.set(0, 2.2, 0);
  coinMesh.visible = false;
  scene.add(coinMesh);
}

function setupStadiumScoreboard() {
  const screen = modelRoot.getObjectByName('Cricket_Scoreboard_Screen');
  if (!screen?.isMesh) return;
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 1024;
  boardCanvas.height = 512;
  scoreboardTexture = new THREE.CanvasTexture(boardCanvas);
  scoreboardTexture.colorSpace = THREE.SRGBColorSpace;
  screen.material = new THREE.MeshBasicMaterial({ map: scoreboardTexture, toneMapped: false });
  scoreboardTexture.userData.canvas = boardCanvas;
  updateScoreboards();
}

function drawStadiumScoreboard(label, value) {
  if (!scoreboardTexture) return;
  const boardCanvas = scoreboardTexture.userData.canvas;
  const ctx = boardCanvas.getContext('2d');
  ctx.fillStyle = '#06120c';
  ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
  ctx.strokeStyle = '#d6b65b';
  ctx.lineWidth = 12;
  ctx.strokeRect(18, 18, boardCanvas.width - 36, boardCanvas.height - 36);
  ctx.fillStyle = '#91b99f';
  ctx.font = '700 48px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(label, 512, 170);
  ctx.fillStyle = '#fff4cf';
  ctx.font = '900 76px system-ui';
  ctx.fillText(value, 512, 300);
  scoreboardTexture.needsUpdate = true;
}

function applyConfiguredContent(content) {
  if (!content) return;
  const items = content.items || {};
  const set = (selector,key,fallbackDynamic=false) => {
    const node = document.querySelector(selector);
    const item = items[key];
    if (!node || !item) return;
    if (!fallbackDynamic && item.text != null) node.textContent = item.text;
    node.style.setProperty('font-size', `${Number(item.fontSize) || 16}px`, 'important');
    node.style.setProperty('color', item.color || '#ffffff', 'important');
  };
  const shell = document.querySelector('.cricket-play-shell');
  shell?.style.setProperty('font-family', content.fontFace || 'Arial, Helvetica, sans-serif');
  const layout = content.layout || {};
  shell?.style.setProperty('--hud-scale', String(Number(layout.scoreboardScale) || 1));
  shell?.style.setProperty('--bat-control-width', `${Number(layout.batButtonWidth) || 220}px`);
  shell?.style.setProperty('--bat-control-height', `${Number(layout.batButtonHeight) || 68}px`);
  shell?.style.setProperty('--bat-control-gap', `${Number(layout.batButtonGap) || 14}px`);
  shell?.style.setProperty('--bat-control-bottom', `${Number(layout.batButtonBottom) || 18}px`);
  set('#matchIntro > p','matchIntro'); set('#beginToss','beginToss');
  set('#tossEyebrow','tossEyebrow',true); set('#tossTitle','tossTitle',true); set('#tossInstruction','tossInstruction');
  set('#coinStatus','coinStatus'); set('[data-call="HEADS"]','heads'); set('[data-call="TAILS"]','tails');
  set('[data-role="BAT"]','bat'); set('[data-role="BOWL"]','bowl');
  set('#hudScore','hudScore',true); set('#hudNeed','hudBall',true); set('#hudBowler','hudRole',true);
  set('[data-line="LEFT"]','leftLine'); set('[data-line="CENTRE"]','centreLine'); set('[data-line="RIGHT"]','rightLine');
  set('#powerControl span','charge'); set('[data-flipper="left"]','leftBat'); set('[data-flipper="right"]','rightBat');
  set('#nextBallClock > span','nextBall'); set('#nextBallClock > small','seconds');
  set('#deliveryCueLabel','delivery'); set('#deliveryCueValue','ready',true); set('#resultEyebrow','matchResult');
}

async function startTossFlow() {
  if (inputsLocked) return;
  intro.hidden = true;
  tossPanel.hidden = false;

  if (caller.type === 'CPU') {
    callActions.hidden = true;
    roleActions.hidden = true;
    tossTitle.textContent = 'CPU CALLS';
    tossInstruction.textContent = 'CPU is choosing Heads or Tails…';
    inputsLocked = true;
    await delay(650);
    inputsLocked = false;
    await resolveToss(Math.random() < 0.5 ? 'HEADS' : 'TAILS');
    return;
  }

  callActions.hidden = false;
  tossTitle.textContent = 'PLAYER 1 CALLS';
  tossInstruction.textContent = 'Choose Heads or Tails';
}

function bindUi() {
  beginToss.addEventListener('click', startTossFlow);

  document.querySelectorAll('[data-call]').forEach((button) => {
    button.addEventListener('click', () => resolveToss(button.dataset.call));
  });
  document.querySelectorAll('[data-role]').forEach((button) => {
    button.addEventListener('click', () => chooseRole(button.dataset.role));
  });
  document.querySelectorAll('[data-line]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!canBowlNow()) return;
      selectedLine = button.dataset.line;
      document.querySelectorAll('[data-line]').forEach((node) => node.classList.toggle('active', node === button));
    });
  });

  bindPowerControl();
  bindFlippers();

  document.querySelector('#rematch').addEventListener('click', () => window.location.reload());

  window.addEventListener('keydown', (event) => {
    if (!engine) return;

    if (canBatNow() && !event.repeat) {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        event.preventDefault();
        engine.setFlipper('left', true);
        document.querySelector('[data-flipper="left"]')?.classList.add('pressed');
        return;
      }
      if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        event.preventDefault();
        engine.setFlipper('right', true);
        document.querySelector('[data-flipper="right"]')?.classList.add('pressed');
        return;
      }
    }

    if (inputsLocked) return;
    if (canBowlNow()) {
      if (event.code === 'KeyQ') setLineFromKeyboard('LEFT');
      if (event.code === 'KeyW') setLineFromKeyboard('CENTRE');
      if (event.code === 'KeyE') setLineFromKeyboard('RIGHT');
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        beginPower();
      }
    }
  });

  window.addEventListener('keyup', (event) => {
    if (!engine) return;
    if (event.code === 'Space' && powerPressed) {
      event.preventDefault();
      releasePower();
    }
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
      engine.setFlipper('left', false);
      document.querySelector('[data-flipper="left"]')?.classList.remove('pressed');
    }
    if (event.code === 'KeyD' || event.code === 'ArrowRight') {
      engine.setFlipper('right', false);
      document.querySelector('[data-flipper="right"]')?.classList.remove('pressed');
    }
  });
}

function bindPowerControl() {
  const finish = (event) => {
    if (!powerPressed) return;
    event?.preventDefault();
    releasePower();
  };
  powerControl.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    beginPower();
    try { powerControl.setPointerCapture(event.pointerId); } catch {}
  });
  powerControl.addEventListener('pointerup', finish);
  powerControl.addEventListener('pointercancel', finish);
  powerControl.addEventListener('lostpointercapture', finish);
}

function bindFlippers() {
  document.querySelectorAll('[data-flipper]').forEach((button) => {
    const id = button.dataset.flipper;
    const release = (event) => {
      event.preventDefault();
      engine?.setFlipper(id, false);
      button.classList.remove('pressed');
    };
    button.addEventListener('pointerdown', (event) => {
      if (!canBatNow()) return;
      event.preventDefault();
      engine?.setFlipper(id, true);
      button.classList.add('pressed');
      try { button.setPointerCapture(event.pointerId); } catch {}
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  });
}

async function resolveToss(call) {
  if (inputsLocked || tossController.isLocked()) return;
  inputsLocked = true;
  disableTossInputs(true);

  const toss = tossController.perform(call, caller.id, opponent.id);
  match.setToss(toss);
  callActions.hidden = true;
  tossTitle.textContent = `${caller.name} CALLED ${call}`;
  tossInstruction.textContent = 'Coin in the air…';
  setScoreboard('TOSS', 'COIN IN AIR');
  await animateCoin(toss.result);

  tossTitle.textContent = toss.result;
  tossInstruction.textContent = `${playerName(toss.winnerId)} WON THE TOSS`;
  setScoreboard('TOSS RESULT', `${toss.result} · ${playerName(toss.winnerId)} WINS`);
  await delay(rulesConfig.toss?.resultHoldMs ?? 800);

  const winner = getPlayer(toss.winnerId);
  if (winner.type === 'CPU') {
    tossInstruction.textContent = 'CPU is choosing…';
    await delay(500);
    inputsLocked = false;
    chooseRole(Math.random() < 0.5 ? 'BAT' : 'BOWL');
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

  const winnerId = match.toss.winnerId;
  const loserId = players.find((player) => player.id !== winnerId).id;
  const battingPlayerId = choice === 'BAT' ? winnerId : loserId;
  const bowlingPlayerId = choice === 'BAT' ? loserId : winnerId;
  match.assignRoles({ battingPlayerId, bowlingPlayerId, choice });

  const battingName = playerName(battingPlayerId);
  const bowlingName = playerName(bowlingPlayerId);
  tossTitle.textContent = `${playerName(winnerId)} CHOOSES ${choice}`;
  tossInstruction.textContent = 'Roles confirmed';
  document.querySelector('#battingRole').textContent = `${battingName} BATTING`;
  document.querySelector('#bowlingRole').textContent = `${bowlingName} BOWLING`;
  roleConfirmation.hidden = false;
  setScoreboard('TOSS', `${battingName} BAT · ${bowlingName} BOWL`);

  await delay(rulesConfig.toss?.roleConfirmMs ?? 900);
  tossPanel.hidden = true;
  await beginInnings();
}

async function beginInnings() {
  match.startInnings();
  updateScoreboards();
  inningsIntro.hidden = false;
  document.querySelector('#inningsBatting').textContent = `${playerName(match.battingPlayerId)} BATTING`;
  document.querySelector('#inningsBowling').textContent = `${playerName(match.bowlingPlayerId)} BOWLING`;
  inningsIntro.querySelector('p').textContent = `INNINGS ${match.inningsNumber}`;
  await delay(rulesConfig.toss?.inningsIntroMs ?? 900);
  inningsIntro.hidden = true;
  matchHud.hidden = false;
  inputsLocked = false;
  prepareDelivery();
}

function prepareDelivery() {
  if (!engine || match.currentInnings?.complete || ['MATCH_OVER', 'SUPER_OVER'].includes(match.status)) return;
  engine.resetBall();
  cpuBattingAI?.reset();
  resetBallTrail();
  cpuDeliveryCountdownToken += 1;
  inputsLocked = false;
  updateScoreboards();
  updateRoleControls();

  if (getPlayer(match.bowlingPlayerId).type === 'CPU') {
    startCpuBowlingCountdown();
    return;
  }

  showDeliveryCue('READY TO BOWL', 'YOUR DELIVERY', 700);
}

async function startCpuBowlingCountdown() {
  const token = ++cpuDeliveryCountdownToken;
  inputsLocked = true;
  updateRoleControls();

  for (const count of [3, 2, 1]) {
    if (token !== cpuDeliveryCountdownToken || match.deliveryOpen || match.currentInnings?.complete) return;
    showDeliveryCue(String(count), 'CPU BOWLING', 0);
    setScoreboard('GET READY', String(count));
    await delay(700);
  }

  if (token !== cpuDeliveryCountdownToken || match.deliveryOpen || match.currentInnings?.complete) return;
  launchCpuDelivery();
}

function launchCpuDelivery() {
  if (!engine || match.deliveryOpen || match.currentInnings?.complete) return;
  const bowling = chooseCpuBowling(difficulty, rulesConfig.cpu);
  selectedLine = bowling.line;
  if (!match.beginDelivery(bowling)) return;
  adapter.armDelivery();
  resetBallTrail();

  // Transfer control to the human batter before the physical release.
  inputsLocked = false;
  engine.releaseLaunch({ charge: bowling.power, line: bowling.line, deliveryType: bowling.type });
  showDeliveryCue('BAT NOW · ← / →', 'BALL LIVE', 650);
  updateRoleControls();
  updateScoreboards();
}

function beginPower() {
  if (!canBowlNow() || powerPressed) return;
  powerPressed = engine.beginLaunch();
  powerControl.classList.toggle('pressed', powerPressed);
}

function releasePower() {
  if (!powerPressed || !engine || !isHumanBowling() || match.deliveryOpen) return;
  powerPressed = false;
  powerControl.classList.remove('pressed');
  const charge = Math.max(engine.getLauncherCharge(), tableConfig.launcher.tapCharge);
  const bowling = { line: selectedLine, power: charge, type: 'PACE' };
  if (!match.beginDelivery(bowling)) return;
  adapter.armDelivery();
  resetBallTrail();
  showDeliveryCue('BALL LIVE', selectedLine + ' LINE', 450);
  engine.releaseLaunch({ charge, line: selectedLine, deliveryType: 'PACE' });
  updateRoleControls();
  updateScoreboards();

}

function onDeliveryResolved(type) {
  cpuDeliveryCountdownToken += 1;
  cpuBattingAI?.reset();
  inputsLocked = true;
  updateRoleControls();
  engine?.setFlipper('left', false);
  engine?.setFlipper('right', false);
  document.querySelector('#hudLast').textContent = `LAST BALL ${displayOutcome(type)}`;
  showDeliveryCue(displayOutcome(type), 'RESULT', Math.max(900, rulesConfig.delivery.resolveDelayMs));
  updateScoreboards();

  clearTimeout(deliveryResetTimer);
  clearInterval(nextBallCountdownTimer);

  if (match.status === 'MATCH_OVER' || match.status === 'SUPER_OVER') {
    deliveryResetTimer = window.setTimeout(showResult, rulesConfig.delivery.resolveDelayMs);
    return;
  }

  startNextBallCountdown(async () => {
    if (match.status === 'INNINGS_BREAK') {
      setScoreboard('TARGET', String(match.target));
      inningsIntro.hidden = false;
      inningsIntro.querySelector('p').textContent = 'INNINGS BREAK';
      document.querySelector('#inningsBatting').textContent = `TARGET ${match.target}`;
      document.querySelector('#inningsBowling').textContent = 'ROLES SWITCHING';
      await delay(1100);
      inningsIntro.hidden = true;
      match.startSecondInnings();
    }
    prepareDelivery();
  });
}

function startNextBallCountdown(onComplete) {
  clearInterval(nextBallCountdownTimer);
  let remaining = 5;
  nextBallSeconds.textContent = String(remaining);
  nextBallClock.hidden = false;

  nextBallCountdownTimer = window.setInterval(() => {
    remaining -= 1;
    nextBallSeconds.textContent = String(Math.max(0, remaining));
    if (remaining <= 0) {
      clearInterval(nextBallCountdownTimer);
      nextBallCountdownTimer = null;
      nextBallClock.hidden = true;
      onComplete?.();
    }
  }, 1000);
}

function showResult() {
  inputsLocked = true;
  bowlingControls.hidden = true;
  battingControls.hidden = true;
  resultPanel.hidden = false;
  const result = match.result;
  if (match.status === 'SUPER_OVER') {
    document.querySelector('#resultEyebrow').textContent = 'TIE';
    document.querySelector('#resultTitle').textContent = 'SUPER OVER READY';
    document.querySelector('#resultDetail').textContent = 'The match is tied. Super Over is the next match state.';
    setScoreboard('TIE', 'SUPER OVER');
    return;
  }
  const winner = playerName(result.winnerId);
  document.querySelector('#resultTitle').textContent = `${winner} WINS`;
  document.querySelector('#resultDetail').textContent = result.marginType === 'RUNS'
    ? `Won by ${result.margin} run${result.margin === 1 ? '' : 's'}.`
    : `Won with ${result.margin} ball${result.margin === 1 ? '' : 's'} remaining.`;
  setScoreboard('MATCH RESULT', `${winner} WINS`);
}

function updateRoleControls() {
  const state = match.getState();
  const ballLive = state.deliveryOpen && engine && !engine.isAwaitingLaunch();
  const showBowling = canBowlNow();
  const showBatting = canBatNow();

  bowlingControls.hidden = !showBowling;
  battingControls.hidden = !showBatting;

  // Hard lock flippers unless the live ball belongs to a human batter.
  if (!showBatting) {
    engine?.setFlipper('left', false);
    engine?.setFlipper('right', false);
    document.querySelectorAll('[data-flipper]').forEach((button) => button.classList.remove('pressed'));
  }

  const roleText = showBowling
    ? `${playerName(state.bowlingPlayerId)} · BOWL NOW`
    : showBatting
      ? `${playerName(state.battingPlayerId)} · BAT NOW`
      : ballLive
        ? `${playerName(state.battingPlayerId)} BATTING`
        : 'DELIVERY SETUP';

  document.querySelector('#hudRole').textContent = roleText;
}
function updateScoreboards() {
  const state = match.getState();
  const batting = playerName(state.battingPlayerId);
  const bowling = playerName(state.bowlingPlayerId);
  document.querySelector('#hudBatter').textContent = `${batting} BATTING`;
  document.querySelector('#hudBowler').textContent = `${bowling} BOWLING`;
  document.querySelector('#hudScore').textContent = `${state.score.runs}/${state.score.wickets}`;
  document.querySelector('#hudInnings').textContent = `INNINGS ${Math.max(1, state.innings)}`;
  document.querySelector('#hudTarget').textContent = state.target === null ? 'TARGET —' : `TARGET ${state.target}`;
  document.querySelector('#hudNeed').textContent = state.target === null
    ? `BALL ${Math.min(state.score.balls + 1, state.ballsPerInnings)} / ${state.ballsPerInnings}`
    : `NEED ${state.requiredRuns} FROM ${state.ballsRemaining}`;
  document.querySelector('#hudState').textContent = state.status.replaceAll('_', ' ');
  if (state.innings > 0) setScoreboard(`INNINGS ${state.innings}`, `${state.score.runs}/${state.score.wickets}`);
}

function setScoreboard(label, value) {
  scoreboard.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
  drawStadiumScoreboard(label, value);
}

function setLineFromKeyboard(line) {
  selectedLine = line;
  document.querySelectorAll('[data-line]').forEach((button) => button.classList.toggle('active', button.dataset.line === line));
}

function disableTossInputs(disabled) {
  document.querySelectorAll('[data-call], [data-role]').forEach((button) => { button.disabled = disabled; });
}

function isHumanBowling() {
  return getPlayer(match.bowlingPlayerId)?.type === 'HUMAN';
}

function isHumanBatting() {
  return getPlayer(match.battingPlayerId)?.type === 'HUMAN';
}

function canBowlNow() {
  return Boolean(
    !inputsLocked &&
    engine &&
    isHumanBowling() &&
    !match.deliveryOpen &&
    engine.isAwaitingLaunch()
  );
}

function canBatNow() {
  return Boolean(
    engine &&
    isHumanBatting() &&
    match.deliveryOpen
  );
}

function getPlayer(id) {
  return players.find((player) => player.id === id);
}

function playerName(id) {
  return getPlayer(id)?.name || '—';
}

function formatLabel(value) {
  return { LAST_3: 'LAST 3 BALLS', ONE_OVER: '1 OVER', TWO_OVER: '2 OVERS' }[value] || '1 OVER';
}

function displayOutcome(type) {
  return { WICKET: 'W', DOT: '0', ONE: '1', TWO: '2', FOUR: '4', SIX: '6' }[type] || type;
}

function animateCoin(result) {
  return new Promise((resolve) => {
    const duration = rulesConfig?.toss?.coinMs ?? 1600;

    coinStatus.textContent = 'COIN IN THE AIR';
    tossCoin.classList.remove('is-flipping', 'show-tails');
    void tossCoin.offsetWidth;
    tossCoin.classList.add('is-flipping');

    coinAnimation = {
      start: performance.now(),
      duration,
      result,
      resolve: () => {
        tossCoin.classList.remove('is-flipping');
        tossCoin.classList.toggle('show-tails', result === 'TAILS');
        coinStatus.textContent = result;
        resolve();
      }
    };

    coinMesh.visible = true;
  });
}
function updateCoin(now) {
  if (!coinAnimation || !coinMesh) return;
  const t = Math.min(1, (now - coinAnimation.start) / coinAnimation.duration);
  coinMesh.position.y = 1.35 + Math.sin(t * Math.PI) * 2.1;
  coinMesh.rotation.x = t * Math.PI * 12;
  coinMesh.rotation.z = Math.PI / 2 + t * Math.PI * 8;
  if (t >= 1) {
    coinMesh.rotation.x = coinAnimation.result === 'HEADS' ? 0 : Math.PI;
    const done = coinAnimation.resolve;
    coinAnimation = null;
    window.setTimeout(() => { coinMesh.visible = false; }, 650);
    done();
  }
}

function syncMechanics() {
  if (!engine || !ballVisual) return;
  ballVisual.visible = engine.ball.active;
  ballVisual.position.set(
    engine.ball.position.x,
    tableConfig.playfield.surfaceY + tableConfig.ball.radius + 0.08,
    engine.ball.position.z
  );
  const awaitingLaunch = engine.isAwaitingLaunch();
  if (ballGlow) {
    ballGlow.visible = engine.ball.active;
    ballGlow.position.copy(ballVisual.position);
    const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.12;
    ballGlow.scale.setScalar(pulse);
  }
  ballVisual.rotation.x += 0.03;
  ballVisual.rotation.z += 0.045;
  if (aimGuide) aimGuide.visible = awaitingLaunch && isHumanBowling();
  if (aimMarker) {
    aimMarker.visible = awaitingLaunch && isHumanBowling();
    const markerPulse = 1 + Math.sin(performance.now() * 0.01) * 0.18;
    aimMarker.scale.setScalar(markerPulse);
  }
  pushBallTrailPoint();

  syncFlipper(leftFlipperVisual, engine.getFlipper('left'), tableConfig.flippers[0]);
  syncFlipper(rightFlipperVisual, engine.getFlipper('right'), tableConfig.flippers[1]);

  const charge = engine.getLauncherCharge();
  document.querySelector('#powerValue').textContent = `${Math.round(charge * 100)}%`;
  document.querySelector('#powerFill').style.width = `${Math.round(charge * 100)}%`;
}

function syncFlipper(object, state, cfg) {
  if (!object || !state) return;

  if (object.userData.cricketAuthoredFlipper) {
    const rest = object.userData.cricketRestAngle ?? (cfg.restAngleDeg * Math.PI / 180);
    const delta = state.angle - rest;
    object.quaternion.copy(object.userData.cricketBaseQuaternion);
    object.rotateY(delta);
    return;
  }

  object.rotation.y = state.angle;
  if (object.userData.cricketFallbackFlipper) {
    object.position.x = cfg.pivot[0];
    object.position.z = cfg.pivot[1];
  }
}

function frameWorld(size) {
  const span = Math.max(size.x, size.z, 1);
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.fov = aspect < 0.85 ? 48 : 42;
  camera.position.set(0, Math.max(size.y * 1.08, span * 0.61), Math.max(span * 1.08, 6.1));
  camera.lookAt(0, Math.max(size.y * 0.23, 0.42), 0);
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}, { passive: true });

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  const cpuBatting = Boolean(
    engine &&
    match.deliveryOpen &&
    getPlayer(match.battingPlayerId)?.type === 'CPU'
  );
  cpuBattingAI?.update(now, cpuBatting);

  if (adapter) {
    adapter.step(dt);
    syncMechanics();
  } else if (engine) {
    engine.step(dt);
    syncMechanics();
  }
  updateCoin(now);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
