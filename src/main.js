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
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080d);
scene.fog = new THREE.FogExp2(0x06080d, 0.026);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.01,
  100
);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minPolarAngle = THREE.MathUtils.degToRad(34);
controls.maxPolarAngle = THREE.MathUtils.degToRad(74);
controls.minAzimuthAngle = THREE.MathUtils.degToRad(-26);
controls.maxAzimuthAngle = THREE.MathUtils.degToRad(26);

const hemi = new THREE.HemisphereLight(0xc7dcff, 0x1a1008, 1.65);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffdfbc, 3.8);
key.position.set(-3.3, 5.3, 7.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
scene.add(key);

const rim = new THREE.PointLight(0x35a8ff, 19, 14, 2);
rim.position.set(3.8, 2.8, 3.5);
scene.add(rim);

const warm = new THREE.PointLight(0xff6b2b, 12, 12, 2);
warm.position.set(-3.2, -1.8, 2.6);
scene.add(warm);

const lowerFill = new THREE.PointLight(0x7ea8ff, 10, 9, 2);
lowerFill.position.set(0, 2.1, 4.2);
scene.add(lowerFill);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(12, 96),
  new THREE.MeshStandardMaterial({
    color: 0x0b1018,
    roughness: 0.82,
    metalness: 0.08
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.04;
floor.receiveShadow = true;
scene.add(floor);

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

  // The table's long axis is Z after Blender -> glTF conversion.
  const tableLength = Math.max(modelSize.z, modelSize.x * 1.55);
  const tableHeight = modelSize.y;

  camera.aspect = aspect;
  camera.fov = isPortrait ? 43 : isWide ? 39 : 41;
  camera.updateProjectionMatrix();

  const target = new THREE.Vector3(
    0,
    Math.max(tableHeight * 0.28, 0.42),
    isPortrait ? 0.08 : 0
  );

  if (isPortrait) {
    camera.position.set(0, tableLength * 0.96, tableLength * 1.13);
  } else if (isWide) {
    camera.position.set(0, tableLength * 0.78, tableLength * 1.27);
  } else {
    camera.position.set(0, tableLength * 0.88, tableLength * 1.20);
  }

  controls.target.copy(target);
  controls.minDistance = tableLength * 0.92;
  controls.maxDistance = tableLength * 2.15;
  controls.update();
}

loader.load(
  '/models/infinite-pinball-base-v3.glb',
  (gltf) => {
    modelRoot = gltf.scene;

    modelRoot.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    // Center only once. Camera positioning is then deterministic and
    // independent of viewport size.
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

    status.textContent = 'V3.1 VIEW · LIVE';
    status.classList.add('ready');
    resetViewButton.disabled = false;
  },
  (progress) => {
    if (progress.total) {
      const pct = Math.round((progress.loaded / progress.total) * 100);
      status.textContent = `Loading V3 · ${pct}%`;
    }
  },
  (error) => {
    console.error(error);
    status.textContent = 'V3 model failed to load';
    status.classList.add('error');
  }
);

resetViewButton.addEventListener('click', () => {
  applyHeroView();
});

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

    if (modelRoot) {
      applyHeroView();
    }
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
