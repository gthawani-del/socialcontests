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

export class CricketMatchEngine {
  constructor({ format = 'ONE_OVER', difficulty = 'MEDIUM', players, maxWickets = 2, superOver = true } = {}) {
    if (!FORMAT_BALLS[format]) throw new Error('Unsupported cricket format: ' + format);
    if (!Array.isArray(players) || players.length !== 2) throw new Error('Cricket match requires exactly two players.');

    this.listeners = new Map();
    this.format = format;
    this.difficulty = difficulty;
    this.players = players.map((player) => ({ ...player }));
    this.ballsPerInnings = FORMAT_BALLS[format];
    this.maxWickets = maxWickets;
    this.superOverEnabled = superOver;
    this.status = 'MATCH_INTRO';
    this.inningsNumber = 0;
    this.innings = [];
    this.target = null;
    this.battingPlayerId = null;
    this.bowlingPlayerId = null;
    this.toss = null;
    this.deliveryOpen = false;
    this.deliveryHistory = [];
    this.result = null;
  }

  on(type, handler) {
    const handlers = this.listeners.get(type) || new Set();
    handlers.add(handler);
    this.listeners.set(type, handlers);
    return () => handlers.delete(handler);
  }

  emit(type, detail = {}) {
    const payload = { ...detail, match: this.getState() };
    for (const handler of this.listeners.get(type) || []) handler(payload);
  }

  setToss(toss) {
    this.toss = { ...toss };
    this.status = 'ROLE_SELECT';
    this.emit('match:toss-result', { toss: this.toss });
  }

  assignRoles({ battingPlayerId, bowlingPlayerId, choice = null }) {
    if (!this.players.some((player) => player.id === battingPlayerId)) throw new Error('Unknown batting player.');
    if (!this.players.some((player) => player.id === bowlingPlayerId)) throw new Error('Unknown bowling player.');
    if (battingPlayerId === bowlingPlayerId) throw new Error('Batting and bowling roles must differ.');

    this.battingPlayerId = battingPlayerId;
    this.bowlingPlayerId = bowlingPlayerId;
    if (this.toss) this.toss.choice = choice;
    this.status = 'INNINGS_SETUP';
    this.emit('match:role-selected', { battingPlayerId, bowlingPlayerId, choice });
  }

  startInnings() {
    if (!this.battingPlayerId || !this.bowlingPlayerId) throw new Error('Roles must be assigned before innings starts.');

    this.inningsNumber += 1;
    const innings = {
      number: this.inningsNumber,
      battingPlayerId: this.battingPlayerId,
      bowlingPlayerId: this.bowlingPlayerId,
      runs: 0,
      wickets: 0,
      balls: 0,
      complete: false
    };
    this.innings.push(innings);
    this.status = this.inningsNumber === 1 ? 'DELIVERY_SETUP' : 'SECOND_INNINGS';
    this.deliveryOpen = false;
    this.emit('match:innings-start', { innings: { ...innings } });
    return this.getState();
  }

  beginDelivery(bowling = {}) {
    if (!this.currentInnings || this.currentInnings.complete) return false;
    if (this.deliveryOpen) return false;

    this.deliveryOpen = true;
    this.status = 'BALL_LIVE';
    this.currentBowling = {
      line: bowling.line || 'CENTRE',
      power: Number.isFinite(bowling.power) ? bowling.power : 0.5,
      type: bowling.type || 'PACE',
      startedAt: performanceNow()
    };
    this.emit('delivery:launch', { bowling: { ...this.currentBowling } });
    return true;
  }

  abortDelivery(reason = 'DEAD_BALL', metadata = {}) {
    if (!this.deliveryOpen) return false;
    this.deliveryOpen = false;
    const aborted = {
      innings: this.currentInnings?.number ?? this.inningsNumber,
      bowling: { ...this.currentBowling },
      reason,
      ...metadata
    };
    this.currentBowling = null;
    this.status = 'DELIVERY_SETUP';
    this.emit('delivery:aborted', { delivery: aborted });
    this.emit('delivery:ready', { deadBall: true });
    return true;
  }

  resolveDelivery(outcome, metadata = {}) {
    if (!this.deliveryOpen) return false;
    const normalized = String(outcome || '').toUpperCase();
    const result = OUTCOMES[normalized];
    if (!result) throw new Error('Unsupported cricket outcome: ' + outcome);

    this.deliveryOpen = false;
    const innings = this.currentInnings;
    innings.balls += 1;
    innings.runs += result.runs;
    if (result.wicket) innings.wickets += 1;

    const record = {
      innings: innings.number,
      ballNumber: innings.balls,
      batter: innings.battingPlayerId,
      bowler: innings.bowlingPlayerId,
      bowling: { ...this.currentBowling },
      result: { type: normalized, runs: result.runs, wicket: result.wicket },
      durationMs: Math.max(0, Math.round(performanceNow() - (this.currentBowling?.startedAt || performanceNow()))),
      ...metadata
    };
    this.deliveryHistory.push(record);
    this.status = 'DELIVERY_RESOLVED';
    this.emit('delivery:resolved', { delivery: record });
    this.emit('score:changed', { innings: { ...innings } });

    if (this.shouldEndInnings()) {
      this.finishInnings();
    } else {
      this.status = 'DELIVERY_SETUP';
      this.emit('delivery:ready', {});
    }
    return true;
  }

  shouldEndInnings() {
    const innings = this.currentInnings;
    if (!innings) return true;
    if (innings.wickets >= this.maxWickets) return true;
    if (innings.balls >= this.ballsPerInnings) return true;
    if (innings.number === 2 && this.target !== null && innings.runs >= this.target) return true;
    return false;
  }

  finishInnings() {
    const innings = this.currentInnings;
    innings.complete = true;
    this.emit('innings:end', { innings: { ...innings } });

    if (innings.number === 1) {
      this.target = innings.runs + 1;
      const nextBatter = innings.bowlingPlayerId;
      const nextBowler = innings.battingPlayerId;
      this.battingPlayerId = nextBatter;
      this.bowlingPlayerId = nextBowler;
      this.status = 'INNINGS_BREAK';
      this.emit('match:target-set', { target: this.target });
      return;
    }

    this.finishMatch();
  }

  startSecondInnings() {
    if (this.status !== 'INNINGS_BREAK') return false;
    this.startInnings();
    return true;
  }

  finishMatch() {
    const first = this.innings[0];
    const second = this.innings[1];
    if (!first || !second) return;

    if (second.runs >= this.target) {
      this.result = {
        type: 'WIN',
        winnerId: second.battingPlayerId,
        loserId: first.battingPlayerId,
        margin: this.ballsPerInnings - second.balls,
        marginType: 'BALLS'
      };
      this.status = 'MATCH_OVER';
    } else if (second.runs < first.runs) {
      this.result = {
        type: 'WIN',
        winnerId: first.battingPlayerId,
        loserId: second.battingPlayerId,
        margin: first.runs - second.runs,
        marginType: 'RUNS'
      };
      this.status = 'MATCH_OVER';
    } else {
      this.result = { type: 'TIE', winnerId: null };
      this.status = this.superOverEnabled ? 'SUPER_OVER' : 'MATCH_OVER';
      if (this.status === 'SUPER_OVER') this.emit('superover:start', {});
    }

    this.emit('match:end', { result: this.result });
  }

  get currentInnings() {
    return this.innings[this.innings.length - 1] || null;
  }

  getState() {
    const innings = this.currentInnings;
    const balls = innings?.balls || 0;
    const runs = innings?.runs || 0;
    return {
      format: this.format,
      difficulty: this.difficulty,
      ballsPerInnings: this.ballsPerInnings,
      maxWickets: this.maxWickets,
      players: this.players.map((player) => ({ ...player })),
      status: this.status,
      innings: this.inningsNumber,
      score: innings ? { runs, wickets: innings.wickets, balls } : { runs: 0, wickets: 0, balls: 0 },
      target: this.target,
      requiredRuns: this.target === null ? null : Math.max(0, this.target - runs),
      ballsRemaining: Math.max(0, this.ballsPerInnings - balls),
      battingPlayerId: this.battingPlayerId,
      bowlingPlayerId: this.bowlingPlayerId,
      toss: this.toss ? { ...this.toss } : null,
      result: this.result ? { ...this.result } : null,
      deliveryOpen: this.deliveryOpen
    };
  }
}

export { FORMAT_BALLS, OUTCOMES };

function performanceNow() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}
