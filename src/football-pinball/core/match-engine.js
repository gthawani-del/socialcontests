import RAPIER from "@dimforge/rapier3d-compat";
import {
  PHYSICS as P,
  RULE_VERSION,
  MODE_RULES,
  MODE_IDS,
  geometryFor,
  canonicalRules,
  crashValue,
} from "../modes/rules.js";
let initialized;
const quat = (a) => ({ x: 0, y: Math.sin(a / 2), z: 0, w: Math.cos(a / 2) });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const other = (t) => (t === "blue" ? "red" : "blue");
export async function createMatch(options = {}) {
  initialized ??= RAPIER.init();
  await initialized;
  return new MatchEngine(options);
}
export class MatchEngine {
  constructor(options) {
    if (
      !options ||
      typeof options !== "object" ||
      Object.keys(options).some(
        (k) =>
          !["mode", "seed", "difficulty", "format", "opponent"].includes(k),
      )
    )
      throw Error("Invalid match options");
    this.options = Object.freeze({
      mode: "pvp",
      seed: 1,
      difficulty: options.mode === "penalty" ? "pro" : "medium",
      format: "quick",
      opponent: "cpu",
      ...options,
    });
    if (
      !Number.isInteger(this.options.seed) ||
      this.options.seed < 0 ||
      this.options.seed > 4294967295 ||
      !["cpu", "human"].includes(this.options.opponent) ||
      !["easy", "medium", "hard", "rookie", "pro", "elite"].includes(
        this.options.difficulty,
      )
    )
      throw Error("Invalid match options");
    if (!MODE_IDS.includes(this.options.mode)) throw Error("Invalid mode");
    if (!["quick", "classic", "golden"].includes(this.options.format))
      throw Error("Invalid format");
    this.mode = this.options.mode;
    this.maxSpeed = MODE_RULES[this.mode].maxSpeed ?? P.maxSpeed;
    this.ballRadius = MODE_RULES[this.mode].ballRadius || P.ballRadius;
    this.geometry = geometryFor(this.mode);
    this.world = new RAPIER.World({
      x: 0,
      y: -9.81,
      z: this.mode === "pvp" ? 0 : 1.5,
    });
    this.world.timestep = P.step;
    this.world.numSolverIterations = 8;
    this.queue = new RAPIER.EventQueue(true);
    this.names = new Map();
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(3.4, 0.1, 6)
        .setTranslation(0, -0.1, 0)
        .setRestitution(0.35)
        .setFriction(0.015),
    );
    for (const r of this.geometry.rails)
      this.collider(
        RAPIER.ColliderDesc.cuboid(r.hx, r.height / 2, r.hy)
          .setTranslation(r.x, r.height / 2, -r.y)
          .setRestitution(this.mode === "pvp" ? .94 : .85)
          .setFriction(0),
        r,
      );
    for (const sign of [-1, 1])
      this.collider(
        RAPIER.ColliderDesc.cuboid(1.2, 0.08, 0.1)
          .setTranslation(0, 1.28, -sign * 5)
          .setRestitution(0.7),
        { id: `crossbar-${sign}`, type: "rail" },
      );
    for (const r of this.geometry.ramps) {
      const vertices = [],
        indices = [];
      for (let i = 0; i <= r.segments; i++) {
        const t = i / r.segments,
          h = r.entry + r.rise * t * t,
          z = r.length / 2 - r.length * t;
        vertices.push(-r.width / 2, h, z, r.width / 2, h, z);
      }
      for (let i = 0; i < r.segments; i++) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        const t = (i + 0.5) / r.segments,
          h = r.entry + r.rise * t * t;
        for (const side of [-1, 1])
          this.collider(
            RAPIER.ColliderDesc.cuboid(0.01, 0.0375, r.length / r.segments / 2)
              .setTranslation(
                r.x + side * 0.34,
                h + 0.0375,
                -r.y + r.length / 2 - r.length * t,
              )
              .setRestitution(0.2),
            { id: r.id + "-lip-" + side + "-" + i, type: "ramp" },
          );
      }
      this.collider(
        RAPIER.ColliderDesc.trimesh(
          new Float32Array(vertices),
          new Uint32Array(indices),
        )
          .setTranslation(r.x, 0, -r.y)
          .setRestitution(0.15)
          .setFriction(0.02),
        { ...r, type: "ramp" },
      );
    }
    this.boots = this.geometry.boots.map((b) => {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased(),
      );
      const collider = this.collider(
        RAPIER.ColliderDesc.roundCuboid(b.length / 2 - 0.07, 0.06, b.radius - 0.07, 0.07)
          .setTranslation(this.mode === "pvp" ? P.bootOffset * 1.2 : P.bootOffset, P.bootCenterHeight, 0)
          .setRestitution(0.8)
          .setFriction(0.05),
        b,
        body,
      );
      return { ...b, body, collider: collider.handle, angle: b.rest, previousAngle: b.rest,
        pressed: false, strokeTick: -999, cpuStrikeTick: null };
    });
    this.targets = this.geometry.targets.map((t) => {
      const body = t.moving
        ? this.world.createRigidBody(
            RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
              t.x,
              t.height / 2,
              -t.y,
            ),
          )
        : undefined;
      this.collider(
        RAPIER.ColliderDesc.cylinder(t.height / 2, t.radius)
          .setTranslation(
            body ? 0 : t.x,
            body ? 0 : t.height / 2,
            body ? 0 : -t.y,
          )
          .setRestitution(0.9),
        t,
        body,
      );
      return { ...t, baseX: t.x, body };
    });
    this.keepers = (this.mode === "penalty" ? [1] : []).map((sign) => {
      const keeperTuning =
        MODE_RULES.penalty.keeper[this.options.difficulty] ||
        MODE_RULES.penalty.keeper.pro;
      const data = {
        id: `keeper-${sign}`,
        type: "keeper",
        team: sign < 0 ? "blue" : "red",
        sign,
        x: 0,
        y: sign * 4.55,
        width: keeperTuning.width,
        height: 0.7,
        depth: 0.22,
      };
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          0,
          data.height / 2,
          -data.y,
        ),
      );
      this.collider(
        RAPIER.ColliderDesc.cuboid(
          data.width / 2,
          data.height / 2,
          data.depth / 2,
        ).setRestitution(0.9),
        data,
        body,
      );
      return { ...data, body, nextReaction: 0, targetX: 0 };
    });
    this.reset();
  }
  collider(desc, data, body) {
    const c = this.world.createCollider(desc, body);
    this.names.set(c.handle, { ...data });
    return c;
  }
  rng() {
    let x = this.rngState | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rngState = x >>> 0;
    return this.rngState / 4294967296;
  }
  emit(type, payload = {}) {
    this.events.push({
      eventId: ++this.sequence,
      sessionId: `${RULE_VERSION}-${this.options.seed}`,
      authoritativeSequence: this.sequence,
      tick: this.tick,
      type,
      ruleVersion: RULE_VERSION,
      ...payload,
    });
  }
  reset() {
    if (this.initialized) {
      const next = new MatchEngine(this.options);
      this.dispose();
      Object.assign(this, next);
      return true;
    }
    this.initialized = true;
    for (const b of this.balls || []) this.world.removeRigidBody(b.body);
    this.balls = [];
    this.nextBall = 0;
    this.tick = 0;
    this.activeTicks = 0;
    this.sequence = 0;
    this.events = [];
    this.commands = [];
    this.systemEvents = [];
    this.rngState = Number(this.options.seed) >>> 0 || 1;
    this.state = "ready";
    this.paused = false;
    this.accumulator = 0;
    this.score = { blue: 0, red: 0 };
    this.points = { blue: 0, red: 0 };
    this.result = null;
    this.toss = null;
    this.bottomTeam = "blue";
    this.kickoffTeam = "blue";
    this.lastTeam = "blue";
    this.comboUntil = { blue: 0, red: 0 };
    this.skill = { blue: false, red: false };
    this.passHits = { blue: 0, red: 0 };
    this.half = 1;
    this.transitionTick = 0;
    this.durationTicks = 10800;
    this.timeBonuses = 0;
    this.multiballUntil = 0;
    this.rush = false;
    this.rushCharge = 0;
    this.rushLastHit = -999;
    this.shot = { index: 0, total: 5, goals: 0, streak: 0, outcome: null };
    this.shotStart = 0;
    this.shotPerfect = false;
    this.targetHits = new Map();
    this.basePoints = 0;
    this.charge = 0;
    this.lastHitTick = -999;
    this.bankedPoints = 0;
    this.inputOrder = 0;
    this.cpuNext = 0;
    this.pendingBank = false;
    this.restart = null;
    for (const b of this.boots) {
      b.pressed = false;
      b.angle = b.rest;
      b.previousAngle = b.rest;
      b.cpuStrikeTick = null;
      b.team = b.id.startsWith("blue") ? "blue" : "red";
      this.pose(b, true);
    }
    for (const k of this.keepers) {
      k.x = 0;
      k.targetX = 0;
      k.nextReaction = 0;
      k.team = k.sign < 0 ? "blue" : "red";
      k.body.setTranslation({ x: 0, y: k.height / 2, z: -k.y }, true);
    }
    this.emit("MATCH_CREATED");
    return true;
  }
  pose(b, immediate = false) {
    const p = { x: b.x, y: 0, z: -b.y },
      q = quat(b.angle);
    if (immediate) {
      b.body.setTranslation(p, true);
      b.body.setRotation(q, true);
    }
    b.body.setNextKinematicTranslation(p);
    b.body.setNextKinematicRotation(q);
  }
  addBall(x = 0, y = 0, vx = 0, vy = 0, height = this.ballRadius, vheight = 0) {
    const id = `ball-${++this.nextBall}`;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, height, -y)
        .setLinvel(vx, vheight, -vy)
        .setCcdEnabled(true)
        .setLinearDamping(this.mode === "pvp" ? .012 : .02)
        .setCanSleep(false),
    );
    const c = this.collider(
      RAPIER.ColliderDesc.ball(this.ballRadius)
        .setRestitution(this.mode === "pvp" ? .92 : .78)
        .setFriction(0.005)
        .setDensity(1)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      { id, type: "ball" },
      body,
    );
    const ball = {
      id,
      body,
      collider: c.handle,
      previous: { x, y, height },
      lastBootTick: -999,
      stillTicks: 0,
      incomingSpeed: Math.hypot(vx, vy),
      controlTeam: null,
      lastTouch: null,
      lastKick: null,
      bootStrokes: new Map(),
    };
    this.balls.push(ball);
    this.emit("BALL_LAUNCHED", { ballId: id });
    return ball;
  }
  removeBalls() {
    for (const b of this.balls) {
      this.names.delete(b.collider);
      this.world.removeRigidBody(b.body);
    }
    this.balls = [];
  }
  launch() {
    this.restart = null;
    if (this.mode === "penalty") {
      this.removeBalls();
      this.shot.index++;
      this.shot.outcome = null;
      this.shotStart = this.activeTicks;
      this.shotPerfect = false;
      this.addBall(-0.7, -1.5, 0, -1.7);
      this.state = "active";
      this.emit("ATTEMPT_STARTED", { payload: { attempt: this.shot.index } });
      return;
    }
    if (this.mode !== "pvp") {
      this.removeBalls();
      this.addBall(-0.85, -2.5, 1.4, 7);
      this.state = "active";
      return;
    }
    this.removeBalls();
    const direction = this.kickoffTeam === this.bottomTeam ? -1 : 1;
    const serve = MODE_RULES.pvp.kickoff,
      x = (this.rng() < .5 ? -1 : 1) *
        (serve.minOffset + this.rng() * (serve.maxOffset - serve.minOffset));
    // Seeded service lanes vary the rally while keeping replay deterministic.
    this.addBall(x, 0, -Math.sign(x) * serve.lateralSpeed, direction * serve.speed);
    this.state = "active";
    this.emit("KICKOFF", { actorId: this.kickoffTeam });
  }
  record(command) {
    if (this.commands.length >= P.maxCommands) return false;
    this.commands.push({
      tick: this.tick,
      sequence: ++this.inputOrder,
      command: { ...command },
    });
    return true;
  }
  command(c) {
    if (
      !c ||
      typeof c !== "object" ||
      !["start", "flip", "bank", "pause", "resume", "choose"].includes(c.type)
    )
      return false;
    if (
      c.type === "flip" &&
      (!this.boots.some((b) => b.id === c.id) || typeof c.pressed !== "boolean")
    )
      return false;
    if (
      c.type === "start" &&
      c.call !== undefined &&
      !["heads", "tails"].includes(c.call)
    )
      return false;
    if (
      c.type === "choose" &&
      (!["kickoff", "side"].includes(c.choice) ||
        (c.choice === "side" && !["near", "far"].includes(c.value)))
    )
      return false;
    if (this.state === "ended" || !this.record(c)) return false;
    if (c.type === "start") return this.startInternal(c.call || "heads");
    if (c.type === "flip") {
      if (this.state !== "active" || this.paused) return false;
      return this.flip(c.id, c.pressed);
    }
    if (c.type === "pause" || c.type === "resume") {
      this.paused = c.type === "pause";
      this.releaseInternal();
      this.accumulator = 0;
      this.emit(this.paused ? "PAUSED" : "RESUMED");
      return true;
    }
    if (c.type === "choose") return this.choose(c.choice, c.value);
    if (c.type === "bank") {
      if (
        this.mode !== "crash" ||
        this.state !== "active" ||
        this.paused ||
        this.pendingBank
      )
        return false;
      this.pendingBank = true;
      this.emit("BANK_REQUESTED");
      return true;
    }
    return false;
  }
  start(call = "heads") {
    return this.command({ type: "start", call });
  }
  startInternal(call) {
    if (this.state !== "ready") return false;
    if (this.mode !== "pvp") {
      this.state = "countdown";
      this.transitionTick = this.tick + 180;
      return true;
    }
    const face = this.rng() < 0.5 ? "heads" : "tails";
    this.toss = { face, call, winner: face === call ? "blue" : "red" };
    this.state = "toss";
    this.transitionTick = this.tick + 120;
    this.emit("TOSS_DECIDED", { payload: { ...this.toss } });
    return true;
  }
  choose(choice, value) {
    if (this.state !== "choice") return false;
    const winner = this.toss.winner;
    if (choice === "side") {
      this.bottomTeam = value === "near" ? winner : other(winner);
      this.kickoffTeam = other(winner);
    } else this.kickoffTeam = winner;
    this.assignSides();
    this.state = "countdown";
    this.transitionTick = this.tick + 180;
    this.emit("TOSS_CHOICE", {
      actorId: winner,
      payload: {
        choice,
        value,
        bottomTeam: this.bottomTeam,
        kickoffTeam: this.kickoffTeam,
      },
    });
    return true;
  }
  assignSides() {
    for (const b of this.boots)
      b.team = b.y < 0 ? this.bottomTeam : other(this.bottomTeam);
    for (const k of this.keepers) {
      k.team = k.sign < 0 ? this.bottomTeam : other(this.bottomTeam);
      for (const data of this.names.values())
        if (data.id === k.id) data.team = k.team;
    }
    for (const t of this.targets.filter((t) => t.type === "player")) {
      t.team = t.homeSign < 0 ? this.bottomTeam : other(this.bottomTeam);
      for (const data of this.names.values())
        if (data.id === t.id) data.team = t.team;
    }
  }
  setInput(id, pressed) {
    return this.command({ type: "flip", id, pressed: Boolean(pressed) });
  }
  flip(id, pressed) {
    const b = this.boots.find((b) => b.id === id);
    if (!b || b.pressed === pressed) return false;
    b.pressed = pressed;
    if (pressed) b.strokeTick = this.tick;
    this.emit(pressed ? "FLIP_DOWN" : "FLIP_UP", { actorId: id });
    return true;
  }
  releaseInternal() {
    for (const b of this.boots) {
      this.flip(b.id, false);
      b.cpuStrikeTick = null;
    }
  }
  releaseInputs() {
    for (const b of this.boots) if (b.pressed) this.setInput(b.id, false);
  }
  setPaused(v) {
    return this.command({ type: v ? "pause" : "resume" });
  }
  pause() {
    return this.setPaused(true);
  }
  advance(dt) {
    if (this.paused || !Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += Math.min(dt, P.maxFrame);
    while (this.accumulator + 1e-10 >= P.step) {
      this.step();
      this.accumulator = Math.max(0, this.accumulator - P.step);
    }
  }
  cpu() {
    if (this.mode !== "pvp") return;
    if (this.options.opponent !== "cpu") return;
    const tuning = MODE_RULES.pvp.cpu;
    const boots = this.boots.filter((b) => b.team === "red");
    // Release on physics ticks, independently of the difficulty's reaction delay.
    // A fresh stroke needs both a release and enough time to return to rest.
    for (const b of boots) {
      if (b.pressed && this.tick - b.strokeTick >= tuning.holdTicks)
        this.flip(b.id, false);
      if (b.cpuStrikeTick !== null && this.tick >= b.cpuStrikeTick) {
        const ball = this.balls[0];
        b.cpuStrikeTick = null;
        if (ball && !b.pressed && this.tick - b.strokeTick >= tuning.holdTicks + tuning.returnTicks) {
          const p = ball.body.translation(), local = this.bootApproach(b, p);
          if (p.y < P.bootCenterHeight + P.bootHalfHeight + this.ballRadius &&
              local.along > -this.ballRadius && local.along < b.length + this.ballRadius &&
              local.front >= -this.ballRadius && local.front < b.radius + this.ballRadius + .45)
            this.flip(b.id, true);
        }
      }
    }
    if (this.tick < this.cpuNext) return;
    const level = tuning.reactionTicks[this.options.difficulty] || 20;
    const aim = tuning.aim[this.options.difficulty] || tuning.aim.medium;
    this.cpuNext = this.tick + level;
    const ball = this.balls[0];
    if (!ball) return;
    const p = ball.body.translation(), v = ball.body.linvel();
    for (const b of boots) {
      if (b.pressed || b.cpuStrikeTick !== null || this.tick - b.strokeTick < tuning.holdTicks + tuning.returnTicks)
        continue;
      const local = this.bootApproach(b, p),
        closing = v.x * local.nx - v.z * local.ny,
        distance = local.front - b.radius - this.ballRadius,
        contactTime = distance <= .08 ? 0 : closing < -.1 ? distance / -closing : Infinity,
        along = local.along + (v.x * Math.cos(b.rest) - v.z * Math.sin(b.rest)) * contactTime;
      // Commit to an imperfect estimate instead of continuously correcting a
      // scheduled swing with exact physics data. Seeded errors preserve replay.
      if (contactTime <= .5 && local.front >= -this.ballRadius &&
          along >= .1 && along <= b.length &&
          this.rng() > aim.missChance) {
        const predictionError = (this.rng() * 2 - 1) * aim.predictionError;
        const timingError = (this.rng() * 2 - 1) * aim.timingError;
        const estimate = contactTime * (1 + predictionError) - .035 + timingError;
        b.cpuStrikeTick = this.tick + Math.max(1, Math.round(estimate / P.step));
      }
    }
  }

  bootApproach(boot, p) {
    const spin = Math.sign(boot.active - boot.rest),
      nx = -Math.sin(boot.rest) * spin, ny = Math.cos(boot.rest) * spin,
      dx = p.x - boot.x, dy = -p.z - boot.y;
    return { nx, ny, front: dx * nx + dy * ny,
      along: dx * Math.cos(boot.rest) + dy * Math.sin(boot.rest) };
  }

  strikePvpBoot(ball, boot) {
    const tuning = MODE_RULES.pvp.bootShot;
    if (!boot.pressed || this.tick - boot.strokeTick > tuning.strokeTicks ||
        boot.angle === boot.previousAngle || ball.bootStrokes.get(boot.id) === boot.strokeTick)
      return false;
    const p = ball.body.translation(), local = this.bootApproach(boot, p);
    // A backside rebound or a ball over the boot is not a powered shot.
    if (local.front < 0 || p.y > P.bootCenterHeight + P.bootHalfHeight + this.ballRadius)
      return false;
    const spin = Math.sign(boot.active - boot.rest), v = ball.body.linvel(),
      planar = Math.hypot(v.x, v.z),
      forward = planar > .1 && v.z * Math.sign(boot.y) / planar > .55,
      x = forward ? v.x / planar : -Math.sin(boot.angle) * spin,
      z = forward ? v.z / planar : -Math.cos(boot.angle) * spin,
      speed = Math.min(this.maxSpeed, (tuning.minSpeed +
        (tuning.maxSpeed - tuning.minSpeed) * clamp(local.along / boot.length, 0, 1)) *
        (this.skill[boot.team] ? 1.25 : 1));
    ball.body.setLinvel({ x: x * speed, y: tuning.lift, z: z * speed }, true);
    ball.bootStrokes.set(boot.id, boot.strokeTick);
    ball.lastBootTick = this.tick;
    ball.stillTicks = 0;
    this.lastTeam = boot.team;
    ball.reception = null;
    ball.controlTeam = boot.team;
    ball.lastKick = { team: boot.team, id: boot.id, tick: this.tick };
    this.award(boot.team, MODE_RULES.pvp.points.boot);
    ball.pendingBootStrike = { id: boot.id, team: boot.team };
    if (this.skill[boot.team]) { ball.superShot = true; this.skill[boot.team] = false; }
    if (this.tick - boot.strokeTick <= 4) {
      this.award(boot.team, MODE_RULES.pvp.points.perfect);
      this.emit("PERFECT_KICK", { ballId: ball.id, actorId: boot.team });
    }
    return true;
  }

  restartPvp(ball, team, reason) {
    this.emit("BALL_OUT_OF_PLAY", { ballId: ball.id, actorId: team, payload: { reason } });
    this.removeBalls();
    this.releaseInternal();
    this.kickoffTeam = team;
    this.restart = { reason, team };
    this.state = "relaunch";
    this.transitionTick = this.tick + MODE_RULES.pvp.restartTicks;
  }

  movePlayers() {
    if (this.mode !== "pvp") return;
    const ball = this.balls[0], p = ball?.body.translation(), v = ball?.body.linvel();
    for (const t of this.targets.filter(t => t.type === "player")) {
      const tuning = MODE_RULES.pvp.playerMotion[t.role];
      const receiving = p && Math.hypot(p.x - t.x, p.z + t.y) < t.radius + this.ballRadius + .3;
      const targetX = t.baseX + clamp((p ? p.x + v.x * .08 : 0) * tuning.tracking, -tuning.range, tuning.range);
      // Settle for the actual reception; players cannot chase, overlap or
      // sweep into a nearby ball with an unbounded kinematic impulse.
      if (!receiving) t.x += clamp(targetX - t.x, -tuning.speed * P.step, tuning.speed * P.step);
      t.body.setNextKinematicTranslation({ x: t.x, y: t.height / 2, z: -t.y });
    }
  }

  moveKeepers() {
    const ball = this.balls[0];
    for (const k of this.keepers) {
      if (ball && this.tick >= k.nextReaction) {
        const tuning =
          MODE_RULES.penalty.keeper[this.options.difficulty] ||
          MODE_RULES.penalty.keeper.pro;
        const reaction =
          { easy: 32, medium: 20, hard: 10, rookie: 38, pro: 22, elite: 10 }[
            this.options.difficulty
          ] || 20;
        k.nextReaction = this.tick + reaction;
        const p = ball.body.translation(),
          v = ball.body.linvel();
        k.targetX = clamp(
          p.x +
            v.x * 0.08 +
            (this.rng() - 0.5) * tuning.error,
          -0.66,
          0.66,
        );
      }
      const speed =
        (MODE_RULES.penalty.keeper[this.options.difficulty] ||
          MODE_RULES.penalty.keeper.pro).speed;
      k.x += clamp(k.targetX - k.x, -speed * P.step, speed * P.step);
      k.body.setNextKinematicTranslation({ x: k.x, y: k.height / 2, z: -k.y });
    }
  }
  award(team, value) {
    this.points[team] +=
      value * (this.comboUntil[team] > this.activeTicks ? 2 : 1);
  }
  rushAward(value) {
    const combo = Math.min(5, 1 + this.rushCharge),
      phase = this.rush ? 2 : 1;
    this.points.blue += value * combo * phase;
  }
  activateMultiball() {
    if (this.activeTicks < this.multiballUntil) return false;
    this.multiballUntil = this.activeTicks + 1200;
    while (this.balls.length < 3)
      this.addBall(
        (this.balls.length - 1) * 0.6,
        0,
        (this.balls.length % 2 ? 1 : -1) * 2,
        5,
      );
    this.emit("MULTIBALL_STARTED", { payload: { until: this.multiballUntil } });
    return true;
  }
  collision(ball, data) {
    this.emit("COLLISION", { ballId: ball.id, targetId: data.id });
    if (ball.reception && ball.reception.id !== data.id) ball.reception = null;
    if (this.mode === "pvp" && (data.type === "player" || this.boots.some(b => b.id === data.id))) {
      const team = this.boots.find(b => b.id === data.id)?.team || data.team;
      ball.lastTouch = { team, id: data.id, tick: this.tick };
      // An opposing physical touch ends a controlled pass; rail contacts do not.
      if (ball.controlTeam !== team) ball.controlTeam = null;
    }
    if (
      this.mode === "arcade-rush" &&
      ["small", "advanced", "time", "multiball", "super"].includes(data.type)
    ) {
      const key = ball.id + ":" + data.id,
        last = this.targetHits.get(key);
      if (last !== undefined && this.tick - last < 30) return;
      this.targetHits.set(key, this.tick);
      this.rushCharge = Math.min(4, this.rushCharge + 1);
      this.rushLastHit = this.activeTicks;
      if (data.type === "time") {
        if (this.timeBonuses < 2) {
          this.timeBonuses++;
          this.durationTicks = Math.min(14400, this.durationTicks + 1200);
          this.emit("TIME_EXTENDED", {
            payload: { seconds: 10, count: this.timeBonuses },
          });
        }
      } else if (data.type === "multiball") this.activateMultiball();
      else if (data.type === "super") this.skill.blue = true;
      else this.rushAward(data.type === "small" ? 50 : 100);
      this.emit("TARGET_HIT", { ballId: ball.id, targetId: data.id });
      return;
    }
    if (this.mode === "crash" && MODE_RULES.crash.points[data.type]) {
      const key = ball.id + ":" + data.id,
        last = this.targetHits.get(key);
      if (last !== undefined && this.tick - last < 30) return;
      this.targetHits.set(key, this.tick);
      this.basePoints += MODE_RULES.crash.points[data.type];
      this.charge = Math.min(5, this.charge + 1);
      this.lastHitTick = this.activeTicks;
      this.emit("TARGET_HIT", {
        ballId: ball.id,
        targetId: data.id,
        payload: { basePoints: this.basePoints, charge: this.charge },
      });
      return;
    }
    const boot = this.boots.find((b) => b.id === data.id);
    if (boot) {
      this.lastTeam = boot.team;
      if (this.mode === "pvp") {
        this.strikePvpBoot(ball, boot);
        return;
      }
      ball.pendingBootStrike = {id:boot.id,team:boot.team};
      if (
        boot.pressed &&
        this.tick - boot.strokeTick <= 16 &&
        this.tick - ball.lastBootTick > 10
      ) {
        ball.lastBootTick = this.tick;
        const v = ball.body.linvel(),
          boost = this.skill[boot.team] ? 1.25 : 1;
        const planar = Math.hypot(v.x, v.z) || 1;
        ball.body.setLinvel(
          { x: v.x * boost, y: Math.max(v.y, 3.4), z: v.z * boost },
          true,
        );
        if (this.skill[boot.team]) {
          ball.superShot = true;
          this.skill[boot.team] = false;
        }
        if (this.tick - boot.strokeTick <= 8) {
          if (this.mode === "penalty") this.shotPerfect = true;
          if (this.mode === "arcade-rush") this.rushAward(150);
          this.emit("PERFECT_KICK", { ballId: ball.id, actorId: boot.team });
        }
      }
      return;
    }
    if (data.type === "keeper") {
      this.emit("KEEPER_SAVE", { actorId: data.team, ballId: ball.id });
      this.pendingSave = true;
      return;
    }
    if (data.type === "player") {
      // Moving collider metadata uses the same current position as the renderer.
      data = this.targets.find(t => t.id === data.id) || data;
      this.lastTeam = data.team;
      const p = ball.body.translation(), v = ball.body.linvel();
      const attack = -data.homeSign;
      const receiver = this.targets.find(t => t.type === 'player' && t.team === data.team &&
        t.role === (data.role === 'defender' ? 'midfielder' : 'striker'));
      const destination = data.role === 'striker' || !receiver
        ? {x: data.x > 0 ? -.62 : .62, y: attack * P.goalPlane}
        : receiver;
      const dx=destination.x-p.x, dz=-destination.y-p.z, length=Math.hypot(dx,dz)||1;
      const nx=p.x-data.x, nz=p.z+data.y, normal=Math.hypot(nx,nz)||1;
      const facing=(nx*dx+nz*dz)/(normal*length);
      const last=this.targetHits.get(data.id)??-999;
      // Teammates receive their own passes from either side instead of firing a
      // rear-face rebound back at their own net. Opposing rear hits still rebound.
      const friendly = ball.controlTeam === data.team;
      if (friendly || (facing >= .15 && this.tick-last >= MODE_RULES.pvp.playerKickCooldown)) {
        const reward = this.tick-last >= MODE_RULES.pvp.playerKickCooldown;
        this.targetHits.set(data.id,this.tick);
        // Role speeds are floors, not brakes. Use pre-contact speed so the
        // collision solver cannot turn a strong boot shot into a weak pass.
        const speed=Math.min(this.maxSpeed, Math.max(MODE_RULES.pvp.playerKickSpeed[data.role],
          ball.incomingSpeed, Math.hypot(v.x,v.z)));
        // A rear reception clears around the player's outside shoulder. Never
        // teleport through the body or aim a pass back through its cylinder.
        const rear = friendly && facing < .15;
        const outX = rear ? Math.sign(nx) || Math.sign(dx) || 1 : dx / length,
          outZ = rear ? data.homeSign * Math.min(.35, Math.abs(nx) / (Math.abs(nz) + .01) * .8) : dz / length,
          outLength = Math.hypot(outX, outZ);
        ball.body.setLinvel({x:outX/outLength*speed,y:Math.max(0,Math.min(v.y,.65)),z:outZ/outLength*speed},true);
        ball.reception = rear ? { id:data.id, team:data.team, destination:{x:destination.x,z:-destination.y}, speed, until:this.tick+36 } : null;
        ball.controlTeam = data.team;
        ball.lastKick = { team: data.team, id: data.id, tick: this.tick };
        if (reward) {
          this.award(data.team,20);
          this.emit('PLAYER_KICK',{actorId:data.team,targetId:data.id,ballId:ball.id,payload:{role:data.role,receiverId:data.role==='striker'?null:receiver?.id||null,speed,friendlyReception:friendly}});
        }
      }
      return;
    }
    if (["skill", "pass", "combo"].includes(data.type)) {
      this.emit("TARGET_HIT", {
        actorId: this.lastTeam,
        targetId: data.id,
        ballId: ball.id,
      });
      if (data.type === "skill") {
        this.skill[this.lastTeam] = true;
        this.award(this.lastTeam, 75);
      }
      if (data.type === "pass") {
        this.passHits[this.lastTeam]++;
        this.award(this.lastTeam, 50);
        const p = ball.body.translation(),
          v = ball.body.linvel(),
          target = this.targets.find((t) => t.type === "player" && t.team === this.lastTeam && t.role === "striker");
        if (target) {
          const dx = target.x - p.x,
            dz = -target.y - p.z,
            n = Math.hypot(dx, dz) || 1,
            s = this.mode === "pvp"
              ? Math.min(this.maxSpeed, Math.max(MODE_RULES.pvp.playerKickSpeed.midfielder,
                  ball.incomingSpeed, Math.hypot(v.x, v.z)))
              : Math.min(10, Math.max(4, Math.hypot(v.x, v.z)));
          ball.body.setLinvel(
            { x: (dx / n) * s, y: v.y, z: (dz / n) * s },
            true,
          );
        }
      }
      if (data.type === "combo") {
        this.comboUntil[this.lastTeam] = this.activeTicks + 600;
        this.emit("COMBO_CHANGED", {
          actorId: this.lastTeam,
          payload: { multiplier: 2 },
        });
      }
    }
  }
  goal(ball, sign, crossing = {}) {
    if (this.mode === "arcade-rush") {
      if (sign > 0) {
        this.rushAward(500 + (ball.superShot ? 300 : 0));
        this.emit("GOAL_SCORED", { actorId: "blue", ballId: ball.id });
      } else {
        this.emit("BALL_DRAINED", { ballId: ball.id });
        this.world.removeRigidBody(ball.body);
        this.names.delete(ball.collider);
        this.balls = this.balls.filter((b) => b !== ball);
        this.rushCharge = 0;
        if (!this.balls.length) {
          this.state = "relaunch";
          this.transitionTick = this.tick + 120;
          this.releaseInternal();
        }
      }
      return;
    }
    if (this.mode === "penalty") {
      if (sign < 0) return this.resolveShot("miss");
      return this.resolveShot("goal", crossing);
    }
    if (this.mode === "crash") {
      if (sign < 0) {
        this.emit("BALL_DRAINED", { ballId: ball.id });
        if (this.pendingBank)
          this.emit("BANK_REJECTED", {
            payload: { reason: "same-tick drain" },
          });
        this.pendingBank = false;
        this.end("drained");
        return;
      }
      return;
    }
    const team = sign > 0 ? this.bottomTeam : other(this.bottomTeam);
    this.score[team]++;
    this.award(team, 500 + (ball.superShot ? 250 : 0));
    this.emit("GOAL_SCORED", { actorId: team, ballId: ball.id, payload: {
      lastTouch: ball.lastTouch, lastKick: ball.lastKick,
      defendingLastTouch: !!ball.lastTouch && ball.lastTouch.team !== team,
    } });
    this.releaseInternal();
    this.removeBalls();
    if (
      this.options.format === "golden" ||
      (this.options.format === "quick" && this.score[team] >= 3)
    )
      return this.end("goals", team);
    this.kickoffTeam = other(team);
    this.state = "relaunch";
    this.transitionTick = this.tick + MODE_RULES.pvp.restartTicks;
  }
  resolveShot(outcome, crossing = {}) {
    if (this.state !== "active") return;
    this.shot.outcome = outcome;
    if (outcome === "goal") {
      this.shot.goals++;
      this.shot.streak++;
      this.score.blue++;
      const corner = Math.abs(crossing.x) >= 0.6 && crossing.height >= 0.78,
        precision = Math.abs(crossing.x) >= 0.6;
      const points =
        500 +
        (corner ? 250 : 0) +
        (precision ? 150 : 0) +
        (this.shotPerfect ? 100 : 0) +
        (this.shot.streak === 3 ? 100 : 0) +
        (this.shot.streak === 5 ? 200 : 0);
      this.points.blue += points;
      this.emit("GOAL_SCORED", {
        actorId: "blue",
        ballId: this.balls[0]?.id,
        payload: { corner, precision, points },
      });
    } else this.shot.streak = 0;
    this.emit("ATTEMPT_RESOLVED", { payload: { ...this.shot } });
    this.removeBalls();
    this.releaseInternal();
    if (this.shot.index >= 5) {
      this.end("five-attempts");
      return;
    }
    this.state = "relaunch";
    this.transitionTick = this.tick + 120;
  }
  end(reason, winner = null) {
    this.state = "ended";
    this.paused = false;
    this.releaseInternal();
    for (const b of this.balls) b.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.result = {
      reason,
      winner,
      bankedPoints: this.bankedPoints,
      basePoints: this.basePoints,
      shot: { ...this.shot },
      score: { ...this.score },
      points: { ...this.points },
      tick: this.tick,
    };
    this.emit("ROUND_ENDED", { payload: this.result });
  }
  forfeit(team) {
    if (!["blue", "red"].includes(team) || this.state === "ended") return false;
    this.systemEvents.push({
      tick: this.tick,
      sequence: ++this.inputOrder,
      type: "forfeit",
      team,
    });
    this.emit("FORFEIT", { actorId: team });
    this.end("forfeit", other(team));
    return true;
  }
  step() {
    if (
      this.paused ||
      this.state === "ended" ||
      this.state === "ready" ||
      this.state === "choice"
    )
      return;
    this.tick++;
    if (
      this.mode === "arcade-rush" &&
      ["active", "relaunch"].includes(this.state)
    ) {
      this.activeTicks++;
      const final = this.durationTicks - this.activeTicks <= 1800;
      if (final && !this.rush) this.emit("FINAL_RUSH");
      this.rush = final;
      if (this.activeTicks >= this.durationTicks) return this.end("time");
    }
    if (this.tick >= P.maxTicks) {
      const winner = this.mode === "pvp" && this.score.blue !== this.score.red
        ? (this.score.blue > this.score.red ? "blue" : "red") : null;
      return this.end("time-limit", winner);
    }
    if (this.state === "toss" && this.tick >= this.transitionTick) {
      this.state = "choice";
      if (this.toss.winner === "red" && this.options.opponent === "cpu")
        this.choose("kickoff", "red");
      return;
    }
    if (["countdown", "relaunch", "halftime"].includes(this.state)) {
      if (this.tick >= this.transitionTick) this.launch();
      return;
    }
    if (this.state !== "active") return;
    if (this.mode !== "arcade-rush") this.activeTicks++;
    if (this.mode === "arcade-rush") {
      if (this.activeTicks - this.rushLastHit >= 600) this.rushCharge = 0;
      for (const target of this.targets.filter((t) => t.body)) {
        const phase = (this.activeTicks % 480) / 480;
        target.x = 1.4 + (0.5 - Math.abs(phase - 0.5)) * 1.6;
        target.body.setNextKinematicTranslation({
          x: target.x,
          y: target.height / 2,
          z: -target.y,
        });
      }
      if (this.multiballUntil && this.activeTicks >= this.multiballUntil) {
        while (this.balls.length > 1) {
          const b = this.balls.pop();
          this.names.delete(b.collider);
          this.world.removeRigidBody(b.body);
        }
        this.multiballUntil = 0;
        this.emit("MULTIBALL_ENDED");
      }
    }
    this.pendingSave = false;
    if (this.mode === "crash" && this.activeTicks - this.lastHitTick >= 600)
      this.charge = 0;
    this.cpu();
    this.movePlayers();
    this.moveKeepers();
    for (const b of this.boots) {
      b.previousAngle = b.angle;
      const target = b.pressed ? b.active : b.rest;
      b.angle += clamp(
        target - b.angle,
        -(b.pressed ? 15 : 9) * P.step,
        (b.pressed ? 15 : 9) * P.step,
      );
      this.pose(b);
    }
    for (const b of this.balls) {
      const p = b.body.translation();
      if (b.reception) {
        const reception=b.reception, t=this.targets.find(t=>t.id===reception.id);
        const dx=reception.destination.x-p.x, dz=reception.destination.z-p.z, length=Math.hypot(dx,dz)||1;
        const nx=p.x-t.x,nz=p.z+t.y,along=(nx*dx+nz*dz)/length;
        const clearance=nx*nx+nz*nz-Math.min(0,along)**2;
        // Complete the automatic pass once its path clears the receiving
        // player's body. Motion up to this point is real, with no teleport.
        if (along>=0 || clearance>(t.radius+this.ballRadius+.04)**2) {
          const v=b.body.linvel();
          b.body.setLinvel({x:dx/length*reception.speed,y:v.y,z:dz/length*reception.speed},true);
          b.reception=null;
        } else if (this.tick>=reception.until) b.reception=null;
      }
      b.previous = { x: p.x, y: -p.z, height: p.y };
      const velocity = b.body.linvel();
      b.incomingSpeed = Math.hypot(velocity.x, velocity.z);
      // A two-ended pinball table rolls gently down from midfield toward
      // each defending end. Without this, balls orbit midfield out of reach.
      if (this.mode === "pvp" && p.y < this.ballRadius + .06 && Math.abs(p.z) > .2) {
        const v = b.body.linvel();
        b.body.setLinvel({ ...v, z: v.z + Math.sign(p.z) * MODE_RULES.pvp.tableSlope * P.step }, true);
      }
    }
    this.world.step(this.queue);
    this.queue.drainCollisionEvents((a, b, started) => {
      if (!started) return;
      const ball = this.balls.find((v) => v.collider === a || v.collider === b),
        data = this.names.get(ball?.collider === a ? b : a);
      if (ball && data) this.collision(ball, data);
    });
    // A ball can already be touching a stationary boot when the user presses.
    // Collision-start events alone miss that legitimate swing.
    if (this.mode === "pvp") for (const ball of this.balls) for (const boot of this.boots) {
      if (!boot.pressed || boot.angle === boot.previousAngle) continue;
      let touching = false;
      this.world.contactPair(this.world.getCollider(ball.collider), this.world.getCollider(boot.collider),
        manifold => { if (manifold.numSolverContacts() > 0) touching = true; });
      if (touching) this.strikePvpBoot(ball, boot);
    }
    for (const b of [...this.balls]) {
      const p = b.body.translation(),
        v = b.body.linvel();
      // Sustained contacts with rounded kinematic boots can keep injecting lift
      // after the collision-start event. Limit ascent every PvP physics tick.
      if (this.mode === "pvp" && v.y > MODE_RULES.pvp.maxBallLift) {
        v.y = MODE_RULES.pvp.maxBallLift;
        b.body.setLinvel(v, true);
      }
      // Recompute after limiting lift; using the old 3D speed robbed the
      // horizontal shot of power even when its new speed was already legal.
      const speed = Math.hypot(v.x, v.y, v.z);
      // A resting ball must not consume a timed round. This never applies to Crash.
      if (this.mode === "pvp") {
        const rally = MODE_RULES.pvp.rally;
        b.stillTicks = Math.hypot(v.x, v.z) < rally.slowSpeed ? b.stillTicks + 1 : 0;
        // A slow ball bouncing on top of a boot never reaches the pitch's
        // height threshold. Give genuine flight longer, then free that trap.
        const recoveryTicks = p.y < this.ballRadius + .15 ? rally.recoveryTicks : rally.airRecoveryTicks;
        const outward = v.z * Math.sign(p.z),
          crossingX = outward > .5 ? p.x + v.x * (P.goalPlane + this.ballRadius - Math.abs(p.z)) / outward : Infinity,
          rollingIntoGoal = Math.abs(p.z) > 3.7 && outward > .5 && Math.abs(crossingX) + this.ballRadius <= P.goalHalfWidth;
        // An already goal-bound slow shot completes under normal physics.
        if (b.stillTicks >= recoveryTicks && !rollingIntoGoal) {
          // Once trapped behind the boots, let the defending side receive a
          // fresh ball. A recovery impulse here must never create an own goal.
          if (Math.abs(p.z) > 3.7) {
            this.restartPvp(b, p.z > 0 ? this.bottomTeam : other(this.bottomTeam), "trapped-ball");
            break;
          }
          const planar = Math.hypot(v.x, v.z),
            dx = planar > .05 ? v.x / planar : p.x > 0 ? -.35 : .35,
            dz = Math.abs(p.z) > 2.5 ? -Math.sign(p.z) : planar > .05 ? v.z / planar : p.z > 0 ? -1 : 1,
            length = Math.hypot(dx, dz);
          b.body.setLinvel({ x: dx / length * rally.recoverySpeed, y: .6,
            z: dz / length * rally.recoverySpeed }, true);
          b.stillTicks = 0;
          this.emit("BALL_UNSTUCK", { ballId: b.id });
        }
      } else if (this.mode === "arcade-rush") {
        b.stillTicks = speed < .06 ? b.stillTicks + 1 : 0;
        if (b.stillTicks >= 480) {
          b.stillTicks = 0;
          b.body.setLinvel({x: p.x > 0 ? -1.6 : 1.6, y: 1.5, z: p.z > 0 ? -2 : 2}, true);
          this.emit("BALL_UNSTUCK", {ballId:b.id});
        }
      }
      if (speed > this.maxSpeed)
        b.body.setLinvel(
          {
            x: (v.x * this.maxSpeed) / speed,
            y: (v.y * this.maxSpeed) / speed,
            z: (v.z * this.maxSpeed) / speed,
          },
          true,
        );
      if (b.pendingBootStrike) {
        const velocity=b.body.linvel(), speed=Math.hypot(velocity.x,velocity.z);
        this.emit('BOOT_STRIKE',{actorId:b.pendingBootStrike.team,targetId:b.pendingBootStrike.id,ballId:b.id,payload:{power:Math.round(Math.min(1,speed/this.maxSpeed)*100)}});
        b.pendingBootStrike=null;
      }
      for (const sign of [-1, 1]) {
        const plane =
            (sign < 0 ? Math.abs(this.geometry.nearPlane) : P.goalPlane) +
            this.ballRadius,
          y = -p.z;
        if (b.previous.y * sign <= plane && y * sign > plane) {
          const f = (sign * plane - b.previous.y) / (y - b.previous.y),
            x = b.previous.x + f * (p.x - b.previous.x),
            height = b.previous.height + f * (p.y - b.previous.height);
          if (
            Math.abs(x) + this.ballRadius <= P.goalHalfWidth &&
            height + this.ballRadius <= P.goalHeight
          ) {
            this.goal(b, sign, { x, height });
            break;
          }
        }
        if (this.mode === "pvp" && y * sign > plane) {
          this.restartPvp(b, sign < 0 ? this.bottomTeam : other(this.bottomTeam), "goal-line");
          break;
        }
      }
      if (this.state !== "active") break;
    }
    if (this.mode === "penalty" && this.state === "active" && this.pendingSave)
      this.resolveShot("save");
    if (
      this.mode === "penalty" &&
      this.state === "active" &&
      this.activeTicks - this.shotStart >= 960
    )
      this.resolveShot("timeout");
    if (this.state === "active") {
      for (const b of [...this.balls]) {
        const p = b.body.translation();
        if (
          Math.abs(p.x) > this.geometry.halfWidth + 0.4 ||
          -p.z > 6.2 ||
          -p.z < this.geometry.nearPlane - 1.2 ||
          p.y < -0.5
        ) {
          if (this.mode !== "pvp") this.emit("BALL_OUT_OF_PLAY", { ballId: b.id });
          if (this.mode === "penalty") this.resolveShot("miss");
          else if (this.mode === "crash") {
            this.pendingBank = false;
            this.end("drained");
          } else if (this.mode === "arcade-rush") this.goal(b, -1);
          else {
            this.restartPvp(b, other(this.lastTeam), "sideline");
          }
          break;
        }
      }
    }
    if (this.mode === "crash" && this.state === "active" && this.pendingBank) {
      this.pendingBank = false;
      this.bankedPoints = crashValue(
        this.basePoints,
        this.activeTicks,
        this.charge,
      ).bank;
      this.emit("BANK_ACCEPTED", { payload: { points: this.bankedPoints } });
      this.end("banked");
    }
    if (
      this.mode === "pvp" &&
      this.options.format === "classic" &&
      this.state === "active" &&
      this.activeTicks >= this.half * 14400
    ) {
      if (this.half === 1) {
        this.half = 2;
        this.bottomTeam = other(this.bottomTeam);
        this.assignSides();
        this.removeBalls();
        this.releaseInternal();
        this.state = "halftime";
        this.transitionTick = this.tick + 360;
        this.emit("HALFTIME");
      } else
        this.end(
          "time",
          this.score.blue === this.score.red
            ? null
            : this.score.blue > this.score.red
              ? "blue"
              : "red",
        );
    }
  }
  canonicalRules() {
    return canonicalRules(this.mode);
  }
  exportReplay() {
    return {
      version: RULE_VERSION,
      options: { ...this.options },
      commands: this.commands.map((c) => ({ ...c, command: { ...c.command } })),
      systemEvents: this.systemEvents.map((e) => ({ ...e })),
      finalTick: this.tick,
      finalState: this.snapshot(),
      ledger: structuredClone(this.events),
      result: structuredClone(this.result),
    };
  }
  snapshot() {
    return {
      ruleVersion: RULE_VERSION,
      mode: this.mode,
      state: this.state,
      paused: this.paused,
      tick: this.tick,
      activeTicks: this.activeTicks,
      shot: { ...this.shot },
      basePoints: this.basePoints,
      bankedPoints: this.bankedPoints,
      potentialBank:
        this.mode === "crash"
          ? crashValue(this.basePoints, this.activeTicks, this.charge).bank
          : 0,
      multiplier:
        this.mode === "crash"
          ? crashValue(this.basePoints, this.activeTicks, this.charge)
              .multiplier / 10000
          : 1,
      combo:
        this.mode === "crash"
          ? crashValue(this.basePoints, this.activeTicks, this.charge).combo /
            10000
          : this.mode === "arcade-rush"
            ? Math.min(5, 1 + this.rushCharge)
            : 1,
      rush: this.rush,
      timeBonuses: this.timeBonuses,
      multiballRemaining: Math.max(
        0,
        (this.multiballUntil - this.activeTicks) / 120,
      ),
      remaining:
        this.mode === "arcade-rush"
          ? Math.max(0, (this.durationTicks - this.activeTicks) / 120)
          : this.mode === "penalty"
            ? Math.max(0, 8 - (this.activeTicks - this.shotStart) / 120)
            : this.options.format === "classic"
              ? Math.max(0, (28800 - this.activeTicks) / 120)
              : null,
      half: this.half,
      score: { ...this.score },
      points: { ...this.points },
      bottomTeam: this.bottomTeam,
      defendingEnd: {
        [this.bottomTeam]: "near",
        [other(this.bottomTeam)]: "far",
      },
      kickoffTeam: this.kickoffTeam,
      restart: this.restart ? { ...this.restart } : null,
      toss: this.toss ? { ...this.toss } : null,
      result: this.result,
      balls: this.balls.map((b) => {
        const p = b.body.translation(),
          v = b.body.linvel();
        return {
          id: b.id,
          x: p.x,
          y: -p.z,
          height: p.y,
          vx: v.x,
          vy: -v.z,
          vheight: v.y,
          radius: this.ballRadius,
        };
      }),
      boots: this.boots.map(({ body, ...b }) => ({ ...b })),
      targets: this.targets.map(({ body, ...t }) => ({ ...t })),
      keepers: this.keepers.map(({ body, ...k }) => ({ ...k })),
      geometry: this.geometry,
      events: this.events.slice(-128),
    };
  }
  dispose() {
    this.queue.free();
    this.world.free();
  }
}
