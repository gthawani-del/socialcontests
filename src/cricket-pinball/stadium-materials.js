import * as THREE from 'three';

// Existing committed artwork only. Geometry stays in the authored GLB.
export async function applyStadiumMaterials(model) {
  const crowd = await new THREE.TextureLoader().loadAsync('/assets/cricket/world/cricket-crowd-stand-strip.webp');
  crowd.colorSpace = THREE.SRGBColorSpace;
  crowd.wrapS = THREE.RepeatWrapping;
  crowd.anisotropy = 4;
  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, ...extra });
  const palette = {
    field: material('#18533e'), pitch: material('#b29a6b'), navy: material('#132943'),
    structure: material('#253d51'), metal: material('#c5af76', { metalness: .45, roughness: .4 }),
    bat: material('#dfcda2'), white: material('#f4ecd7'), dark: material('#09131e'),
    ramp: material('#286b66', { roughness: .55 }), crowd: material('#d3dbea', { map: crowd }),
    lamp: material('#f3e9d1', { emissive: '#ffe4b0', emissiveIntensity: 1.5 })
  };
  let terraces = 0;
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const n = mesh.name;
    let m = palette.structure;
    if (n === 'Arena_Field_Substrate') m = palette.field;
    else if (n === 'Pitch_Inlay') m = palette.pitch;
    else if (/^Bat_(Left|Right)$/.test(n)) m = palette.bat;
    else if (/Number|Crease|Wicket_Stump|Wicket_Bails/.test(n)) m = palette.white;
    else if (/Rail|Boundary_Cushion|Lintel|Jamb/.test(n)) m = palette.metal;
    else if (/Recess|Aisle|Pivot|Scoreboard/.test(n)) m = palette.dark;
    else if (/Six_Ramp$|Boundary_Four_Lane/.test(n)) m = palette.ramp;
    else if (/Floodlight_Panel/.test(n)) m = palette.lamp;
    else if (/Pavilion|Outer_Stadium/.test(n)) m = palette.navy;
    else if (/Continuous_Terrace/.test(n)) {
      const row = Number(n.slice(-2));
      const a = 3.78 + row * .28, b = 6.48 + row * .28;
      // Unindexed triangles allow UV seams without stretching across the ellipse.
      const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      const p = g.getAttribute('position'), normal = g.getAttribute('normal');
      const uv = new Float32Array(p.count * 2);
      const tops = [], sides = [];
      g.clearGroups();
      for (let i = 0; i < p.count; i += 3) {
        const angles = [0, 1, 2].map(j => Math.atan2(-p.getZ(i + j) / b, p.getX(i + j) / a));
        if (Math.max(...angles) - Math.min(...angles) > Math.PI) for (let j = 0; j < 3; j++) if (angles[j] < 0) angles[j] += Math.PI * 2;
        const top = [0, 1, 2].some(j => normal.getY(i + j) > .5);
        (top ? tops : sides).push(i, i + 1, i + 2);
        for (let j = 0; j < 3; j++) {
          const k = i + j, t = angles[j];
          const innerRadius = Math.hypot(a * Math.cos(t), b * Math.sin(t));
          const radial = Math.max(0, Math.min(1, (Math.hypot(p.getX(k), p.getZ(k)) - innerRadius) / .29));
          uv[k * 2] = t / (Math.PI * 2) * 32 + row * .19;
          uv[k * 2 + 1] = row * .17 + radial * .04;
        }
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex([...tops, ...sides]);
      g.addGroup(0, tops.length, 0); g.addGroup(tops.length, sides.length, 1);
      mesh.geometry = g; mesh.material = [palette.crowd, palette.navy]; terraces++;
      return;
    }
    mesh.material = m;
  });
  return { terraces, texture: crowd.image.src };
}
