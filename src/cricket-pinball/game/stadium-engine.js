import {BOWLERS,LENGTHS,normalizeBowling,normalizePitchTarget,bowlingDispersion} from './bowling-rules.js';
import { PinballEngine } from '../../physics/pinball-engine.js';

// Opt-in prototype: planar free play with a constrained, height-aware ramp.
// The existing game continues to use PinballEngine directly.
export class StadiumEngine extends PinballEngine {
  constructor(config, {random=Math.random} = {}) {
    super(config);
    this.random=random;
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
    this.shotMode = 'GROUND';
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
    this.rampExitFlight = false;
    this.frozen = false;
    this.deliveryVariation = null;
    this.launchRoute = null;
    this.verticalVelocity = 0;
    this.deliveryFlight = false;
    this.shotFlight = null;
    this.deliveryShotMode = null;
    this.fielded = false;
  }

  freezeBall() {
    super.freezeBall();
    this.frozen = true;
    if (this.ramp) this.ramp.speed = 0;
  }

  releaseLaunch(options = null) {
    if (options?.bowler) {
      const selection=normalizeBowling({...options,type:options.deliveryType,power:options.charge});
      options={...options,...selection,deliveryType:selection.type,charge:selection.power};
    }
    const released = super.releaseLaunch(options);
    if (!released) return false;

    const profiles = this.config.launcher.deliveryTypes || {};
    const type = this.launcher.deliveryType || 'PACE';
    const profile = {...(profiles[type] || profiles.PACE || {})};
    const accuracy=options?.bowler?bowlingDispersion({...options,type:options.deliveryType,power:options.charge},this.random):{x:0,z:0,risk:0};
    const length=LENGTHS[options?.length];
    if(length) {profile.bounceZ=length.bounceZ+accuracy.z;profile.startZ=Math.min(profile.startZ??1.55,length.bounceZ-.2);}
    const target=normalizePitchTarget(options?.target);
    if(target) {target.x+=accuracy.x;target.z+=accuracy.z;profile.bounceZ=target.z;profile.startZ=Math.min(profile.startZ??1.55,target.z-.2);}
    this.config.launcher.deliveryGuide.releaseZ=length?Math.min(1.55,length.bounceZ-.11):1.55;
    const speedMultiplier = Math.max(.55, Math.min(1.3, Number(profile.speedMultiplier ?? 1)*(BOWLERS[options?.bowler]?.speed ?? 1)));

    this.ball.velocity.x *= speedMultiplier;
    this.ball.velocity.z *= speedMultiplier;
    this.limitBallSpeed();
    this.deliveryVariation = {
      type,
      profile,
      accuracy,
      target,
      length:options?.length || null,
      bowler:options?.bowler || null,
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
      const target=this.deliveryVariation?.target;
      const preset=this.config.launcher.bowlingLines[this.launcher.deliveryLine].target;
      this.launcher.deliveryTarget = target ? [target.x,target.z] : [preset[0]+(this.deliveryVariation?.accuracy.x||0),preset[1]];
      this.launcher.deliveryGuideActive = !target;
      this.beginDeliveryFlight();
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
    if (!state.bounced && swingAcceleration) this.ball.velocity.x += swingAcceleration * dt;
  }

  beginDeliveryFlight() {
    if(this.deliveryVariation?.target) {
      const flight=this.aimDeliveryFlight(this.deliveryVariation.target);
      Object.assign(this.ball.velocity,flight.velocity);
      this.verticalVelocity=9.81*flight.time/2;
      this.deliveryFlight=true;
      return;
    }
    // Predict time to the pitching length with the same forward acceleration,
    // damping and friction as the table. Height is then integrated under gravity.
    const target = Number(this.deliveryVariation?.profile.bounceZ ?? 1.66);
    const dt = this.fixedStep / this.config.physics.collisionSubsteps;
    let z = this.ball.position.z, speed = Math.hypot(this.ball.velocity.x, this.ball.velocity.z), time = 0;
    while (z < target && time < 2) {
      speed = Math.min(this.config.ball.maxSpeed, Math.max(0,
        (speed + this.config.physics.gravity[1] * dt) * Math.exp(-this.config.physics.linearDamping * dt)
        - this.config.physics.rollingFriction * dt));
      z += speed * dt; time += dt;
    }
    this.verticalVelocity = 9.81 * time / 2;
    this.deliveryFlight = true;
  }

  aimDeliveryFlight(target) {
    // Solve the launch direction against the same planar integration as free play.
    // Compensate for swing before release; never move the ball to the target at impact.
    const dt=this.fixedStep/this.config.physics.collisionSubsteps;
    const physics=this.config.physics, profile=this.deliveryVariation.profile;
    const speed=Math.hypot(this.ball.velocity.x,this.ball.velocity.z);
    const predict=angle=>{
      const initial={x:Math.sin(angle)*speed,z:Math.cos(angle)*speed};
      let {x,z}=this.ball.position,vx=initial.x,vz=initial.z,time=0;
      while(z<target.z && time<3) {
        const beforeZ=z,beforeX=x;
        if(z>=profile.startZ && z<=(profile.stopZ??2.32))vx+=(profile.swingAcceleration||0)*this.deliveryVariation.movementScale*dt;
        vx=(vx+physics.gravity[0]*dt)*Math.exp(-physics.linearDamping*dt);
        vz=(vz+physics.gravity[1]*dt)*Math.exp(-physics.linearDamping*dt);
        const magnitude=Math.hypot(vx,vz),next=Math.min(this.config.ball.maxSpeed,Math.max(0,magnitude-physics.rollingFriction*dt));
        vx*=next/magnitude;vz*=next/magnitude;
        x+=vx*dt;z+=vz*dt;time+=dt;
        if(z>=target.z) {const t=(target.z-beforeZ)/(z-beforeZ);x=beforeX+(x-beforeX)*t;time-=dt*(1-t);}
      }
      return {x,time,velocity:initial};
    };
    let low=-.65,high=.65,flight;
    for(let i=0;i<24;i++){const angle=(low+high)/2;flight=predict(angle);if(flight.x<target.x)low=angle;else high=angle;}
    return flight;
  }

  beginShotFlight(feedback) {
    this.deliveryFlight = false;
    this.ball.height = 0;
    const lofted = (this.deliveryShotMode || this.shotMode) === 'LOFT';
    const quality = Math.max(0, Math.min(1, Number(feedback.quality ?? .5)));
    // A deliberate loft trades distance for height. Poor contact falls short.
    this.verticalVelocity = lofted ? 2.4 + 3.2 * quality : 0;
    if (lofted) {
      const carry = .64 + .36 * quality;
      this.ball.velocity.x *= carry;
      this.ball.velocity.z *= carry;
    }
    this.shotFlight = {lofted, bounced:false, groundContacts:0};
    this.fielded = false;
    return lofted;
  }

  markShotGroundContact(surface) {
    if (!this.shotFlight) return;
    this.shotFlight.bounced = true;
    this.shotFlight.groundContacts = (this.shotFlight.groundContacts || 0) + 1;
    this.emit('shot-ground-contact', {surface, x:this.ball.position.x, z:this.ball.position.z});
  }

  setFieldPosition(id, slotId) {
    if (!this.isAwaitingLaunch() && !this.frozen) return false;
    const fielder=this.config.fielders?.find(f=>f.id===id);
    const slot=this.config.fieldingSlots?.find(s=>s.id===slotId);
    if (!fielder || !slot || this.config.fielders.some(f=>f!==fielder && Math.hypot(f.x-slot.x,f.z-slot.z)<.3)) return false;
    Object.assign(fielder,{x:slot.x,z:slot.z,slotId});
    return true;
  }

  resetFieldPositions() {
    if (!this.isAwaitingLaunch() && !this.frozen) return false;
    for (const f of this.config.fielders || []) {
      const slot=this.config.fieldingSlots.find(s=>s.id===f.id);
      Object.assign(f,{x:slot.x,z:slot.z,slotId:slot.id});
    }
    return true;
  }

  beforeTableCollisions() {
    if (!this.shotFlight || this.frozen || this.ramp) return;
    this.checkFielders(this.previousPosition, this.previousHeight);
    if (this.frozen) return false;
    const b=this.config.boundary, p=this.ball.position, a=this.previousPosition;
    if (!b || !this.shotFlight.lofted || p.z>b.maxZ) return;
    const value=p=>p.x*p.x/(b.radiusX*b.radiusX)+p.z*p.z/(b.radiusZ*b.radiusZ);
    if (value(a)<=1 && value(p)>1) {
      this.emit('shot-boundary', {outcome:this.shotFlight.lofted && !this.shotFlight.bounced ? 'SIX':'FOUR',
        reason:this.shotFlight.lofted && !this.shotFlight.bounced ? 'AERIAL_SIX':'GROUND_BOUNDARY',
        height:this.ball.height, groundContacts:this.shotFlight.groundContacts});
      if (this.frozen) return false;
    }
  }

  shouldCollideWithWall(wall) {
    if (!this.shotFlight || this.ramp) return true;
    if (this.shotFlight.lofted && wall.id.startsWith('stadium-boundary-') && this.ball.position.z<=this.config.boundary.maxZ) return false;
    // Raised balls clear the low gate structures; grounded shots retain pinball geometry.
    return !(this.ball.height > .55 && !wall.id.startsWith('stadium-boundary-'));
  }

  advanceShotHeight(dt) {
    if (!this.rampExitFlight && (!this.shotFlight?.lofted || this.shotFlight.bounced)) return;
    this.ball.height += this.verticalVelocity*dt - 4.905*dt*dt;
    this.verticalVelocity -= 9.81*dt;
    if (this.ball.height <= 0 && this.verticalVelocity < 0) {
      this.ball.height = 0; this.verticalVelocity = 0; this.rampExitFlight = false; this.markShotGroundContact('PITCH');
    }
  }

  checkFielders(before, beforeHeight) {
    if (!this.shotFlight || this.fielded || this.frozen || this.ramp || this.launcher.inLane) return;
    const after=this.ball.position, dx=after.x-before.x, dz=after.z-before.z;
    for (const fielder of this.config.fielders || []) {
      const t=Math.max(0,Math.min(1,((fielder.x-before.x)*dx+(fielder.z-before.z)*dz)/(dx*dx+dz*dz || 1)));
      const distance=Math.hypot(before.x+t*dx-fielder.x,before.z+t*dz-fielder.z);
      const height=beforeHeight+(this.ball.height-beforeHeight)*t;
      if (distance > fielder.radius+this.config.ball.radius || height > fielder.reach) continue;
      const caught=this.shotFlight.lofted && !this.shotFlight.bounced && height>0 && !(this.shotFlight.groundContacts > 0);
      // Intercept at the fielder, with no random dismissal roll.
      this.fielded=true;
      this.emit('fielder-intercept',{fielderId:fielder.id,caught,height});
      break;
    }
  }

  advanceDeliveryHeight(dt) {
    if (!this.deliveryFlight) return;
    this.ball.height += this.verticalVelocity * dt - .5 * 9.81 * dt * dt;
    this.verticalVelocity -= 9.81 * dt;
    if (this.ball.height > 0 || this.verticalVelocity >= 0) return;
    this.ball.height = 0;
    const state = this.deliveryVariation;
    if (state && !state.bounced) {
      state.bounced = true;
      const before = { ...this.ball.velocity };
      this.ball.velocity.x += Number(state.profile.bounceKickX ?? 0) * state.movementScale;
      this.ball.velocity.z *= Number(state.profile.bounceSpeedMultiplier ?? 1);
      this.limitBallSpeed();
      this.verticalVelocity = Math.min(LENGTHS[state.length]?.rebound ?? 1.05, -this.verticalVelocity * .5);
      this.emit('delivery-bounce', { type: state.type, x: this.ball.position.x, z: this.ball.position.z,
        height: 0, beforeVelocity: before, velocity: { ...this.ball.velocity } });
    } else {
      this.verticalVelocity = 0;
      this.deliveryFlight = false;
    }
  }

  resolveFlipperCollision(flipper) {
    // Ball height is its lower surface above the pitch; the bat blade is low.
    if (this.ball.height > (flipper.config.contactHeight ?? .06)) return;
    super.resolveFlipperCollision(flipper);
  }

  isDeliveryZoneEligible(zone) {
    if (this.shotFlight?.lofted && !this.shotFlight.bounced) return false;
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
    const beforeHeight = this.ball.height;
    this.previousHeight = beforeHeight;
    this.advanceShotHeight(dt);
    this.advanceDeliveryHeight(dt);
    this.applyDeliveryVariation(dt);
    super.integrateSubstep(dt);

    if (this.frozen || !this.ball.active || this.launcher.inLane || this.launcher.deliveryGuideActive) return;
    if (this.shotFlight?.lofted && !this.shotFlight.bounced) return;
    for (const route of this.routes) {
      const start = route.points[0];
      if (this.ball.height > start.height + this.config.ball.radius) continue;
      // Capture only a forward crossing of the mouth, never a side/top crossing.
      if (before.z <= start.z || this.ball.position.z > start.z || this.ball.velocity.z >= 0) continue;
      const fraction = (before.z - start.z) / (before.z - this.ball.position.z);
      const x = before.x + (this.ball.position.x - before.x) * fraction;
      if (Math.abs(x - start.x) > route.halfWidth - this.config.ball.radius) continue;
      const sample = this.sampleRoute(route, 0);
      const speed = this.ball.velocity.x * sample.tx + this.ball.velocity.z * sample.tz;
      if (speed <= 0) continue;
      this.markShotGroundContact('RAMP');
      this.ramp = { route, distance: 0, speed };
      this.deliveryFlight = false;
      this.verticalVelocity = 0;
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

  releaseCompletedRamp(routeId) {
    if (this.frozen || !this.ramp || this.completedRoute !== routeId || this.ramp.route.id !== routeId) return false;
    const { route, speed } = this.ramp;
    // Leave the raised deck with its existing momentum; ramp contact already
    // marks the shot as bounced, so this flight cannot become a catch or aerial six.
    this.verticalVelocity = speed * this.sampleRoute(route, route.length).slope;
    this.rampExitFlight = true;
    this.ramp = null;
    this.completedRoute = null;
    this.emit('ramp-exit', { id: routeId, reason: 'UNQUALIFIED_SCORE' });
    return true;
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
