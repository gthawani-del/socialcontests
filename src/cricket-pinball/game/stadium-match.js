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
  let paused = false;
  const displayState = () => match ? {...match.getState(), inningsHistory:match.innings.map(i=>({...i})), deliveryHistory:match.deliveryHistory.map(d=>({...d}))} : null;
  const requested = new URLSearchParams(location.search);
  if (['LAST_3', 'ONE_OVER', 'TWO_OVER'].includes(requested.get('format'))) format = requested.get('format');
  if (['EASY', 'MEDIUM', 'HARD'].includes(requested.get('difficulty'))) difficulty = requested.get('difficulty');
  const toss = createTossController({ random: () => Math.random() });
  const schedule = job => { job.started=performance.now(); job.id=setTimeout(()=>{timers.delete(job);job.fn();},job.remaining); };
  const delay = (fn, ms) => {const job={fn,remaining:ms,id:null,started:0};timers.add(job);if(!paused)schedule(job);};
  function setPaused(value) {
    if(paused === value)return;
    paused=value;
    for (const animation of panel.getAnimations({subtree:true})) {
      if (paused && animation.playState === 'running') animation.pause();
      else if (!paused && animation.playState === 'paused') animation.play();
    }
    for(const job of timers){if(paused){clearTimeout(job.id);job.remaining=Math.max(0,job.remaining-(performance.now()-job.started));}else schedule(job);}
    if(paused)releaseBats();
    controls();
  }
  const name = id => id === 'player' ? 'You' : 'CPU';
  const humanBatting = () => match?.battingPlayerId === 'player';
  const canBat = () => practice || Boolean(humanBatting() && match?.currentInnings && !match.currentInnings.complete);
  function releaseBats() {
    for (const side of ['left', 'right']) { engine.setFlipper(side, false); document.querySelector(`#${side}Bat`).classList.remove('pressed'); }
  }
  function controls() {
    bowl.disabled = paused || !ready || running;
    document.querySelector('.setup').classList.toggle('batting', !practice && humanBatting());
    bowl.textContent = practice || !humanBatting() ? 'Bowl' : 'Ready for ball';
    for (const id of ['line', 'power', 'deliveryType']) {
      const element = document.querySelector(`#${id}`);
      if (element) element.disabled = !practice && (!ready || running || humanBatting());
    }
    for (const side of ['left', 'right']) document.querySelector(`#${side}Bat`).disabled = paused || !canBat();
    onFeedback({
      type: 'CONTROL_STATE',
      ready: ready && !paused,
      running,
      paused,
      humanBatting: Boolean(humanBatting()),
      practice,
      match: displayState()
    });
  }
  function hud() {
    const state = match.getState(), s = state.score;
    document.querySelector('#score').innerHTML = `<div><small>${state.innings ? `${name(match.currentInnings?.battingPlayerId || state.battingPlayerId)} batting` : 'Score'}</small><strong>${s.runs} / ${s.wickets}</strong></div><div><small>Ball</small><strong>${s.balls} <span>/ ${state.ballsPerInnings}</span></strong><span>${Math.floor(s.balls/6)}.${s.balls%6} ov</span></div><div><small>${state.target !== null ? 'Target' : 'Innings'}</small><strong>${state.target !== null ? state.target : state.innings ? state.roundInnings : '—'}</strong>${state.roundInnings === 2 && state.target !== null ? `<span>${state.requiredRuns} needed</span>` : ''}</div>`;
  }
  function show(title, body) { panel.hidden = false; panel.innerHTML = `<h2>${title}</h2>${body}`; }
  function makeReady() {
    ready = true; panel.hidden = true; delete cue.dataset.contact;
    cue.textContent = humanBatting()
      ? 'CPU preparing delivery'
      : 'Select line + movement · pull and release';
    controls(); hud();
    if (!practice && humanBatting()) {
      const selection = chooseCpuBowling(difficulty, rules.cpu);
      delay(() => {
        if (!ready || running || !humanBatting() || !['DELIVERY_SETUP', 'SECOND_INNINGS'].includes(match?.status)) return;
        onFeedback({ type: 'CPU_PLUNGER_PREP', selection, match: displayState() });
        delay(() => {
          if (ready && !running && humanBatting() && ['DELIVERY_SETUP', 'SECOND_INNINGS'].includes(match?.status)) {
            launch(selection);
          }
        }, Number(rules.delivery.cpuPlungerMs ?? 920));
      }, Number(rules.delivery.cpuDeliveryDelayMs ?? 450));
    }
  }
  function runCountdown(label, startAt, done) {
    let value = startAt;
    const tick = () => {
      onFeedback({ type: 'COUNTDOWN', label, value, match: displayState() });
      cue.textContent = `${label} · ${value}`;
      if (value <= 1) {
        delay(done, Number(rules.delivery.countdownStepMs ?? 650));
        return;
      }
      value -= 1;
      delay(tick, Number(rules.delivery.countdownStepMs ?? 650));
    };
    tick();
  }

  function afterDelivery(outcome, metadata = {}) {
    running = false; ready = false; cpu.reset(); releaseBats(); hud(); controls();
    onFeedback({ type: 'OUTCOME', outcome, metadata, match: displayState() });
    cue.textContent = metadata.displayText
      || (metadata.reason === 'RISK_WICKET'
        ? `MISTIMED ATTACK · WICKET`
        : metadata.reason === 'SKILL_REJECTED'
          ? `${metadata.attemptedOutcome} MISSED · ${metadata.scoring?.reason || 'MISTIMED'}`
          : outcome === 'DEAD_BALL'
            ? 'DEAD BALL · DOES NOT COUNT'
            : outcome);
    if (practice) { ready = !match.currentInnings.complete; controls(); return; }

    const deadBall = outcome === 'DEAD_BALL';
    const holdMs = deadBall
      ? Number(rules.delivery.deadBallHoldMs ?? 1050)
      : Number(rules.delivery.resultHoldMs?.[outcome] ?? rules.delivery.betweenBallsMs);

    delay(() => {
      if (match.status === 'INNINGS_BREAK') {
        show('Innings break', `<p>${match.innings.at(-1).wickets >= match.maxWickets ? `${match.maxWickets} wickets lost` : `${match.ballsPerInnings} balls completed`} · ${match.innings.at(-1).balls}/${match.ballsPerInnings} balls</p><p>${match.battingPlayerId === 'player' ? 'You need' : 'CPU needs'} ${match.target} to win.</p><button id="continueInnings">Start chase</button>`);
        document.querySelector('#continueInnings').onclick = () => { match.startSecondInnings(); cpu.reset(); engine.resetBall(); makeReady(); };
      } else if (match.status === 'SUPER_OVER') {
        show('Scores tied', `<p>Three-ball tie-break. Two wickets per side.</p><button id="startTieBreak">Play tie-break</button>`);
        document.querySelector('#startTieBreak').onclick = () => { match.startSuperOver(); cpu.reset(); engine.resetBall(); makeReady(); };
      } else if (match.status === 'MATCH_OVER') {
        const result = match.result;
        onFeedback({ type: 'MATCH_RESULT', result, match: displayState() });
        show(result.type === 'TIE' ? 'Match tied' : `${name(result.winnerId)} won`, `<p>${result.type === 'TIE' ? 'Scores level.' : result.marginType === 'RUNS' ? `Won by ${result.margin} run${result.margin === 1 ? '' : 's'}.` : `Won with ${result.margin} ball${result.margin === 1 ? '' : 's'} remaining.`}</p><button id="playAgain">New match</button>`);
        document.querySelector('#playAgain').onclick = reset;
      } else {
        runCountdown(deadBall ? 'RE-BOWL' : 'NEXT BALL', deadBall ? 2 : 3, makeReady);
      }
    }, holdMs);
  }
  function newMatch() {
    adapter?.dispose(); cpu?.reset(); engine.resetBall(); onReset(); releaseBats();
    match = new CricketMatchEngine({ format: practice ? 'ONE_OVER' : format, difficulty, players: [{ id: 'player' }, { id: 'cpu' }], maxWickets: rules.maxWickets, superOver: rules.superOver.enabled, superOverBalls: rules.superOver.ballsPerInnings });
    engine.setDifficulty?.(difficulty, rules.difficultyGameplay?.[difficulty] || {});
    cpu = createCpuBattingAI({ engine, tableConfig: table, difficulty, cpuConfig: rules.cpu });
    adapter = createCricketGameplayAdapter({ engine, matchEngine: match, tableConfig: table, cricketRules: rules,
      onResolved: afterDelivery,
      onDeadBall: reason => afterDelivery('DEAD_BALL', {
        reason,
        displayText: 'DEAD BALL · DOES NOT COUNT'
      }),
      onBatContact: (feedback, hit) => {
        cue.dataset.contact = feedback.timing;
        cue.textContent = feedback.timing === 'PERFECT'
          ? 'PERFECT CONTACT'
          : `${feedback.timing} CONTACT`;
        onFeedback({ type: 'BAT_CONTACT', feedback, hit, match: displayState() });
      }
    });
    onFeedback({type:'MATCH_RESET',match:displayState()});
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
  function coinMarkup(face = 'HEADS', flying = false) {
    return `<div class="toss-stage"><div class="toss-lift${flying ? ' tossing' : ''}" style="--toss-duration:${rules.toss.coinMs}ms"><div class="toss-coin ${face === 'TAILS' ? 'tails' : 'heads'}${flying ? ' flipping' : ''}" role="img" aria-label="${flying ? 'Coin flipping in the air' : face}"><div class="coin-face coin-heads"><img src="/assets/cricket/world/cricket-pinball-toss-coin-v4.png" alt=""><strong>HEADS</strong></div><div class="coin-face coin-tails"><span aria-hidden="true">✦</span><strong>TAILS</strong></div></div></div></div>`;
  }
  function perform(call, caller) {
    const result = toss.perform(call, caller, caller === 'player' ? 'cpu' : 'player');
    if (!result) return;
    show('Coin in the air', `${coinMarkup(result.result, true)}<p>${name(caller)} called ${call.toLowerCase()}.</p>`);
    const coin = panel.querySelector('.toss-coin');
    const reveal = () => {
      if (panel.querySelector('.toss-coin') !== coin) return;
      match.setToss(result);
      show(`${result.result} · ${name(result.winnerId)} won the toss`, `${coinMarkup(result.result)}<p id="tossChoice">Result confirmed</p>`);
      delay(() => {
        if (result.winnerId === 'player') {
          document.querySelector('#tossChoice').innerHTML = '<button id="chooseBat">Bat first</button> <button id="chooseBowl">Bowl first</button>';
          document.querySelector('#chooseBat').onclick = () => assign('BAT'); document.querySelector('#chooseBowl').onclick = () => assign('BOWL');
        } else { const choice = Math.random() < .5 ? 'BAT' : 'BOWL'; document.querySelector('#tossChoice').textContent = `CPU chooses to ${choice.toLowerCase()}`; delay(() => assign(choice), rules.toss.cpuChoiceMs); }
      }, rules.toss.resultHoldMs);
    };
    // Wait for the rendered lift AND flip, including throttled/paused frames.
    // A wall-clock timeout can reveal the result before the compositor lands.
    const animations = panel.getAnimations({subtree:true});
    if (animations.length) Promise.all(animations.map(a => a.finished))
      .then(() => delay(reveal, 180)).catch(() => {}); // Reset cancels the old toss.
    else delay(reveal, 240); // Reduced-motion users get a short static reveal.
  }
  function reset() {
    for (const job of timers) clearTimeout(job.id); timers.clear(); paused=false; toss.reset(); newMatch();
    if (practice) { match.assignRoles({ battingPlayerId: 'player', bowlingPlayerId: 'cpu' }); match.startInnings(); makeReady(); }
    else {
      show('Set up your match', '<label>Format<select id="format"><option value="LAST_3">Last 3 balls</option><option value="ONE_OVER">One over</option><option value="TWO_OVER">Two overs</option></select></label><label>Difficulty<select id="difficulty"><option>EASY</option><option selected>MEDIUM</option><option>HARD</option></select></label><p>One over: 6 balls · Two overs: 12 balls · 2 wickets per innings.</p><button id="beginStadiumToss">Begin toss</button>');
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
  function launch(selectionOverride = null) {
    if (paused || !ready || running || !match.currentInnings || match.currentInnings.complete) return false;
    const selection = selectionOverride || (!practice && humanBatting()
      ? chooseCpuBowling(difficulty, rules.cpu)
      : {
          line: document.querySelector('#line')?.value || 'CENTRE',
          power: Number(document.querySelector('#power')?.value || 50) / 100,
          type: document.querySelector('#deliveryType')?.value || 'PACE',
          movementScale: 1
        });
    if (!match.beginDelivery(selection)) return false;
    const held = Object.fromEntries(['left', 'right'].map(side => [side, engine.flippers.get(side).pressed]));
    engine.resetBall(); cpu.reset();
    if (humanBatting()) for (const side of ['left', 'right']) engine.setFlipper(side, held[side]);
    adapter.armDelivery();
    engine.releaseLaunch({
      line: selection.line,
      charge: selection.power,
      deliveryType: selection.type || 'PACE',
      movementScale: selection.movementScale ?? 1
    });
    onFeedback({ type: 'DELIVERY_LAUNCH', selection, match: displayState() });
    running = true; ready = false; stepAccumulator = 0;
    cue.textContent = humanBatting() ? 'You bat · ball live' : 'CPU batting · ball live';
    controls();
    return true;
  }
  return {
    reset, launch, setPaused, get paused() {return paused;}, get running() { return running; }, get match() { return match; },
    step(dt) {
      if(paused)return;
      if (!running) { engine.updateFlippers(Math.min(Math.max(dt, 0), table.physics.maxFrameDelta)); return; }
      stepAccumulator += Math.min(Math.max(dt, 0), table.physics.maxFrameDelta);
      while (running && stepAccumulator >= table.physics.fixedStep) {
        cpu.update(engine.simTime * 1000, !practice && !humanBatting());
        adapter.step(table.physics.fixedStep);
        stepAccumulator -= table.physics.fixedStep;
      }
    },
    bat(side, pressed) { if(paused)return; if (pressed && !practice && !canBat()) return; engine.setFlipper(side, pressed); document.querySelector(`#${side}Bat`).classList.toggle('pressed', pressed); }
  };
}
