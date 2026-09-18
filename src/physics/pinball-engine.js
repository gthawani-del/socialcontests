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
    if (flipper) flipper.pressed = Boolean(pressed);
  }

  getFlipper(id) {
    return this.flippers.get(id);
  }

  resetBall() {
    const { start, initialVelocity } = this.config.ball;
    this.ball.position.x = start[0];
    this.ball.position.z = start[1];
    this.ball.velocity.x = initialVelocity[0];
    this.ball.velocity.z = initialVelocity[1];
    this.ball.active = true;
    this.accumulator = 0;
    this.emit('reset', { position: { ...this.ball.position } });
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
    if (!this.ball.active) return;

    const gravity = this.config.physics.gravity;
    const damping = Math.exp(-this.config.physics.linearDamping * dt);

    this.ball.velocity.x += gravity[0] * dt;
    this.ball.velocity.z += gravity[1] * dt;
    this.ball.velocity.x *= damping;
    this.ball.velocity.z *= damping;
    this.limitBallSpeed();

    this.ball.position.x += this.ball.velocity.x * dt;
    this.ball.position.z += this.ball.velocity.z * dt;

    for (const wall of this.config.walls) {
      const hit = this.resolveSegmentCollision(
        wall.a,
        wall.b,
        this.config.ball.radius,
        wall.restitution
      );
      if (hit && hit.impact > 0.35 && this.canEmit(this.wallHitAt, wall.id, 0.045)) {
        this.emit('wall-hit', { id: wall.id, impact: hit.impact });
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
        this.emit('slingshot-hit', { id: slingshot.id, impact: hit.impact });
      }
    }

    for (const flipper of this.flippers.values()) {
      this.resolveFlipperCollision(flipper);
    }

    this.checkDrain();
    this.checkSafetyBounds();
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
      const target = (flipper.pressed ? cfg.activeAngleDeg : cfg.restAngleDeg) * DEG;
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

      if (flipper.pressed && Math.abs(flipper.angularVelocity) > 0.2) {
        this.ball.velocity.x += nx * cfg.kick;
        this.ball.velocity.z += nz * cfg.kick;
      }

      this.limitBallSpeed();
      this.emit('flipper-hit', { id: cfg.id, impact: Math.abs(relativeNormal) });
    }
  }

  checkDrain() {
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}