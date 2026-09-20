import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const app = document.querySelector('#app');
app.innerHTML = `
  <main style="position:fixed;inset:0;background:#07110c;overflow:hidden">
    <canvas id="world"></canvas>
    <div style="position:fixed;top:16px;left:16px;z-index:2;padding:10px 12px;background:rgba(0,0,0,.62);color:white;font:700 12px/1.2 system-ui;border:1px solid rgba(255,255,255,.18);border-radius:8px">
      GLB ONLY · cricket-world-v2.glb
    </div>
    <div id="status" style="position:fixed;right:16px;top:16px;z-index:2;color:white;font:600 12px system-ui">Loading…</div>
  </main>
`;

const canvas = document.querySelector('#world');
const status = document.querySelector('#status');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07110c);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 100);
scene.add(new THREE.HemisphereLight(0xffffff, 0x0a120d, 2.2));
const key = new THREE.DirectionalLight(0xffffff, 3.2);
key.position.set(-3, 7, 5);
scene.add(key);
const fill = new THREE.DirectionalLight(0x8ad2a2, 1.4);
fill.position.set(4, 3, -4);
scene.add(fill);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

loader.load(
  '/models/cricket-world-v2.glb',
  (gltf) => {
    const root = gltf.scene;

    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;

      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (material?.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.needsUpdate = true;
        }
        if (material) material.needsUpdate = true;
      });
    });

    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    root.position.sub(center);
    root.position.y += size.y * 0.5;
    scene.add(root);

    const span = Math.max(size.x, size.z, 1);
    camera.position.set(0, Math.max(size.y * 1.35, span * 0.72), Math.max(span * 1.35, 7));
    camera.lookAt(0, Math.max(size.y * 0.28, 0.5), 0);
    camera.updateProjectionMatrix();

    status.textContent = `Loaded · ${gltf.scene.children.length} top-level nodes`;
  },
  (progress) => {
    if (progress.total) status.textContent = `${Math.round((progress.loaded / progress.total) * 100)}%`;
  },
  (error) => {
    console.error(error);
    status.textContent = 'LOAD ERROR';
  }
);

window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}, { passive: true });

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
