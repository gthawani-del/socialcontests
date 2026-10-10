import * as THREE from 'three';
import { STADIUM_SCALE } from './game/stadium-layout.js';

export async function applyStadiumMaterials(model) {
  const loader = new THREE.TextureLoader();
  const [crowd, grass, pitch] = await Promise.all([
    loader.loadAsync('/assets/cricket/world/seated-crowd-night-v2.webp'),
    loader.loadAsync('/assets/cricket/world/stadium-turf-v1.webp'),
    loader.loadAsync('/assets/cricket/world/rolled-pitch-v2.webp')
  ]);
  for (const texture of [crowd, grass]) {
    texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
  }
  crowd.wrapT = THREE.ClampToEdgeWrapping; crowd.anisotropy = 8;
  pitch.colorSpace = THREE.SRGBColorSpace; pitch.anisotropy = 4;
  pitch.wrapS = pitch.wrapT = THREE.RepeatWrapping;
  const pitchMaterial = new THREE.MeshStandardMaterial({ map: pitch, color: '#c9b18c', roughness: .98 });
  const crowdMaterial = new THREE.MeshStandardMaterial({ map: crowd, color: '#ffffff', emissive: '#ffffff', emissiveMap: crowd, emissiveIntensity: .42, roughness: 1, side: THREE.DoubleSide });
  const fieldMaterial = new THREE.MeshStandardMaterial({ map: grass, color: '#c5d6a6', vertexColors: true, roughness: .96 });
  // Flat printed branding avoids sub-pixel text geometry and its broken shadows.
  const retired = [];
  model.traverse(mesh => { if (/^(Bat_Brand_|Willow_Grain_)/.test(mesh.name)) retired.push(mesh); });
  for (const mesh of retired) mesh.removeFromParent();
  const bladeMaterials = new Map();
  for (const side of ['left', 'right']) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d9b985'; ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = '#c5a775'; ctx.lineWidth = 1;
    for (let y = 12; y < 256; y += 17) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y + 3); ctx.stroke(); }
    ctx.translate(550, 128);
    if (side === 'right') ctx.rotate(Math.PI);
    ctx.fillStyle = '#112536'; ctx.fillRect(-200, -88, 400, 176);
    ctx.fillStyle = '#ead4a6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 48px sans-serif'; ctx.fillText('CRICKET', 0, -34);
    ctx.font = 'bold 58px sans-serif'; ctx.fillText('PINBALL', 0, 32);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    bladeMaterials.set(side, new THREE.MeshStandardMaterial({ map, roughness: .7 }));
  }
  const rampMaterial = new THREE.MeshStandardMaterial({ color: '#263d4c', metalness: .45, roughness: .42 });
  const tuned = new Set(), accents = new Map();
  let terraces = 0;
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const original = mesh.material;
    if (!tuned.has(original)) {
      tuned.add(original);
      const name = original.name.replace(/\.\d+$/, '');
      if (name === 'R27_Gallery_Interior') {
        original.color.set('#b99b69');
        original.emissive.set('#ffe0ad'); original.emissiveIntensity = 1.8;
        original.roughness = .8;
      }
      if (/^(R10_Amber_Glow|R12_Amber|R11_Warm|Warm_Lamp)$/.test(name)) {
        original.emissive.set('#ffd6a0'); original.emissiveIntensity = .65;
      }
      if (/^R(9|10|11)_City_?Light$/.test(name)) {
        original.emissive.set('#ffdfad'); original.emissiveIntensity = .8;
      }
      if (/^R(10_Pavilion_Glass|12_Glass)$/.test(name)) {
        original.emissive.set('#fbd39b'); original.emissiveIntensity = .45;
        original.color.set('#514630');
      }
      if (/^R(12_CrowdGlow|13_Crowd_Cool|13_Crowd_Warm)$/.test(name)) {
        original.emissiveIntensity = .12;
      }
      if (name === 'Architecture_Navy') { original.color.set('#102034'); original.roughness = .32; }
      if (name === 'Brushed_Champagne') { original.color.set('#bf9657'); original.roughness = .28; }
      if (name === 'Ramp_Champagne') { original.color.set('#69625b'); original.roughness = .38; }
      if (name === 'Rolled_Pitch') { original.color.set('#b89a69'); original.roughness = .95; }
      if (name === 'Warm_Lamp') { original.emissive.set('#ffba64'); original.emissiveIntensity = .65; }
      if (name === 'Boundary_LED') { original.emissive.set('#298bff'); original.emissiveIntensity = 1.1; }
    }
    if (mesh.name.startsWith('Pavilion_Window_Back')) {
      if (!accents.has('windows')) {
        const window = original.clone(); window.emissiveIntensity = .45; accents.set('windows', window);
      }
      mesh.material = accents.get('windows');
    }
    if (/^(Six|Four)_Rail_|_Arch_Trim$/.test(mesh.name)) {
      if (!accents.has(original)) {
        const accent = original.clone(); accent.emissive.set('#ffc57c'); accent.emissiveIntensity = .45;
        accents.set(original, accent);
      }
      mesh.material = accents.get(original);
    }
    if (/^Willow_Blade_(left|right)$/.test(mesh.name)) {
      const g = mesh.geometry, p = g.getAttribute('position'); g.computeBoundingBox();
      const b = g.boundingBox, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        uv[i * 2] = (p.getX(i) - b.min.x) / (b.max.x - b.min.x);
        uv[i * 2 + 1] = 1 - (p.getZ(i) - b.min.z) / (b.max.z - b.min.z);
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      mesh.material = bladeMaterials.get(mesh.name.endsWith('left') ? 'left' : 'right');
    }
    if (mesh.name === 'Six_Ramp' || mesh.name === 'Boundary_Four_Lane') mesh.material = rampMaterial;
    if (mesh.name.startsWith('Crowd_Band')) {
      // The authored cards span one seating row. Map one complete head-to-waist
      // strip vertically instead of slicing a tall multi-row photograph.
      const uv = mesh.geometry.getAttribute('uv');
      let minV = Infinity, maxV = -Infinity;
      for (let i = 0; i < uv.count; i++) { minV = Math.min(minV, uv.getY(i)); maxV = Math.max(maxV, uv.getY(i)); }
      const row = Number(mesh.name.match(/(\d+)$/)?.[1] || 0);
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, uv.getX(i) * 6 / 18 + row * .173, .36 + .60 * (uv.getY(i) - minV) / Math.max(maxV - minV, .0001));
      }
      uv.needsUpdate = true;
      mesh.material = crowdMaterial; terraces++;
    }
    if (mesh.name === 'Measured_Pitch') {
      const g = mesh.geometry, p = g.getAttribute('position');
      g.computeBoundingBox();
      const b = g.boundingBox, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        // Sample only bare soil: existing 3D creases retain their measured positions.
        uv[i * 2] = (p.getX(i) - b.min.x) / (b.max.x - b.min.x);
        uv[i * 2 + 1] = (p.getZ(i) - b.min.z) / (b.max.x - b.min.x);
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); mesh.material = pitchMaterial;
    }
    if ((mesh.name === 'Arena_Field_Substrate' || mesh.name === 'Drain_Rear_Turf_Infill')) {
      const g = mesh.geometry, p = g.getAttribute('position');
      const uv = new Float32Array(p.count * 2), colors = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const x = (p.getX(i) + mesh.position.x) * STADIUM_SCALE, z = (p.getZ(i) + mesh.position.z) * STADIUM_SCALE;
        uv[i * 2] = x * 1.7; uv[i * 2 + 1] = z * 1.7;
        // Very gentle tonal variation; ground remains one continuous collision surface.
        const shade = .88 + .06 * Math.cos(z * Math.PI / .38);
        colors.set([shade, shade, shade], i * 3);
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); mesh.material = fieldMaterial;
    }
  });
  return { terraces, printedBatFaces: bladeMaterials.size, texture: crowd.image.src, grass: grass.image.src, pitch: pitch.image.src };
}
