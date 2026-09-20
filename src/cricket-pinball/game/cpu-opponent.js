export function chooseCpuBowling(difficulty = 'MEDIUM', cpuConfig = {}) {
  const lines = ['LEFT', 'CENTRE', 'RIGHT'];
  const preset = cpuConfig[difficulty] || cpuConfig.MEDIUM || {};
  const min = Number(preset.bowlingPowerMin ?? (difficulty === 'HARD' ? 0.72 : difficulty === 'EASY' ? 0.45 : 0.58));
  const max = Number(preset.bowlingPowerMax ?? (difficulty === 'HARD' ? 0.96 : difficulty === 'EASY' ? 0.72 : 0.86));

  return {
    line: lines[Math.floor(Math.random() * lines.length)],
    power: min + Math.random() * Math.max(0, max - min),
    type: 'PACE'
  };
}

export function resolveCpuBatting({
  difficulty = 'MEDIUM',
  requiredRuns = null,
  ballsRemaining = null,
  cpuConfig = {}
} = {}) {
  const preset = cpuConfig[difficulty] || cpuConfig.MEDIUM || {};
  const wicketRisk = clamp(Number(preset.wicketRisk ?? 0.16), 0.01, 0.6);
  let boundaryBias = clamp(Number(preset.boundaryBias ?? 0.22), 0.01, 0.65);

  if (requiredRuns !== null && ballsRemaining !== null && ballsRemaining <= 2 && requiredRuns >= 4) {
    boundaryBias = clamp(boundaryBias + 0.16, 0.01, 0.8);
  }

  const weights = [
    ['WICKET', wicketRisk],
    ['DOT', 0.22],
    ['ONE', 0.28],
    ['TWO', 0.18],
    ['FOUR', boundaryBias],
    ['SIX', boundaryBias * 0.45]
  ];

  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  let type = 'DOT';

  for (const [candidate, weight] of weights) {
    roll -= weight;
    if (roll <= 0) {
      type = candidate;
      break;
    }
  }

  return {
    type,
    runs: { WICKET:0, DOT:0, ONE:1, TWO:2, FOUR:4, SIX:6 }[type],
    wicket: type === 'WICKET'
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
