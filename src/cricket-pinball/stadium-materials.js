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
  const crowdMaterial = new THREE.MeshStandardMaterial({ map: crowd, color: '#7f91ad', roughness: .98, side: THREE.DoubleSide, emissive: '#102343', emissiveIntensity: .16 });
  const fieldMaterial = new THREE.MeshStandardMaterial({ map: grass, color: '#4e7331', vertexColors: true, roughness: .94 });
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
      tune(mesh, { color: '#30251d', roughness: .48, metalness: .18 });
    if (/^(Single|Double|Straight_Four|Boundary_Four|Six_Finish)_Shell/.test(n))
      tune(mesh, { color: '#0d1b16', roughness: .52, metalness: .12 });
    if (n.includes('Arch_Trim') || n.startsWith('R7_') && n.includes('Outer_Halo') || n.startsWith('R9_') && (n.includes('_Glow_') || n.includes('Chevron') || n.includes('Tier_Warm_Band')))
      tune(mesh, { color: '#5e3c22', roughness: .36, metalness: .28, emissive: '#f07a2a', emissiveIntensity: .92 });
    if (n.startsWith('Pavilion_Window_Back') || n.startsWith('R7_Pavilion_Glass') || n.startsWith('R7_Pavilion_Wing_Glass'))
      tune(mesh, { color: '#21130b', roughness: .32, metalness: .03, emissive: '#ff8a35', emissiveIntensity: .78 });
    if (n.startsWith('Canopy_Panel_'))
      tune(mesh, { color: '#071a31', roughness: .38, metalness: .22 });
    if (n.startsWith('R9_Pavilion_Tensile_') || n.startsWith('R9_Pavilion_Petal_'))
      tune(mesh, { color: '#8d724f', roughness: .38, metalness: .16, emissive: '#5a3813', emissiveIntensity: .22 });
    if (n.startsWith('R12_Crowd_Ribbon_'))
      tune(mesh, { color: '#1e72b0', roughness: .34, metalness: .20, emissive: '#2089e0', emissiveIntensity: 1.45 });
    if (n.startsWith('R11_Stand_Petal_'))
      tune(mesh, { color: '#06162a', roughness: .34, metalness: .28 });
    if ((n.includes('Outer_Halo') || n.includes('Plinth')) && !n.includes('Pavilion'))
      tune(mesh, { color: '#49331f', roughness: .44, metalness: .18, emissive: '#9c541c', emissiveIntensity: .42 });
    if (n === 'Arena_Field_Substrate') {
      const g = mesh.geometry, p = g.getAttribute('position');
      const uv = new Float32Array(p.count * 2), colors = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) * STADIUM_SCALE, z = p.getZ(i) * STADIUM_SCALE;
        uv[i * 2] = x * 1.7; uv[i * 2 + 1] = z * 1.7;
        // Very gentle tonal variation; ground remains one continuous collision surface.
        const shade = .72 + .15 * Math.cos(z * Math.PI / .38);
        colors.set([shade, shade, shade], i * 3);
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); mesh.material = fieldMaterial;
    }
  });
  return { terraces, texture: crowd.image.src, grass: grass.image.src, model: 'colosseum-r12-final' };
}
