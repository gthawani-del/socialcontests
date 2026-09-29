import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Merge only stationary parts sharing one material. Animated bat roots remain
// separate, with their own material batches. No collision geometry is inferred here.
export function batchStadium(model, bats) {
  function batch(root, excluded = new Set()) {
    model.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert(), groups = new Map(), originals = [];
    const materialIds = new Map();
    root.traverse(o => {
      if (!o.isMesh || Array.isArray(o.material)) return;
      for (let p = o; p && p !== root; p = p.parent) if (excluded.has(p)) return;
      if (!materialIds.has(o.material)) materialIds.set(o.material, materialIds.size);
      const key = `${materialIds.get(o.material)}/${o.castShadow}/${o.receiveShadow}`;
      if (!groups.has(key)) groups.set(key, { material: o.material, cast: o.castShadow, receive: o.receiveShadow, geometries: [] });
      let g = o.geometry.clone();
      if (g.index) { const flat = g.toNonIndexed(); g.dispose(); g = flat; }
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
      const count = g.getAttribute('position').count;
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
      if (!g.getAttribute('color')) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 3).fill(1), 3));
      groups.get(key).geometries.push(g); originals.push(o);
    });
    for (const item of groups.values()) {
      const geometry = mergeGeometries(item.geometries);
      if (!geometry) throw new Error('Stadium geometry batching failed');
      const mesh = new THREE.Mesh(geometry, item.material); mesh.name = 'Stadium_Material_Batch';
      mesh.castShadow = item.cast; mesh.receiveShadow = item.receive; root.add(mesh);
      for (const g of item.geometries) g.dispose();
    }
    for (const o of originals) o.removeFromParent();
    return { before: originals.length, after: groups.size };
  }
  const staticGeometry = batch(model, new Set(Object.values(bats)));
  const movingGeometry = Object.values(bats).map(bat => batch(bat));
  return { staticGeometry, movingGeometry };
}
