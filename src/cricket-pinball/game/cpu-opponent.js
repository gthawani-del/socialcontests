const RESULT_TABLES = Object.freeze({
  EASY: ['WICKET', 'DOT', 'ONE', 'ONE', 'TWO', 'FOUR'],
  MEDIUM: ['DOT', 'ONE', 'ONE', 'TWO', 'FOUR', 'SIX'],
  HARD: ['ONE', 'TWO', 'TWO', 'FOUR', 'FOUR', 'SIX']
});

export function chooseCpuBowling(difficulty = 'MEDIUM') {
  const lines = ['LEFT', 'CENTRE', 'RIGHT'];
  const range = difficulty === 'HARD' ? [0.72, 0.96] : difficulty === 'EASY' ? [0.45, 0.72] : [0.58, 0.86];
  return {
    line: lines[Math.floor(Math.random() * lines.length)],
    power: range[0] + Math.random() * (range[1] - range[0]),
    type: 'PACE'
  };
}

export function resolveCpuBatting({ difficulty = 'MEDIUM', requiredRuns = null, ballsRemaining = null } = {}) {
  const table = RESULT_TABLES[difficulty] || RESULT_TABLES.MEDIUM;
  let index = Math.floor(Math.random() * table.length);
  if (requiredRuns !== null && ballsRemaining !== null && ballsRemaining <= 2 && requiredRuns >= 4) {
    index = Math.max(index, table.length - 2);
  }
  const type = table[index];
  return {
    type,
    runs: { WICKET: 0, DOT: 0, ONE: 1, TWO: 2, FOUR: 4, SIX: 6 }[type],
    wicket: type === 'WICKET'
  };
}
