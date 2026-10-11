import * as THREE from 'three';
import { FOUNDATION as RULES, RAILS } from './modes/foundation.js';

export function createRenderer(container, engine) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor('#101923');
  container.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Football pinball arena: red goal above, blue goal below');
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera();
  camera.position.set(0, 15, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  camera.near = 0.1; camera.far = 40;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x384454, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(-4, 10, 5); scene.add(light);
  const materials = new Map();
  function material(color) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
    return materials.get(color);
  }
  function box(name, w, h, d, x, y, z, color) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
    mesh.name = name; mesh.position.set(x, y, z); scene.add(mesh); return mesh;
  }
  box('field', 6.2, 0.12, 11.6, 0, -0.08, 0, '#364b45');
  for (let i = 0; i < 10; i += 2) box(`stripe-${i}`, 6, 0.01, 1, 0, -0.01, i - 4.5, '#3c524b');
  for (const rail of RAILS) box(rail.id, rail.hx * 2, 0.35, rail.hy * 2,
    rail.x, 0.15, -rail.y, '#87929c');
  const lineMaterial = new THREE.LineBasicMaterial({ color: '#a6b5aa' });
  function line(points) {
    const mesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(
      points.map(([x, y]) => new THREE.Vector3(x, 0.012, -y))), lineMaterial);
    scene.add(mesh);
  }
  line([[-2.8, -4.8], [-2.8, 4.8], [2.8, 4.8], [2.8, -4.8], [-2.8, -4.8]]);
  line([[-2.8, 0], [2.8, 0]]);
  line(Array.from({ length: 65 }, (_, i) => [Math.cos(i / 64 * Math.PI * 2) * 0.85, Math.sin(i / 64 * Math.PI * 2) * 0.85]));
  for (const sign of [-1, 1]) {
    const color = sign < 0 ? '#397dde' : '#d85358';
    box(`${sign}-goal-floor`, 2.2, 0.012, 0.7, 0, 0, -sign * 5.35, color);
    box(`${sign}-crossbar`, 2.35, 0.08, 0.08, 0, 0.65, -sign * 5, '#e3e9e8');
    for (const x of [-1.15, 1.15]) box(`${sign}-post-${x}`, 0.08, 0.65, 0.08, x, 0.325, -sign * 5, '#e3e9e8');
    line([[-1.6, sign * 4.8], [-1.6, sign * 4.15], [1.6, sign * 4.15], [1.6, sign * 4.8]]);
  }
  const bootMeshes = engine.boots.map(boot => {
    const pivot = new THREE.Group(); pivot.name = boot.id;
    pivot.position.set(boot.x, 0.19, -boot.y); scene.add(pivot);
    // Simple capsule proxy, matching the Rapier collider exactly, not a production boot model.
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(RULES.bootRadius,
      RULES.bootLength - RULES.bootRadius * 2, 4, 12), material(boot.team === 'blue' ? '#397dde' : '#d85358'));
    mesh.rotation.z = -Math.PI / 2; mesh.position.x = RULES.bootLength / 2; pivot.add(mesh);
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.04, 12), material('#e3e9e8'));
    hinge.position.y = 0.17; pivot.add(hinge);
    return pivot;
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(RULES.ballRadius, 20, 12), material('#f5f3e8'));
  ball.name = 'ball-1'; scene.add(ball);
  // Black pentagonal panels identify the ball without introducing external textures/assets.
  for (const vector of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(RULES.ballRadius * 0.45, 5), material('#1b2429'));
    const normal = new THREE.Vector3(...vector);
    patch.position.copy(normal.multiplyScalar(RULES.ballRadius * 1.005));
    patch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.normalize()); ball.add(patch);
  }
  function resize() {
    const width = container.clientWidth, height = container.clientHeight;
    renderer.setSize(width, height, false);
    const ratio = width / Math.max(height, 1);
    const viewHeight = Math.max(12.1, 6.8 / ratio);
    camera.left = -viewHeight * ratio / 2; camera.right = viewHeight * ratio / 2;
    camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  function draw() {
    const alpha = engine.paused ? 1 : engine.accumulator / RULES.step;
    const p = engine.ball.translation(), prev = engine.previousBall;
    ball.position.set(THREE.MathUtils.lerp(prev.x, p.x, alpha), RULES.ballRadius + 0.02,
      -THREE.MathUtils.lerp(prev.y, p.y, alpha));
    ball.rotation.set(-p.y / RULES.ballRadius, 0, -p.x / RULES.ballRadius);
    engine.boots.forEach((boot, i) => {
      bootMeshes[i].rotation.y = THREE.MathUtils.lerp(boot.previousAngle, boot.angle, alpha);
    });
    renderer.render(scene, camera);
  }
  return { draw, metrics: () => ({ ...renderer.info.memory, calls: renderer.info.render.calls }),
    dispose() {
      observer.disconnect();
      scene.traverse(object => object.geometry?.dispose());
      materials.forEach(m => m.dispose()); lineMaterial.dispose();
      renderer.dispose(); renderer.domElement.remove();
    } };
}
