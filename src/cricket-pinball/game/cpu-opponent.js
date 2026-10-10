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

export function createCpuBattingAI({
  engine,
  tableConfig,
  difficulty = 'MEDIUM',
  cpuConfig = {},
  random = Math.random
}) {
  let swingUntil = 0;
  let cooldownUntil = 0;
  let activeSide = null;
  let scheduledSwingAt = null;
  let scheduledSide = null;
  let centralTiming = null;

  function reset() {
    swingUntil = 0;
    cooldownUntil = 0;
    activeSide = null;
    scheduledSwingAt = null;
    scheduledSide = null;
    centralTiming = null;
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
    swingUntil = nowMs + Number(preset.battingHoldMs ?? 105);
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

    const preset = cpuConfig[difficulty] || cpuConfig.MEDIUM || {};
    const ball = engine.ball;

    if (scheduledSwingAt !== null) {
      if (centralTiming && ball.velocity.z > 0) {
        const arrival = (centralTiming.z - ball.position.z) / ball.velocity.z * 1000;
        scheduledSwingAt = Math.max(centralTiming.reactAt, nowMs + arrival - centralTiming.sweep + centralTiming.jitter);
      }
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
    const reactionMs = Math.max(0, Number(preset.battingReactionMs ?? 65));
    const triggerZ = Number(Math.abs(ball.position.x) <= centreBand
      ? preset.battingCentreTriggerZ ?? preset.battingTriggerZ ?? 1.45
      : preset.battingTriggerZ ?? 1.45);
    const maxTriggerZ = Number(preset.battingMaxZ ?? 2.48);
    if (ball.position.z > maxTriggerZ) return;
    if (centralApproach) {
      if (engine.launcher.inLane || ball.position.z < .5 || arrivalMs > reactionMs + 140) return;
    } else if (ball.position.z < triggerZ) return;

    const missChance = clamp(Number(preset.battingMissChance ?? .12), 0, .75);
    if (random() < missChance) {
      cooldownUntil = nowMs + Number(preset.battingCooldownMs ?? 220);
      return;
    }

    scheduledSide = centralApproach ? 'both' : predictSide(ball, preset);
    const jitterMs = Math.max(0, Number(preset.battingTimingJitterMs ?? 35));
    const jitter = (random() * 2 - 1) * jitterMs * (centralApproach ? .18 : 1);
    // Centre balls pass the blade tips: aim the crossing of the horizontal
    // bat position at their arrival, rather than reacting at a fixed pitch Z.
    const blade = tableConfig?.flippers?.[0];
    const sweepMs = blade ? Math.abs(blade.restAngleDeg) / blade.speedDegPerSec * 1000 : 20;
    centralTiming = centralApproach ? {z:Number(preset.battingCentreContactZ ?? 2.02),reactAt:nowMs+reactionMs,sweep:sweepMs,jitter} : null;
    scheduledSwingAt = nowMs + Math.max(0, centralApproach
      ? Math.max(reactionMs, arrivalMs - sweepMs) + jitter
      : reactionMs + jitter);

    if (scheduledSwingAt <= nowMs) startSwing(nowMs, scheduledSide, preset);
  }

  return {
    update,
    reset,
    getState: () => ({ swingUntil, cooldownUntil, activeSide, scheduledSwingAt, scheduledSide })
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
