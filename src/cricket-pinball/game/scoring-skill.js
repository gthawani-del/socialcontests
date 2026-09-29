const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function evaluateScoringOpportunity(zone = {}, feedback = null, config = {}) {
  const outcome = String(zone.outcome || '').toUpperCase();
  if (!config.enabled || !feedback || !['ONE', 'TWO', 'FOUR', 'SIX'].includes(outcome)) {
    return { qualified: true, outcome, reason: 'LEGACY_OR_UNSCOPED' };
  }

  const minQuality = Number(config.minQuality?.[outcome] ?? 0);
  const minImpactScore = Number(config.minImpactScore?.[outcome] ?? 0);
  const quality = clamp(Number(feedback.quality ?? 0), 0, 1);
  const impactScore = clamp(Number(feedback.impactScore ?? 0), 0, 1);

  let directionQualified = true;
  let directionalAlignment = 1;
  const x = Number(zone.position?.[0] ?? 0);
  const directionalOutcomes = new Set(config.directionalOutcomes || ['FOUR', 'SIX']);
  if (directionalOutcomes.has(outcome) && Math.abs(x) >= Number(config.directionalZoneMinX ?? .2)) {
    const zoneSide = Math.sign(x);
    directionalAlignment = Number(feedback.directionBias ?? 0) * zoneSide;
    directionQualified = directionalAlignment >= Number(config.minDirectionalAlignment ?? .15);
  }

  const qualityQualified = quality >= minQuality;
  const impactQualified = impactScore >= minImpactScore;
  const qualified = qualityQualified && impactQualified && directionQualified;

  return {
    qualified,
    outcome,
    quality,
    minQuality,
    impactScore,
    minImpactScore,
    directionalAlignment,
    qualityQualified,
    impactQualified,
    directionQualified,
    reason: qualified
      ? 'QUALIFIED'
      : !qualityQualified
        ? 'CONTACT_QUALITY'
        : !impactQualified
          ? 'CONTACT_IMPACT'
          : 'SHOT_DIRECTION'
  };
}
