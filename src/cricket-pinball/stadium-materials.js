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
  const fieldMaterial = new THREE.MeshStandardMaterial({ map: grass, color: '#6f954a', vertexColors: true, roughness: .92 });
  const tune = (mesh, { color, roughness, metalness, emissive, emissiveIntensity } = {}) => {
    if (!mesh.material) return;
    mesh.material = mesh.material.clone();
    if (color) mesh.material.color.set(color);
    if (roughness !== undefined) mesh.material.roughness = roughness;
    if (metalness !== undefined) mesh.material.metalness = metalness;
    if (emissive && mesh.material.emissive) mesh.material.emissive.set(emissive);
    if (emissiveIntensity !== undefined) mesh.material.emissiveIntensity = emissiveIntensity;
    mesh.material.needsUpdate = true;
  };
  let terraces = 0;
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const n = mesh.name;
    if (n.startsWith('Crowd_Band')) { mesh.material = crowdMaterial; terraces++; }
    if (n === 'R9_Four_Lane' || n === 'R9_Six_Lane' || n === 'Six_Ramp' || n === 'Boundary_Four_Lane')
      tune(mesh, { color: '#5f4329', roughness: .43, metalness: .24 });
    if (/^(Single|Double|Straight_Four|Boundary_Four|Six_Finish)_Shell/.test(n))
      tune(mesh, { color: '#162617', roughness: .48, metalness: .14 });
    if (n.includes('Arch_Trim') || n.startsWith('R7_') && n.includes('Outer_Halo') || n.startsWith('R9_') && (n.includes('_Glow_') || n.includes('Chevron') || n.includes('Tier_Warm_Band')))
      tune(mesh, { color: '#855027', roughness: .32, metalness: .30, emissive: '#ff8a36', emissiveIntensity: 1.55 });
    if (n.startsWith('Pavilion_Window_Back') || n.startsWith('R7_Pavilion_Glass') || n.startsWith('R7_Pavilion_Wing_Glass'))
      tune(mesh, { color: '#3d1d0c', roughness: .30, metalness: .04, emissive: '#ff7a2b', emissiveIntensity: 1.35 });
    if (n.startsWith('Canopy_Panel_'))
      tune(mesh, { color: '#102946', roughness: .34, metalness: .24 });
    if (n === 'Arena_Field_Substrate') {
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
  return { terraces, texture: crowd.image.src, grass: grass.image.src, model: 'colosseum-r12-final' };
}
