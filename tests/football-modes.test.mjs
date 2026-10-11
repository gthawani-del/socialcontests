import test from "node:test";
import assert from "node:assert/strict";
import { createMatch } from "../src/football-pinball/core/match-engine.js";
const steps = (e, n) => {
  for (let i = 0; i < n; i++) e.step();
};
async function setup(options = {}) {
  const e = await createMatch({ opponent: "human", ...options });
  e.start();
  steps(e, 120);
  if (e.state === "choice") e.command({ type: "choose", choice: "kickoff" });
  steps(e, e.mode === "pvp" ? 180 : 60);
  return e;
}
function place(
  e,
  { x = 0, y = 0, height = 0.13, vx = 0, vy = 0, vheight = 0 } = {},
) {
  const b = e.balls[0];
  b.body.setTranslation({ x, y: height, z: -y }, true);
  b.body.setLinvel({ x: vx, y: vheight, z: -vy }, true);
}
test("3D PvP toss call, four boots, ball floor, start and bounded physics", async () => {
  const e = await setup();
  try {
    assert.equal(e.state, "active");
    assert.equal(e.toss.call, "heads");
    assert.equal(e.toss.winner, e.toss.face === "heads" ? "blue" : "red");
    assert.equal(e.boots.length, 4);
    steps(e, 60);
    const s = e.snapshot();
    assert(s.balls[0].height > 0.1);
    assert(s.balls[0].height < 0.3);
    assert.equal(s.defendingEnd.blue, "near");
  } finally {
    e.dispose();
  }
});
for (const id of ["blue-left", "blue-right", "red-left", "red-right"])
  test(`3D ${id} physical contact and loft`, async () => {
    const e = await setup();
    try {
      const b = e.boots.find((b) => b.id === id),
        sign = b.y < 0 ? 1 : -1;
      place(e, {
        x: b.x + Math.cos(b.rest) * 0.95,
        y: b.y + Math.sin(b.rest) * 0.95 + sign * 0.31,
        height: 0.15,
      });
      e.setInput(id, true);
      steps(e, 10);
      assert(e.events.some((v) => v.type === "COLLISION" && v.targetId === id));
      assert(e.balls[0].body.translation().y > 0.15);
      assert(-e.balls[0].body.linvel().z * sign > 0);
    } finally {
      e.dispose();
    }
  });
test("whole-ball goal crossing scores once and golden ends", async () => {
  const e = await setup({ format: "golden" });
  try {
    place(e, { x: 0.72, y: 4.94, vy: 3, height: 0.3 });
    steps(e, 4);
    assert.equal(e.score.blue, 0);
    steps(e, 10);
    assert.equal(e.score.blue, 1);
    assert.equal(e.state, "ended");
    steps(e, 100);
    assert.equal(e.events.filter((v) => v.type === "GOAL_SCORED").length, 1);
  } finally {
    e.dispose();
  }
});
test("above crossbar is not goal and keeper physical collision emits save", async () => {
  const e = await setup();
  try {
    place(e, { x: 0, y: 4.9, vy: 3, height: 1.7 });
    steps(e, 15);
    assert.equal(e.score.blue, 0);
    place(e, { x: 0, y: 4.2, vy: 5, height: 0.13 });
    steps(e, 10);
    assert(e.events.some((v) => v.type === "KEEPER_SAVE"));
  } finally {
    e.dispose();
  }
});
test("classic half switches team ends, final timer and forfeit terminal", async () => {
  const e = await setup({ format: "classic" });
  try {
    e.activeTicks = 14399;
    e.step();
    assert.equal(e.state, "halftime");
    assert.equal(e.snapshot().defendingEnd.blue, "far");
    steps(e, 360);
    assert.equal(e.state, "active");
    e.activeTicks = 28799;
    e.step();
    assert.equal(e.state, "ended");
    assert.equal(e.result.reason, "time");
    assert.equal(e.forfeit("blue"), false);
  } finally {
    e.dispose();
  }
  const f = await setup();
  try {
    assert(f.forfeit("blue"));
    assert.equal(f.result.winner, "red");
  } finally {
    f.dispose();
  }
});
test("pause freezes active time and releases all boots; malformed score commands rejected", async () => {
  const e = await setup();
  try {
    e.setInput("blue-left", true);
    e.pause();
    const s = e.snapshot();
    steps(e, 50);
    assert.deepEqual(e.snapshot(), s);
    assert(e.boots.every((b) => !b.pressed));
    assert.equal(e.command({ type: "goal", score: 999 }), false);
  } finally {
    e.dispose();
  }
});
test("seeded canonical PvP input runs repeat exactly", async () => {
  const a = await setup({ opponent: "cpu", seed: 777 }),
    b = await setup({ opponent: "cpu", seed: 777 });
  try {
    for (const e of [a, b]) {
      const boot = e.boots.find((v) => v.team === "red");
      place(e, { x: boot.x + 0.7, y: boot.y - Math.sign(boot.y) * 0.7 });
    }
    steps(a, 2400);
    steps(b, 2400);
    assert.deepEqual(a.snapshot(), b.snapshot());
    assert(a.events.some((v) => v.type === "FLIP_DOWN"));
  } finally {
    a.dispose();
    b.dispose();
  }
});
import { crashValue } from "../src/football-pinball/modes/rules.js";
import { verifyReplay } from "../src/football-pinball/core/replay.js";
test("Crash fixed-point formula matches exact samples and caps", () => {
  assert.deepEqual(crashValue(1000, 0, 2), {
    multiplier: 10000,
    combo: 12000,
    bank: 1200,
  });
  assert.equal(crashValue(1000, 1200, 0).multiplier, 16000);
  assert.equal(crashValue(1000, 120 * 300, 99).bank, 15000);
  assert.throws(() => crashValue(-1, 0, 0));
});
test("Crash bank ends run, duplicates rejected; pause cannot farm score", async () => {
  const e = await setup({ mode: "crash" });
  try {
    e.basePoints = 1000;
    e.charge = 2;
    e.lastHitTick = e.activeTicks;
    e.pause();
    const value = e.snapshot().potentialBank;
    steps(e, 1000);
    assert.equal(e.snapshot().potentialBank, value);
    assert.equal(e.command({ type: "bank" }), false);
    e.setPaused(false);
    assert(e.command({ type: "bank" }));
    assert.equal(e.command({ type: "bank" }), false);
    e.step();
    assert.equal(e.result.reason, "banked");
    assert(e.result.bankedPoints >= 1200);
    assert.equal(e.command({ type: "bank" }), false);
  } finally {
    e.dispose();
  }
});
test("Crash same-tick physical drain takes priority over queued bank", async () => {
  const e = await setup({ mode: "crash" });
  try {
    e.basePoints = 1000;
    place(e, { x: 0, y: -5.12, vy: -8 });
    e.command({ type: "bank" });
    e.step();
    assert.equal(e.result.reason, "drained");
    assert.equal(e.result.bankedPoints, 0);
    assert.equal(e.events.filter((v) => v.type === "BANK_ACCEPTED").length, 0);
  } finally {
    e.dispose();
  }
});
test("Crash target requires real collision start and no repeated resting score", async () => {
  const e = await setup({ mode: "crash" });
  try {
    const before = e.tick;
    place(e, { x: 0, y: 0.4, vy: 4 });
    steps(e, 20);
    assert(e.events.some((v) => v.type === "TARGET_HIT"));
    const count = e.events.filter(
      (v) =>
        v.type === "TARGET_HIT" && v.targetId === "center" && v.tick > before,
    ).length;
    assert.equal(count, 1);
  } finally {
    e.dispose();
  }
});
test("Crash canonical replay verifies inputs and detects ledger/input/order tampering", async () => {
  const e = await createMatch({ mode: "crash", seed: 23 });
  let replay;
  try {
    e.start();
    steps(e, 220);
    e.setInput("blue-left", true);
    steps(e, 10);
    e.setInput("blue-left", false);
    e.command({ type: "bank" });
    e.step();
    replay = e.exportReplay();
  } finally {
    e.dispose();
  }
  assert.equal((await verifyReplay(replay)).valid, true);
  const ledger = structuredClone(replay);
  ledger.ledger[0].type = "FORGED";
  assert.equal((await verifyReplay(ledger)).valid, false);
  const command = structuredClone(replay);
  command.commands[1].command.id = "blue-right";
  assert.equal((await verifyReplay(command)).valid, false);
  const order = structuredClone(replay);
  order.commands[1].sequence = 42;
  assert.equal((await verifyReplay(order)).valid, false);
});
test("Penalty five physical corner goals classify bonuses and end once", async () => {
  const e = await setup({ mode: "penalty", difficulty: "pro" });
  try {
    for (let i = 0; i < 5; i++) {
      assert.equal(e.state, "active");
      place(e, { x: 0.75, y: 5.08, vy: 5, height: 0.9 });
      steps(e, 3);
      assert.equal(e.shot.outcome, "goal");
      if (i < 4) steps(e, 120);
    }
    assert.equal(e.state, "ended");
    assert.equal(e.shot.goals, 5);
    assert.equal(e.score.blue, 5);
    assert.equal(e.points.blue, 4800);
    assert.equal(e.events.filter((v) => v.type === "GOAL_SCORED").length, 5);
  } finally {
    e.dispose();
  }
});
test("Penalty keeper save requires contact and timeout resolves one attempt", async () => {
  const e = await setup({ mode: "penalty" });
  try {
    place(e, { x: 0, y: 4.2, vy: 5 });
    steps(e, 12);
    assert.equal(e.shot.outcome, "save");
    assert(
      e.events.some((v) => v.type === "COLLISION" && v.targetId === "keeper-1"),
    );
    steps(e, 120);
    e.shotStart = e.activeTicks - 959;
    place(e, { x: 0, y: 0 });
    e.step();
    assert.equal(e.shot.outcome, "timeout");
    assert.equal(e.shot.goals, 0);
  } finally {
    e.dispose();
  }
});
test("Penalty difficulty keeper speed/reach bounded and out-of-play miss recovers", async () => {
  const e = await setup({ mode: "penalty", difficulty: "elite" });
  try {
    assert.equal(e.keepers[0].width, 0.82);
    place(e, { x: 2, y: 0 });
    const x = e.keepers[0].x;
    e.step();
    assert(Math.abs(e.keepers[0].x - x) <= 3 / 120 + 1e-9);
    assert(Math.abs(e.keepers[0].x) <= 0.66);
    place(e, { x: 3.5, y: 0, height: 1 });
    e.step();
    assert.equal(e.shot.outcome, "miss");
    assert.equal(e.state, "relaunch");
  } finally {
    e.dispose();
  }
});
test("authoritative forfeit reproduces via system ledger, client forfeit rejected", async () => {
  const e = await createMatch({ mode: "pvp", opponent: "human" });
  let replay;
  try {
    e.start();
    steps(e, 80);
    assert.equal(e.command({ type: "forfeit", team: "red" }), false);
    e.forfeit("red");
    replay = e.exportReplay();
  } finally {
    e.dispose();
  }
  assert.equal((await verifyReplay(replay)).valid, true);
});
test("Rush physical drain relaunch keeps clock ticking and resets combo", async () => {
  const e = await setup({ mode: "arcade-rush" });
  try {
    e.rushCharge = 3;
    place(e, { x: 0, y: -5.12, vy: -8 });
    e.step();
    assert.equal(e.state, "relaunch");
    const t = e.activeTicks;
    steps(e, 60);
    assert.equal(e.activeTicks, t + 60);
    assert.equal(e.rushCharge, 0);
    steps(e, 60);
    assert.equal(e.state, "active");
    assert.equal(e.balls.length, 1);
  } finally {
    e.dispose();
  }
});
test("Rush physical time target bonuses limited to two", async () => {
  const e = await setup({ mode: "arcade-rush" });
  try {
    for (let i = 0; i < 3; i++) {
      place(e, { x: -2, y: 2.2, vy: 5 });
      steps(e, 12);
      place(e, { x: 0, y: 0 });
      steps(e, 40);
    }
    assert.equal(e.timeBonuses, 2);
    assert.equal(e.durationTicks, 13200);
    assert.equal(e.events.filter((v) => v.type === "TIME_EXTENDED").length, 2);
  } finally {
    e.dispose();
  }
});
test("Rush multiball physical target yields unique IDs, one event, ten-second expiry", async () => {
  const e = await setup({ mode: "arcade-rush" });
  try {
    place(e, { x: 0, y: 2, vy: 5 });
    steps(e, 12);
    assert.equal(e.balls.length, 3);
    assert.equal(new Set(e.balls.map((b) => b.id)).size, 3);
    assert.equal(e.activateMultiball(), false);
    e.multiballUntil = e.activeTicks + 1;
    e.step();
    assert.equal(e.balls.length, 1);
    assert.equal(
      e.events.filter((v) => v.type === "MULTIBALL_ENDED").length,
      1,
    );
  } finally {
    e.dispose();
  }
});
test("Rush Final15 doubles configured score, timer locks result and combo expires", async () => {
  const e = await setup({ mode: "arcade-rush" });
  try {
    e.activeTicks = e.durationTicks - 1801;
    e.rushCharge = 4;
    e.rushLastHit = e.activeTicks;
    e.step();
    assert(e.rush);
    const before = e.points.blue;
    e.rushAward(50);
    assert.equal(e.points.blue - before, 500);
    e.rushLastHit = e.activeTicks - 600;
    e.step();
    assert.equal(e.rushCharge, 0);
    e.activeTicks = e.durationTicks - 1;
    e.step();
    assert.equal(e.state, "ended");
    const score = e.points.blue;
    steps(e, 500);
    assert.equal(e.points.blue, score);
    assert.equal(e.command({ type: "bank" }), false);
  } finally {
    e.dispose();
  }
});
test("Rush incline collider physically lifts football", async () => {
  const e = await setup({ mode: "arcade-rush" });
  try {
    place(e, { x: 2, y: 0.8, vy: 5, height: 0.15 });
    let peak = 0;
    for (let i = 0; i < 55; i++) {
      e.step();
      peak = Math.max(peak, e.balls[0]?.body.translation().y || 0);
    }
    assert(
      e.events.some(
        (v) => v.type === "COLLISION" && v.targetId === "rush-ramp",
      ),
    );
    assert(peak > 0.3, `peak ${peak}`);
  } finally {
    e.dispose();
  }
});
for (const mode of ["pvp", "penalty", "arcade-rush"])
  test(`${mode} canonical replay includes full 3D motion and mode events`, async () => {
    const e = await createMatch({ mode, seed: 893, opponent: "human" });
    let replay;
    try {
      e.start();
      steps(e, 120);
      if (e.state === "choice")
        e.command({ type: "choose", choice: "kickoff" });
      steps(e, 1000);
      e.setInput("blue-left", true);
      steps(e, 20);
      e.setInput("blue-left", false);
      replay = e.exportReplay();
    } finally {
      e.dispose();
    }
    assert.equal((await verifyReplay(replay)).valid, true);
  });
test("reset reconstructs canonical world without old contacts or moving-target state", async () => {
  const e = await createMatch({ mode: "arcade-rush", seed: 72 }),
    fresh = await createMatch({ mode: "arcade-rush", seed: 72 });
  try {
    e.start();
    steps(e, 600);
    e.reset();
    assert.deepEqual(e.snapshot(), fresh.snapshot());
    e.start();
    fresh.start();
    steps(e, 500);
    steps(fresh, 500);
    assert.deepEqual(e.snapshot(), fresh.snapshot());
  } finally {
    e.dispose();
    fresh.dispose();
  }
});
test("side swap reassigns player and keeper collider ownership", async () => {
  const e = await setup({ format: "classic" });
  try {
    e.activeTicks = 14399;
    e.step();
    for (const target of e.targets.filter((t) => t.type === "player")) {
      assert.equal(target.team, target.y < 0 ? "red" : "blue");
      assert.equal(
        [...e.names.values()].find((n) => n.id === target.id).team,
        target.team,
      );
    }
    for (const k of e.keepers)
      assert.equal(
        [...e.names.values()].find((n) => n.id === k.id).team,
        k.team,
      );
  } finally {
    e.dispose();
  }
});
test("Crash far goal returns by physical backwall without teleport", async () => {
  const e = await setup({ mode: "crash" });
  try {
    place(e, { x: 0.72, y: 5.06, vy: 4, height: 0.3 });
    const before = e.balls[0].body.translation().z;
    e.step();
    assert(Math.abs(e.balls[0].body.translation().z - before) < 0.1);
    steps(e, 35);
    assert(e.balls[0].body.linvel().z > 0);
    assert(
      e.events.some(
        (v) => v.type === "COLLISION" && v.targetId === "goal-back-1",
      ),
    );
    assert.equal(e.state, "active");
  } finally {
    e.dispose();
  }
});
test("canonical rules immutable and unknown mutable options rejected", async () => {
  await assert.rejects(() => createMatch({ seed: { mutable: true } }));
  await assert.rejects(() => createMatch({ score: 999 }));
  const e = await setup();
  try {
    assert(Object.isFrozen(e.options));
    const rules = e.canonicalRules();
    assert(Object.isFrozen(rules.geometry));
    assert.throws(() => {
      rules.physics.maxSpeed = 999;
    });
  } finally {
    e.dispose();
  }
});
test("Penalty dedicated lane uses configured near drain and actual boot contact", async () => {
  const e = await setup({ mode: "penalty" });
  try {
    assert.equal(e.geometry.halfWidth, 2.3);
    assert.equal(e.geometry.nearPlane, -3.5);
    const b = e.boots[0];
    assert.equal(b.y, -2.4);
    place(e, {
      x: b.x + Math.cos(b.rest) * 0.95,
      y: b.y + Math.sin(b.rest) * 0.95 + 0.31,
      height: 0.15,
    });
    e.setInput(b.id, true);
    steps(e, 10);
    assert(e.events.some((v) => v.type === "COLLISION" && v.targetId === b.id));
    assert(e.balls[0].body.linvel().z < 0);
    place(e, { x: 0, y: -3.62, vy: -8 });
    e.step();
    assert.equal(e.shot.outcome, "miss");
  } finally {
    e.dispose();
  }
});
