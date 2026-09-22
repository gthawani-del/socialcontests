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
    <aside id="meshPanel"><h2>GLB COMPONENT MAP</h2><div id="meshSummary">Loading mesh hierarchy…</div><button id="copyMap" style="margin:0 0 8px;padding:6px 9px;font:700 10px system-ui;background:#d5a52b;color:#07110c;border:0;border-radius:5px;cursor:pointer">COPY MAP JSON</button><div id="meshRows"></div></aside>
  </main>
`;

const canvas = document.querySelector('#world');
const status = document.querySelector('#status');
const meshSummary = document.querySelector('#meshSummary');
const meshRows = document.querySelector('#meshRows');
const copyMap = document.querySelector('#copyMap');

function classifyCricketMesh(name = '', material = '') {
  const value = `${name} ${material}`.toLowerCase();
  const has = (...tokens) => tokens.some((token) => value.includes(token));

  if (has('bowler', 'bowling')) return { component: 'bowler', treatment: 'KEEP', role: 'BOWLER_VISUAL' };
  if (has('flipper', 'bat_left', 'left_bat')) return { component: 'bat', treatment: 'FUNCTIONAL', role: 'BAT' };
  if (has('bat_right', 'right_bat')) return { component: 'bat', treatment: 'FUNCTIONAL', role: 'BAT' };
  if (has('wicket', 'stump')) return { component: 'wicket', treatment: 'FUNCTIONAL', role: 'WICKET' };
  if (has('four', '4_', '4-', 'boundary4')) return { component: 'four-ramp', treatment: 'FUNCTIONAL', role: 'FOUR' };
  if (has('six', '6_', '6-', 'boundary6')) return { component: 'six-ramp', treatment: 'FUNCTIONAL', role: 'SIX' };
  if (has('pitch', 'playfield', 'field', 'ground', 'base')) return { component: 'playfield', treatment: 'SKIN', role: 'PLAYFIELD' };
  if (has('pavilion', 'scoreboard')) return { component: 'pavilion', treatment: 'SKIN', role: 'DISPLAY' };
  if (has('stand', 'crowd', 'stadium')) return { component: 'stands', treatment: 'SKIN', role: 'ENVIRONMENT' };
  if (has('rail', 'wall', 'frame', 'post', 'light', 'lamp', 'support')) return { component: 'structure', treatment: 'KEEP', role: 'STRUCTURE' };
  if (has('target', 'one', 'single')) return { component: 'single-target', treatment: 'FUNCTIONAL', role: 'ONE' };
  if (has('two', 'double')) return { component: 'two-target', treatment: 'FUNCTIONAL', role: 'TWO' };
  return { component: 'unclassified', treatment: 'REVIEW', role: null };
}

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
      const name = object.name || '(unnamed mesh)';
      const material = Array.isArray(object.material)
        ? object.material.map((m) => m?.name || '(unnamed)').join(', ')
        : object.material?.name || '(unnamed)';
      inventory.push({
        object,
        name,
        material,
        size: localSize,
        center: localCenter,
        ...classifyCricketMesh(name, material)
      });
    });

    meshSummary.textContent = `${inventory.length} meshes · click ISOLATE to inspect geometry`;

    // Bowler-only structural audit. Prefer semantic names; if the GLB uses generic
    // names, locate the character as a compact cluster around the visible bowler zone.
    const namedBowler = inventory.filter((item) => item.component === 'bowler');
    const playfieldItems = inventory.filter((item) => item.component === 'playfield');
    const playfieldBox = playfieldItems.length
      ? playfieldItems.reduce((box, item) => box.union(new THREE.Box3().setFromObject(item.object)), new THREE.Box3())
      : new THREE.Box3().setFromObject(root);
    const fieldSize = playfieldBox.getSize(new THREE.Vector3());
    const fieldCenter = playfieldBox.getCenter(new THREE.Vector3());

    const geometricCandidates = inventory.filter((item) => {
      if (item.component !== 'unclassified') return false;
      const dx = Math.abs(item.center.x - fieldCenter.x);
      const dz = item.center.z - fieldCenter.z;
      const compact = item.size.x < fieldSize.x * 0.24 && item.size.z < fieldSize.z * 0.18;
      const characterHeight = item.size.y > 0.05 && item.size.y < Math.max(1.4, fieldSize.y * 2.5);
      const centralLane = dx < fieldSize.x * 0.22;
      const upperHalf = dz < fieldSize.z * 0.18 && dz > -fieldSize.z * 0.48;
      return compact && characterHeight && centralLane && upperHalf;
    });

    const candidateSource = namedBowler.length ? namedBowler : geometricCandidates;
    const bowlerDetails = candidateSource.map((item) => {
      const geometry = item.object.geometry;
      const materials = (Array.isArray(item.object.material) ? item.object.material : [item.object.material])
        .filter(Boolean)
        .map((material) => ({
          name: material.name || '(unnamed)',
          type: material.type,
          hasMap: Boolean(material.map),
          mapName: material.map?.name || null
        }));
      return {
        mesh: item.name,
        inventoryIndex: inventory.indexOf(item) + 1,
        center: [item.center.x, item.center.y, item.center.z].map((n) => Number(n.toFixed(4))),
        size: [item.size.x, item.size.y, item.size.z].map((n) => Number(n.toFixed(4))),
        vertices: geometry?.attributes?.position?.count || 0,
        uvCount: geometry?.attributes?.uv?.count || 0,
        hasUV: Boolean(geometry?.attributes?.uv),
        groups: geometry?.groups?.length || 0,
        materials
      };
    });
    const fullUV = bowlerDetails.length > 0 && bowlerDetails.every((item) => item.hasUV);
    const materialCount = bowlerDetails.reduce((sum, item) => sum + item.materials.length, 0);
    const mappedCount = bowlerDetails.reduce((sum, item) => sum + item.materials.filter((m) => m.hasMap).length, 0);
    const detection = namedBowler.length ? 'NAME' : bowlerDetails.length ? 'GEOMETRY_CANDIDATES' : 'NOT_FOUND';
    const decision = detection === 'NAME'
      ? (fullUV ? 'TEXTURE_SKIN' : materialCount > 1 ? 'MATERIAL_STYLING' : 'VISUAL_REPLACEMENT')
      : detection === 'GEOMETRY_CANDIDATES' ? 'ISOLATE_CANDIDATES' : 'NOT_FOUND';

    window.__CRICKET_BOWLER_AUDIT__ = {
      detection,
      candidateCount: bowlerDetails.length,
      fullUV,
      materialCount,
      mappedCount,
      decision,
      meshes: bowlerDetails
    };
    console.info('[Cricket GLB] Bowler structural audit', window.__CRICKET_BOWLER_AUDIT__);
    meshSummary.textContent += detection === 'NAME'
      ? ` · Bowler: ${bowlerDetails.length} named mesh(es), UV ${fullUV ? 'YES' : 'NO'} → ${decision}`
      : detection === 'GEOMETRY_CANDIDATES'
        ? ` · Bowler name absent · ${bowlerDetails.length} geometric candidate(s) found → isolate highlighted candidates`
        : ' · Bowler name absent · no safe geometric candidates found';

    const candidateIndices = new Set(bowlerDetails.map((item) => item.inventoryIndex));
    meshRows.innerHTML = inventory.map((item, index) => `
      <div class="mesh-row" style="${candidateIndices.has(index + 1) ? 'outline:1px solid #d5a52b;background:rgba(213,165,43,.08)' : ''}">
        <small>${index + 1}</small>
        <div><strong>${candidateIndices.has(index + 1) ? 'BOWLER? · ' : ''}${item.name}</strong> <small>[${item.treatment} · ${item.component}]</small><br><small>mat: ${item.material} · size: ${item.size.x.toFixed(2)} × ${item.size.y.toFixed(2)} × ${item.size.z.toFixed(2)} · center: ${item.center.x.toFixed(2)}, ${item.center.y.toFixed(2)}, ${item.center.z.toFixed(2)}</small></div>
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

    window.__CRICKET_GLB_COMPONENT_MAP__ = inventory.map((item, index) => ({
      index: index + 1,
      mesh: item.name,
      material: item.material,
      component: item.component,
      treatment: item.treatment,
      role: item.role,
      size: [item.size.x, item.size.y, item.size.z].map((n) => Number(n.toFixed(4))),
      center: [item.center.x, item.center.y, item.center.z].map((n) => Number(n.toFixed(4)))
    }));

    copyMap.onclick = async () => {
      const json = JSON.stringify(window.__CRICKET_GLB_COMPONENT_MAP__, null, 2);
      try {
        await navigator.clipboard.writeText(json);
        copyMap.textContent = 'COPIED';
      } catch {
        console.log(json);
        copyMap.textContent = 'MAP IN CONSOLE';
      }
      setTimeout(() => { copyMap.textContent = 'COPY MAP JSON'; }, 1200);
    };

    console.table(inventory.map((item, index) => ({
      index: index + 1,
      mesh: item.name,
      material: item.material,
      sizeX: item.size.x.toFixed(3),
      sizeY: item.size.y.toFixed(3),
      sizeZ: item.size.z.toFixed(3),
      centerX: item.center.x.toFixed(3),
      centerY: item.center.y.toFixed(3),
      centerZ: item.center.z.toFixed(3),
      component: item.component,
      treatment: item.treatment,
      role: item.role || ''
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
