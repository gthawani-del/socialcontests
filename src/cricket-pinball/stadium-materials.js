import * as THREE from 'three';
import { STADIUM_SCALE } from './game/stadium-layout.js';

export async function applyStadiumMaterials(model) {
  const loader = new THREE.TextureLoader();
  const [crowd, grass] = await Promise.all([
    loader.loadAsync('/assets/cricket/world/cricket-crowd-stand-strip.webp'),
    loader.loadAsync('/assets/cricket/world/stadium-turf-v1.webp')
  ]);
  for (const texture of [crowd, grass]) {
    texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
  }
  const crowdMaterial = new THREE.MeshStandardMaterial({ map: crowd, color: '#d6c8b6', roughness: 1, side: THREE.DoubleSide });
  const fieldMaterial = new THREE.MeshStandardMaterial({ map: grass, color: '#789f54', vertexColors: true, roughness: .92 });
  let terraces = 0;
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (mesh.name.startsWith('Crowd_Band')) { mesh.material = crowdMaterial; terraces++; }
    if (mesh.name === 'Arena_Field_Substrate') {
      const g = mesh.geometry, p = g.getAttribute('position');
      const uv = new Float32Array(p.count * 2), colors = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) * STADIUM_SCALE, z = p.getZ(i) * STADIUM_SCALE;
        uv[i * 2] = x * 1.7; uv[i * 2 + 1] = z * 1.7;
        // Very gentle tonal variation; ground remains one continuous collision surface.
        const shade = .80 + .12 * Math.cos(z * Math.PI / .38);
        colors.set([shade, shade, shade], i * 3);
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); mesh.material = fieldMaterial;
    }
  });
  return { terraces, texture: crowd.image.src, grass: grass.image.src, model: 'colosseum-r10' };
}
