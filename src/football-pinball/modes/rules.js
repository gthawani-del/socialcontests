import { BOOTS, RAILS } from "./foundation.js";
export const RULE_VERSION = "football-3d-11";
export const PHYSICS = Object.freeze({
  hz: 120,
  step: 1 / 120,
  maxFrame: 0.1,
  maxTicks: 216000,
  maxCommands: 100000,
  ballRadius: 0.13,
  maxSpeed: 16,
  goalPlane: 5,
  goalHalfWidth: 1.1,
  goalHeight: 1.2,
  bootLength: 1.55,
  bootRadius: 0.17,
  bootOffset: 0.675,
  bootCenterHeight: 0.2,
  bootHalfHeight: 0.13,
});
export const MODE_IDS = ["pvp", "crash", "penalty", "arcade-rush"];
export const MODE_RULES = {
  pvp: {
    ballRadius: 0.15,
    maxBallLift: 2.2,
    bootShot: { minSpeed: 10, maxSpeed: 14, lift: 2.2, strokeTicks: 8 },
    rally: { slowSpeed: 2.5, recoveryTicks: 42, airRecoveryTicks: 84, recoverySpeed: 6 },
    tableSlope: .9,
    kickoff: { minOffset: .7, maxOffset: 1.5, speed: 6, lateralSpeed: .2 },
    restartTicks: 60,
    playerKickCooldown: 90,
    playerKickSpeed: { defender: 8, midfielder: 9, striker: 11 },
    cpu: { holdTicks: 12, returnTicks: 12, reactionTicks: { easy: 36, medium: 20, hard: 10 } },
    quickGoals: 3,
    halfTicks: 14400,
    comboTicks: 600,
    points: {
      boot: 10,
      player: 20,
      pass: 50,
      skill: 75,
      perfect: 100,
      goal: 500,
      super: 250,
    },
  },
  crash: {
    targetRearmTicks: 30,
    comboTicks: 600,
    multiplierScale: 10000,
    maxMultiplier: 100000,
    comboCap: 15000,
    points: { small: 50, wing: 75, center: 100, skill: 150, goal: 500 },
  },
  penalty: {
    attempts: 5,
    shotTicks: 960,
    points: {
      goal: 500,
      topCorner: 250,
      perfect: 100,
      precision: 150,
      streak3: 100,
      streak5: 200,
    },
    keeper: {
      rookie: { reaction: 38, speed: 1.7, width: 0.6, error: 0.35 },
      pro: { reaction: 22, speed: 2.2, width: 0.72, error: 0.2 },
      elite: { reaction: 10, speed: 3, width: 0.82, error: 0.08 },
    },
  },
  "arcade-rush": {
    durationTicks: 10800,
    maxTicks: 14400,
    timeBonusTicks: 1200,
    maxTimeBonuses: 2,
    multiballTicks: 1200,
    comboTicks: 600,
    finalTicks: 1800,
    finalBonus: 2,
    points: { small: 50, advanced: 100, goal: 500, perfect: 150, super: 300 },
  },
};
export function geometryFor(mode) {
  return {
    halfWidth: mode === "penalty" ? 2.3 : 3,
    nearPlane: mode === "penalty" ? -3.5 : -5,
    fieldCenterY: mode === "penalty" ? 0.75 : 0,
    fieldLength: mode === "penalty" ? 8.5 : 10,
    goalPlane: 5,
    goalHalfWidth: 1.1,
    goalHeight: 1.2,
    ramps:
      mode === "arcade-rush"
        ? [
            {
              id: "rush-ramp",
              x: 2,
              y: 2,
              width: 0.7,
              length: 2,
              height: 0,
              angle: 0,
              entry: 0.02,
              rise: 0.43,
              profile: "quadratic",
              segments: 16,
              thickness: 0.02,
            },
          ]
        : [],
    rails: RAILS.map((r) => {
      const q = {
        ...r,
        height: mode !== "pvp" && r.id === "goal-back-1" ? 1.2 : 0.45,
      };
      if (mode === "penalty") {
        if (q.id === "left-rail" || q.id === "right-rail") {
          q.x = Math.sign(q.x) * 2.4;
          q.y = 0.75;
          q.hy = 4.4;
        } else if (q.id.startsWith("end-")) {
          q.x = Math.sign(q.x) * 1.75;
          q.hx = 0.65;
          if (q.y < 0) q.y += 1.5;
        } else if (q.y < 0) q.y += 1.5;
      }
      return q;
    }),
    boots: BOOTS.filter((b) => mode === "pvp" || b.team === "blue").map(
      (b) => ({
        ...b,
        ...(mode === "penalty" ? { x: Math.sign(b.x) * 1.65, y: -2.4 } : {}),
        length: mode === "pvp" ? 1.86 : 1.55,
        radius: mode === "pvp" ? 0.35 : 0.17,
        height: 0,
        thickness: 0.26,
      }),
    ),
    targets:
      mode === "arcade-rush"
        ? [
            {
              id: "small-left",
              type: "small",
              x: -1.4,
              y: 0.5,
              radius: 0.3,
              height: 0.4,
            },
            {
              id: "advanced",
              type: "advanced",
              x: 1.4,
              y: 0.5,
              radius: 0.35,
              height: 0.4,
              moving: true,
            },
            {
              id: "time",
              type: "time",
              x: -2,
              y: 2.8,
              radius: 0.3,
              height: 0.2,
            },
            {
              id: "multiball",
              type: "multiball",
              x: 0,
              y: 2.6,
              radius: 0.4,
              height: 0.25,
            },
            {
              id: "super",
              type: "super",
              x: -1.3,
              y: -1.5,
              radius: 0.3,
              height: 0.2,
            },
          ]
        : mode === "crash"
          ? [
              {
                id: "small-left",
                type: "small",
                x: -1.5,
                y: 1.8,
                radius: 0.28,
                height: 0.4,
              },
              {
                id: "small-right",
                type: "small",
                x: 1.5,
                y: 1.8,
                radius: 0.28,
                height: 0.4,
              },
              {
                id: "wing-left",
                type: "wing",
                x: -2.1,
                y: -0.7,
                radius: 0.3,
                height: 0.35,
              },
              {
                id: "wing-right",
                type: "wing",
                x: 2.1,
                y: -0.7,
                radius: 0.3,
                height: 0.35,
              },
              {
                id: "center",
                type: "center",
                x: 0,
                y: 1,
                radius: 0.4,
                height: 0.4,
              },
              {
                id: "skill",
                type: "skill",
                x: -1.3,
                y: 3.25,
                radius: 0.3,
                height: 0.25,
              },
              {
                id: "goal-zone",
                type: "goal",
                x: 0,
                y: 4.3,
                radius: 0.5,
                height: 0.3,
              },
            ]
          : mode === "pvp"
            ? [
                ...[-1, 1].flatMap(homeSign => [
                  {role:'defender',x:homeSign*.85,y:homeSign*2.35},
                  {role:'midfielder',x:-homeSign*1.25,y:homeSign*.55},
                  {role:'striker',x:homeSign*.85,y:-homeSign*1.85},
                ].map(position => ({
                  ...position,id:`player-${position.role}-${homeSign}`,type:'player',
                  homeSign,team:homeSign<0?'blue':'red',radius:.38,height:1.45,
                }))),
                {
                  id: "skill",
                  type: "skill",
                  x: -2.1,
                  y: 0,
                  radius: 0.4,
                  height: 0.28,
                },
                {
                  id: "pass",
                  type: "pass",
                  x: 2.1,
                  y: 0,
                  radius: 0.4,
                  height: 0.28,
                },
                {
                  id: "combo",
                  type: "combo",
                  x: -2.3,
                  y: -1.4,
                  radius: 0.3,
                  height: 0.22,
                },
                {id:'combo-right',type:'combo',x:2.3,y:-1.4,radius:.3,height:.22},
              ]
            : [],
  };
}
export function canonicalRules(mode) {
  return deepFreeze({
    ruleVersion: RULE_VERSION,
    rapier: "0.19.3",
    physics: PHYSICS,
    rules: MODE_RULES[mode],
    geometry: geometryFor(mode),
    coordinates: "world(x,height,-boardY)",
    bootShape: {
      type: "roundCuboid",
      halfExtents: [0.705, 0.06, 0.1],
      borderRadius: 0.07,
      offset: [0.675, 0.2, 0],
    },
  });
}

export function crashValue(base, ticks, charge) {
  if (
    !Number.isSafeInteger(base) ||
    base < 0 ||
    !Number.isSafeInteger(ticks) ||
    ticks < 0
  )
    throw Error("Invalid score");
  const t = BigInt(ticks);
  const multiplier = Math.min(
    100000,
    10000 + Number((t * t + 3600n * t) / 960n),
  );
  const combo = 10000 + Math.min(5, Math.max(0, charge)) * 1000;
  const bank = Number(
    (BigInt(base) * BigInt(multiplier) * BigInt(combo)) / 100000000n,
  );
  if (!Number.isSafeInteger(bank)) throw Error("Score overflow");
  return { multiplier, combo, bank };
}

export function deepFreeze(value) {
  Object.freeze(value);
  for (const item of Object.values(value))
    if (item && typeof item === "object" && !Object.isFrozen(item))
      deepFreeze(item);
  return value;
}
deepFreeze(MODE_RULES);
