export function createMockMatchFeed(matchId) {
  let state = {
    id: matchId,
    status: 'MATCH_AVAILABLE',
    format: '1 OVER',
    innings: 1,
    player1: { id: 'p1', name: 'PLAYER 1' },
    player2: { id: 'p2', name: 'PLAYER 2' },
    score: { runs: 0, wickets: 0 },
    target: null,
    ballsRemaining: 6,
    batterId: 'p1',
    bowlerId: 'p2',
    toss: 'PLAYER 1 WON · BAT',
    winnerId: null
  };
  const listeners = new Set();
  const timers = [];

  function subscribe(handler) {
    listeners.add(handler);
    handler({ ...state });
    return () => listeners.delete(handler);
  }

  function update(patch) {
    state = { ...state, ...patch };
    listeners.forEach((handler) => handler({ ...state }));
  }

  function startDemo() {
    if (state.status !== 'MATCH_AVAILABLE') return;
    update({ status: 'BALL_LIVE' });
    timers.push(setTimeout(() => update({
      status: 'INNINGS_1',
      score: { runs: 8, wickets: 0 },
      ballsRemaining: 3
    }), 1500));
    timers.push(setTimeout(() => update({
      status: 'SECOND_INNINGS',
      innings: 2,
      score: { runs: 5, wickets: 1 },
      target: 9,
      ballsRemaining: 2,
      batterId: 'p2',
      bowlerId: 'p1'
    }), 3000));
    timers.push(setTimeout(() => update({
      status: 'MATCH_OVER',
      score: { runs: 9, wickets: 1 },
      ballsRemaining: 1,
      winnerId: 'p2'
    }), 4800));
  }

  function dispose() {
    timers.forEach(clearTimeout);
    listeners.clear();
  }

  return { subscribe, startDemo, dispose, getState: () => ({ ...state }) };
}
