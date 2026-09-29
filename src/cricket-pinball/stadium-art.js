import * as THREE from 'three';
import { STADIUM_PITCH, STADIUM_SCALE } from './game/stadium-layout.js';

// All visible architecture, pitch, bats and ramps come from the Jutsu GLB.
// Runtime owns only animation and verification of the authored geometry.
function canopyHeight(x, depth) {
  const u = x / 1.08;
  return 1.30 + .24 * Math.pow(Math.abs(u), 1.55) + .035 * Math.cos(u * Math.PI * 2) + .09 * depth;
}

function addRuntimePavilionCanopy(scene, model) {
  const oldRoof = model.getObjectByName('Pavilion_Peaked_Roof');
  if (oldRoof) oldRoof.visible = false;
  if (model.getObjectByName('Pavilion_Sculpted_Canopy')) return { authored: true, runtime: false };

  const xs = Array.from({ length: 17 }, (_, i) => -1.08 + i * (2.16 / 16));
  const zs = [-2.82, -3.08, -3.34, -3.62];
  const vertices = [], indices = [];
  for (let r = 0; r < zs.length; r++) {
    const depth = r / (zs.length - 1);
    for (const x of xs) vertices.push(x, canopyHeight(x, depth), zs[r]);
  }
  for (let r = 0; r < zs.length - 1; r++) for (let i = 0; i < xs.length - 1; i++) {
    const a = r * xs.length + i, b = a + 1, c = (r + 1) * xs.length + i + 1, d = c - 1;
    indices.push(a, b, c, a, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const shell = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: '#d7c3a0', roughness: .58, metalness: .04, side: THREE.DoubleSide
  }));
  shell.name = 'Runtime_Pavilion_Sculpted_Canopy'; shell.castShadow = true; shell.receiveShadow = true;

  const lines = [];
  const addPolyline = points => { for (let i = 0; i < points.length - 1; i++) lines.push(...points[i], ...points[i + 1]); };
  for (const [z, depth] of [[zs[0], 0], [zs[zs.length - 1], 1]]) addPolyline(xs.map(x => [x, canopyHeight(x, depth) + .012, z]));
  for (const x of [-1, -.66, -.33, 0, .33, .66, 1]) addPolyline(zs.map((z, i) => [x, canopyHeight(x, i / (zs.length - 1)) + .016, z]));
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  const trim = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: '#d0a85d' }));
  trim.name = 'Runtime_Pavilion_Canopy_Trim';

  const group = new THREE.Group(); group.name = 'Runtime_Pavilion_Canopy';
  group.add(shell, trim); scene.add(group);
  return { authored: false, runtime: true };
}

function refineBatMaterials(model) {
  let refined = 0;
  for (const side of ['left', 'right']) {
    const blade = model.getObjectByName(`Willow_Blade_${side}`);
    if (blade?.isMesh) {
      blade.material = blade.material.clone();
      blade.material.color.set('#c9904f');
      blade.material.roughness = .46;
      blade.material.metalness = 0;
      refined++;
    }
    const grip = model.getObjectByName(`Wrapped_Grip_${side}`);
    if (grip?.isMesh) {
      grip.material = grip.material.clone();
      grip.material.color.set('#071827');
      grip.material.roughness = .7;
    }
  }
  return refined;
}

export function buildStadiumArt(scene, model, table) {
  const canopy = addRuntimePavilionCanopy(scene, model);
  const refinedBatMaterials = refineBatMaterials(model);
  const bats = Object.fromEntries(['left', 'right'].map(side => [side, model.getObjectByName(`Branded_Bat_${side}`)]));
  if (!bats.left || !bats.right) throw new Error('Authored stadium bats missing');
  model.updateMatrixWorld(true);
  const pitch = model.getObjectByName('Measured_Pitch');
  const size = new THREE.Box3().setFromObject(pitch).getSize(new THREE.Vector3());
  const ramp = model.getObjectByName('Six_Ramp');
  const p = ramp.geometry.getAttribute('position'), n = ramp.geometry.getAttribute('normal');
  const points = [], normalMatrix = new THREE.Matrix3().getNormalMatrix(ramp.matrixWorld);
  for (let i = 0; i < p.count; i++) {
    const normal = new THREE.Vector3().fromBufferAttribute(n, i).applyMatrix3(normalMatrix);
    if (normal.y > .5) points.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(ramp.matrixWorld));
  }
  const route = table.ramps.find(r => r.id === 'six-ramp');
  const parityError = Math.max(...route.points.flatMap(sample => [-1, 1].map(sign => Math.min(...points.map(v =>
    Math.hypot(v.x - sample.x - sign * route.halfWidth, v.y - sample.height, v.z - sample.z)
  )))));
  const stats = {
    pitchLengthMetres: size.z * STADIUM_PITCH.metresPerUnit,
    pitchWidthMetres: size.x * STADIUM_PITCH.metresPerUnit,
    battingZ: STADIUM_PITCH.battingZ, bowlingZ: STADIUM_PITCH.bowlingZ,
    rampMouthHeight: Math.min(...points.map(v => v.y)), rampSurfaceParityError: parityError,
    rampUpwardNormals: points.length > 0, brandedBats: 2, canopy, refinedBatMaterials, scope: 'Colosseum GLB with runtime r6 visual refinement, measured in runtime.'
  };
  return { bats, stats, update(engine) {
    for (const side of ['left', 'right']) {
      const state = engine.flippers.get(side), cfg = state.config;
      bats[side].position.set((cfg.pivot[0] + Math.cos(state.angle) * cfg.length / 2) / STADIUM_SCALE, .065 / STADIUM_SCALE, (cfg.pivot[1] - Math.sin(state.angle) * cfg.length / 2) / STADIUM_SCALE);
      bats[side].rotation.set(0, state.angle, 0);
    }
  } };
}
