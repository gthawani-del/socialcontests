const FORMAT_BALLS = Object.freeze({
  LAST_3: 3,
  ONE_OVER: 6,
  TWO_OVER: 12
});

const OUTCOMES = Object.freeze({
  WICKET: { runs: 0, wicket: true },
  DOT: { runs: 0, wicket: false },
  ONE: { runs: 1, wicket: false },
  TWO: { runs: 2, wicket: false },
  FOUR: { runs: 4, wicket: false },
  SIX: { runs: 6, wicket: false }
});

export function createMatchEngine({
  format = 'ONE_OVER',
  difficulty = 'MEDIUM',
  players,
  maxWickets = 2,
  superOverEnabled = true
}) {
  if (!Array.isArray(players) || players.length !== 2) {
    throw new Error('Cricket match requires exactly two players.');
  }

  const ballsPerInnings = FORMAT_BALLS[format];
  if (!ballsPerInnings) throw new Error(`Unsupported cricket format: ${format}`);

  const state = {
    format,
    difficulty,
    players: players.map((player) => ({ ...player })),
    ballsPerInnings,
    maxWickets,
    superOverEnabled,
    status: 'AWAITING_ROLES',
    innings: 0,
    battingPlayerId: null,
    bowlingPlayerId: null,
    target: null,
    requiredRuns: null,
    current: null,
    inningsHistory: [],
    deliveryHistory: [],
    winnerId: null,
    result: null,
    superOver: false
  };

  let deliveryOpen = false;

  function assignOpeningRoles({ battingPlayerId, bowlingPlayerId }) {
    assertPlayer(battingPlayerId);
    assertPlayer(bowlingPlayerId);
    if (battingPlayerId === bowlingPlayerId) {
      throw new Error('Batting and bowling players must be different.');
    }

    state.battingPlayerId = battingPlayerId;
    state.bowlingPlayerId = bowlingPlayerId;
    state.status = 'INNINGS_SETUP';
    return snapshot();
  }

  function startMatch() {
    if (!state.battingPlayerId || !state.bowlingPlayerId) {
      throw new Error('Assign opening roles before starting the match.');
    }

    state.innings = 1;
    state.target = null;
    state.requiredRuns = null;
    state.winnerId = null;
    state.result = null;
    state.superOver = false;
    state.inningsHistory = [];
    state.deliveryHistory = [];
    startInnings();
    return snapshot();
  }

  function readyDelivery() {
    if (!state.current || !['INNINGS_LIVE', 'DELIVERY_RESOLVED'].includes(state.status)) {
      return false;
    }

    if (deliveryOpen) return false;
    deliveryOpen = true;
    state.status = 'DELIVERY_READY';
    return true;
  }

  function resolveDelivery({ type, bowling = {}, pinballScore = 0, durationMs = 0 }) {
    if (!deliveryOpen || state.status !== 'DELIVERY_READY') {
      return { accepted: false, reason: 'DELIVERY_NOT_READY', state: snapshot() };
    }

    const outcomeKey = String(type || '').toUpperCase();
    const outcome = OUTCOMES[outcomeKey];
    if (!outcome) {
      throw new Error(`Unsupported cricket outcome: ${type}`);
    }

    deliveryOpen = false;
    const current = state.current;

    current.runs += outcome.runs;
    current.wickets += outcome.wicket ? 1 : 0;
    current.ballsBowled += 1;

    const record = {
      innings: state.innings,
      ballNumber: current.ballsBowled,
      batter: state.battingPlayerId,
      bowler: state.bowlingPlayerId,
      bowling: {
        line: bowling.line || 'CENTRE',
        power: Number.isFinite(Number(bowling.power)) ? Number(bowling.power) : null,
        type: bowling.type || 'PACE'
      },
      result: {
        type: outcomeKey,
        runs: outcome.runs,
        wicket: outcome.wicket
      },
      pinballScore: Number(pinballScore) || 0,
      durationMs: Number(durationMs) || 0
    };

    state.deliveryHistory.push(record);
    state.status = 'DELIVERY_RESOLVED';

    if (state.innings === 2) {
      state.requiredRuns = Math.max(0, state.target - current.runs);
    }

    const inningsDecision = evaluateInningsEnd();

    if (inningsDecision.ended) {
      finishInnings(inningsDecision.reason);
    }

    return { accepted: true, delivery: record, state: snapshot() };
  }

  function evaluateInningsEnd() {
    const current = state.current;

    if (state.innings === 2 && current.runs >= state.target) {
      return { ended: true, reason: 'TARGET_REACHED' };
    }

    if (current.wickets >= state.maxWickets) {
      return { ended: true, reason: 'WICKETS' };
    }

    if (current.ballsBowled >= current.ballsPerInnings) {
      return { ended: true, reason: 'BALLS_COMPLETE' };
    }

    return { ended: false, reason: null };
  }

  function finishInnings(reason) {
    const completed = {
      innings: state.innings,
      battingPlayerId: state.battingPlayerId,
      bowlingPlayerId: state.bowlingPlayerId,
      runs: state.current.runs,
      wickets: state.current.wickets,
      ballsBowled: state.current.ballsBowled,
      ballsPerInnings: state.current.ballsPerInnings,
      reason
    };

    state.inningsHistory.push(completed);

    if (state.innings === 1) {
      state.target = completed.runs + 1;
      state.requiredRuns = state.target;
      state.status = 'INNINGS_BREAK';
      swapRoles();
      state.innings = 2;
      startInnings();
      return;
    }

    finishMatch();
  }

  function startInnings() {
    state.current = {
      runs: 0,
      wickets: 0,
      ballsBowled: 0,
      ballsPerInnings: state.superOver ? 3 : state.ballsPerInnings
    };

    if (state.innings === 2 && state.target != null) {
      state.requiredRuns = state.target;
    }

    state.status = state.innings === 2 ? 'SECOND_INNINGS' : 'INNINGS_LIVE';
    deliveryOpen = false;
  }

  function finishMatch() {
    const first = state.inningsHistory[0];
    const second = state.inningsHistory[1];

    if (second.runs >= state.target) {
      state.winnerId = second.battingPlayerId;
      state.result = {
        type: 'CHASE_WIN',
        winnerId: state.winnerId,
        ballsRemaining: Math.max(0, second.ballsPerInnings - second.ballsBowled)
      };
      state.status = 'MATCH_OVER';
      return;
    }

    if (second.runs < first.runs) {
      state.winnerId = first.battingPlayerId;
      state.result = {
        type: 'DEFENCE_WIN',
        winnerId: state.winnerId,
        runs: first.runs - second.runs
      };
      state.status = 'MATCH_OVER';
      return;
    }

    state.winnerId = null;
    state.result = { type: 'TIE' };
    state.status = state.superOverEnabled ? 'SUPER_OVER' : 'MATCH_OVER';
  }

  function startSuperOver() {
    if (state.status !== 'SUPER_OVER') return false;

    state.superOver = true;
    state.status = 'INNINGS_SETUP';
    state.innings = 1;
    state.target = null;
    state.requiredRuns = null;
    state.winnerId = null;
    state.result = null;
    state.inningsHistory = [];
    state.deliveryHistory = [];
    startInnings();
    return true;
  }

  function swapRoles() {
    const previousBatter = state.battingPlayerId;
    state.battingPlayerId = state.bowlingPlayerId;
    state.bowlingPlayerId = previousBatter;
  }

  function getBallsRemaining() {
    if (!state.current) return state.ballsPerInnings;
    return Math.max(0, state.current.ballsPerInnings - state.current.ballsBowled);
  }

  function snapshot() {
    return {
      ...state,
      players: state.players.map((player) => ({ ...player })),
      current: state.current ? { ...state.current } : null,
      inningsHistory: state.inningsHistory.map((innings) => ({ ...innings })),
      deliveryHistory: state.deliveryHistory.map((delivery) => ({
        ...delivery,
        bowling: { ...delivery.bowling },
        result: { ...delivery.result }
      })),
      ballsRemaining: getBallsRemaining()
    };
  }

  function assertPlayer(id) {
    if (!state.players.some((player) => player.id === id)) {
      throw new Error(`Unknown player: ${id}`);
    }
  }

  return {
    assignOpeningRoles,
    startMatch,
    readyDelivery,
    resolveDelivery,
    startSuperOver,
    getState: snapshot
  };
}

export { FORMAT_BALLS, OUTCOMES };
