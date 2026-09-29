import * as THREE from 'three';
import { STADIUM_PITCH, STADIUM_SCALE } from './game/stadium-layout.js';

// All visible architecture, pitch, bats and ramps come from the Jutsu GLB.
// Runtime owns only animation and verification of the authored geometry.
export function buildStadiumArt(scene, model, table) {
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
    rampUpwardNormals: points.length > 0, brandedBats: 2, scope: 'Authored Jutsu colosseum r6 GLB, measured in runtime.'
  };
  return { bats, stats, update(engine) {
    for (const side of ['left', 'right']) {
      const state = engine.flippers.get(side), cfg = state.config;
      bats[side].position.set((cfg.pivot[0] + Math.cos(state.angle) * cfg.length / 2) / STADIUM_SCALE, .065 / STADIUM_SCALE, (cfg.pivot[1] - Math.sin(state.angle) * cfg.length / 2) / STADIUM_SCALE);
      bats[side].rotation.set(0, state.angle, 0);
    }
  } };
}
