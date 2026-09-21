const style=document.createElement('style');style.textContent="html,body,#app{margin:0;width:100%;height:100%;overflow:hidden;background:#07110c}canvas{display:block;width:100%;height:100%}\n#meshPanel{position:fixed;left:16px;bottom:16px;z-index:3;width:min(520px,calc(100vw - 32px));max-height:44vh;overflow:auto;background:rgba(0,0,0,.78);color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:12px;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace}\n#meshPanel h2{margin:0 0 8px;font:700 13px system-ui}.mesh-row{display:grid;grid-template-columns:28px 1fr 92px;gap:8px;padding:5px 0;border-top:1px solid rgba(255,255,255,.08)}.mesh-row small{opacity:.65}.mesh-row button{font:700 10px system-ui;background:#173525;color:#fff;border:1px solid #4d765d;border-radius:5px;cursor:pointer}.mesh-row button[data-on=\"true\"]{background:#b98d24;color:#07110c}\n#meshSummary{opacity:.7;margin-bottom:8px}";document.head.appendChild(style);
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
    <aside id="meshPanel"><h2>GLB MESH INVENTORY</h2><div id="meshSummary">Loading mesh hierarchy…</div><div id="meshRows"></div></aside>
  </main>
`;

const canvas = document.querySelector('#world');
const status = document.querySelector('#status');
const meshSummary = document.querySelector('#meshSummary');
const meshRows = document.querySelector('#meshRows');

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

    const inventory = [];
    root.traverse((object) => {
      if (!object.isMesh) return;
      const localBox = new THREE.Box3().setFromObject(object);
      const localSize = localBox.getSize(new THREE.Vector3());
      const localCenter = localBox.getCenter(new THREE.Vector3());
      inventory.push({
        object,
        name: object.name || '(unnamed mesh)',
        material: Array.isArray(object.material)
          ? object.material.map((m) => m?.name || '(unnamed)').join(', ')
          : object.material?.name || '(unnamed)',
        size: localSize,
        center: localCenter
      });
    });

    meshSummary.textContent = `${inventory.length} meshes · click ISOLATE to inspect geometry`;
    meshRows.innerHTML = inventory.map((item, index) => `
      <div class="mesh-row">
        <small>${index + 1}</small>
        <div><strong>${item.name}</strong><br><small>mat: ${item.material} · size: ${item.size.x.toFixed(2)} × ${item.size.y.toFixed(2)} × ${item.size.z.toFixed(2)} · center: ${item.center.x.toFixed(2)}, ${item.center.y.toFixed(2)}, ${item.center.z.toFixed(2)}</small></div>
        <button data-mesh-index="${index}" data-on="false">ISOLATE</button>
      </div>
    `).join('');

    meshRows.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mesh-index]');
      if (!button) return;
      const index = Number(button.dataset.meshIndex);
      const alreadyOn = button.dataset.on === 'true';
      inventory.forEach((item) => { item.object.visible = alreadyOn || inventory[index].object === item.object; });
      meshRows.querySelectorAll('button').forEach((candidate) => {
        candidate.dataset.on = 'false';
        candidate.textContent = 'ISOLATE';
      });
      if (!alreadyOn) {
        button.dataset.on = 'true';
        button.textContent = 'SHOW ALL';
      }
    });

    console.table(inventory.map((item, index) => ({
      index: index + 1,
      mesh: item.name,
      material: item.material,
      sizeX: item.size.x.toFixed(3),
      sizeY: item.size.y.toFixed(3),
      sizeZ: item.size.z.toFixed(3),
      centerX: item.center.x.toFixed(3),
      centerY: item.center.y.toFixed(3),
      centerZ: item.center.z.toFixed(3)
    })));

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
