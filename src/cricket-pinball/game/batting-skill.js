const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function evaluateBatContact(hit = {}, config = {}) {
  if (!hit || !hit.pressed || !Number.isFinite(hit.z) || !hit.id) return null;

  const idealZ = Number(config.idealContactZ ?? 1.92);
  const perfectHalfWindow = Math.max(.04, Number(config.perfectHalfWindow ?? .18));
  const timingSpan = Math.max(perfectHalfWindow + .05, Number(config.timingSpan ?? .58));
  const error = hit.z - idealZ;
  const absError = Math.abs(error);
  const timing = absError <= perfectHalfWindow ? 'PERFECT' : error < 0 ? 'EARLY' : 'LATE';

  const timingScore = clamp(1 - Math.max(0, absError - perfectHalfWindow) / (timingSpan - perfectHalfWindow), 0, 1);
  const swingProgress = clamp(Number(hit.swingProgress ?? .5), 0, 1);
  const idealSwingProgress = clamp(Number(config.idealSwingProgress ?? .58), .05, .95);
  const angleScore = clamp(1 - Math.abs(swingProgress - idealSwingProgress) / Math.max(idealSwingProgress, 1 - idealSwingProgress), 0, 1);
  const impact = Math.max(0, Number(hit.impact ?? 0));
  const impactScore = clamp(impact / Math.max(.1, Number(config.strongImpact ?? 8)), 0, 1);

  const quality = clamp(
    timingScore * Number(config.timingWeight ?? .52) +
    angleScore * Number(config.angleWeight ?? .28) +
    impactScore * Number(config.impactWeight ?? .20),
    0,
    1
  );

  const sideSign = hit.id === 'left' ? -1 : 1;
  const timingBias = timing === 'EARLY' ? sideSign : timing === 'LATE' ? -sideSign : 0;
  const angleBias = sideSign * clamp((swingProgress - idealSwingProgress) / .45, -1, 1);
  const directionBias = clamp(
    timingBias * Number(config.timingDirectionWeight ?? .70) +
    angleBias * Number(config.angleDirectionWeight ?? .30),
    -1,
    1
  );

  const minPower = Number(config.minPowerMultiplier ?? .92);
  const maxPower = Number(config.maxPowerMultiplier ?? 1.12);
  const powerMultiplier = minPower + (maxPower - minPower) * quality;

  return {
    timing,
    timingError: error,
    timingScore,
    angleScore,
    impactScore,
    quality,
    swingProgress,
    directionBias,
    powerMultiplier
  };
}

export function applyBatContactSkill(engine, hit, config = {}) {
  const feedback = evaluateBatContact(hit, config);
  if (!feedback || !engine?.ball?.velocity) return feedback;

  const velocity = engine.ball.velocity;
  const speed = Math.hypot(velocity.x, velocity.z);
  if (speed <= 0.001) return feedback;

  const steer = clamp(Number(config.steeringStrength ?? .13), 0, .35);
  const lateral = speed * feedback.directionBias * steer;

  velocity.x = (velocity.x + lateral) * feedback.powerMultiplier;
  velocity.z *= feedback.powerMultiplier;
  engine.limitBallSpeed?.();

  return {
    ...feedback,
    speedBefore: speed,
    speedAfter: Math.hypot(velocity.x, velocity.z)
  };
}
