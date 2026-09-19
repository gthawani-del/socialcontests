import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { loadValidatedJson } from './config/validate.js';
import { createGameplayController } from './gameplay/controller.js';
import {
  createDifficultyTableConfig,
  DEFAULT_DIFFICULTY,
  getDifficultyLabel,
  getDifficultyMetrics,
  resolveDifficulty
} from './gameplay/difficulty.js';
import { resolveTheme, THEMES } from './themes/registry.js';
import { createThemeEffectController } from './theme-effects/effect-controller.js';
import './style.css';

const canvas = document.querySelector('#game');
const status = document.querySelector('#status');
const resetViewButton = document.querySelector('#resetView');
const ballStateElement = document.querySelector('#ballState');
const scoreElement = document.querySelector('#scoreValue');
const popupLayer = document.querySelector('#scorePopups');
const tiltStateElement = document.querySelector('#tiltState');
const launcherStateElement = document.querySelector('#launcherState');
const launchMeterFill = document.querySelector('#launchMeterFill');
const fxBadge = document.querySelector('#fxBadge');
const difficultySelect = document.querySelector('#difficultySelect');
const soundButton = document.querySelector('#soundButton');
const soundGateElement = document.querySelector('#soundGate');
const enableSoundButton = document.querySelector('#enableSoundButton');
const mobileMenuButton = document.querySelector('#mobileMenuButton');
const runtimeState = document.querySelector('#runtimeState');
const gameOverElement = document.querySelector('#gameOver');
const finalScoreElement = document.querySelector('#finalScore');
const playAgainButton = document.querySelector('#playAgain');
const leftFlipperButton = document.querySelector('[data-flipper="left"]');
const launchButton = document.querySelector('#launchButton');
const nudgeLeftButton = document.querySelector('#nudgeLeft');
const nudgeRightButton = document.querySelector('#nudgeRight');
const rightFlipperButton = document.querySelector('[data-flipper="right"]');
const themeNameElement = document.querySelector('#themeName');
const soundThemeNameElement = document.querySelector('#soundThemeName');
const gameOverThemeNameElement = document.querySelector('#gameOverThemeName');

const urlParams = new URLSearchParams(window.location.search);
const themeConfig = resolveTheme(urlParams.get('theme'));
document.title = 'Infinite Pinball · ' + themeConfig.name;
if (themeNameElement) themeNameElement.textContent = themeConfig.name;
if (soundThemeNameElement) soundThemeNameElement.textContent = themeConfig.shortName;
if (gameOverThemeNameElement) gameOverThemeNameElement.textContent = themeConfig.shortName;
document.documentElement.dataset.theme = themeConfig.id;

const isIPhone =
  /iPhone/i.test(navigator.userAgent || '') ||
  navigator.platform === 'iPhone';

if (soundGateElement && isIPhone) {
  soundGateElement.hidden = false;
  soundGateElement.setAttribute('aria-hidden', 'false');
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = themeConfig.scene.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(themeConfig.scene.background);
scene.fog = new THREE.FogExp2(themeConfig.scene.fog, themeConfig.scene.fogDensity);

const camera = new THREE.PerspectiveCamera(
  41,
  window.innerWidth / window.innerHeight,
  0.05,
  50
);

// Gameplay uses a fixed hero camera. Free orbit/zoom exposes decorative
// layers that are deliberately composed for this angle and can also compete
// with touch controls on mobile.
resetViewButton.hidden = true;

const bombayLighting = themeConfig.id === 'bombay-1945';

const hemi = new THREE.HemisphereLight(
  bombayLighting ? 0xd7c49a : 0xc7dcff,
  bombayLighting ? 0x111713 : 0x17100b,
  bombayLighting ? 1.55 : 1.9
);
scene.add(hemi);

const key = new THREE.DirectionalLight(
  bombayLighting ? 0xffd495 : 0xffdfbc,
  bombayLighting ? 3.8 : 4.2
);
key.position.set(-3.3, 5.3, 7.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
scene.add(key);

const rim = new THREE.PointLight(
  bombayLighting ? 0x315b4b : 0x3588ff,
  bombayLighting ? 12 : 18,
  14,
  2
);
rim.position.set(3.8, 2.8, 3.5);
scene.add(rim);

const warm = new THREE.PointLight(
  bombayLighting ? 0xd98b45 : 0xff8a2b,
  bombayLighting ? 16 : 14,
  12,
  2
);
warm.position.set(-3.2, -1.8, 2.6);
scene.add(warm);

const lowerFill = new THREE.PointLight(
  bombayLighting ? 0xb9a574 : 0x8fb5ff,
  bombayLighting ? 12 : 17,
  10,
  2
);
lowerFill.position.set(0, 3.0, 2.3);
scene.add(lowerFill);

const lowerWarm = new THREE.PointLight(
  bombayLighting ? 0x7a342e : 0xffc08a,
  bombayLighting ? 7 : 8,
  7,
  2
);
lowerWarm.position.set(0, 1.4, 3.8);
scene.add(lowerWarm);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');

const clock = new THREE.Clock();

let mixer = null;
let modelRoot = null;
let gameplay = null;
let themeAnimator = null;
let themeEffects = null;
let tableConfig = null;
let rulesConfig = null;
const requestedDifficulty = urlParams.get('difficulty');
const difficultyLevel = resolveDifficulty(requestedDifficulty);
const modelSize = new THREE.Vector3();

if (difficultySelect) {
  difficultySelect.value = difficultyLevel;
  difficultySelect.addEventListener('change', () => {
    const nextDifficulty = resolveDifficulty(difficultySelect.value);
    const url = new URL(window.location.href);

    if (nextDifficulty === DEFAULT_DIFFICULTY) {
      url.searchParams.delete('difficulty');
    } else {
      url.searchParams.set('difficulty', nextDifficulty);
    }

    window.location.assign(url.toString());
  });
}

if (mobileMenuButton && runtimeState) {
  const setSettingsOpen = (open) => {
    runtimeState.classList.toggle('mobile-open', open);
    mobileMenuButton.setAttribute('aria-expanded', String(open));
  };

  mobileMenuButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    setSettingsOpen(!runtimeState.classList.contains('mobile-open'));
  });

  document.addEventListener('pointerdown', (event) => {
    if (!runtimeState.classList.contains('mobile-open')) return;
    if (runtimeState.contains(event.target) || mobileMenuButton.contains(event.target)) return;
    setSettingsOpen(false);
  }, { passive: true });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setSettingsOpen(false);
  });
}

const PARIS_ASSETS = THEMES.paris.assets;

function prepareTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

async function loadParisTextures() {
  const entries = await Promise.all(
    Object.entries(PARIS_ASSETS).map(async ([name, url]) => {
      const texture = await textureLoader.loadAsync(url);
      return [name, prepareTexture(texture)];
    })
  );
  return Object.fromEntries(entries);
}

function makePlane(texture, width, height, position, rotation = [0, 0, 0], options = {}) {
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    depthWrite: options.depthWrite ?? true,
    side: THREE.DoubleSide,
    toneMapped: options.toneMapped ?? false,
    polygonOffset: options.polygonOffset ?? false,
    polygonOffsetFactor: options.polygonOffsetFactor ?? 0,
    polygonOffsetUnits: options.polygonOffsetUnits ?? 0
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.renderOrder = options.renderOrder ?? 4;
  return mesh;
}

function makeCircleGraphic(texture, radius, position) {
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4
  });

  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), mat);
  mesh.position.set(...position);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 8;
  return mesh;
}

async function applyParisGraphics(root) {
  const textures = await loadParisTextures();

  // Real AI-generated playfield artwork. This sits just above the physical
  // V4 board, while all rails, posts, bumpers and flippers stay true 3D.
  const playfield = makePlane(
    textures.playfield,
    3.18,
    5.82,
    [0, 0.584, 0.02],
    [-Math.PI / 2, 0, 0],
    {
      depthWrite: false,
      renderOrder: 2,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3
    }
  );
  playfield.name = 'Paris_AI_Playfield_Artwork';
  playfield.material.color.set(0x9aa6b6);
  root.add(playfield);

  // Convert the lower-center printed-ball cover into a real, readable
  // non-blocking scoring target. Physics scoring is configured in table.json.
  const cityLight = tableConfig.scoringZones?.find((zone) => zone.id === 'city-light');
  const cityLightX = cityLight?.position?.[0] ?? 0;
  const cityLightZ = cityLight?.position?.[1] ?? 1.02;
  const cityLightScore = cityLight?.score ?? 750;

  const ballMask = new THREE.Mesh(
    new THREE.CircleGeometry(0.285, 48),
    new THREE.MeshBasicMaterial({
      color: 0x071a36,
      toneMapped: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5
    })
  );
  ballMask.position.set(cityLightX, 0.589, cityLightZ);
  ballMask.rotation.x = -Math.PI / 2;
  ballMask.renderOrder = 3;
  ballMask.name = 'Paris_CityLight_Backplate';
  root.add(ballMask);

  const ballMaskRing = new THREE.Mesh(
    new THREE.RingGeometry(0.255, 0.285, 48),
    new THREE.MeshBasicMaterial({
      color: 0xd5a847,
      toneMapped: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6
    })
  );
  ballMaskRing.position.set(cityLightX, 0.590, cityLightZ);
  ballMaskRing.rotation.x = -Math.PI / 2;
  ballMaskRing.renderOrder = 4;
  ballMaskRing.name = 'Paris_CityLight_ScoreRing';
  root.add(ballMaskRing);

  const cityLightTexture = makeCityLightTexture(cityLightScore);
  const cityLightFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.235, 48),
    new THREE.MeshBasicMaterial({
      map: cityLightTexture,
      transparent: true,
      toneMapped: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -7,
      polygonOffsetUnits: -7
    })
  );
  cityLightFace.position.set(cityLightX, 0.592, cityLightZ);
  cityLightFace.rotation.x = -Math.PI / 2;
  cityLightFace.renderOrder = 5;
  cityLightFace.name = 'Paris_CityLight_ScoreFace';
  root.add(cityLightFace);

  createThemeTargetBank(
    root,
    tableConfig.targets,
    THEMES.paris.targetLabels,
    {
      frame: '#111827',
      border: '#d7ae55',
      firstFill: '#dcecff',
      secondFill: '#f7d49a',
      firstBg: '#143252',
      secondBg: '#4d2f10'
    }
  );

  // Actual generated Paris skyline artwork behind the jackpot area.
  const backdrop = makePlane(
    textures.backdrop,
    3.48,
    1.52,
    [0, 1.57, -3.18],
    [0, 0, 0],
    { depthWrite: false, renderOrder: 1 }
  );
  backdrop.name = 'Paris_AI_Backdrop';
  root.add(backdrop);

  // Generated bumper-face artwork mapped onto the physical bumper domes.
  const metro = makeCircleGraphic(textures.metro, 0.205, [-0.72, 1.036, -0.35]);
  metro.name = 'Paris_AI_Bumper_Metro';
  root.add(metro);

  const cafe = makeCircleGraphic(textures.cafe, 0.205, [0.70, 1.036, -0.40]);
  cafe.name = 'Paris_AI_Bumper_Cafe';
  root.add(cafe);

  // The center bumper uses the Eiffel hero artwork as the Paris landmark skin.
  const paris = makeCircleGraphic(textures.paris, 0.205, [0, 1.036, -1.18]);
  paris.name = 'Paris_AI_Bumper_Landmark';
  root.add(paris);

  // Generated illuminated Eiffel hero graphic at the top theme slot.
  const hero = makePlane(
    textures.hero,
    0.86,
    0.86,
    [0, 1.42, -2.78],
    [0, 0, 0],
    { depthWrite: false, renderOrder: 7 }
  );
  hero.name = 'Paris_AI_Hero_Eiffel';
  root.add(hero);

  // Matching production jackpot artwork from the approved Paris art direction.
  const jackpotGraphic = makePlane(
    textures.jackpot,
    1.20,
    0.90,
    [0, 1.30, -2.58],
    [0, 0, 0],
    { depthWrite: false, renderOrder: 6 }
  );
  jackpotGraphic.name = 'Paris_AI_Jackpot_Crest';
  root.add(jackpotGraphic);

  // Theme mechanical accents.
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;

    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];

    if (/Flipper_Left|Flipper_Right/.test(obj.name)) {
      mats.forEach((m) => {
        if (m.color) m.color.set('#e3ad45');
        if ('metalness' in m) m.metalness = 0.72;
        if ('roughness' in m) m.roughness = 0.18;
      });
    }

    if (/Jackpot_Ring/.test(obj.name)) {
      mats.forEach((m) => {
        if (m.color) m.color.set('#e5ad43');
        if (m.emissive) m.emissive.set('#8a4d0a');
        if ('emissiveIntensity' in m) m.emissiveIntensity = 1.3;
      });
    }

    if (/Bumper_.*_Ring/.test(obj.name)) {
      mats.forEach((m) => {
        if ('emissiveIntensity' in m) m.emissiveIntensity = 1.5;
      });
    }
  });

  const parisGold = new THREE.PointLight(0xffb34d, 11, 7, 2);
  parisGold.position.set(0, 2.25, -2.35);
  root.add(parisGold);

  const parisBlue = new THREE.PointLight(0x315aa0, 7, 8, 2);
  parisBlue.position.set(-1.2, 1.6, -0.4);
  root.add(parisBlue);
}


function createThemeTargetBank(root, targets, labelMap, palette = {}) {
  const existing = ['Target_1','Target_2','Target_3','Target_4','Target_5','Target_6'];
  existing.forEach((name) => {
    const object = root.getObjectByName(name);
    if (object) object.visible = false;
  });

  const labels = new Map(Object.entries(labelMap || {}));
  const frameColor = palette.frame || '#111827';
  const borderColor = palette.border || '#d7ae55';

  targets.forEach((cfg, index) => {
    const group = new THREE.Group();
    group.name = 'Target_' + cfg.id;
    group.position.set(cfg.position[0], 0, cfg.position[1]);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.width, 0.30, 0.10),
      new THREE.MeshStandardMaterial({
        color: frameColor,
        metalness: 0.75,
        roughness: 0.24
      })
    );
    frame.position.set(0, 0.82, -0.08);
    frame.castShadow = true;

    const faceTexture = makeTargetTexture(
      labels.get(cfg.id) || cfg.id.slice(0, 1).toUpperCase(),
      index < 3 ? (palette.firstFill || '#dcecff') : (palette.secondFill || '#f7d49a'),
      index < 3 ? (palette.firstBg || '#143252') : (palette.secondBg || '#4d2f10'),
      borderColor
    );

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(0.12, cfg.width - 0.045), 0.235),
      new THREE.MeshBasicMaterial({ map: faceTexture, toneMapped: false })
    );
    face.position.set(0, 0.82, -0.024);
    face.renderOrder = 9;

    group.add(frame, face);
    root.add(group);
  });
}

function makeCityLightTexture(score) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 256, 256);

  const gradient = ctx.createRadialGradient(128, 108, 18, 128, 128, 118);
  gradient.addColorStop(0, '#18365f');
  gradient.addColorStop(0.72, '#091a34');
  gradient.addColorStop(1, '#061126');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(128, 128, 116, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#d8aa48';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(128, 128, 108, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#f6d77b';
  ctx.font = '800 64px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(score), 128, 119);

  ctx.fillStyle = '#d4deec';
  ctx.font = '700 22px Inter, Arial, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('CITY LIGHT', 128, 168);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function makeTargetTexture(letter, fill, bg, border = '#d7ae55') {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = border;
  ctx.lineWidth = 8;
  ctx.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);

  ctx.fillStyle = fill;
  ctx.font = '700 88px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, canvas.width / 2, canvas.height / 2 + 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}


async function applyBombayGraphics(root) {
  const playfieldTexture = makeBombayPlayfieldTexture();
  const tramTexture = makeBombayBadgeTexture('TRAM', 'tram');
  const stationTexture = makeBombayBadgeTexture('V.T.', 'station');
  const dockTexture = makeBombayBadgeTexture('DOCK', 'anchor');
  const jackpotTexture = makeBombayJackpotTexture();
  const signalTexture = makeBombaySignalTexture(
    tableConfig.scoringZones?.[0]?.score ?? 750
  );

  const playfield = makePlane(
    playfieldTexture,
    3.18,
    5.82,
    [0, 0.584, 0.02],
    [-Math.PI / 2, 0, 0],
    {
      depthWrite: false,
      renderOrder: 2,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3
    }
  );
  playfield.name = 'Bombay_1945_Playfield';
  root.add(playfield);

  const scoringZone = tableConfig.scoringZones?.[0];
  const zoneX = scoringZone?.position?.[0] ?? 0;
  const zoneZ = scoringZone?.position?.[1] ?? 1.02;

  const zoneBack = new THREE.Mesh(
    new THREE.CircleGeometry(0.285, 48),
    new THREE.MeshBasicMaterial({
      color: 0x111713,
      toneMapped: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5
    })
  );
  zoneBack.position.set(zoneX, 0.589, zoneZ);
  zoneBack.rotation.x = -Math.PI / 2;
  zoneBack.renderOrder = 3;
  root.add(zoneBack);

  const zoneRing = new THREE.Mesh(
    new THREE.RingGeometry(0.255, 0.285, 48),
    new THREE.MeshBasicMaterial({
      color: 0xd6a84b,
      toneMapped: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6
    })
  );
  zoneRing.position.set(zoneX, 0.590, zoneZ);
  zoneRing.rotation.x = -Math.PI / 2;
  zoneRing.renderOrder = 4;
  zoneRing.name = 'Theme_ScoringZone_' + (scoringZone?.id || 'city-light') + '_Ring';
  root.add(zoneRing);

  const zoneFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.235, 48),
    new THREE.MeshBasicMaterial({
      map: signalTexture,
      transparent: true,
      toneMapped: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -7,
      polygonOffsetUnits: -7
    })
  );
  zoneFace.position.set(zoneX, 0.592, zoneZ);
  zoneFace.rotation.x = -Math.PI / 2;
  zoneFace.renderOrder = 5;
  zoneFace.name = 'Theme_ScoringZone_' + (scoringZone?.id || 'city-light') + '_Face';
  root.add(zoneFace);

  createThemeTargetBank(
    root,
    tableConfig.targets,
    themeConfig.targetLabels,
    {
      frame: '#1b211d',
      border: '#d2a650',
      firstFill: '#f0ddb0',
      secondFill: '#d9c28a',
      firstBg: '#29483d',
      secondBg: '#6a312c'
    }
  );

  let archiveTexture = null;
  try {
    archiveTexture = prepareTexture(
      await textureLoader.loadAsync(themeConfig.archive.victoriaTerminus1940)
    );
  } catch (error) {
    console.warn('Bombay archival backdrop unavailable; using procedural fallback.', error);
  }

  const backdrop = archiveTexture
    ? makePlane(
        archiveTexture,
        3.48,
        1.52,
        [0, 1.57, -3.18],
        [0, 0, 0],
        { depthWrite: false, renderOrder: 1 }
      )
    : makePlane(
        makeBombayBackdropTexture(),
        3.48,
        1.52,
        [0, 1.57, -3.18],
        [0, 0, 0],
        { depthWrite: false, renderOrder: 1 }
      );

  backdrop.name = 'Bombay_1945_Archive_Backdrop';
  if (archiveTexture) backdrop.material.color.set('#c9ad7a');
  root.add(backdrop);

  const tram = makeCircleGraphic(tramTexture, 0.205, [-0.72, 1.036, -0.35]);
  tram.name = 'Theme_Bumper_metro';
  root.add(tram);

  const station = makeCircleGraphic(stationTexture, 0.205, [0.70, 1.036, -0.40]);
  station.name = 'Theme_Bumper_cafe';
  root.add(station);

  const dock = makeCircleGraphic(dockTexture, 0.205, [0, 1.036, -1.18]);
  dock.name = 'Theme_Bumper_paris';
  root.add(dock);

  const heroTexture = archiveTexture || makeBombayBackdropTexture();
  const hero = makePlane(
    heroTexture,
    0.92,
    0.86,
    [0, 1.43, -2.79],
    [0, 0, 0],
    { depthWrite: false, renderOrder: 7 }
  );
  hero.name = 'Bombay_1945_Victoria_Terminus';
  if (archiveTexture) hero.material.color.set('#d5bd8d');
  root.add(hero);

  const jackpotGraphic = makePlane(
    jackpotTexture,
    1.28,
    0.88,
    [0, 1.30, -2.57],
    [0, 0, 0],
    { depthWrite: false, renderOrder: 8, transparent: true }
  );
  jackpotGraphic.name = 'Bombay_1945_Jackpot_Crest';
  root.add(jackpotGraphic);

  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];

    if (/Flipper_Left|Flipper_Right/.test(obj.name)) {
      mats.forEach((m) => {
        if (m.color) m.color.set('#c89a43');
        if ('metalness' in m) m.metalness = 0.78;
        if ('roughness' in m) m.roughness = 0.24;
      });
    }

    if (/Jackpot_Ring/.test(obj.name)) {
      mats.forEach((m) => {
        if (m.color) m.color.set('#d6a84b');
        if (m.emissive) m.emissive.set('#65391c');
        if ('emissiveIntensity' in m) m.emissiveIntensity = 1.15;
      });
    }

    if (/Bumper_.*_Ring/.test(obj.name)) {
      mats.forEach((m) => {
        if ('emissiveIntensity' in m) m.emissiveIntensity = 1.28;
      });
    }
  });

  const stationAmber = new THREE.PointLight(0xe3a85a, 12, 7, 2);
  stationAmber.position.set(0, 2.22, -2.35);
  root.add(stationAmber);

  const tramGreen = new THREE.PointLight(0x315b4b, 10, 8, 2);
  tramGreen.position.set(-1.15, 1.55, -0.35);
  root.add(tramGreen);

  const portRed = new THREE.PointLight(0x7a342e, 6, 6, 2);
  portRed.position.set(1.1, 1.25, 0.2);
  root.add(portRed);

  const signalGroup = new THREE.Group();
  signalGroup.name = 'Bombay_1945_Signal_Lights';
  const signals = [];

  [
    [-1.28, 0.72, 1.28],
    [1.28, 0.72, 1.28],
    [-1.22, 0.72, 0.48],
    [1.22, 0.72, 0.48],
    [-1.12, 0.72, -0.55],
    [1.12, 0.72, -0.55]
  ].forEach((position, index) => {
    const material = new THREE.MeshStandardMaterial({
      color: index % 2 ? 0xd6a84b : 0x8a3d35,
      emissive: index % 2 ? 0xd6a84b : 0x8a3d35,
      emissiveIntensity: 0.55,
      metalness: 0.35,
      roughness: 0.22
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 10), material);
    bulb.position.set(...position);
    signalGroup.add(bulb);
    signals.push(bulb);
  });

  root.add(signalGroup);

  const tramSweep = new THREE.PointLight(0xf1c66f, 3.2, 2.4, 2);
  tramSweep.position.set(0, 0.86, 1.55);
  root.add(tramSweep);

  themeAnimator = (time) => {
    signals.forEach((bulb, index) => {
      bulb.material.emissiveIntensity =
        0.42 + Math.max(0, Math.sin(time * 3.2 - index * 0.85)) * 1.25;
    });

    const phase = (Math.sin(time * 0.72) + 1) * 0.5;
    tramSweep.position.z = 1.55 - phase * 3.35;
    tramSweep.intensity = 2.2 + Math.sin(time * 4.4) * 0.45;
  };
}

function makeCanvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}

function makeBombayPlayfieldTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1800;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#182820');
  bg.addColorStop(0.48, '#101c19');
  bg.addColorStop(1, '#0a1111');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Aged paper / oxidised paint texture.
  ctx.globalAlpha = 0.13;
  for (let i = 0; i < 620; i += 1) {
    const x = (i * 137) % canvas.width;
    const y = (i * 251) % canvas.height;
    const r = 1 + ((i * 17) % 7);
    ctx.fillStyle = i % 3 ? '#d4b16b' : '#7f9b87';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Brass perimeter.
  ctx.strokeStyle = '#b78b3f';
  ctx.lineWidth = 16;
  ctx.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);
  ctx.strokeStyle = '#765827';
  ctx.lineWidth = 3;
  ctx.strokeRect(55, 55, canvas.width - 110, canvas.height - 110);

  // Tram tracks converging toward Victoria Terminus.
  const track = (x1, x2, end1, end2) => {
    ctx.strokeStyle = '#c7a25b';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(x1, 1660);
    ctx.lineTo(end1, 210);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, 1660);
    ctx.lineTo(end2, 210);
    ctx.stroke();
  };
  track(355, 435, 452, 480);
  track(669, 589, 572, 544);

  ctx.strokeStyle = 'rgba(213,182,111,.42)';
  ctx.lineWidth = 5;
  for (let y = 1540; y > 300; y -= 86) {
    const t = (1540 - y) / 1240;
    const left = 380 + t * 86;
    const right = 644 - t * 86;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  // Fort-route plaques.
  drawBombayPlaque(ctx, 512, 146, 700, 126, 'BOMBAY 1945', 54);
  drawBombayPlaque(ctx, 512, 325, 470, 82, 'VICTORIA TERMINUS', 26);
  drawBombayPlaque(ctx, 512, 1435, 520, 92, 'FORT  •  TRAM  •  PORT', 24);

  ctx.fillStyle = 'rgba(230,211,166,.82)';
  ctx.font = '700 28px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('BALLARD ESTATE', 216, 930);
  ctx.fillText('FLORA FOUNTAIN', 808, 930);

  // Art-deco / municipal flourishes.
  ctx.strokeStyle = 'rgba(212,168,75,.52)';
  ctx.lineWidth = 3;
  for (const side of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(512 + side * 155, 430);
    ctx.quadraticCurveTo(512 + side * 330, 530, 512 + side * 400, 760);
    ctx.quadraticCurveTo(512 + side * 350, 980, 512 + side * 420, 1190);
    ctx.stroke();
  }

  // Harbour-wave motif near the lower playfield.
  ctx.strokeStyle = 'rgba(80,120,113,.48)';
  ctx.lineWidth = 4;
  for (let row = 0; row < 7; row += 1) {
    const y = 1570 + row * 24;
    ctx.beginPath();
    for (let x = 90; x <= 934; x += 20) {
      const yy = y + Math.sin((x + row * 18) / 44) * 7;
      if (x === 90) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(232,216,177,.60)';
  ctx.font = '600 18px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('BOMBAY ELECTRIC SUPPLY & TRAMWAYS', 512, 1720);

  return makeCanvasTexture(canvas);
}

function drawBombayPlaque(ctx, cx, cy, width, height, text, fontSize) {
  ctx.save();
  ctx.fillStyle = '#17211c';
  ctx.strokeStyle = '#d0a34e';
  ctx.lineWidth = 5;
  roundRect(ctx, cx - width / 2, cy - height / 2, width, height, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ecd9a8';
  ctx.font = '700 ' + fontSize + 'px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 2);
  ctx.restore();
}

function makeBombayBadgeTexture(label, icon) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(192, 150, 24, 192, 192, 185);
  gradient.addColorStop(0, '#355546');
  gradient.addColorStop(0.66, '#182720');
  gradient.addColorStop(1, '#0b1211');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 384, 384);

  ctx.strokeStyle = '#d6a84b';
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.arc(192, 192, 162, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#74552a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(192, 192, 139, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#edd9a9';
  ctx.fillStyle = '#edd9a9';
  ctx.lineWidth = 9;
  if (icon === 'tram') drawTramIcon(ctx);
  else if (icon === 'station') drawStationIcon(ctx);
  else drawAnchorIcon(ctx);

  ctx.fillStyle = '#e7cd92';
  ctx.font = '800 44px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 192, 322);

  return makeCanvasTexture(canvas);
}

function drawTramIcon(ctx) {
  ctx.strokeRect(112, 114, 160, 112);
  ctx.beginPath();
  ctx.moveTo(142, 114); ctx.lineTo(168, 74); ctx.lineTo(225, 74); ctx.lineTo(246, 114);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(128, 160); ctx.lineTo(256, 160);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(145, 242, 16, 0, Math.PI * 2);
  ctx.arc(239, 242, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(192, 74); ctx.lineTo(218, 36);
  ctx.stroke();
}

function drawStationIcon(ctx) {
  ctx.beginPath();
  ctx.moveTo(115, 238); ctx.lineTo(115, 150); ctx.lineTo(142, 150); ctx.lineTo(142, 118);
  ctx.lineTo(166, 118); ctx.lineTo(166, 80); ctx.lineTo(192, 42); ctx.lineTo(218, 80);
  ctx.lineTo(218, 118); ctx.lineTo(244, 118); ctx.lineTo(244, 150); ctx.lineTo(270, 150);
  ctx.lineTo(270, 238); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.arc(192, 103, 20, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(192, 103); ctx.lineTo(192, 90); ctx.moveTo(192, 103); ctx.lineTo(203, 109); ctx.stroke();
}

function drawAnchorIcon(ctx) {
  ctx.beginPath(); ctx.arc(192, 91, 24, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(192, 115); ctx.lineTo(192, 238); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(128, 151); ctx.lineTo(256, 151); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(118, 194); ctx.quadraticCurveTo(126, 263, 192, 274); ctx.quadraticCurveTo(258, 263, 266, 194);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(118, 194); ctx.lineTo(95, 218); ctx.moveTo(266, 194); ctx.lineTo(289, 218); ctx.stroke();
}

function makeBombaySignalTexture(score) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(160, 125, 22, 160, 160, 150);
  grad.addColorStop(0, '#553b1d');
  grad.addColorStop(0.48, '#253d33');
  grad.addColorStop(1, '#0b1211');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 320, 320);
  ctx.strokeStyle = '#d6a84b';
  ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(160,160,142,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle = '#f0d69a';
  ctx.font = '800 70px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(score),160,151);
  ctx.font = '800 25px ui-monospace, Menlo, monospace';
  ctx.fillText('TRAM BELL',160,205);
  ctx.font = '700 16px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#abbeaa';
  ctx.fillText('RING TO SCORE',160,239);
  return makeCanvasTexture(canvas);
}

function makeBombayJackpotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 520;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,720,520);

  ctx.fillStyle = 'rgba(14,22,19,.96)';
  ctx.strokeStyle = '#d6a84b';
  ctx.lineWidth = 8;
  roundRect(ctx, 55, 55, 610, 410, 54);
  ctx.fill(); ctx.stroke();

  ctx.strokeStyle = '#76552b';
  ctx.lineWidth = 2;
  roundRect(ctx, 78, 78, 564, 364, 40);
  ctx.stroke();

  ctx.fillStyle = '#8a3d35';
  ctx.beginPath(); ctx.arc(360,112,33,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#e6c779'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(360,112,33,0,Math.PI*2); ctx.stroke();

  ctx.fillStyle = '#ead8ad';
  ctx.textAlign = 'center';
  ctx.font = '700 74px Georgia, serif';
  ctx.fillText('BOMBAY',360,228);
  ctx.fillStyle = '#d6a84b';
  ctx.font = '800 31px ui-monospace, Menlo, monospace';
  ctx.fillText('1945',360,278);

  ctx.strokeStyle = '#556e61';
  ctx.beginPath(); ctx.moveTo(150,312); ctx.lineTo(570,312); ctx.stroke();

  ctx.fillStyle = '#c7d0bb';
  ctx.font = '700 20px ui-monospace, Menlo, monospace';
  ctx.fillText('FORT  •  RAIL  •  TRAM  •  PORT',360,352);
  ctx.fillStyle = '#f0d69a';
  ctx.font = '900 28px ui-monospace, Menlo, monospace';
  ctx.fillText('JACKPOT',360,404);

  return makeCanvasTexture(canvas);
}

function makeBombayBackdropTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 560;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0,0,0,560);
  grad.addColorStop(0,'#1e2e27');
  grad.addColorStop(1,'#070b0b');
  ctx.fillStyle = grad; ctx.fillRect(0,0,1280,560);

  ctx.fillStyle = '#151c19';
  for (let i=0;i<15;i+=1) {
    const w=70+(i%4)*16, h=110+(i*37)%180, x=i*92-40;
    ctx.fillRect(x,560-h,w,h);
    ctx.fillStyle='#c29247';
    for(let yy=560-h+25;yy<530;yy+=34) for(let xx=x+18;xx<x+w-10;xx+=28) ctx.fillRect(xx,yy,7,10);
    ctx.fillStyle='#151c19';
  }
  ctx.fillStyle='#d6a84b';
  ctx.font='700 46px Georgia, serif';
  ctx.textAlign='center';
  ctx.fillText('BOMBAY · 1945',640,88);
  ctx.font='700 18px ui-monospace, Menlo, monospace';
  ctx.fillStyle='#a9b8aa';
  ctx.fillText('VICTORIA TERMINUS · FORT · BALLARD ESTATE',640,126);
  return makeCanvasTexture(canvas);
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}


function applyHeroView() {
  if (!modelRoot) return;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;
  const isPortrait = aspect < 0.82;
  const isWide = aspect > 1.35;

  const tableLength = Math.max(modelSize.z, modelSize.x * 1.55);
  const tableHeight = modelSize.y;

  camera.aspect = aspect;
  camera.fov = isPortrait ? 43 : isWide ? 40 : 41;
  camera.updateProjectionMatrix();

  const target = new THREE.Vector3(
    0,
    Math.max(tableHeight * 0.38, 0.52),
    isPortrait ? 0.10 : 0.06
  );

  if (isPortrait) {
    camera.position.set(0, tableLength * 0.84, tableLength * 1.00);
  } else if (isWide) {
    camera.position.set(0, tableLength * 0.52, tableLength * 0.84);
  } else {
    camera.position.set(0, tableLength * 0.64, tableLength * 0.94);
  }

  camera.lookAt(target);
  camera.updateMatrixWorld();
}

loader.load(
  '/models/infinite-pinball-base-v4.glb',
  async (gltf) => {
    modelRoot = gltf.scene;

    modelRoot.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(modelRoot);
    const center = box.getCenter(new THREE.Vector3());
    box.getSize(modelSize);

    modelRoot.position.sub(center);
    modelRoot.position.y += modelSize.y * 0.5;

    try {
      status.textContent = 'Validating game config…';

      [tableConfig, rulesConfig] = await Promise.all([
        loadValidatedJson('/game/table.json', '/game/schema/table.schema.json'),
        loadValidatedJson('/game/rules.json', '/game/schema/rules.schema.json')
      ]);

      tableConfig = createDifficultyTableConfig(tableConfig, difficultyLevel);
      const difficultyLabel = getDifficultyLabel(difficultyLevel);
      const difficultyMetrics = getDifficultyMetrics(tableConfig);

      if (difficultySelect) difficultySelect.value = difficultyLevel;
      console.info('Pinball difficulty', {
        level: difficultyLabel,
        restGap: difficultyMetrics.restGap,
        launchTapPower: difficultyMetrics.launchTapPower,
        maxBallSpeed: tableConfig.ball.maxSpeed
      });

      status.textContent = 'Loading ' + themeConfig.name + '…';
      if (themeConfig.type === 'bombay-1945') {
        await applyBombayGraphics(modelRoot);
      } else {
        await applyParisGraphics(modelRoot);
      }

      themeEffects = createThemeEffectController({
        root: modelRoot,
        camera,
        renderer,
        themeConfig,
        tableConfig
      });

      gameplay = createGameplayController({
        root: modelRoot,
        renderer,
        camera,
        tableConfig,
        rulesConfig,
        themeConfig,
        themeEffects,
        ballStateElement,
        scoreElement,
        popupLayer,
        tiltStateElement,
        launcherStateElement,
        launchMeterFill,
        fxBadge,
        soundButton,
        soundGateElement,
        enableSoundButton,
        gameOverElement,
        finalScoreElement,
        playAgainButton,
        leftButton: leftFlipperButton,
        rightButton: rightFlipperButton,
        launchButton,
        nudgeLeftButton,
        nudgeRightButton
      });

      scene.add(modelRoot);
      gameplay.sync();
      applyHeroView();

      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(modelRoot);
        gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
      }

      status.textContent = themeConfig.statusLabel + ' · ' + getDifficultyLabel(difficultyLevel);
      status.classList.add('ready');
      resetViewButton.disabled = true;
    } catch (error) {
      console.error('Game boot failed:', error);
      status.textContent = 'Game boot failed';
      status.classList.add('error');
    }
  },
  (progress) => {
    if (progress.total) {
      const pct = Math.round((progress.loaded / progress.total) * 100);
      status.textContent = `Loading V4 · ${pct}%`;
    }
  },
  (error) => {
    console.error(error);
    status.textContent = 'V4 model failed to load';
    status.classList.add('error');
  }
);

let resizeFrame = null;

function resize() {
  if (resizeFrame) cancelAnimationFrame(resizeFrame);

  resizeFrame = requestAnimationFrame(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    if (modelRoot) applyHeroView();
  });
}

window.addEventListener('resize', resize, { passive: true });
window.addEventListener('orientationchange', resize, { passive: true });

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  if (gameplay) {
    gameplay.step(dt);
    gameplay.sync();
  }

  if (themeAnimator) themeAnimator(clock.elapsedTime);
  if (themeEffects) themeEffects.update(dt);

  renderer.render(scene, camera);
}

animate();
