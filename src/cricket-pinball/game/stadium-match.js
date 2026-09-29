import { CricketMatchEngine } from '../match/match-engine.js';
import { createCricketGameplayAdapter } from './gameplay-adapter.js';
import { createCpuBattingAI, chooseCpuBowling } from './cpu-opponent.js';
import { createTossController } from '../toss/toss-controller.js';

// Shared match rules; this module only coordinates stadium screen ownership/timing.
export function createStadiumMatch({ engine, table, rules, render, onReset, onFeedback = () => {}, practice = false }) {
  const cue = document.querySelector('#cue'), bowl = document.querySelector('#bowl');
  const panel = document.createElement('section'); panel.id = 'matchPanel'; panel.setAttribute('aria-label', 'Match setup');
  document.querySelector('#viewport').append(panel);
  let match, adapter, cpu, running = false, ready = false, format = 'LAST_3', difficulty = 'MEDIUM', stepAccumulator = 0;
  const timers = new Set();
  const requested = new URLSearchParams(location.search);
  if (['LAST_3', 'ONE_OVER', 'TWO_OVER'].includes(requested.get('format'))) format = requested.get('format');
  if (['EASY', 'MEDIUM', 'HARD'].includes(requested.get('difficulty'))) difficulty = requested.get('difficulty');
  const toss = createTossController({ random: () => Math.random() });
  const delay = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
  const name = id => id === 'player' ? 'You' : 'CPU';
  const humanBatting = () => match?.battingPlayerId === 'player';
  function releaseBats() {
    for (const side of ['left', 'right']) { engine.setFlipper(side, false); document.querySelector(`#${side}Bat`).classList.remove('pressed'); }
  }
  function controls() {
    bowl.disabled = !ready || running;
    document.querySelector('.setup').classList.toggle('batting', !practice && humanBatting());
    bowl.textContent = practice || !humanBatting() ? 'Bowl' : 'Ready for ball';
    for (const id of ['line', 'power']) document.querySelector(`#${id}`).disabled = !practice && (!ready || running || humanBatting());
    for (const side of ['left', 'right']) document.querySelector(`#${side}Bat`).disabled = !practice && (!running || !humanBatting());
  }
  function hud() {
    const state = match.getState(), s = state.score;
    document.querySelector('#score').innerHTML = `<div><small>${state.innings ? `${name(match.currentInnings?.battingPlayerId || state.battingPlayerId)} batting` : 'Score'}</small><strong>${s.runs} / ${s.wickets}</strong></div><div><small>Ball</small><strong>${s.balls} <span>/ ${state.ballsPerInnings}</span></strong></div><div><small>${state.target !== null ? 'Target' : 'Innings'}</small><strong>${state.target !== null ? state.target : state.innings ? state.roundInnings : '—'}</strong></div>`;
  }
  function show(title, body) { panel.hidden = false; panel.innerHTML = `<h2>${title}</h2>${body}`; }
  function makeReady() {
    ready = true; panel.hidden = true; delete cue.dataset.contact;
    cue.textContent = humanBatting() ? 'You bat · prepare for the CPU delivery' : 'You bowl · select line and power';
    controls(); hud();
    if (!practice && humanBatting()) {
      delay(() => {
        if (ready && !running && humanBatting() && ['DELIVERY_SETUP', 'SECOND_INNINGS'].includes(match?.status)) launch();
      }, Number(rules.delivery.cpuDeliveryDelayMs ?? 850));
    }
  }
  function afterDelivery(outcome, metadata = {}) {
    running = false; ready = false; cpu.reset(); releaseBats(); hud(); controls();
    onFeedback({ type: 'OUTCOME', outcome, metadata });
    cue.textContent = metadata.reason === 'RISK_WICKET'
      ? `MISTIMED ATTACK · WICKET`
      : metadata.reason === 'SKILL_REJECTED'
        ? `${metadata.attemptedOutcome} MISSED · ${metadata.scoring?.reason || 'MISTIMED'}`
        : outcome;
    if (practice) { ready = !match.currentInnings.complete; controls(); return; }
    delay(() => {
      if (match.status === 'INNINGS_BREAK') {
        show('Innings break', `<p>${match.battingPlayerId === 'player' ? 'You need' : 'CPU needs'} ${match.target} to win.</p><button id="continueInnings">Start chase</button>`);
        document.querySelector('#continueInnings').onclick = () => { match.startSecondInnings(); cpu.reset(); engine.resetBall(); makeReady(); };
      } else if (match.status === 'SUPER_OVER') {
        show('Scores tied', `<p>Three-ball tie-break. Two wickets per side.</p><button id="startTieBreak">Play tie-break</button>`);
        document.querySelector('#startTieBreak').onclick = () => { match.startSuperOver(); cpu.reset(); engine.resetBall(); makeReady(); };
      } else if (match.status === 'MATCH_OVER') {
        const result = match.result;
        onFeedback({ type: 'MATCH_RESULT', result });
        show(result.type === 'TIE' ? 'Match tied' : `${name(result.winnerId)} won`, `<p>${result.type === 'TIE' ? 'Scores level.' : result.marginType === 'RUNS' ? `Won by ${result.margin} run${result.margin === 1 ? '' : 's'}.` : `Won with ${result.margin} ball${result.margin === 1 ? '' : 's'} remaining.`}</p><button id="playAgain">New match</button>`);
        document.querySelector('#playAgain').onclick = reset;
      } else makeReady();
    }, Number(rules.delivery.resultHoldMs?.[outcome] ?? rules.delivery.betweenBallsMs));
  }
  function newMatch() {
    adapter?.dispose(); cpu?.reset(); engine.resetBall(); onReset(); releaseBats();
    match = new CricketMatchEngine({ format: practice ? 'ONE_OVER' : format, difficulty, players: [{ id: 'player' }, { id: 'cpu' }], maxWickets: rules.maxWickets, superOver: rules.superOver.enabled, superOverBalls: rules.superOver.ballsPerInnings });
    cpu = createCpuBattingAI({ engine, tableConfig: table, difficulty, cpuConfig: rules.cpu });
    adapter = createCricketGameplayAdapter({ engine, matchEngine: match, tableConfig: table, cricketRules: rules,
      onResolved: afterDelivery,
      onDeadBall: () => afterDelivery('Dead ball · does not count'),
      onBatContact: (feedback, hit) => {
        cue.dataset.contact = feedback.timing;
        cue.textContent = feedback.timing === 'PERFECT'
          ? 'PERFECT CONTACT'
          : `${feedback.timing} CONTACT`;
        onFeedback({ type: 'BAT_CONTACT', feedback, hit });
      }
    });
    running = false; ready = false; stepAccumulator = 0; cue.textContent = 'Choose your match settings'; controls(); hud();
  }
  function assign(choice) {
    if (match.status !== 'ROLE_SELECT') return;
    const winner = match.toss.winnerId;
    const battingPlayerId = choice === 'BAT' ? winner : winner === 'player' ? 'cpu' : 'player';
    match.assignRoles({ battingPlayerId, bowlingPlayerId: battingPlayerId === 'player' ? 'cpu' : 'player', choice });
    show('Roles confirmed', `<p>${battingPlayerId === 'player' ? 'You bat' : 'CPU bats'} first.</p>`);
    delay(() => { match.startInnings(); makeReady(); }, rules.toss.roleConfirmMs);
  }
  function perform(call, caller) {
    const result = toss.perform(call, caller, caller === 'player' ? 'cpu' : 'player');
    if (!result) return;
    show('Coin in the air', `<img class="stadium-coin flipping" src="/assets/cricket/world/cricket-pinball-toss-coin-v4.png" alt="Cricket Pinball toss coin"><p>${name(caller)} called ${call.toLowerCase()}.</p>`);
    delay(() => {
      match.setToss(result);
      show(`${result.result} · ${name(result.winnerId)} won the toss`, `<img class="stadium-coin" src="/assets/cricket/world/cricket-pinball-toss-coin-v4.png" alt="Toss coin"><p id="tossChoice">Result confirmed</p>`);
      delay(() => {
        if (result.winnerId === 'player') {
          document.querySelector('#tossChoice').innerHTML = '<button id="chooseBat">Bat first</button> <button id="chooseBowl">Bowl first</button>';
          document.querySelector('#chooseBat').onclick = () => assign('BAT'); document.querySelector('#chooseBowl').onclick = () => assign('BOWL');
        } else { const choice = Math.random() < .5 ? 'BAT' : 'BOWL'; document.querySelector('#tossChoice').textContent = `CPU chooses to ${choice.toLowerCase()}`; delay(() => assign(choice), rules.toss.cpuChoiceMs); }
      }, rules.toss.resultHoldMs);
    }, rules.toss.coinMs);
  }
  function reset() {
    for (const id of timers) clearTimeout(id); timers.clear(); toss.reset(); newMatch();
    if (practice) { match.assignRoles({ battingPlayerId: 'player', bowlingPlayerId: 'cpu' }); match.startInnings(); makeReady(); }
    else {
      show('Set up your match', '<label>Format<select id="format"><option value="LAST_3">Last 3 balls</option><option value="ONE_OVER">One over</option><option value="TWO_OVER">Two overs</option></select></label><label>Difficulty<select id="difficulty"><option>EASY</option><option selected>MEDIUM</option><option>HARD</option></select></label><button id="beginStadiumToss">Begin toss</button>');
      document.querySelector('#format').value = format; document.querySelector('#difficulty').value = difficulty;
      document.querySelector('#beginStadiumToss').onclick = () => {
        format = document.querySelector('#format').value; difficulty = document.querySelector('#difficulty').value; newMatch();
        const caller = toss.pickCaller(match.players).id;
        if (caller === 'player') {
          show('Call the toss', '<img class="stadium-coin" src="/assets/cricket/world/cricket-pinball-toss-coin-v4.png" alt="Cricket Pinball toss coin"><p><button id="callHeads">Heads</button> <button id="callTails">Tails</button></p>');
          document.querySelector('#callHeads').onclick = () => perform('HEADS', caller); document.querySelector('#callTails').onclick = () => perform('TAILS', caller);
        } else { show('CPU calls the toss', '<p>Waiting for the call…</p>'); delay(() => perform(Math.random() < .5 ? 'HEADS' : 'TAILS', caller), rules.toss.cpuCallMs); }
      };
    }
    render();
  }
  function launch() {
    if (!ready || running || !match.currentInnings || match.currentInnings.complete) return;
    const selection = !practice && humanBatting() ? chooseCpuBowling(difficulty, rules.cpu) : { line: document.querySelector('#line').value, power: Number(document.querySelector('#power').value) / 100 };
    if (!match.beginDelivery(selection)) return;
    engine.resetBall(); cpu.reset(); releaseBats(); adapter.armDelivery(); engine.releaseLaunch({ line: selection.line, charge: selection.power, deliveryType: selection.type || 'PACE' });
    onFeedback({ type: 'DELIVERY_LAUNCH', selection });
    running = true; ready = false; stepAccumulator = 0; cue.textContent = humanBatting() ? 'You bat · ball live' : 'CPU batting · ball live'; controls();
  }
  return {
    reset, launch, get running() { return running; }, get match() { return match; },
    step(dt) {
      if (!running) return;
      stepAccumulator += Math.min(Math.max(dt, 0), table.physics.maxFrameDelta);
      while (running && stepAccumulator >= table.physics.fixedStep) {
        cpu.update(engine.simTime * 1000, !practice && !humanBatting());
        adapter.step(table.physics.fixedStep);
        stepAccumulator -= table.physics.fixedStep;
      }
    },
    bat(side, pressed) { if (pressed && !practice && (!running || !humanBatting())) return; engine.setFlipper(side, pressed); document.querySelector(`#${side}Bat`).classList.toggle('pressed', pressed); }
  };
}
