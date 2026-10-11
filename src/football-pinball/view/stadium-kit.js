import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Shared stadium dressing; parameters describe presentation, never colliders.
// Twelve stepped crowd strips and their rails are batched into two draw calls.
export function addCrowdTiers(parent, texture, railMaterial, {
  tiers = 4, sideOffset = 3.92, tierDepth = .65, tierRise = .58,
  tierHeight = .72, near = 8, far = -6.9, rear = -6.55, halfWidth = 6.5,
} = {}) {
  const faces = [], rails = [];
  function face(points, tier) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    const bottom = tier / tiers, top = (tier + 1) / tiers;
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0,bottom,1,bottom,0,top,1,top], 2));
    g.setIndex([0,1,2,1,3,2]);
    g.computeVertexNormals();
    faces.push(g);
    const curve = new THREE.LineCurve3(new THREE.Vector3(...points[0]), new THREE.Vector3(...points[1]));
    rails.push(new THREE.TubeGeometry(curve, 1, .025, 6, false));
  }
  for (let tier = 0; tier < tiers; tier++) {
    const y = .18 + tier * tierRise;
    for (const side of [-1, 1]) {
      const x = side * (sideOffset + tier * tierDepth);
      face([[x,y,near],[x,y,far],[x,y+tierHeight,near],[x,y+tierHeight,far]], tier);
    }
    const z = rear - tier * tierDepth;
    face([[-halfWidth,y,z],[halfWidth,y,z],[-halfWidth,y+tierHeight,z],[halfWidth,y+tierHeight,z]], tier);
  }
  const material = new THREE.MeshStandardMaterial({
    map: texture, color: '#bac3d0', roughness: 1, side: THREE.DoubleSide,
    emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: .38,
  });
  for (const [parts, mat, name] of [[faces, material, 'ENV_crowd_tiers'], [rails, railMaterial, 'ENV_crowd_rails']]) {
    const mesh = new THREE.Mesh(mergeGeometries(parts, false), mat);
    mesh.name = name;
    parent.add(mesh);
    parts.forEach(g => g.dispose());
  }
}
