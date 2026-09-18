import * as THREE from 'three';

const SMOOTH_SECONDS = 0.34;

const STATE_LEVELS = {
  READY: { focus: 3.0, decorative: 0.68, playfield: 0.92 },
  PLAYING: { focus: 9.0, decorative: 0.58, playfield: 1.06 },
  BALL_LOST: { focus: 2.2, decorative: 0.50, playfield: 0.82 },
  GAME_OVER: { focus: 0.35, decorative: 0.38, playfield: 0.64 }
};

export class GameplayFocusLighting {
  constructor({ root, tableConfig }) {
    this.root = root;
    this.tableConfig = tableConfig;
    this.state = 'READY';
    this.pulseStrength = 0;

    const y = tableConfig.playfield.surfaceY + 1.05;
    this.focusPosition = new THREE.Vector3(0, y, 0);
    this.targetPosition = this.focusPosition.clone();
    this.pulsePosition = new THREE.Vector3(0, y, 0);

    this.focusLight = new THREE.PointLight(0xffd9a0, 0, 4.8, 2);
    this.focusLight.name = 'Gameplay_Focus_Light';
    this.focusLight.position.copy(this.focusPosition);
    root.add(this.focusLight);

    this.decorative = [];
    this.playfield = [];
    this.interactive = [];

    this.collectMaterials();
  }

  collectMaterials() {
    const seenMaterials = new Set();

    const addEntry = (bucket, anchor, material) => {
      if (!material?.color || seenMaterials.has(material)) return;
      seenMaterials.add(material);
      bucket.push({
        anchor,
        material,
        baseColor: material.color.clone(),
        baseEmissive: material.emissive?.clone?.() ?? null,
        baseEmissiveIntensity: Number.isFinite(material.emissiveIntensity)
          ? material.emissiveIntensity
          : 0,
        scalar: 1
      });
    };

    const collectAnchor = (anchor, bucket) => {
      anchor.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => addEntry(bucket, anchor, material));
      });
    };

    this.root.traverse((object) => {
      if (object.name === 'Paris_AI_Playfield_Artwork') {
        collectAnchor(object, this.playfield);
        return;
      }

      if (
        object.name === 'Paris_AI_Backdrop' ||
        object.name === 'Paris_AI_Hero_Eiffel' ||
        object.name === 'Paris_AI_Jackpot_Crest'
      ) {
        collectAnchor(object, this.decorative);
        return;
      }

      if (
        /^Paris_AI_Bumper_/.test(object.name) ||
        /^Target_/.test(object.name) ||
        /^Slingshot_/.test(object.name)
      ) {
        collectAnchor(object, this.interactive);
      }
    });
  }

  setState(state) {
    if (!STATE_LEVELS[state]) return;
    this.state = state;
  }

  pulseAt(x, z, strength = 1) {
    this.pulsePosition.set(
      x,
      this.tableConfig.playfield.surfaceY + 0.92,
      z
    );
    this.pulseStrength = Math.max(this.pulseStrength, clamp(strength, 0.35, 1.6));
  }

  reset() {
    this.pulseStrength = 0;
    this.targetPosition.set(
      this.tableConfig.launcher.spawn[0],
      this.tableConfig.playfield.surfaceY + 1.05,
      this.tableConfig.launcher.spawn[1]
    );
    this.setState('PLAYING');
  }

  update(dt, ball) {
    const level = STATE_LEVELS[this.state] || STATE_LEVELS.READY;
    const smoothing = 1 - Math.exp(-dt / SMOOTH_SECONDS);

    if (this.state === 'PLAYING' && ball?.active) {
      this.targetPosition.set(
        clamp(ball.position.x * 0.76, -1.25, 1.25),
        this.tableConfig.playfield.surfaceY + 1.02,
        clamp(ball.position.z, -2.35, 2.25)
      );
    } else {
      this.targetPosition.set(
        0,
        this.tableConfig.playfield.surfaceY + 1.10,
        this.state === 'GAME_OVER' ? -0.30 : 0.15
      );
    }

    if (this.pulseStrength > 0.01) {
      const pulseMix = clamp(this.pulseStrength * 0.62, 0, 0.72);
      this.targetPosition.lerp(this.pulsePosition, pulseMix);
      this.pulseStrength *= Math.exp(-5.8 * dt);
    } else {
      this.pulseStrength = 0;
    }

    this.focusPosition.lerp(this.targetPosition, smoothing);
    this.focusLight.position.copy(this.focusPosition);

    const targetIntensity = level.focus + this.pulseStrength * 5.5;
    this.focusLight.intensity = THREE.MathUtils.lerp(
      this.focusLight.intensity,
      targetIntensity,
      smoothing
    );

    this.updateBucket(this.decorative, level.decorative, smoothing);
    this.updateBucket(this.playfield, level.playfield, smoothing);
    this.updateInteractive(smoothing);
  }

  updateBucket(entries, targetScalar, smoothing) {
    for (const entry of entries) {
      entry.scalar = THREE.MathUtils.lerp(entry.scalar, targetScalar, smoothing);
      entry.material.color.copy(entry.baseColor).multiplyScalar(entry.scalar);

      if (entry.baseEmissive && 'emissiveIntensity' in entry.material) {
        entry.material.emissive.copy(entry.baseEmissive);
        entry.material.emissiveIntensity =
          entry.baseEmissiveIntensity * Math.min(1, entry.scalar);
      }
    }
  }

  updateInteractive(smoothing) {
    const active = this.state === 'PLAYING';

    for (const entry of this.interactive) {
      const anchor = entry.anchor;
      const dx = anchor.position.x - this.focusPosition.x;
      const dz = anchor.position.z - this.focusPosition.z;
      const distance = Math.hypot(dx, dz);
      const proximity = active ? 1 - clamp(distance / 1.35, 0, 1) : 0;

      const pulseDistance = Math.hypot(
        anchor.position.x - this.pulsePosition.x,
        anchor.position.z - this.pulsePosition.z
      );
      const pulse =
        this.pulseStrength > 0
          ? (1 - clamp(pulseDistance / 0.9, 0, 1)) * this.pulseStrength
          : 0;

      const base = this.state === 'GAME_OVER' ? 0.72 : active ? 1.0 : 0.86;
      const targetScalar = base + proximity * 0.16 + pulse * 0.18;

      entry.scalar = THREE.MathUtils.lerp(entry.scalar, targetScalar, smoothing);
      entry.material.color.copy(entry.baseColor).multiplyScalar(entry.scalar);

      if (entry.baseEmissive && 'emissiveIntensity' in entry.material) {
        entry.material.emissive.copy(entry.baseEmissive);
        entry.material.emissiveIntensity =
          entry.baseEmissiveIntensity +
          (active ? proximity * 0.45 : 0) +
          pulse * 0.55;
      }
    }
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
