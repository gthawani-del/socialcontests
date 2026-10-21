import {BOWLERS,normalizeBowling} from './bowling-rules.js';
export function chooseDeliveryType(mix = { PACE: 1 }, roll = Math.random()) {
  const entries = Object.entries(mix).filter(([, weight]) => Number(weight) > 0);
  if (!entries.length) return 'PACE';
  const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
  let cursor = Math.max(0, Math.min(.999999, Number(roll))) * total;
  for (const [type, weight] of entries) {
    cursor -= Number(weight);
    if (cursor < 0) return type;
  }
  return entries.at(-1)[0];
}

export function chooseCpuBowling(difficulty = 'MEDIUM', cpuConfig = {}, random = Math.random) {
  const lines = ['LEFT', 'CENTRE', 'RIGHT'];
  const preset = cpuConfig[difficulty] || cpuConfig.MEDIUM || {};
  const min = Number(preset.bowlingPowerMin ?? (difficulty === 'HARD' ? 0.72 : difficulty === 'EASY' ? 0.45 : 0.58));
  const max = Number(preset.bowlingPowerMax ?? (difficulty === 'HARD' ? 0.96 : difficulty === 'EASY' ? 0.72 : 0.86));

  return {
    line: lines[Math.floor(random() * lines.length)],
    power: min + random() * Math.max(0, max - min),
    type: chooseDeliveryType(preset.deliveryMix || { PACE: 1 }, random()),
    movementScale: Number(preset.deliveryMovementScale ?? 1)
  };
}

export function chooseTacticalBowling(difficulty,cpuConfig,{bowler='MEDIUM',history=[],state={},random=Math.random}={}) {
 const legal=BOWLERS[bowler]?.types || BOWLERS.MEDIUM.types;
 const selection=chooseCpuBowling(difficulty,cpuConfig,random);
 const recent=history.slice(-3).map(d=>d.selection || d.bowling || {});
 selection.type=legal.includes(selection.type)?selection.type:legal[Math.floor(random()*legal.length)];
 selection.length=['FULL','GOOD','SHORT'][Math.floor(random()*3)];
 // Avoid repeating the identical plan; still commit before the ball is live.
 if(recent.length>=2&&recent.slice(-2).every(s=>s.type===selection.type)) {
  const alternatives=legal.filter(t=>t!==selection.type);selection.type=alternatives[Math.floor(random()*alternatives.length)];
 }
 if(state.target!==null&&state.requiredRuns>state.ballsRemaining*2&&random()<.5)selection.length='FULL';
 return normalizeBowling(selection,bowler);
}

export function createCpuBattingAI({
  engine,
  tableConfig,
  difficulty = 'MEDIUM',
  cpuConfig = {},
  random = Math.random
}) {
  let chasePressure=false, defensiveIntent=false;
  const observeDelivery=(_selection,state={})=>{
    chasePressure=state.target!=null&&state.requiredRuns>state.ballsRemaining*1.5;
    const aggression=(cpuConfig[difficulty] || cpuConfig.MEDIUM || {}).battingAggression ?? .4;
    defensiveIntent=random() >= Math.min(.9,aggression+(chasePressure?.15:0));
  };
  let swingUntil = 0;
  let cooldownUntil = 0;
  let activeSide = null;
  let scheduledSwingAt = null;
  let scheduledSide = null;
  let scheduledHoldMs = null;

  function reset() {
    swingUntil = 0;
    cooldownUntil = 0;
    activeSide = null;
    scheduledSwingAt = null;
    scheduledSide = null;
    scheduledHoldMs = null;
    engine?.setFlipper('left', false);
    engine?.setFlipper('right', false);
  }

  function releaseActiveBats() {
    if (!activeSide) return;
    engine.setFlipper('left', false);
    engine.setFlipper('right', false);
    activeSide = null;
  }

  function startSwing(nowMs, side, preset) {
    if (side === 'both') {
      engine.setFlipper('left', true);
      engine.setFlipper('right', true);
    } else {
      engine.setFlipper(side, true);
    }
    activeSide = side;
    scheduledSwingAt = null;
    scheduledSide = null;
    swingUntil = nowMs + (scheduledHoldMs ?? Number(preset.battingHoldMs ?? 105));
    scheduledHoldMs = null;
    cooldownUntil = swingUntil + Number(preset.battingCooldownMs ?? 210);
  }

  function predictSide(ball, preset) {
    const centreBand = Number(preset.battingCentreBand ?? .18);
    const predictionFactor = clamp(Number(preset.battingPredictionFactor ?? .5), 0, 1);
    const contactZ = Number(preset.battingContactZ ?? 2.12);
    const secondsToContact = ball.velocity.z > .05
      ? clamp((contactZ - ball.position.z) / ball.velocity.z, 0, .35)
      : 0;
    const predictedX = ball.position.x + ball.velocity.x * secondsToContact * predictionFactor;

    if (Math.abs(predictedX) > centreBand) return predictedX < 0 ? 'left' : 'right';

    const aggression = clamp(Number(preset.battingAggression ?? .4), 0, 1);
    if (random() >= aggression) return 'both';
    if (Math.abs(ball.velocity.x) > .04) return ball.velocity.x < 0 ? 'left' : 'right';
    return random() < .5 ? 'left' : 'right';
  }

  function update(nowMs, enabled) {
    if (!engine) return;
    if (!enabled) return;

    if (engine.isAwaitingLaunch() || !engine.ball.active) {
      reset();
      return;
    }

    if (nowMs < swingUntil) return;
    releaseActiveBats();

    const source=cpuConfig[difficulty] || cpuConfig.MEDIUM || {};
    const preset={...source,battingAggression:Math.min(.9,(source.battingAggression??.4)+(chasePressure?.15:0))};
    const ball = engine.ball;

    if (scheduledSwingAt !== null) {
      if (nowMs < scheduledSwingAt) return;
      startSwing(nowMs, scheduledSide, preset);
      return;
    }

    if (nowMs < cooldownUntil || ball.velocity.z <= 0) return;

    const centreBand = Number(preset.battingCentreBand ?? .18);
    const contactZ = Number(preset.battingContactZ ?? 2.12);
    const arrivalMs = (contactZ - ball.position.z) / ball.velocity.z * 1000;
    const projectedX = ball.position.x + ball.velocity.x * Math.max(0, arrivalMs / 1000);
    const centralApproach = Boolean(tableConfig?.flippers && Math.abs(projectedX) <= centreBand);
    const defending = centralApproach && defensiveIntent;
    const reactionMs = Math.max(0, Number(preset.battingReactionMs ?? 65));
    const triggerZ = Number(Math.abs(ball.position.x) <= centreBand
      ? preset.battingCentreTriggerZ ?? preset.battingTriggerZ ?? 1.45
      : preset.battingTriggerZ ?? 1.45);
    const maxTriggerZ = Number(preset.battingMaxZ ?? 2.48);
    if (ball.position.z > maxTriggerZ) return;
    if (centralApproach) {
      if (engine.launcher.inLane || ball.position.z < (defending ? -.9 : .5) || arrivalMs > reactionMs + (defending ? 400 : 140)) return;
    } else if (ball.position.z < triggerZ) return;

    const missChance = clamp(Number(preset.battingMissChance ?? .12), 0, .75);
    if (random() < missChance) {
      cooldownUntil = nowMs + Number(preset.battingCooldownMs ?? 220);
      return;
    }

    scheduledSide = defending ? 'both' : predictSide(ball, preset);
    scheduledHoldMs = defending ? 450 : null;
    const jitterMs = Math.max(0, Number(preset.battingTimingJitterMs ?? 35));
    const jitter = (random() * 2 - 1) * jitterMs;
    // Commit one estimated swing with the full difficulty timing error.
    // Do not continuously correct it from live ball coordinates.
    const blade = tableConfig?.flippers?.[0];
    const sweepMs = blade ? Math.abs(blade.restAngleDeg) / blade.speedDegPerSec * 1000 : 20;
    const centreArrivalMs = (2.02 - ball.position.z) / ball.velocity.z * 1000;
    scheduledSwingAt = nowMs + Math.max(0, centralApproach
      ? Math.max(reactionMs, centreArrivalMs - (defending ? 240 : sweepMs)) + jitter
      : reactionMs + jitter);

    if (scheduledSwingAt <= nowMs) startSwing(nowMs, scheduledSide, preset);
  }

  return {
    update,
    reset,
    observeDelivery,
    getState: () => ({ swingUntil, cooldownUntil, activeSide, scheduledSwingAt, scheduledSide })
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
