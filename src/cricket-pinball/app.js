import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import './ui/cricket-pinball.css';
import { installHowToPinCricket } from './ui/how-to-pin-cricket.js';

const STORAGE_KEY = 'cricket-pinball-preferences-v1';
const app = document.querySelector('#cricketPinballApp');

if (!app) throw new Error('Cricket Pinball root element not found.');

document.documentElement.dataset.product = 'cricket-pinball';

const saved = readPreferences();
const lobbyState = {
  mode: 'CPU',
  format: saved.format || 'ONE_OVER',
  difficulty: saved.difficulty || 'MEDIUM'
};

app.innerHTML = `
  <main class="cricket-pinball-shell">
    <canvas id="cricketWorld"></canvas>
    <div class="world-vignette" aria-hidden="true"></div>

    <header class="cricket-sitebar">
      <a class="infinite-brand" href="/" aria-label="Infinite Pinball home">
        <img src="/homepage/logos/01_logo_horizontal_transparent.webp" alt="Infinite Pinball" />
      </a>
      <nav aria-label="Cricket Pinball navigation">
        <a href="/">Worlds</a>
        <span>Cricket Pinball</span>
      </nav>
    </header>

    <section class="cricket-lobby" id="cricketLobby" aria-labelledby="cricketLobbyTitle" hidden>
      <div class="cricket-identity">
        <p>SPORTS WORLD</p>
        <h1 id="cricketLobbyTitle">CRICKET<br>PINBALL</h1>
        <span>Bat with flippers. Bowl the delivery.</span>
      </div>

      <aside class="cricket-lobby-panel" aria-label="Match setup">
        <div class="panel-kicker"><span>QUICK MATCH</span><b>SET YOUR MATCH</b></div>

        <section class="quick-match" id="quickMatch" hidden>
          <div class="quick-summary">
            <span>READY TO PLAY</span>
            <strong id="quickMatchSummary"></strong>
          </div>
          <button type="button" id="quickPlay" class="cricket-start">▶ PLAY MATCH</button>
          <button type="button" class="text-button" id="changeMatch">CHANGE MATCH</button>
        </section>

        <section class="setup-flow" id="setupFlow">
          <div class="setup-step" data-step="1">
            <div class="control-row">
              <span class="control-label">MODE</span>
              <div class="cricket-segmented mode-segmented">
                <button type="button" class="active" data-mode="CPU">PLAYER VS CPU</button>
                <button type="button" class="is-locked" disabled title="Local Player vs Player gameplay is not enabled yet">PLAYER VS PLAYER <small>SOON</small></button>
              </div>
            </div>
            <div class="control-row">
              <span class="control-label">OVERS</span>
              <div class="cricket-segmented">
                <button type="button" data-format="LAST_3">3 BALLS</button>
                <button type="button" data-format="ONE_OVER">1 OVER</button>
                <button type="button" data-format="TWO_OVER">2 OVERS</button>
              </div>
            </div>
            <div class="control-row">
              <span class="control-label">DIFFICULTY</span>
              <div class="cricket-segmented">
                <button type="button" data-difficulty="EASY">EASY</button>
                <button type="button" data-difficulty="MEDIUM">NORMAL</button>
                <button type="button" data-difficulty="HARD">HARD</button>
              </div>
            </div>
            <button type="button" class="cricket-start" id="cricketStart">▶ PLAY MATCH<span></span></button>
          </div>
        </section>
        <div class="panel-footer"><span>SKILL</span><i></i><span>TIMING</span><i></i><span>CRICKET</span></div>
      </aside>
    </section>

    <section class="cricket-loading" id="cricketLoading" aria-live="polite">
      <img src="/homepage/logos/01_logo_horizontal_transparent.webp" alt="" />
      <p>CRICKET PINBALL</p>
      <strong id="cricketLoadingPercent">0%</strong>
      <span id="cricketLoadingStatus">Preparing stadium…</span>
    </section>
  </main>
`

const canvas = document.querySelector('#cricketWorld');
const lobby = document.querySelector('#cricketLobby');
const loading = document.querySelector('#cricketLoading');
const loadingPercent = document.querySelector('#cricketLoadingPercent');
const loadingStatus = document.querySelector('#cricketLoadingStatus');
const setupFlow = document.querySelector('#setupFlow');
const quickMatch = document.querySelector('#quickMatch');
const quickSummary = document.querySelector('#quickMatchSummary');
const startButton = document.querySelector('#cricketStart');
installHowToPinCricket({ root: app, context: 'lobby' });

let currentStep = 1;

bindLobby();
hydrateSelections();
renderLandingMode();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07110c);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 5.8, 8.4);
camera.lookAt(0, 0.8, 0);

scene.add(new THREE.HemisphereLight(0xdcefe3, 0x0c140f, 2.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 3.4);
keyLight.position.set(-3, 7, 5);
scene.add(keyLight);
const rimLight = new THREE.PointLight(0x4daa74, 12, 18, 2);
rimLight.position.set(4, 3, -2);
scene.add(rimLight);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

loader.load(
  '/models/cricket-world-v2.glb',
  (gltf) => {
    const root = gltf.scene;
    root.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    root.position.sub(center);
    root.position.y += size.y * 0.5;
    scene.add(root);
    frameWorld(size);

    loadingPercent.textContent = '100%';
    loadingStatus.textContent = 'Stadium ready';
    loading.classList.add('is-ready');

    window.setTimeout(() => {
      loading.hidden = true;
      lobby.hidden = false;
    }, 350);
  },
  (progress) => {
    if (!progress.total) {
      loadingStatus.textContent = 'Loading stadium…';
      return;
    }
    const percent = Math.min(100, Math.round((progress.loaded / progress.total) * 100));
    loadingPercent.textContent = `${percent}%`;
    loadingStatus.textContent = percent < 100 ? 'Loading stadium…' : 'Preparing scene…';
  },
  (error) => {
    console.error('Cricket world failed to load:', error);
    loadingPercent.textContent = 'ERROR';
    loadingStatus.textContent = 'Cricket stadium could not be loaded.';
    loading.classList.add('is-error');
  }
);

function bindLobby() {
  lobby.addEventListener('click', (event) => {
    const modeButton = event.target.closest('[data-mode]');
    if (modeButton) {
      lobbyState.mode = modeButton.dataset.mode;
      setActive('[data-mode]', modeButton);
      updateStartButton();
      return;
    }

    const formatButton = event.target.closest('[data-format]');
    if (formatButton) {
      lobbyState.format = formatButton.dataset.format;
      setActive('[data-format]', formatButton);
      updateStartButton();
      return;
    }

    const difficultyButton = event.target.closest('[data-difficulty]');
    if (difficultyButton) {
      lobbyState.difficulty = difficultyButton.dataset.difficulty;
      setActive('[data-difficulty]', difficultyButton);
      updateStartButton();
      return;
    }

    const backButton = event.target.closest('[data-back]');
    if (backButton) {
      goToStep(Number(backButton.dataset.back));
      return;
    }

    if (event.target.closest('#cricketStart') || event.target.closest('#quickPlay')) {
      startMatch();
      return;
    }

    if (event.target.closest('#changeMatch')) {
      quickMatch.hidden = true;
      setupFlow.hidden = false;
      goToStep(1);
    }
  });
}
function hydrateSelections() {
  document.querySelectorAll('[data-mode]').forEach((node) => {
    node.classList.toggle('active', node.dataset.mode === lobbyState.mode);
  });
  document.querySelectorAll('[data-format]').forEach((node) => {
    node.classList.toggle('active', node.dataset.format === lobbyState.format);
  });
  document.querySelectorAll('[data-difficulty]').forEach((node) => {
    node.classList.toggle('active', node.dataset.difficulty === lobbyState.difficulty);
  });
  updateStartButton();
}

function renderLandingMode() {
  if (saved.hasPlayed) {
    setupFlow.hidden = true;
    quickMatch.hidden = false;
    quickSummary.textContent = summaryLabel();
  } else {
    quickMatch.hidden = true;
    setupFlow.hidden = false;
    goToStep(1);
  }
}

function goToStep(step) {
  currentStep = step;
  document.querySelectorAll('[data-step]').forEach((section) => {
    section.hidden = Number(section.dataset.step) !== step;
  });
  document.querySelectorAll('[data-step-dot]').forEach((dot) => {
    dot.classList.toggle('active', Number(dot.dataset.stepDot) <= step);
  });
}

function startMatch() {
  writePreferences({ ...lobbyState, hasPlayed: true });
  const params = new URLSearchParams({
    mode: 'CPU',
    format: lobbyState.format,
    difficulty: lobbyState.difficulty,
    v: String(Date.now())
  });
  window.location.assign(`/cricket-pinball/play?${params.toString()}`);
}

function setActive(selector, selected) {
  document.querySelectorAll(selector).forEach((node) => {
    node.classList.toggle('active', node === selected);
  });
}

function updateStartButton() {
  const span = startButton.querySelector('span');
  if (span) span.textContent = summaryLabel();
}

function summaryLabel() {
  const formatLabel = {
    LAST_3: 'LAST 3 BALLS',
    ONE_OVER: '1 OVER',
    TWO_OVER: '2 OVERS'
  }[lobbyState.format];

  return `${formatLabel} · ${lobbyState.difficulty} · PLAYER 1 VS CPU`;
}

function readPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePreferences(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

function frameWorld(size) {
  const aspect = window.innerWidth / window.innerHeight;
  const span = Math.max(size.x, size.z, 1);

  camera.aspect = aspect;
  camera.fov = aspect < 0.85 ? 48 : 42;
  camera.position.set(
    0,
    Math.max(size.y * 1.35, span * 0.72),
    Math.max(span * 1.35, 7)
  );
  camera.lookAt(0, Math.max(size.y * 0.28, 0.5), 0);
  camera.updateProjectionMatrix();
}

function resize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize, { passive: true });

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
