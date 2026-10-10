import { PinballEngine } from '../../physics/pinball-engine.js';

// Opt-in prototype: planar free play with a constrained, height-aware ramp.
// The existing game continues to use PinballEngine directly.
export class StadiumEngine extends PinballEngine {
  constructor(config) {
    super(config);
    this.routes = (config.ramps || []).map(route => {
      let length = 0;
      const points = route.points.map((p, i, all) => {
        if (i) length += Math.hypot(p.x - all[i - 1].x, p.z - all[i - 1].z);
        return { ...p, distance: length };
      });
      return { ...route, points, length };
    });
    this.deliveryVariation = null;
    this.baseFlipperRadii = new Map(
      [...this.flippers.entries()].map(([id, state]) => [id, state.config.radius])
    );
    this.difficulty = 'MEDIUM';
  }

  setDifficulty(difficulty = 'MEDIUM', config = {}) {
    this.difficulty = String(difficulty || 'MEDIUM').toUpperCase();
    const multiplier = Math.max(.85, Math.min(1.35, Number(config.batRadiusMultiplier ?? 1)));
    for (const [id, state] of this.flippers.entries()) {
      const base = this.baseFlipperRadii.get(id) ?? state.config.radius;
      state.config.radius = base * multiplier;
    }
  }

  resetBall() {
    super.resetBall();
    this.ramp = null;
    this.ball.height = this.config.launcher.launchPath?.[0]?.height || 0;
    this.completedRoute = null;
    this.frozen = false;
    this.deliveryVariation = null;
    this.launchRoute = null;
  }

  freezeBall() {
    super.freezeBall();
    this.frozen = true;
    if (this.ramp) this.ramp.speed = 0;
  }

  releaseLaunch(options = null) {
    const released = super.releaseLaunch(options);
    if (!released) return false;

    const profiles = this.config.launcher.deliveryTypes || {};
    const type = this.launcher.deliveryType || 'PACE';
    const profile = profiles[type] || profiles.PACE || {};
    const speedMultiplier = Math.max(.75, Math.min(1.2, Number(profile.speedMultiplier ?? 1)));

    this.ball.velocity.x *= speedMultiplier;
    this.ball.velocity.z *= speedMultiplier;
    this.limitBallSpeed();
    this.deliveryVariation = {
      type,
      profile,
      movementScale: Math.max(.5, Math.min(1.6, Number(options?.movementScale ?? 1))),
      bounced: false
    };
    const path = this.config.launcher.launchPath;
    if (path?.length > 1) this.launchRoute = {path, segment:0, progress:0, speed:Math.hypot(this.ball.velocity.x,this.ball.velocity.z)};
    return true;
  }

  advanceLaunchRoute(dt) {
    const r = this.launchRoute; let remaining = r.speed * dt;
    while (remaining > 0 && r.segment < r.path.length - 1) {
      const a = r.path[r.segment], b = r.path[r.segment+1];
      const length = Math.hypot(b.x-a.x,b.z-a.z);
      const travel = Math.min(remaining,length-r.progress); r.progress += travel; remaining -= travel;
      const t = r.progress / length;
      Object.assign(this.ball.position,{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
      this.ball.height = a.height+(b.height-a.height)*t;
      Object.assign(this.ball.velocity,{x:(b.x-a.x)/length*r.speed,z:(b.z-a.z)/length*r.speed});
      if (r.progress >= length - 1e-9) {r.segment++;r.progress=0;}
    }
    if (r.segment >= r.path.length - 1) {
      this.launchRoute = null; this.launcher.inLane = false; this.ball.height = 0;
      this.launcher.deliveryTarget = this.config.launcher.bowlingLines[this.launcher.deliveryLine].target;
      this.launcher.deliveryGuideActive = true;
      this.emit('launcher-exit',{line:this.launcher.deliveryLine, deliveryType:this.launcher.deliveryType, target:[...this.launcher.deliveryTarget]});
    }
    this.emit('physics:step');
  }

  applyDeliveryVariation(dt) {
    const state = this.deliveryVariation;
    if (
      !state ||
      this.launcher.awaitingLaunch ||
      this.launcher.inLane ||
      this.launcher.deliveryGuideActive ||
      !this.ball.active ||
      this.ball.velocity.z <= 0
    ) return;

    const profile = state.profile || {};
    const z = this.ball.position.z;
    const startZ = Number(profile.startZ ?? 1.55);
    const stopZ = Number(profile.stopZ ?? 2.32);
    if (z < startZ || z > stopZ) return;

    const movementScale = Number(state.movementScale ?? 1);
    const swingAcceleration = Number(profile.swingAcceleration ?? 0) * movementScale;
    if (swingAcceleration) this.ball.velocity.x += swingAcceleration * dt;

    const bounceZ = Number(profile.bounceZ ?? 1.66);
    if (!state.bounced && z >= bounceZ) {
      state.bounced = true;
      this.ball.velocity.x += Number(profile.bounceKickX ?? 0) * movementScale;
      this.ball.velocity.z *= Number(profile.bounceSpeedMultiplier ?? 1);
      this.limitBallSpeed();
      this.emit('delivery-bounce', {
        type: state.type,
        x: this.ball.position.x,
        z: this.ball.position.z,
        velocity: { ...this.ball.velocity }
      });
    }
  }

  isDeliveryZoneEligible(zone) {
    if (zone.requiresRoute) return this.completedRoute === zone.requiresRoute;
    if (zone.entryZ === undefined) return true;
    const before = this.previousPosition, after = this.ball.position;
    if (!before || before.z <= zone.entryZ || after.z > zone.entryZ) return false;
    const t = (before.z - zone.entryZ) / (before.z - after.z);
    const x = before.x + (after.x - before.x) * t;
    return Math.abs(x - zone.position[0]) <= zone.entryHalfWidth - this.config.ball.radius;
  }

  integrateSubstep(dt) {
    if (this.frozen) return;
    if (this.launchRoute) return this.advanceLaunchRoute(dt);
    if (this.ramp) return this.advanceRamp(dt);
    const before = { ...this.ball.position };
    this.previousPosition = before;
    super.integrateSubstep(dt);
    this.applyDeliveryVariation(dt);
    if (this.frozen || !this.ball.active || this.launcher.inLane || this.launcher.deliveryGuideActive) return;
    for (const route of this.routes) {
      const start = route.points[0];
      // Capture only a forward crossing of the mouth, never a side/top crossing.
      if (before.z <= start.z || this.ball.position.z > start.z || this.ball.velocity.z >= 0) continue;
      const fraction = (before.z - start.z) / (before.z - this.ball.position.z);
      const x = before.x + (this.ball.position.x - before.x) * fraction;
      if (Math.abs(x - start.x) > route.halfWidth - this.config.ball.radius) continue;
      const sample = this.sampleRoute(route, 0);
      const speed = this.ball.velocity.x * sample.tx + this.ball.velocity.z * sample.tz;
      if (speed <= 0) continue;
      this.ramp = { route, distance: 0, speed };
      this.completedRoute = null;
      this.placeOnRamp(sample);
      this.emit('ramp-enter', { id: route.id });
      break;
    }
  }

  sampleRoute(route, distance) {
    const i = route.points.findIndex(p => p.distance >= distance);
    const index = Math.max(1, i < 0 ? route.points.length - 1 : i);
    const a = route.points[index - 1], b = route.points[index];
    const length = b.distance - a.distance;
    const t = Math.max(0, Math.min(1, (distance - a.distance) / length));
    return {
      x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t,
      height: a.height + (b.height - a.height) * t,
      tx: (b.x - a.x) / length, tz: (b.z - a.z) / length,
      slope: (b.height - a.height) / length
    };
  }

  placeOnRamp(sample) {
    this.ball.position.x = sample.x;
    this.ball.position.z = sample.z;
    this.ball.height = sample.height;
    this.ball.velocity.x = sample.tx * this.ramp.speed;
    this.ball.velocity.z = sample.tz * this.ramp.speed;
  }

  advanceRamp(dt) {
    const state = this.ramp, route = state.route;
    if (this.completedRoute) return;
    const sample = this.sampleRoute(route, state.distance);
    const gravity = this.config.physics.gravity;
    const acceleration = gravity[0] * sample.tx + gravity[1] * sample.tz - 9.81 * sample.slope;
    state.speed = (state.speed + acceleration * dt) * Math.exp(-this.config.physics.linearDamping * dt);
    state.distance += state.speed * dt;
    this.placeOnRamp(this.sampleRoute(route, state.distance));
    if (state.distance < 0) {
      this.ball.position.z = route.points[0].z + .001;
      this.ball.height = 0;
      this.ramp = null;
      this.emit('ramp-exit', { id: route.id, reason: 'ROLLBACK' });
    } else if (state.distance >= route.length) {
      this.completedRoute = route.id;
      this.emit('ramp-complete', { id: route.id });
    }
    this.emit('physics:step');
  }
}
