import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
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
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080d);
scene.fog = new THREE.FogExp2(0x06080d, 0.026);

const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.01, 100);
camera.position.set(0, 7.0, 9.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 0.5, 0);
controls.minDistance = 4.5;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI * 0.49;

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
  new THREE.MeshStandardMaterial({ color: 0x0b1018, roughness: 0.82, metalness: 0.08 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.04;
floor.receiveShadow = true;
scene.add(floor);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const clock = new THREE.Clock();
let mixer = null;

loader.load(
  '/models/infinite-pinball-base-v3.glb',
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

    const radius = Math.max(size.x, size.y, size.z);

    // Lower, more dimensional gameplay view than V2.
    camera.position.set(0, radius * 0.72, radius * 1.18);
    controls.target.set(0, size.y * 0.23, 0);
    controls.update();

    if (gltf.animations?.length) {
      mixer = new THREE.AnimationMixer(root);
      gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
    }

    status.textContent = 'V3 TABLE · LIVE';
    status.classList.add('ready');
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
