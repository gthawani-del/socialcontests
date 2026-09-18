import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import './style.css';

const canvas = document.querySelector('#game');
const status = document.querySelector('#status');
const resetViewButton = document.querySelector('#resetView');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070b);
scene.fog = new THREE.FogExp2(0x05070b, 0.018);

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

const hemi = new THREE.HemisphereLight(0xc7dcff, 0x17100b, 1.85);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffdfbc, 4.1);
key.position.set(-3.3, 5.3, 7.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
scene.add(key);

const rim = new THREE.PointLight(0x35a8ff, 20, 14, 2);
rim.position.set(3.8, 2.8, 3.5);
scene.add(rim);

const warm = new THREE.PointLight(0xff6b2b, 12, 12, 2);
warm.position.set(-3.2, -1.8, 2.6);
scene.add(warm);

// Focused lower-table fill: improves flipper/drain readability without
// illuminating the entire environment.
const lowerFill = new THREE.PointLight(0x8fb5ff, 17, 10, 2);
lowerFill.position.set(0, 3.0, 2.3);
scene.add(lowerFill);

const lowerWarm = new THREE.PointLight(0xffc08a, 7, 7, 2);
lowerWarm.position.set(0, 1.4, 3.8);
scene.add(lowerWarm);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const clock = new THREE.Clock();

let mixer = null;
let modelRoot = null;
const modelSize = new THREE.Vector3();

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

  // Aim slightly higher on the cabinet so the machine sits lower in the
  // viewport, leaving clean breathing room for the HUD.
  const target = new THREE.Vector3(
    0,
    Math.max(tableHeight * 0.38, 0.52),
    isPortrait ? 0.10 : 0.06
  );

  if (isPortrait) {
    // Preserve full-table visibility on mobile while still being closer
    // than V3.1.
    camera.position.set(0, tableLength * 0.84, tableLength * 1.00);
  } else if (isWide) {
    // Desktop hero framing: about one-third closer than V3.1.
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
  (gltf) => {
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
    scene.add(modelRoot);

    applyHeroView();

    if (gltf.animations?.length) {
      mixer = new THREE.AnimationMixer(modelRoot);
      gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
    }

    status.textContent = 'V4 TABLE · LIVE';
    status.classList.add('ready');
    resetViewButton.disabled = false;
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

  controls.update();
  renderer.render(scene, camera);
}

animate();
