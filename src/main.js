import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';

const canvas = document.querySelector('#game');
const status = document.querySelector('#status');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080d);
scene.fog = new THREE.FogExp2(0x06080d, 0.03);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.01, 100);
camera.position.set(0, 7.8, 8.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 0.5, 0);
controls.minDistance = 4.5;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI * 0.49;

const hemi = new THREE.HemisphereLight(0xbfd7ff, 0x1a1008, 1.45);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffd7ad, 3.4);
key.position.set(-3.5, 5.5, 7.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
scene.add(key);

const rim = new THREE.PointLight(0x35a8ff, 18, 14, 2);
rim.position.set(3.8, 2.8, 3.5);
scene.add(rim);

const warm = new THREE.PointLight(0xff6b2b, 13, 12, 2);
warm.position.set(-3.2, -1.8, 2.6);
scene.add(warm);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(12, 96),
  new THREE.MeshStandardMaterial({ color: 0x0b1018, roughness: 0.82, metalness: 0.08 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.04;
floor.receiveShadow = true;
scene.add(floor);

const loader = new GLTFLoader();
const clock = new THREE.Clock();
let mixer = null;

loader.load(
  '/models/infinite-pinball-base-v1.glb',
  (gltf) => {
    const root = gltf.scene;

    root.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    // GLTF comes from Blender (Y-up export); center it automatically.
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    root.position.sub(center);
    root.position.y += size.y * 0.5;
    scene.add(root);

    const radius = Math.max(size.x, size.y, size.z);
    camera.position.set(0, radius * 0.95, radius * 1.08);
    controls.target.set(0, size.y * 0.26, 0);
    controls.update();

    if (gltf.animations?.length) {
      mixer = new THREE.AnimationMixer(root);
      gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
    }

    status.textContent = 'V1 TABLE · LIVE';
    status.classList.add('ready');
  },
  (progress) => {
    if (progress.total) {
      const pct = Math.round((progress.loaded / progress.total) * 100);
      status.textContent = `Loading table · ${pct}%`;
    }
  },
  (error) => {
    console.error(error);
    status.textContent = 'Model failed to load';
    status.classList.add('error');
  }
);

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
window.addEventListener('resize', resize);

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  controls.update();
  renderer.render(scene, camera);
}
animate();
