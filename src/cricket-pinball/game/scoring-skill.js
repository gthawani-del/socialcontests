const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function evaluateScoringOpportunity(zone = {}, feedback = null, config = {}, difficulty = 'MEDIUM') {
  const outcome = String(zone.outcome || '').toUpperCase();
  if (!config.enabled || !feedback || !['ONE', 'TWO', 'FOUR', 'SIX'].includes(outcome)) {
    return { qualified: true, outcome, reason: 'LEGACY_OR_UNSCOPED' };
  }

  const adjustment = config.difficultyAdjustments?.[String(difficulty || 'MEDIUM').toUpperCase()] || {};
  const minQuality = Number(config.minQuality?.[outcome] ?? 0) + Number(adjustment.qualityBonus?.[outcome] ?? 0);
  const minImpactScore = Number(config.minImpactScore?.[outcome] ?? 0) + Number(adjustment.impactBonus?.[outcome] ?? 0);
  const quality = clamp(Number(feedback.quality ?? 0), 0, 1);
  const impactScore = clamp(Number(feedback.impactScore ?? 0), 0, 1);

  let directionQualified = true;
  let directionalAlignment = 1;
  const routeProvesDirection = Boolean(zone.requiresRoute);
  const x = Number(zone.position?.[0] ?? 0);
  const directionalOutcomes = new Set(config.directionalOutcomes || ['FOUR', 'SIX']);
  if (!routeProvesDirection && directionalOutcomes.has(outcome) && Math.abs(x) >= Number(config.directionalZoneMinX ?? .2)) {
    const zoneSide = Math.sign(x);
    directionalAlignment = Number(feedback.directionBias ?? 0) * zoneSide;
    directionQualified = directionalAlignment >= Number(config.minDirectionalAlignment ?? .15);
  }

  const requiredIntent = config.requiredIntent?.[outcome] || null;
  const intentQualified = !requiredIntent || feedback.shotIntent === requiredIntent;
  const qualityQualified = quality >= minQuality;
  const impactQualified = impactScore >= minImpactScore;
  const qualified = qualityQualified && impactQualified && directionQualified && intentQualified;

  return {
    qualified,
    outcome,
    difficulty: String(difficulty || 'MEDIUM').toUpperCase(),
    quality,
    minQuality,
    impactScore,
    minImpactScore,
    directionalAlignment,
    routeProvesDirection,
    requiredIntent,
    shotIntent: feedback.shotIntent || null,
    qualityQualified,
    impactQualified,
    directionQualified,
    intentQualified,
    reason: qualified
      ? 'QUALIFIED'
      : !intentQualified
        ? 'SHOT_INTENT'
        : !qualityQualified
          ? 'CONTACT_QUALITY'
          : !impactQualified
            ? 'CONTACT_IMPACT'
            : 'SHOT_DIRECTION'
  };
}
