import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { loadValidatedJson } from './config/validate.js';
import { createGameplayController } from './gameplay/controller.js';
import './style.css';

const canvas = document.querySelector('#game');
const status = document.querySelector('#status');
const resetViewButton = document.querySelector('#resetView');
const ballStateElement = document.querySelector('#ballState');
const leftFlipperButton = document.querySelector('[data-flipper="left"]');
const rightFlipperButton = document.querySelector('[data-flipper="right"]');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.13;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04070d);
scene.fog = new THREE.FogExp2(0x04070d, 0.015);

const camera = new THREE.PerspectiveCamera(
  41,
  window.innerWidth / window.innerHeight,
  0.01,
  100
);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minPolarAngle = THREE.MathUtils.degToRad(34);
controls.maxPolarAngle = THREE.MathUtils.degToRad(72);
controls.minAzimuthAngle = THREE.MathUtils.degToRad(-24);
controls.maxAzimuthAngle = THREE.MathUtils.degToRad(24);

const hemi = new THREE.HemisphereLight(0xc7dcff, 0x17100b, 1.9);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffdfbc, 4.2);
key.position.set(-3.3, 5.3, 7.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
scene.add(key);

const rim = new THREE.PointLight(0x3588ff, 18, 14, 2);
rim.position.set(3.8, 2.8, 3.5);
scene.add(rim);

const warm = new THREE.PointLight(0xff8a2b, 14, 12, 2);
warm.position.set(-3.2, -1.8, 2.6);
scene.add(warm);

const lowerFill = new THREE.PointLight(0x8fb5ff, 17, 10, 2);
lowerFill.position.set(0, 3.0, 2.3);
scene.add(lowerFill);

const lowerWarm = new THREE.PointLight(0xffc08a, 8, 7, 2);
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
let tableConfig = null;
let rulesConfig = null;
const modelSize = new THREE.Vector3();

const PARIS_ASSETS = {
  playfield: '/themes/paris/assets/playfield.webp',
  backdrop: '/themes/paris/assets/backdrop.webp',
  metro: '/themes/paris/assets/metro.webp',
  cafe: '/themes/paris/assets/cafe.webp',
  paris: '/themes/paris/assets/paris.webp',
  jackpot: '/themes/paris/assets/jackpot.webp',
  hero: '/themes/paris/assets/hero.webp'
};

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
    toneMapped: options.toneMapped ?? false
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
    { depthWrite: false, renderOrder: 2 }
  );
  playfield.name = 'Paris_AI_Playfield_Artwork';
  root.add(playfield);

  // Cover the printed placeholder ball baked into the approved playfield art.
  // This is a flat decorative insert, not a gameplay collider.
  const ballMask = new THREE.Mesh(
    new THREE.CircleGeometry(0.255, 48),
    new THREE.MeshBasicMaterial({ color: 0x071a36, toneMapped: false, side: THREE.DoubleSide })
  );
  ballMask.position.set(0, 0.589, 0.34);
  ballMask.rotation.x = -Math.PI / 2;
  ballMask.renderOrder = 3;
  ballMask.name = 'Paris_PrintBall_Mask';
  root.add(ballMask);

  const ballMaskRing = new THREE.Mesh(
    new THREE.RingGeometry(0.225, 0.255, 48),
    new THREE.MeshBasicMaterial({ color: 0xd5a847, toneMapped: false, side: THREE.DoubleSide })
  );
  ballMaskRing.position.set(0, 0.590, 0.34);
  ballMaskRing.rotation.x = -Math.PI / 2;
  ballMaskRing.renderOrder = 4;
  ballMaskRing.name = 'Paris_PrintBall_Mask_Ring';
  root.add(ballMaskRing);

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

  controls.target.copy(target);
  controls.minDistance = tableLength * (isPortrait ? 0.78 : 0.70);
  controls.maxDistance = tableLength * 1.75;
  controls.update();
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

      status.textContent = 'Loading Paris theme…';
      await applyParisGraphics(modelRoot);

      gameplay = createGameplayController({
        root: modelRoot,
        tableConfig,
        rulesConfig,
        ballStateElement,
        leftButton: leftFlipperButton,
        rightButton: rightFlipperButton
      });

      scene.add(modelRoot);
      gameplay.sync();
      applyHeroView();

      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(modelRoot);
        gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
      }

      status.textContent = 'PLAYABLE V1 · LIVE';
      status.classList.add('ready');
      resetViewButton.disabled = false;
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

resetViewButton.addEventListener('click', applyHeroView);

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

  controls.update();
  renderer.render(scene, camera);
}

animate();
