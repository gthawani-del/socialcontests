import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import './ui/cricket-pinball.css';

const app = document.querySelector('#cricketPinballApp');

if (!app) {
  throw new Error('Cricket Pinball root element not found.');
}

document.documentElement.dataset.product = 'cricket-pinball';

app.innerHTML = `
  <main class="cricket-pinball-shell">
    <canvas id="cricketWorld"></canvas>

    <section class="cricket-lobby" id="cricketLobby" aria-labelledby="cricketLobbyTitle" hidden>
      <div class="cricket-lobby-panel">
        <div class="cricket-lobby-brand">
          <p>CRICKET PINBALL</p>
          <h1 id="cricketLobbyTitle">BAT WITH FLIPPERS. BOWL THE DELIVERY.</h1>
          <span>Short-format cricket. One ball = one official result.</span>
        </div>

        <div class="cricket-mode-grid" aria-label="Choose match mode">
          <button type="button" class="cricket-mode active" data-mode="CPU">
            <span>01</span>
            <strong>PLAY VS CPU</strong>
            <small>Solo competitive match</small>
          </button>
          <button type="button" class="cricket-mode" data-mode="LOCAL">
            <span>02</span>
            <strong>LOCAL 2 PLAYER</strong>
            <small>Two players, one device</small>
          </button>
          <a class="cricket-mode cricket-mode-link" href="/cricket-pinball/watch/demo">
            <span>03</span>
            <strong>WATCH MATCHES</strong>
            <small>Spectator mode</small>
          </a>
        </div>

        <div class="cricket-selector-block">
          <div class="cricket-selector-heading">
            <span>MATCH FORMAT</span>
            <small>Choose innings length</small>
          </div>
          <div class="cricket-segmented" id="formatSelector">
            <button type="button" data-format="LAST_3">LAST 3 BALLS</button>
            <button type="button" class="active" data-format="ONE_OVER">1 OVER</button>
            <button type="button" data-format="TWO_OVER">2 OVERS</button>
          </div>
        </div>

        <div class="cricket-selector-block">
          <div class="cricket-selector-heading">
            <span>DIFFICULTY</span>
            <small>Separate from match length</small>
          </div>
          <div class="cricket-segmented" id="difficultySelector">
            <button type="button" data-difficulty="EASY">EASY</button>
            <button type="button" class="active" data-difficulty="MEDIUM">MEDIUM</button>
            <button type="button" data-difficulty="HARD">HARD</button>
          </div>
        </div>

        <button type="button" class="cricket-start" id="cricketStart">
          START MATCH
          <span>1 OVER · MEDIUM · VS CPU</span>
        </button>
      </div>
    </section>

    <section class="cricket-loading" id="cricketLoading" aria-live="polite">
      <p>CRICKET PINBALL</p>
      <strong id="cricketLoadingPercent">0%</strong>
      <span id="cricketLoadingStatus">Preparing stadium…</span>
    </section>
  </main>
`;

const canvas = document.querySelector('#cricketWorld');
const lobby = document.querySelector('#cricketLobby');
const loading = document.querySelector('#cricketLoading');
const loadingPercent = document.querySelector('#cricketLoadingPercent');
const loadingStatus = document.querySelector('#cricketLoadingStatus');
const startButton = document.querySelector('#cricketStart');

const lobbyState = {
  mode: 'CPU',
  format: 'ONE_OVER',
  difficulty: 'MEDIUM'
};

bindLobby();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07110c);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.05,
  100
);

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
  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      lobbyState.mode = button.dataset.mode;
      setActive('[data-mode]', button);
      updateStartButton();
    });
  });

  document.querySelectorAll('[data-format]').forEach((button) => {
    button.addEventListener('click', () => {
      lobbyState.format = button.dataset.format;
      setActive('[data-format]', button);
      updateStartButton();
    });
  });

  document.querySelectorAll('[data-difficulty]').forEach((button) => {
    button.addEventListener('click', () => {
      lobbyState.difficulty = button.dataset.difficulty;
      setActive('[data-difficulty]', button);
      updateStartButton();
    });
  });

  startButton.addEventListener('click', () => {
    const params = new URLSearchParams({
      mode: lobbyState.mode,
      format: lobbyState.format,
      difficulty: lobbyState.difficulty
    });
    window.location.assign(`/cricket-pinball/play?${params.toString()}`);
  });

  updateStartButton();
}

function setActive(selector, selected) {
  document.querySelectorAll(selector).forEach((node) => {
    node.classList.toggle('active', node === selected);
  });
}

function updateStartButton() {
  const formatLabel = {
    LAST_3: 'LAST 3 BALLS',
    ONE_OVER: '1 OVER',
    TWO_OVER: '2 OVERS'
  }[lobbyState.format];

  const modeLabel = lobbyState.mode === 'LOCAL' ? 'LOCAL 2 PLAYER' : 'VS CPU';
  startButton.querySelector('span').textContent =
    `${formatLabel} · ${lobbyState.difficulty} · ${modeLabel}`;
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
