import * as THREE from 'three';
import { BOMBAY_HOTSPOTS } from './hotspots.js';

export function createThemeEffectController({ root, camera, renderer, themeConfig }) {
  if (!root || !camera || !renderer || themeConfig?.id !== 'bombay-1945') {
    return { trigger(){}, update(){}, reset(){}, dispose(){} };
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const entries = new Map();
  const picks = [];
  const effectRoot = new THREE.Group();
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  let hovered = null;
  let disposed = false;

  effectRoot.name = 'Bombay_Interaction_Effects';
  root.add(effectRoot);

  for (const cfg of BOMBAY_HOTSPOTS) {
    const entry = cfg.kind === 'circle' ? makeCircle(cfg) : makeRect(cfg);
    entries.set(cfg.id, entry);
    picks.push(entry.pick);
    effectRoot.add(entry.group);
  }

  const canvas = renderer.domElement;

  const setHover = (id) => {
    if (hovered === id) return;
    hovered = id;
    if (!coarse) canvas.style.cursor = id ? 'pointer' : '';
    for (const [key, entry] of entries) entry.hoverTarget = key === id ? 1 : 0;
  };

  const pick = (event) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    root.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);

    return raycaster.intersectObjects(picks, false)[0]?.object?.userData?.hotspotId || null;
  };

  const onMove = (event) => {
    if (disposed || coarse || event.pointerType === 'touch') return;
    setHover(pick(event));
  };

  const onLeave = () => {
    if (!disposed) setHover(null);
  };

  const onDown = (event) => {
    if (disposed) return;
    const id = pick(event);
    if (id) trigger(id, 'pointer', 0.85);
  };

  canvas.addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointerleave', onLeave, { passive: true });
  canvas.addEventListener('pointerdown', onDown, { passive: true });

  function trigger(id, source = 'gameplay', strength = 1) {
    const entry = entries.get(id);
    if (!entry) return;
    const multiplier = source === 'gameplay' ? 1 : 0.82;
    entry.pulse = Math.max(entry.pulse, Math.min(1.4, strength * multiplier));
  }

  function update(dt) {
    if (disposed) return;
    const hoverEase = 1 - Math.exp(-12 * dt);

    for (const entry of entries.values()) {
      entry.hover += (entry.hoverTarget - entry.hover) * hoverEase;
      entry.pulse *= Math.exp(-5.8 * dt);

      const energy = Math.min(1.25, entry.hover * 0.62 + entry.pulse);
      const wave = entry.pulse > 0.001
        ? Math.sin((1 - Math.min(entry.pulse, 1)) * Math.PI) * entry.pulse
        : 0;

      entry.glow.material.opacity = Math.min(0.24, energy * 0.19);
      entry.ring.material.opacity = Math.min(0.9, energy * 0.72);

      const scale = 1 + entry.hover * 0.025 + wave * 0.065;
      entry.group.scale.set(scale, scale, 1);

      if (entry.light) {
        entry.light.intensity = (entry.config.maxLight || 0) * Math.min(1, energy);
      }
    }
  }

  function reset() {
    setHover(null);
    for (const entry of entries.values()) {
      entry.pulse = 0;
      entry.hover = 0;
      entry.hoverTarget = 0;
      entry.group.scale.set(1, 1, 1);
      entry.ring.material.opacity = 0;
      entry.glow.material.opacity = 0;
      if (entry.light) entry.light.intensity = 0;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.style.cursor = '';
    effectRoot.removeFromParent();
  }

  return { trigger, update, reset, dispose };

  function makeCircle(cfg) {
    const group = baseGroup(cfg);
    const glow = meshCircle(cfg.radius * 0.91, cfg.color, false);
    const ring = meshRing(cfg.radius * 0.78, cfg.radius * 1.06, cfg.color);
    const pickMesh = invisibleCircle(cfg.radius * 1.15, cfg.id);
    group.add(glow, ring, pickMesh);

    let light = null;
    if (cfg.maxLight) {
      light = new THREE.PointLight(cfg.color, 0, 1.8, 2);
      light.position.y = 0.30;
      group.add(light);
    }

    return entry(cfg, group, ring, glow, pickMesh, light);
  }

  function makeRect(cfg) {
    const group = baseGroup(cfg);
    const [w, h, d = 0.16] = cfg.size;

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      effectMaterial(cfg.color)
    );
    glow.position.z = 0.012;

    const ring = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(w * 1.025, h * 1.07)),
      new THREE.LineBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      })
    );
    ring.position.z = 0.016;

    const pickMesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      invisibleMaterial()
    );
    pickMesh.userData.hotspotId = cfg.id;

    group.add(glow, ring, pickMesh);
    return entry(cfg, group, ring, glow, pickMesh, null);
  }

  function baseGroup(cfg) {
    const group = new THREE.Group();
    group.name = 'Bombay_Effect_' + cfg.id;
    group.position.set(...cfg.position);
    return group;
  }

  function entry(config, group, ring, glow, pickMesh, light) {
    return {
      config, group, ring, glow, pick: pickMesh, light,
      pulse: 0, hover: 0, hoverTarget: 0
    };
  }

  function meshCircle(radius, color) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 48),
      effectMaterial(color)
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 39;
    return mesh;
  }

  function meshRing(inner, outer, color) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 56),
      effectMaterial(color)
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.004;
    mesh.renderOrder = 40;
    return mesh;
  }

  function invisibleCircle(radius, id) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 32),
      invisibleMaterial()
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.03;
    mesh.userData.hotspotId = id;
    return mesh;
  }

  function effectMaterial(color) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
  }

  function invisibleMaterial() {
    return new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      colorWrite: false,
      side: THREE.DoubleSide
    });
  }
}
