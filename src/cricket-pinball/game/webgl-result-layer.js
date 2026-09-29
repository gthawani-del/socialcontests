export function createWebGLResultLayer({ THREE, scene } = {}) {
  const group = new THREE.Group();
  group.name = 'Gameplay_Result_Layer';
  group.position.set(0, 1.35, .25);
  group.visible = false;
  scene.add(group);

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: 0
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.9, 1.45, 1);
  sprite.renderOrder = 100;
  group.add(sprite);

  const particleGeometry = new THREE.BufferGeometry();
  const particleCount = 28;
  const positions = new Float32Array(particleCount * 3);
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMaterial = new THREE.PointsMaterial({
    color: 0xffcf72,
    size: .035,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.renderOrder = 99;
  group.add(particles);

  const velocities = Array.from({ length: particleCount }, () => new THREE.Vector3());
  let startedAt = 0;
  let duration = 0;
  let active = false;
  let kind = 'RESULT';
  let particleStrength = 0;

  function roundedRect(x, y, w, h, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
  }

  function draw({ title, subtitle = '', tone = 'gold' }) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const palette = tone === 'red'
      ? { line: '#ff8b63', glow: 'rgba(214,59,30,.55)', title: '#ffd3c4', subtitle: '#ff9f85' }
      : tone === 'blue'
        ? { line: '#8acbff', glow: 'rgba(58,135,210,.45)', title: '#e4f4ff', subtitle: '#a9d8ff' }
        : { line: '#f1c668', glow: 'rgba(233,168,60,.48)', title: '#fff1ba', subtitle: '#e5c780' };

    const x = 118, y = 126, w = 788, h = 252;
    ctx.save();
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 48;
    roundedRect(x, y, w, h, 54);
    ctx.fillStyle = 'rgba(4,15,28,.87)';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = palette.line;
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 126px Arial, Helvetica, sans-serif';
    ctx.fillStyle = palette.title;
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 24;
    ctx.fillText(title, 512, subtitle ? 235 : 260);

    if (subtitle) {
      ctx.shadowBlur = 10;
      ctx.font = '700 38px Arial, Helvetica, sans-serif';
      ctx.fillStyle = palette.subtitle;
      ctx.fillText(subtitle, 512, 326);
    }
    ctx.shadowBlur = 0;
    texture.needsUpdate = true;
  }

  function resetParticles(strength = 1) {
    particleStrength = strength;
    const attr = particleGeometry.getAttribute('position');
    for (let i = 0; i < particleCount; i++) {
      attr.array[i * 3] = (Math.random() - .5) * .65;
      attr.array[i * 3 + 1] = (Math.random() - .2) * .28;
      attr.array[i * 3 + 2] = (Math.random() - .5) * .12;
      velocities[i].set(
        (Math.random() - .5) * .7 * strength,
        (.26 + Math.random() * .58) * strength,
        (Math.random() - .5) * .18
      );
    }
    attr.needsUpdate = true;
  }

  function show({ title, subtitle = '', tone = 'gold', ms = 1100, particles: strength = 0 } = {}) {
    draw({ title, subtitle, tone });
    group.visible = true;
    material.opacity = 0;
    particleMaterial.opacity = 0;
    sprite.scale.set(2.35, 1.18, 1);
    group.position.y = 1.18;
    startedAt = performance.now();
    duration = ms;
    active = true;
    kind = 'RESULT';
    if (strength > 0) resetParticles(strength);
    else particleStrength = 0;
  }

  function showOutcome(outcome, metadata = {}) {
    const normalized = String(outcome || '').toUpperCase();
    if (normalized === 'ONE') return show({ title: '1 RUN', subtitle: '+1', ms: 820, particles: .35 });
    if (normalized === 'TWO') return show({ title: '2 RUNS', subtitle: '+2', ms: 900, particles: .45 });
    if (normalized === 'FOUR') return show({ title: 'FOUR!', subtitle: '+4 RUNS', ms: 1150, particles: .8 });
    if (normalized === 'SIX') return show({ title: 'SIX!', subtitle: '+6 RUNS', ms: 1350, particles: 1 });
    if (normalized === 'WICKET') return show({ title: 'WICKET!', subtitle: metadata.reason === 'RISK_WICKET' ? 'MISTIMED ATTACK' : 'OUT', tone: 'red', ms: 1350, particles: .55 });
    if (normalized === 'DOT') return show({ title: 'DOT BALL', subtitle: 'NO RUN', tone: 'blue', ms: 720 });
    if (normalized === 'DEAD_BALL') return show({ title: 'DEAD BALL', subtitle: 'DOES NOT COUNT', tone: 'blue', ms: 1200 });
  }

  function showCountdown(label, value) {
    show({ title: String(value), subtitle: label, tone: 'blue', ms: 700, particles: 0 });
    kind = 'COUNTDOWN';
  }

  function update(now = performance.now(), dt = 1 / 60) {
    if (!active) return;
    const elapsed = now - startedAt;
    const t = Math.min(1, elapsed / Math.max(1, duration));
    const fadeIn = Math.min(1, t / .14);
    const fadeOut = t > .68 ? 1 - (t - .68) / .32 : 1;
    material.opacity = Math.max(0, fadeIn * fadeOut);
    const scale = kind === 'COUNTDOWN'
      ? 2.15 + Math.sin(Math.min(1, t) * Math.PI) * .2
      : 2.35 + Math.min(1, t / .3) * .5;
    sprite.scale.set(scale, scale * .5, 1);
    group.position.y = 1.18 + t * .22;

    if (particleStrength > 0) {
      const attr = particleGeometry.getAttribute('position');
      for (let i = 0; i < particleCount; i++) {
        attr.array[i * 3] += velocities[i].x * dt;
        attr.array[i * 3 + 1] += velocities[i].y * dt;
        attr.array[i * 3 + 2] += velocities[i].z * dt;
        velocities[i].y -= .52 * dt;
      }
      attr.needsUpdate = true;
      particleMaterial.opacity = Math.max(0, .9 * fadeOut * particleStrength);
    }

    if (t >= 1) {
      active = false;
      group.visible = false;
      material.opacity = 0;
      particleMaterial.opacity = 0;
    }
  }

  return { showOutcome, showCountdown, update, group };
}
