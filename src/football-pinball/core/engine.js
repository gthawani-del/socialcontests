import RAPIER from '@dimforge/rapier2d-compat';
import { FOUNDATION as RULES, BOOTS, RAILS } from '../modes/foundation.js';

let initialized;
export async function createEngine() {
  initialized ??= RAPIER.init();
  await initialized;
  return new FootballEngine();
}

class FootballEngine {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: 0 });
    this.world.timestep = RULES.step;
    this.world.numSolverIterations = 8;
    this.queue = new RAPIER.EventQueue(true);
    this.names = new Map();
    this.tick = 0;
    this.sequence = 0;
    this.events = [];
    this.accumulator = 0;
    this.state = 'ready';
    this.score = { blue: 0, red: 0 };
    this.serves = 0;
    this.paused = false;
    for (const rail of RAILS) {
      const collider = this.world.createCollider(RAPIER.ColliderDesc.cuboid(rail.hx, rail.hy)
        .setTranslation(rail.x, rail.y).setRestitution(0.85).setFriction(0));
      this.names.set(collider.handle, rail.id);
    }
    this.boots = BOOTS.map(config => {
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
      // Rapier capsules point along local Y. Rotate the collider so length follows local X.
      const collider = this.world.createCollider(RAPIER.ColliderDesc.capsule(
        RULES.bootLength / 2 - RULES.bootRadius, RULES.bootRadius,
      ).setRotation(Math.PI / 2).setRestitution(0.8).setFriction(0.05), body);
      this.names.set(collider.handle, config.id);
      return { ...config, body, angle: config.rest, previousAngle: config.rest, pressed: false };
    });
    this.ball = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setCcdEnabled(true).setLinearDamping(0.025).setCanSleep(false));
    const collider = this.world.createCollider(RAPIER.ColliderDesc.ball(RULES.ballRadius)
      .setRestitution(0.9).setFriction(0).setDensity(1)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), this.ball);
    this.names.set(collider.handle, 'ball-1');
    this.ballCollider = collider.handle;
    this.reset();
  }

  emit(type, payload = {}) {
    this.events.push({ eventId: ++this.sequence, tick: this.tick, ruleVersion: RULES.version,
      type, ballId: 'ball-1', ...payload });
    if (this.events.length > 512) this.events.shift();
  }

  poseBoot(boot, immediate = false) {
    const center = { x: boot.x + Math.cos(boot.angle) * RULES.bootLength / 2,
      y: boot.y + Math.sin(boot.angle) * RULES.bootLength / 2 };
    if (immediate) {
      boot.body.setTranslation(center, true);
      boot.body.setRotation(boot.angle, true);
    }
    boot.body.setNextKinematicTranslation(center);
    boot.body.setNextKinematicRotation(boot.angle);
  }

  setInput(id, pressed) {
    const boot = this.boots.find(b => b.id === id);
    if (!boot || (pressed && (this.paused || this.state === 'goal'))) return;
    if (boot.pressed !== pressed) {
      boot.pressed = pressed;
      this.emit(pressed ? 'FLIP_DOWN' : 'FLIP_UP', { actorId: id });
    }
  }

  releaseInputs() { for (const boot of this.boots) this.setInput(boot.id, false); }

  setPaused(value) {
    this.paused = Boolean(value);
    this.releaseInputs();
    this.accumulator = 0;
    this.emit(this.paused ? 'PAUSED' : 'RESUMED');
  }

  reset() {
    this.score = { blue: 0, red: 0 };
    this.state = 'ready';
    this.paused = false;
    this.tick = 0;
    this.sequence = 0;
    this.events = [];
    this.serves = 0;
    this.accumulator = 0;
    for (const boot of this.boots) {
      boot.pressed = false;
      boot.angle = boot.previousAngle = boot.rest;
      this.poseBoot(boot, true);
    }
    this.placeBall({ x: 0, y: 0 }, { x: 0, y: 0 });
    this.emit('MATCH_CREATED');
  }

  placeBall(position, velocity) {
    this.ball.setTranslation(position, true);
    this.ball.setLinvel(velocity, true);
    this.ball.setAngvel(0, true);
    this.previousBall = { ...position };
  }

  serve() {
    if (this.state === 'active' || this.paused) return false;
    const direction = this.serves++ % 2 ? 1 : -1;
    this.releaseInputs();
    this.placeBall({ x: -0.95, y: 0 }, { x: 0, y: direction * 5 });
    this.state = 'active';
    this.accumulator = 0;
    this.emit('BALL_LAUNCHED');
    return true;
  }

  advance(seconds) {
    if (this.paused || !Number.isFinite(seconds) || seconds <= 0) return;
    this.accumulator += Math.min(seconds, RULES.maxFrame);
    while (this.accumulator + 1e-10 >= RULES.step) {
      this.step();
      this.accumulator = Math.max(0, this.accumulator - RULES.step);
    }
  }

  step() {
    if (this.paused) return;
    this.tick++;
    this.previousBall = { ...this.ball.translation() };
    for (const boot of this.boots) {
      boot.previousAngle = boot.angle;
      const target = boot.pressed ? boot.active : boot.rest;
      const maxDelta = (boot.pressed ? 15 : 9) * RULES.step;
      boot.angle += Math.max(-maxDelta, Math.min(maxDelta, target - boot.angle));
      this.poseBoot(boot);
    }
    // Keep collider poses current before starting a serve, without simulating an idle ball.
    if (this.state !== 'active') {
      for (const boot of this.boots) this.poseBoot(boot, true);
      return;
    }
    this.world.step(this.queue);
    this.queue.drainCollisionEvents((a, b, started) => {
      if (started && (a === this.ballCollider || b === this.ballCollider)) {
        this.emit('COLLISION', { targetId: this.names.get(a === this.ballCollider ? b : a) });
      }
    });
    const velocity = this.ball.linvel();
    const speed = Math.hypot(velocity.x, velocity.y);
    if (speed > RULES.maxSpeed) this.ball.setLinvel({
      x: velocity.x * RULES.maxSpeed / speed, y: velocity.y * RULES.maxSpeed / speed,
    }, true);
    const p = this.ball.translation();
    for (const sign of [-1, 1]) {
      const plane = RULES.goalPlane + RULES.ballRadius;
      if (this.previousBall.y * sign <= plane && p.y * sign > plane) {
        // Interpolate the crossing coordinate: side entry cannot award a goal.
        const fraction = (sign * plane - this.previousBall.y) / (p.y - this.previousBall.y);
        const x = this.previousBall.x + fraction * (p.x - this.previousBall.x);
        if (Math.abs(x) + RULES.ballRadius <= RULES.goalHalfWidth) {
          const team = sign > 0 ? 'blue' : 'red';
          this.score[team]++;
          this.state = 'goal';
          this.releaseInputs();
          this.ball.setLinvel({ x: 0, y: 0 }, true);
          this.emit('GOAL_SCORED', { actorId: team });
          break;
        }
      }
    }
  }

  snapshot() {
    return { tick: this.tick, state: this.state, paused: this.paused, score: { ...this.score },
      ball: { ...this.ball.translation() }, velocity: { ...this.ball.linvel() },
      boots: this.boots.map(({ id, angle, pressed }) => ({ id, angle, pressed })),
      events: this.events.map(event => ({ ...event })) };
  }

  dispose() { this.queue.free(); this.world.free(); }
}
