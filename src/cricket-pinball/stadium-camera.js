import * as THREE from 'three';

// Fit the playable footprint; background architecture can extend beyond the frame.
export function frameStadium(camera, aspect) {
  camera.aspect = aspect;
  // A wider lens brings the batting end forward while retaining the full
  // collision footprint. Keep this shared by runtime and preview fixtures.
  camera.fov = 58;
  const target = new THREE.Vector3(0, .05, .35);
  const back = new THREE.Vector3(0, .58, .81).normalize();
  const up = new THREE.Vector3(0, back.z, -back.y);
  const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const points = [[-1.66,0,0],[1.66,0,0],[0,.65,-2.15],[0,0,2.58],[1.38,.1,2.75],[-1.05,.2,2.22],[1.05,.2,2.22]];
  let distance = 0;
  for (const point of points) {
    const p = new THREE.Vector3(...point).sub(target);
    distance = Math.max(distance, p.dot(back) + Math.abs(p.x) / (tangent * aspect * .94), p.dot(back) + Math.abs(p.dot(up)) / (tangent * .94));
  }
  camera.position.copy(target).addScaledVector(back, distance);
  camera.lookAt(target); camera.updateProjectionMatrix();
}
