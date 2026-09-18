import * as THREE from 'three';

const GOLD = new THREE.Color(0xffc85c);
const WARM = new THREE.Color(0xff784f);
const CYAN = new THREE.Color(0x72c8ff);
const RED = new THREE.Color(0xff4b55);

export class VfxEngine {
  constructor({ root, renderer, config, fxBadge }) {
    this.root = root;
    this.renderer = renderer;
    this.config = config;
    this.fxBadge = fxBadge;

    this.quality = detectQuality(config.quality);
    this.webgpuAvailable = Boolean(navigator.gpu);
    this.baseRootPosition = root.position.clone();

    this.time = 0;
    this.shake = 0;
    this.shakeFrequency = 0;
    this.pulses = [];
    this.trailCursor = 0;

    this.maxParticles = tierValue(this.quality, 48, 88, 140, 220);
    this.trailLength = tierValue(this.quality, 8, 14, 22, 32);

    this.createParticles();
    this.createTrail();
    this.updateBadge();
  }

  updateBadge() {
    if (!this.fxBadge) return;
    const backend = this.renderer.capabilities?.isWebGL2 ? 'WEBGL2' : 'WEBGL';
    const future = this.webgpuAvailable ? ' · WEBGPU READY' : '';
    this.fxBadge.textContent = 'FX ' + this.quality + ' · ' + backend + future;
  }

  createParticles() {
    this.positions = new Float32Array(this.maxParticles * 3);
    this.velocities = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.life = new Float32Array(this.maxParticles);
    this.maxLife = new Float32Array(this.maxParticles);

    for (let i = 0; i < this.maxParticles; i += 1) {
      this.positions[i * 3 + 1] = -999;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1));

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: {
        uSize: { value: tierValue(this.quality, 6, 8, 10, 12) * window.devicePixelRatio }
      },
      vertexShader: `
        attribute vec3 color;
        attribute float aLife;
        varying vec3 vColor;
        varying float vLife;
        uniform float uSize;

        void main() {
          vColor = color;
          vLife = aLife;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize * (260.0 / max(1.0, -mvPosition.z));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vLife;

        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          if (d > 0.5) discard;
          float soft = smoothstep(0.5, 0.0, d);
          float alpha = soft * clamp(vLife, 0.0, 1.0);
          gl_FragColor = vec4(vColor, alpha);
        }
      `
    });

    this.particlePoints = new THREE.Points(geometry, material);
    this.particlePoints.frustumCulled = false;
    this.particlePoints.renderOrder = 12;
    rootSafeAdd(this.root, this.particlePoints);
  }

  createTrail() {
    this.trailPositions = new Float32Array(this.trailLength * 3);
    for (let i = 0; i < this.trailLength; i += 1) {
      this.trailPositions[i * 3 + 1] = -999;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));

    const material = new THREE.LineBasicMaterial({
      color: 0xf7c85f,
      transparent: true,
      opacity: tierValue(this.quality, 0.18, 0.24, 0.32, 0.42),
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.trail = new THREE.Line(geometry, material);
    this.trail.frustumCulled = false;
    this.trail.renderOrder = 11;
    rootSafeAdd(this.root, this.trail);
  }

  updateBallTrail(ball, y, active) {
    if (!active || !this.config.trail) {
      this.trail.visible = false;
      return;
    }

    this.trail.visible = true;

    for (let i = this.trailLength - 1; i > 0; i -= 1) {
      const dst = i * 3;
      const src = (i - 1) * 3;
      this.trailPositions[dst] = this.trailPositions[src];
      this.trailPositions[dst + 1] = this.trailPositions[src + 1];
      this.trailPositions[dst + 2] = this.trailPositions[src + 2];
    }

    this.trailPositions[0] = ball.position.x;
    this.trailPositions[1] = y + 0.015;
    this.trailPositions[2] = ball.position.z;
    this.trail.geometry.attributes.position.needsUpdate = true;
  }

  step(dt) {
    this.time += dt;
    this.updateParticles(dt);
    this.updatePulses(dt);
    this.updateShake(dt);
  }

  burst(x, y, z, color = GOLD, count = 14, force = 1) {
    if (!this.config.particles) return;

    const scaled = Math.min(
      this.maxParticles,
      Math.max(4, Math.round(count * tierValue(this.quality, 0.45, 0.75, 1, 1.3)))
    );

    let emitted = 0;
    for (let i = 0; i < this.maxParticles && emitted < scaled; i += 1) {
      if (this.life[i] > 0) continue;

      const angle = Math.random() * Math.PI * 2;
      const radial = (0.5 + Math.random() * 1.4) * force;
      const upward = (0.45 + Math.random() * 1.0) * force;
      const idx = i * 3;

      this.positions[idx] = x;
      this.positions[idx + 1] = y;
      this.positions[idx + 2] = z;

      this.velocities[idx] = Math.cos(angle) * radial;
      this.velocities[idx + 1] = upward;
      this.velocities[idx + 2] = Math.sin(angle) * radial;

      const variation = 0.82 + Math.random() * 0.28;
      this.colors[idx] = color.r * variation;
      this.colors[idx + 1] = color.g * variation;
      this.colors[idx + 2] = color.b * variation;

      const life = 0.28 + Math.random() * 0.32;
      this.life[i] = 1;
      this.maxLife[i] = life;
      emitted += 1;
    }

    this.particlePoints.geometry.attributes.position.needsUpdate = true;
    this.particlePoints.geometry.attributes.color.needsUpdate = true;
    this.particlePoints.geometry.attributes.aLife.needsUpdate = true;
  }

  pulse(x, y, z, color = GOLD, radius = 0.22, duration = 0.42) {
    if (!this.config.pulses) return;

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.65, radius, 48),
      material
    );
    mesh.position.set(x, y, z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 10;
    rootSafeAdd(this.root, mesh);

    this.pulses.push({
      mesh,
      age: 0,
      duration,
      startScale: 0.72,
      endScale: 2.4
    });
  }

  hit(kind, x, z, strength = 1) {
    const y = 0.92;
    const s = clamp(strength, 0.5, 2.2);

    if (kind === 'bumper') {
      this.burst(x, y, z, GOLD, 18, 1.0 * s);
      this.pulse(x, y - 0.20, z, GOLD, 0.28, 0.36);
      this.kick(0.018 * s, 32);
    } else if (kind === 'slingshot') {
      this.burst(x, y - 0.18, z, WARM, 14, 0.8 * s);
      this.pulse(x, y - 0.22, z, WARM, 0.22, 0.30);
      this.kick(0.012 * s, 38);
    } else if (kind === 'target') {
      this.burst(x, y, z, CYAN, 12, 0.72 * s);
      this.pulse(x, y - 0.20, z, CYAN, 0.18, 0.30);
      this.kick(0.010 * s, 42);
    } else if (kind === 'bank') {
      this.burst(x, y, z, GOLD, 36, 1.35);
      this.pulse(x, y - 0.22, z, GOLD, 0.44, 0.58);
      this.kick(0.032, 28);
    } else if (kind === 'launch') {
      this.burst(x, y - 0.16, z, GOLD, 18, 1.1 * s);
      this.pulse(x, y - 0.20, z, GOLD, 0.20, 0.34);
      this.kick(0.012 * s, 35);
    } else if (kind === 'tilt') {
      this.burst(x, y, z, RED, 28, 1.15);
      this.kick(0.055, 20);
    }
  }

  kick(amount, frequency = 30) {
    if (!this.config.cameraShake) return;
    this.shake = Math.max(this.shake, amount * this.config.cameraShake);
    this.shakeFrequency = frequency;
  }

  updateParticles(dt) {
    let dirty = false;

    for (let i = 0; i < this.maxParticles; i += 1) {
      if (this.life[i] <= 0) continue;

      const idx = i * 3;
      const lifeSeconds = this.maxLife[i];
      const decay = dt / lifeSeconds;

      this.velocities[idx] *= Math.exp(-2.2 * dt);
      this.velocities[idx + 1] -= 3.2 * dt;
      this.velocities[idx + 2] *= Math.exp(-2.2 * dt);

      this.positions[idx] += this.velocities[idx] * dt;
      this.positions[idx + 1] += this.velocities[idx + 1] * dt;
      this.positions[idx + 2] += this.velocities[idx + 2] * dt;

      this.life[i] = Math.max(0, this.life[i] - decay);
      if (this.life[i] <= 0) this.positions[idx + 1] = -999;
      dirty = true;
    }

    if (dirty) {
      this.particlePoints.geometry.attributes.position.needsUpdate = true;
      this.particlePoints.geometry.attributes.aLife.needsUpdate = true;
    }
  }

  updatePulses(dt) {
    for (let i = this.pulses.length - 1; i >= 0; i -= 1) {
      const pulse = this.pulses[i];
      pulse.age += dt;
      const t = clamp(pulse.age / pulse.duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const scale = lerp(pulse.startScale, pulse.endScale, eased);

      pulse.mesh.scale.setScalar(scale);
      pulse.mesh.material.opacity = (1 - t) * 0.75;

      if (t >= 1) {
        this.root.remove(pulse.mesh);
        pulse.mesh.geometry.dispose();
        pulse.mesh.material.dispose();
        this.pulses.splice(i, 1);
      }
    }
  }

  updateShake(dt) {
    if (this.shake <= 0.0001) {
      this.root.position.copy(this.baseRootPosition);
      this.shake = 0;
      return;
    }

    const decay = Math.exp(-9 * dt);
    this.shake *= decay;
    const phase = this.time * this.shakeFrequency;

    this.root.position.set(
      this.baseRootPosition.x + Math.sin(phase * 1.17) * this.shake,
      this.baseRootPosition.y,
      this.baseRootPosition.z + Math.cos(phase * 0.91) * this.shake * 0.68
    );
  }
}

function detectQuality(requested) {
  if (requested && requested !== 'auto') return requested.toUpperCase();

  const threads = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const mobile = matchMedia('(max-width: 800px)').matches;

  if (!mobile && navigator.gpu && threads >= 8 && memory >= 8) return 'ULTRA';
  if (!mobile && threads >= 6 && memory >= 4) return 'HIGH';
  if (threads >= 4) return 'MEDIUM';
  return 'LOW';
}

function tierValue(tier, low, medium, high, ultra) {
  if (tier === 'ULTRA') return ultra;
  if (tier === 'HIGH') return high;
  if (tier === 'MEDIUM') return medium;
  return low;
}

function rootSafeAdd(root, object) {
  root.add(object);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
