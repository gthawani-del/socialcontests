const EPS = 1e-7;
const DEG = Math.PI / 180;

export class PinballEngine {
  constructor(config) {
    this.config = config;
    this.fixedStep = config.physics.fixedStep;
    this.accumulator = 0;
    this.simTime = 0;
    this.listeners = new Map();
    this.wallHitAt = new Map();
    this.slingshotHitAt = new Map();
    this.bumperHitAt = new Map();
    this.targetResetAt = null;
    this.scoringZoneStates = new Map(
      (config.scoringZones || []).map((zone) => [zone.id, { config: zone, inside: false }])
    );

    this.ball = {
      position: { x: 0, z: 0 },
      velocity: { x: 0, z: 0 },
      active: true
    };

    this.flippers = new Map(
      config.flippers.map((item) => [
        item.id,
        {
          config: item,
          angle: item.restAngleDeg * DEG,
          angularVelocity: 0,
          pressed: false
        }
      ])
    );

    this.targets = new Map(
      config.targets.map((item) => [
        item.id,
        { config: item, active: true }
      ])
    );

    this.launcher = {
      awaitingLaunch: true,
      charging: false,
      chargeSeconds: 0,
      inLane: true
    };

    this.nudgeTimes = [];
    this.tilted = false;

    this.resetBall();
  }

  on(type, handler) {
    const handlers = this.listeners.get(type) || new Set();
    handlers.add(handler);
    this.listeners.set(type, handlers);
    return () => handlers.delete(handler);
  }

  emit(type, detail = {}) {
    const handlers = this.listeners.get(type);
    if (!handlers) return;
    for (const handler of handlers) handler(detail);
  }

  setFlipper(id, pressed) {
    const flipper = this.flippers.get(id);
    if (!flipper) return;
    flipper.pressed = this.tilted ? false : Boolean(pressed);
  }

  getFlipper(id) {
    return this.flippers.get(id);
  }

  getTarget(id) {
    return this.targets.get(id);
  }

  isTilted() {
    return this.tilted;
  }

  isAwaitingLaunch() {
    return this.launcher.awaitingLaunch;
  }

  getLauncherCharge() {
    const maxSeconds = this.config.launcher.chargeTimeMs / 1000;
    return maxSeconds > 0 ? clamp(this.launcher.chargeSeconds / maxSeconds, 0, 1) : 0;
  }

  beginLaunch() {
    if (this.tilted || !this.ball.active || !this.launcher.awaitingLaunch) return false;
    this.launcher.charging = true;
    return true;
  }

  setLaunchCharge(normalized) {
    if (this.tilted || !this.ball.active || !this.launcher.awaitingLaunch) return false;
    const maxSeconds = this.config.launcher.chargeTimeMs / 1000;
    this.launcher.charging = true;
    this.launcher.chargeSeconds = clamp(normalized, 0, 1) * maxSeconds;
    return true;
  }

  releaseLaunch(options = null) {
    if (this.tilted || !this.ball.active || !this.launcher.awaitingLaunch) return false;

    const cfg = this.config.launcher;
    const requestedCharge = Number(options?.charge);
    const charge = Number.isFinite(requestedCharge)
      ? clamp(requestedCharge, 0, 1)
      : Math.max(this.getLauncherCharge(), cfg.tapCharge);
    const line = String(options?.line || 'CENTRE').toUpperCase();
    const lineConfig = cfg.bowlingLines?.[line] || null;
    const direction = normalize2(
      cfg.direction[0] + Number(lineConfig?.directionOffsetX || 0),
      cfg.direction[1]
    );
    const power = cfg.minPower + (cfg.maxPower - cfg.minPower) * charge;

    this.ball.velocity.x = direction.x * power;
    this.ball.velocity.z = direction.z * power;
    this.launcher.awaitingLaunch = false;
    this.launcher.charging = false;
    this.launcher.inLane = true;
    this.launcher.chargeSeconds = 0;
    this.launcher.deliveryLine = line;
    this.launcher.deliveryType = String(options?.deliveryType || 'PACE').toUpperCase();
    this.launcher.exitKick = [
      Number.isFinite(Number(lineConfig?.exitKickX))
        ? Number(lineConfig.exitKickX)
        : cfg.exitKick[0],
      cfg.exitKick[1]
    ];

    this.emit('launch', {
      power,
      charge,
      line: this.launcher.deliveryLine,
      deliveryType: this.launcher.deliveryType
    });
    return true;
  }

  freezeBall() {
    this.ball.velocity.x = 0;
    this.ball.velocity.z = 0;
    this.launcher.charging = false;
    this.launcher.chargeSeconds = 0;
  }

  nudge(direction) {
    if (this.tilted || !this.ball.active || this.launcher.awaitingLaunch) return false;

    const cfg = this.config.nudge;
    const dir = direction < 0 ? -1 : 1;

    this.ball.velocity.x += dir * cfg.impulse;
    this.limitBallSpeed();

    const windowSeconds = cfg.windowMs / 1000;
    this.nudgeTimes = this.nudgeTimes.filter((time) => this.simTime - time <= windowSeconds);
    this.nudgeTimes.push(this.simTime);

    const warnings = this.nudgeTimes.length;

    if (warnings >= cfg.maxWarnings) {
      this.tilted = true;
      for (const flipper of this.flippers.values()) flipper.pressed = false;
      this.emit('tilt', { warnings });
    } else {
      this.emit('tilt-warning', { warnings, remaining: cfg.maxWarnings - warnings });
    }

    this.emit('nudge', { direction: dir, warnings });
    return true;
  }

  resetBall() {
    const cfg = this.config.launcher;
    this.ball.position.x = cfg.spawn[0];
    this.ball.position.z = cfg.spawn[1];
    this.ball.velocity.x = 0;
    this.ball.velocity.z = 0;
    this.ball.active = true;

    this.launcher.awaitingLaunch = true;
    this.launcher.charging = false;
    this.launcher.chargeSeconds = 0;
    this.launcher.inLane = true;
    this.launcher.deliveryLine = 'CENTRE';
    this.launcher.deliveryType = 'PACE';
    this.launcher.exitKick = [...cfg.exitKick];

    this.nudgeTimes = [];
    this.tilted = false;
    this.accumulator = 0;

    for (const zone of this.scoringZoneStates.values()) zone.inside = false;
    for (const flipper of this.flippers.values()) flipper.pressed = false;

    this.emit('reset', { position: { ...this.ball.position } });
  }

  resetGame() {
    this.resetTargets();
    this.resetBall();
  }

  resetTargets() {
    this.targetResetAt = null;
    for (const target of this.targets.values()) target.active = true;
    this.emit('targets-reset');
  }

  step(frameDelta) {
    const dt = Math.min(Math.max(frameDelta, 0), this.config.physics.maxFrameDelta);
    this.accumulator += dt;

    let steps = 0;
    while (this.accumulator >= this.fixedStep && steps < 12) {
      this.integrate(this.fixedStep);
      this.accumulator -= this.fixedStep;
      steps += 1;
    }

    if (steps === 12) this.accumulator = 0;
  }

  integrate(dt) {
    this.simTime += dt;
    this.updateFlippers(dt);
    this.updateTargetBank();

    if (!this.ball.active) return;

    if (this.launcher.awaitingLaunch) {
      if (this.launcher.charging) {
        const maxSeconds = this.config.launcher.chargeTimeMs / 1000;
        this.launcher.chargeSeconds = Math.min(
          maxSeconds,
          this.launcher.chargeSeconds + dt
        );
      }
      return;
    }

    const substeps = this.config.physics.collisionSubsteps;
    const subDt = dt / substeps;

    for (let i = 0; i < substeps; i += 1) {
      this.integrateSubstep(subDt);
      if (!this.ball.active) break;
    }
  }

  integrateSubstep(dt) {
    const gravity = this.config.physics.gravity;
    const damping = Math.exp(-this.config.physics.linearDamping * dt);

    this.ball.velocity.x += gravity[0] * dt;
    this.ball.velocity.z += gravity[1] * dt;
    this.ball.velocity.x *= damping;
    this.ball.velocity.z *= damping;

    this.applyRollingFriction(dt);
    this.limitBallSpeed();

    this.ball.position.x += this.ball.velocity.x * dt;
    this.ball.position.z += this.ball.velocity.z * dt;

    this.resolveLauncherLane();

    for (const wall of this.config.walls) {
      const hit = this.resolveSegmentCollision(
        wall.a,
        wall.b,
        this.config.ball.radius,
        wall.restitution
      );
      if (hit && hit.impact > 0.35 && this.canEmit(this.wallHitAt, wall.id, 0.045)) {
        this.emit('wall-hit', {
          id: wall.id,
          impact: hit.impact,
          x: this.ball.position.x,
          z: this.ball.position.z
        });
      }
    }

    for (const slingshot of this.config.slingshots) {
      const hit = this.resolveSegmentCollision(
        slingshot.a,
        slingshot.b,
        this.config.ball.radius,
        slingshot.restitution
      );
      if (!hit) continue;

      const cooldown = slingshot.cooldownMs / 1000;
      if (this.canEmit(this.slingshotHitAt, slingshot.id, cooldown)) {
        this.ball.velocity.x += hit.nx * slingshot.impulse;
        this.ball.velocity.z += hit.nz * slingshot.impulse;
        this.limitBallSpeed();
        this.emit('slingshot-hit', {
          id: slingshot.id,
          impact: hit.impact,
          score: this.tilted ? 0 : slingshot.score,
          x: this.ball.position.x,
          z: this.ball.position.z
        });
      }
    }

    for (const bumper of this.config.bumpers) {
      const hit = this.resolveCircleCollision(
        bumper.position,
        bumper.radius,
        bumper.restitution
      );
      if (!hit) continue;

      const cooldown = bumper.cooldownMs / 1000;
      if (this.canEmit(this.bumperHitAt, bumper.id, cooldown)) {
        this.ball.velocity.x += hit.nx * bumper.impulse;
        this.ball.velocity.z += hit.nz * bumper.impulse;
        this.limitBallSpeed();
        this.emit('bumper-hit', {
          id: bumper.id,
          score: this.tilted ? 0 : bumper.score,
          impact: hit.impact,
          x: this.ball.position.x,
          z: this.ball.position.z
        });
      }
    }

    for (const target of this.targets.values()) {
      if (!target.active) continue;
      const cfg = target.config;
      const half = cfg.width * 0.5;
      const hit = this.resolveSegmentCollision(
        [cfg.position[0] - half, cfg.position[1]],
        [cfg.position[0] + half, cfg.position[1]],
        this.config.ball.radius,
        cfg.restitution
      );

      if (!hit || hit.impact < cfg.minImpact) continue;

      target.active = false;
      this.emit('target-hit', {
        id: cfg.id,
        score: this.tilted ? 0 : cfg.score,
        impact: hit.impact,
        x: cfg.position[0],
        z: cfg.position[1]
      });

      if ([...this.targets.values()].every((item) => !item.active)) {
        this.targetResetAt = this.simTime + this.config.targetBank.resetMs / 1000;
        this.emit('target-bank-complete', {
          score: this.tilted ? 0 : this.config.targetBank.completionScore,
          x: 0,
          z: this.config.targetBank.popupZ
        });
      }
    }

    this.updateScoringZones();

    for (const flipper of this.flippers.values()) {
      this.resolveFlipperCollision(flipper);
    }

    this.checkDrain();
    this.checkSafetyBounds();
  }

  updateTargetBank() {
    if (this.targetResetAt !== null && this.simTime >= this.targetResetAt) {
      this.resetTargets();
    }
  }

  updateScoringZones() {
    for (const zone of this.scoringZoneStates.values()) {
      const cfg = zone.config;
      const dx = this.ball.position.x - cfg.position[0];
      const dz = this.ball.position.z - cfg.position[1];
      const distance = Math.hypot(dx, dz);

      if (!zone.inside && distance <= cfg.radius) {
        zone.inside = true;
        this.emit('scoring-zone-hit', {
          id: cfg.id,
          score: this.tilted ? 0 : cfg.score,
          x: cfg.position[0],
          z: cfg.position[1]
        });
        continue;
      }

      if (zone.inside && distance >= cfg.rearmRadius) {
        zone.inside = false;
      }
    }
  }

  resolveLauncherLane() {
    if (!this.launcher.inLane) return;

    const cfg = this.config.launcher;
    const radius = this.config.ball.radius;
    const minCenterX = cfg.lane.minX + radius;
    const maxCenterX = cfg.lane.maxX - radius;

    if (this.ball.position.x < minCenterX) {
      this.ball.position.x = minCenterX;
      this.ball.velocity.x = Math.abs(this.ball.velocity.x) * cfg.laneRestitution;
    }

    if (this.ball.position.x > maxCenterX) {
      this.ball.position.x = maxCenterX;
      this.ball.velocity.x = -Math.abs(this.ball.velocity.x) * cfg.laneRestitution;
    }

    const exitReached = cfg.lane.exitDirection === 'GTE'
      ? this.ball.position.z >= cfg.lane.exitZ
      : this.ball.position.z <= cfg.lane.exitZ;

    if (exitReached) {
      this.launcher.inLane = false;
      const exitKick = this.launcher.exitKick || cfg.exitKick;
      this.ball.velocity.x += exitKick[0];
      this.ball.velocity.z += exitKick[1];
      this.emit('launcher-exit', {
        line: this.launcher.deliveryLine,
        deliveryType: this.launcher.deliveryType
      });
    }
  }

  applyRollingFriction(dt) {
    const friction = this.config.physics.rollingFriction;
    const speed = Math.hypot(this.ball.velocity.x, this.ball.velocity.z);
    if (speed < EPS || friction <= 0) return;

    const nextSpeed = Math.max(0, speed - friction * dt);
    const scale = nextSpeed / speed;
    this.ball.velocity.x *= scale;
    this.ball.velocity.z *= scale;
  }

  canEmit(map, id, cooldownSeconds) {
    const previous = map.get(id) ?? -Infinity;
    if (this.simTime - previous < cooldownSeconds) return false;
    map.set(id, this.simTime);
    return true;
  }

  updateFlippers(dt) {
    for (const flipper of this.flippers.values()) {
      const cfg = flipper.config;
      const target = (
        this.tilted
          ? cfg.restAngleDeg
          : flipper.pressed
            ? cfg.activeAngleDeg
            : cfg.restAngleDeg
      ) * DEG;
      const speed = (flipper.pressed ? cfg.speedDegPerSec : cfg.returnSpeedDegPerSec) * DEG;
      const previous = flipper.angle;

      flipper.angle = moveTowards(previous, target, speed * dt);
      flipper.angularVelocity = (flipper.angle - previous) / dt;
    }
  }

  resolveSegmentCollision(a, b, radius, restitution) {
    const closest = closestPointOnSegment(
      this.ball.position.x,
      this.ball.position.z,
      a[0],
      a[1],
      b[0],
      b[1]
    );

    let nx = this.ball.position.x - closest.x;
    let nz = this.ball.position.z - closest.z;
    let distSq = nx * nx + nz * nz;

    if (distSq >= radius * radius) return null;

    if (distSq < EPS) {
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz) || 1;
      nx = -dz / len;
      nz = dx / len;

      if (nx * this.ball.velocity.x + nz * this.ball.velocity.z > 0) {
        nx = -nx;
        nz = -nz;
      }
      distSq = 1;
    }

    const dist = Math.sqrt(distSq);
    nx /= dist;
    nz /= dist;

    const penetration = radius - dist;
    this.ball.position.x += nx * penetration;
    this.ball.position.z += nz * penetration;

    const vn = this.ball.velocity.x * nx + this.ball.velocity.z * nz;
    const impact = Math.max(0, -vn);

    if (vn < 0) {
      const impulse = -(1 + restitution) * vn;
      this.ball.velocity.x += nx * impulse;
      this.ball.velocity.z += nz * impulse;
    }

    return { nx, nz, impact };
  }

  resolveCircleCollision(position, radius, restitution) {
    let nx = this.ball.position.x - position[0];
    let nz = this.ball.position.z - position[1];
    let dist = Math.hypot(nx, nz);
    const combined = radius + this.config.ball.radius;

    if (dist >= combined) return null;

    if (dist < EPS) {
      nx = 0;
      nz = 1;
      dist = 1;
    } else {
      nx /= dist;
      nz /= dist;
    }

    const penetration = combined - dist;
    this.ball.position.x += nx * penetration;
    this.ball.position.z += nz * penetration;

    const vn = this.ball.velocity.x * nx + this.ball.velocity.z * nz;
    const impact = Math.max(0, -vn);

    if (vn < 0) {
      const impulse = -(1 + restitution) * vn;
      this.ball.velocity.x += nx * impulse;
      this.ball.velocity.z += nz * impulse;
    }

    return { nx, nz, impact };
  }

  resolveFlipperCollision(flipper) {
    const cfg = flipper.config;
    const pivotX = cfg.pivot[0];
    const pivotZ = cfg.pivot[1];
    const endX = pivotX + Math.cos(flipper.angle) * cfg.length;
    const endZ = pivotZ - Math.sin(flipper.angle) * cfg.length;
    const combinedRadius = this.config.ball.radius + cfg.radius;

    const closest = closestPointOnSegment(
      this.ball.position.x,
      this.ball.position.z,
      pivotX,
      pivotZ,
      endX,
      endZ
    );

    let nx = this.ball.position.x - closest.x;
    let nz = this.ball.position.z - closest.z;
    let dist = Math.hypot(nx, nz);

    if (dist >= combinedRadius) return;

    if (dist < EPS) {
      nx = 0;
      nz = -1;
      dist = 1;
    } else {
      nx /= dist;
      nz /= dist;
    }

    const penetration = combinedRadius - dist;
    this.ball.position.x += nx * penetration;
    this.ball.position.z += nz * penetration;

    const rx = closest.x - pivotX;
    const rz = closest.z - pivotZ;
    const surfaceVx = rz * flipper.angularVelocity;
    const surfaceVz = -rx * flipper.angularVelocity;

    const relativeVx = this.ball.velocity.x - surfaceVx;
    const relativeVz = this.ball.velocity.z - surfaceVz;
    const relativeNormal = relativeVx * nx + relativeVz * nz;

    if (relativeNormal < 0) {
      const impulse = -(1 + cfg.restitution) * relativeNormal;
      this.ball.velocity.x += nx * impulse;
      this.ball.velocity.z += nz * impulse;

      if (!this.tilted && flipper.pressed && Math.abs(flipper.angularVelocity) > 0.2) {
        this.ball.velocity.x += nx * cfg.kick;
        this.ball.velocity.z += nz * cfg.kick;
      }

      this.limitBallSpeed();
      this.emit('flipper-hit', {
        id: cfg.id,
        impact: Math.abs(relativeNormal),
        pressed: Boolean(flipper.pressed)
      });
    }
  }

  checkDrain() {
    if (this.launcher.awaitingLaunch) return;

    const drain = this.config.playfield.drain;
    if (
      this.ball.position.z > drain.z &&
      this.ball.position.x > drain.minX &&
      this.ball.position.x < drain.maxX
    ) {
      this.ball.active = false;
      this.emit('drain');
    }
  }

  checkSafetyBounds() {
    const bounds = this.config.playfield.safetyBounds;
    const p = this.ball.position;

    if (
      p.x < bounds.minX ||
      p.x > bounds.maxX ||
      p.z < bounds.minZ ||
      p.z > bounds.maxZ
    ) {
      this.ball.active = false;
      this.emit('drain', { safetyReset: true });
    }
  }

  limitBallSpeed() {
    const max = this.config.ball.maxSpeed;
    const speed = Math.hypot(this.ball.velocity.x, this.ball.velocity.z);
    if (speed <= max || speed < EPS) return;

    const scale = max / speed;
    this.ball.velocity.x *= scale;
    this.ball.velocity.z *= scale;
  }
}

function moveTowards(current, target, maxDelta) {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

function closestPointOnSegment(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const lengthSq = abx * abx + abz * abz;

  if (lengthSq < EPS) return { x: ax, z: az };

  const t = clamp(((px - ax) * abx + (pz - az) * abz) / lengthSq, 0, 1);
  return { x: ax + abx * t, z: az + abz * t };
}

function normalize2(x, z) {
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}