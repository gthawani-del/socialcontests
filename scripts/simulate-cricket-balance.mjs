import fs from 'node:fs';
import { StadiumEngine } from '../src/cricket-pinball/game/stadium-engine.js';
import { createStadiumTable } from '../src/cricket-pinball/game/stadium-layout.js';
import { CricketMatchEngine } from '../src/cricket-pinball/match/match-engine.js';
import { createCricketGameplayAdapter } from '../src/cricket-pinball/game/gameplay-adapter.js';
import { createCpuBattingAI, chooseCpuBowling } from '../src/cricket-pinball/game/cpu-opponent.js';

const TRIALS_PER_CELL = Number(process.env.CRICKET_SIM_TRIALS || 150);
const SEED = Number(process.env.CRICKET_SIM_SEED || 20260929);
const levels = ['EASY', 'MEDIUM', 'HARD'];

const base = JSON.parse(fs.readFileSync(new URL('../public/game/cricket-table.json', import.meta.url)));
const rules = JSON.parse(fs.readFileSync(new URL('../public/game/cricket-rules.json', import.meta.url)));
const table = createStadiumTable(base);

function rng32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function simulateOne(battingSkill, bowlingDifficulty, random) {
  const engine = new StadiumEngine(structuredClone(table));
  const match = new CricketMatchEngine({
    format: 'ONE_OVER',
    difficulty: bowlingDifficulty,
    players: [{ id: 'player' }, { id: 'cpu' }],
    maxWickets: rules.maxWickets,
    superOver: false
  });
  match.assignRoles({ battingPlayerId: 'player', bowlingPlayerId: 'cpu' });
  match.startInnings();

  const selection = chooseCpuBowling(bowlingDifficulty, rules.cpu, random);
  match.beginDelivery(selection);

  let feedback = null;
  const adapter = createCricketGameplayAdapter({
    engine,
    matchEngine: match,
    tableConfig: table,
    cricketRules: rules,
    onBatContact: value => { if (!feedback) feedback = value; },
    random
  });
  const batter = createCpuBattingAI({
    engine,
    tableConfig: table,
    difficulty: battingSkill,
    cpuConfig: rules.cpu,
    random
  });

  adapter.armDelivery();
  engine.releaseLaunch({
    line: selection.line,
    charge: selection.power,
    deliveryType: selection.type,
    movementScale: selection.movementScale
  });

  for (let i = 0; i < 2600 && !match.deliveryHistory.length; i++) {
    batter.update(engine.simTime * 1000, true);
    adapter.step(1 / 120);
  }

  const record = match.deliveryHistory[0] || null;
  batter.reset();
  adapter.dispose();
  return { selection, feedback, record };
}

function summarize(rows) {
  const counts = {
    deliveries: rows.length,
    contacts: 0,
    qualityTotal: 0,
    qualityCount: 0,
    results: {},
    reasons: {},
    boundaries: 0,
    wickets: 0,
    runs: 0,
    perfectRejected: 0,
    highQualityRejected: 0
  };

  for (const row of rows) {
    const feedback = row.feedback;
    const record = row.record;
    if (feedback) {
      counts.contacts += 1;
      counts.qualityTotal += feedback.quality;
      counts.qualityCount += 1;
    }

    const result = record?.result?.type || 'NONE';
    counts.results[result] = (counts.results[result] || 0) + 1;
    counts.runs += ({ ONE: 1, TWO: 2, FOUR: 4, SIX: 6 })[result] || 0;
    if (result === 'FOUR' || result === 'SIX') counts.boundaries += 1;
    if (result === 'WICKET') counts.wickets += 1;

    const reason = record?.reason || 'NONE';
    counts.reasons[reason] = (counts.reasons[reason] || 0) + 1;
    if (reason === 'SKILL_REJECTED' && feedback?.timing === 'PERFECT') counts.perfectRejected += 1;
    if (reason === 'SKILL_REJECTED' && (feedback?.quality ?? 0) >= .8) counts.highQualityRejected += 1;
  }

  return {
    deliveries: counts.deliveries,
    runsPerBall: counts.runs / counts.deliveries,
    contactRate: counts.contacts / counts.deliveries,
    avgQuality: counts.qualityCount ? counts.qualityTotal / counts.qualityCount : null,
    boundaryRate: counts.boundaries / counts.deliveries,
    wicketRate: counts.wickets / counts.deliveries,
    perfectRejected: counts.perfectRejected,
    highQualityRejected: counts.highQualityRejected,
    results: counts.results,
    reasons: counts.reasons
  };
}

const matrix = {};
const all = [];
let seed = SEED;

for (const battingSkill of levels) {
  matrix[battingSkill] = {};
  for (const bowlingDifficulty of levels) {
    const random = rng32(seed++);
    const rows = [];
    for (let i = 0; i < TRIALS_PER_CELL; i++) {
      const row = simulateOne(battingSkill, bowlingDifficulty, random);
      rows.push(row);
      all.push(row);
    }
    matrix[battingSkill][bowlingDifficulty] = summarize(rows);
  }
}

console.log(JSON.stringify({
  seed: SEED,
  trialsPerCell: TRIALS_PER_CELL,
  totalDeliveries: all.length,
  overall: summarize(all),
  matrix
}, null, 2));
