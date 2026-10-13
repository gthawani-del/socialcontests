import {BOWLERS,normalizeBowling} from './bowling-rules.js';
import { CricketMatchEngine } from '../match/match-engine.js';
import { createCricketGameplayAdapter } from './gameplay-adapter.js';
import { createCpuBattingAI, chooseTacticalBowling } from './cpu-opponent.js';
import { createTossController } from '../toss/toss-controller.js';

// Shared match rules; this module only coordinates stadium screen ownership/timing.
export function createStadiumMatch({ engine, table, rules, render, onReset, onFeedback = () => {}, practice = false }) {
  const cue = document.querySelector('#cue'), bowl = document.querySelector('#bowl');
  const panel = document.createElement('section'); panel.id = 'matchPanel'; panel.setAttribute('aria-label', 'Match setup');
  document.querySelector('#viewport').append(panel);
  let match, adapter, cpu, running = false, ready = false, format = 'LAST_3', difficulty = 'MEDIUM', stepAccumulator = 0;
  const timers = new Set(), pauseReasons = new Set();
  let paused = false, bowlerByInnings={}, currentBowler='MEDIUM', deliveryPlan=null;
  const practiceRole=practice==='bowl'?'bowl':'bat';
  const isPractice=Boolean(practice);
  const displayState = () => match ? {...match.getState(), practice:isPractice,bowler:currentBowler,inningsHistory:match.innings.map(i=>({...i})), deliveryHistory:match.deliveryHistory.map(d=>({...d}))} : null;
  const requested = new URLSearchParams(location.search);
  if (['LAST_3', 'ONE_OVER', 'TWO_OVER'].includes(requested.get('format'))) format = requested.get('format');
  if (['EASY', 'MEDIUM', 'HARD'].includes(requested.get('difficulty'))) difficulty = requested.get('difficulty');
  const toss = createTossController({ random: () => Math.random() });
  const schedule = job => { job.started=performance.now(); job.id=setTimeout(()=>{timers.delete(job);job.fn();},job.remaining); };
  const delay = (fn, ms) => {const job={fn,remaining:ms,id:null,started:0};timers.add(job);if(!paused)schedule(job);};
  function setPaused(value, reason='panel') {
    if(value)pauseReasons.add(reason);else pauseReasons.delete(reason);
    const nextPaused=pauseReasons.size>0;
    if(paused === nextPaused)return;
    paused=nextPaused;
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
  const canBat = () => Boolean(humanBatting() && match?.currentInnings && !match.currentInnings.complete);
  function releaseBats() {
    for (const side of ['left', 'right']) { engine.setFlipper(side, false); document.querySelector(`#${side}Bat`).classList.remove('pressed'); }
  }
  function controls() {
    bowl.disabled = paused || !ready || running || humanBatting();
    document.querySelector('.setup').classList.toggle('batting', humanBatting());
    bowl.textContent = !humanBatting() ? 'Bowl' : 'Ready for ball';
    for (const id of ['line', 'power', 'deliveryType', 'length']) {
      const element = document.querySelector(`#${id}`);
      if (element) element.disabled = paused || !ready || running || humanBatting();
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
    document.querySelector('#score').hidden = !state.innings;
    document.querySelector('#score').innerHTML = `<div><small>${state.innings ? `${name(match.currentInnings?.battingPlayerId || state.battingPlayerId)} batting` : 'Score'}</small><strong>${s.runs} / ${s.wickets}</strong></div><div><small>Ball</small><strong>${s.balls} <span>/ ${state.ballsPerInnings}</span></strong></div><div><small>${state.target !== null ? 'Target' : 'Innings'}</small><strong>${state.target !== null ? state.target : state.innings ? state.roundInnings : '—'}</strong></div>`;
  }
  function tossVisible(visible) {
    panel.classList.toggle('toss-panel', visible);
    document.querySelector('#stadiumApp').classList.toggle('toss-active', visible);
    panel.setAttribute('aria-label', visible ? 'Coin toss' : 'Match setup');
  }
  function show(title, body) { tossVisible(false); panel.hidden = false; panel.classList.remove('match-setup'); panel.innerHTML = `<h2>${title}</h2>${body}`; }
  function prepareBowler() {
    if(!match?.currentInnings || match.currentInnings.complete)return;
    ready=false;running=false;releaseBats();controls();
    const selectedMatch=match,key=match.currentInnings.number;
    if(bowlerByInnings[key]) {currentBowler=bowlerByInnings[key];makeReady();return;}
    engine.resetFieldPositions();
    onFeedback({type:'FIELD_RESET'});
    const confirm=bowler=>{if(paused || match!==selectedMatch || match.currentInnings.number!==key || ready)return;currentBowler=bowler;bowlerByInnings[key]=bowler;onFeedback({type:'BOWLER_SELECTED',bowler,human:!humanBatting(),match:displayState()});makeReady();};
    if(humanBatting()) {
      // Choose while paused too; the delivery timer remains suspended until resume.
      const keys=Object.keys(BOWLERS);currentBowler=keys[Math.floor(Math.random()*keys.length)];bowlerByInnings[key]=currentBowler;
      onFeedback({type:'BOWLER_SELECTED',bowler:currentBowler,human:false,match:displayState()});makeReady();return;
    }
    show('Choose your bowler',`<p>One bowler for this innings. Choose the ball and length before each delivery.</p><div class="bowler-options">${Object.entries(BOWLERS).map(([id,b])=>`<button type="button" data-bowler="${id}" aria-pressed="${id==='MEDIUM'}"><strong>${b.label}</strong><small>${id==='FAST'?'Speed and swing':id==='MEDIUM'?'Swing, cutters and slower balls':'Turn, flight and flipper'}</small></button>`).join('')}</div><button id="confirmBowler">Start bowling</button>`);
    let chosen='MEDIUM';
    panel.querySelectorAll('[data-bowler]').forEach(button=>button.onclick=()=>{chosen=button.dataset.bowler;panel.querySelectorAll('[data-bowler]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
    panel.querySelector('#confirmBowler').onclick=()=>confirm(chosen);
  }
  function makeReady() {
    if(!match?.currentInnings || match.currentInnings.complete)return;
    if(!bowlerByInnings[match.currentInnings.number]){prepareBowler();return;}
    ready = true; tossVisible(false); panel.hidden = true; delete cue.dataset.contact;
    cue.textContent = humanBatting()
      ? 'CPU preparing delivery'
      : 'Drag the ring to aim · pull and release the lever';
    controls(); hud();
    if (humanBatting()) {
      const selection = chooseTacticalBowling(difficulty,rules.cpu,{bowler:currentBowler,history:match.deliveryHistory.filter(d=>d.innings===match.currentInnings.number),state:match.getState()});
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
    onFeedback({ type: 'OUTCOME', outcome, metadata:{...metadata,selection:deliveryPlan}, match: displayState() });
    cue.textContent = metadata.displayText
      || (metadata.reason === 'RISK_WICKET'
        ? `MISTIMED ATTACK · WICKET`
        : metadata.reason === 'SKILL_REJECTED'
          ? `${metadata.attemptedOutcome} MISSED · ${metadata.scoring?.reason || 'MISTIMED'}`
          : outcome === 'DEAD_BALL'
            ? 'DEAD BALL · DOES NOT COUNT'
            : outcome);
    if (isPractice) {
      delay(()=>{if(match.currentInnings.complete){show('Practice complete',`<p>${match.currentInnings.runs} runs · ${match.currentInnings.wickets} wickets · ${match.currentInnings.balls} balls</p><button id="practiceAgain">Practice again</button><p><a href="/cricket-pinball/">Back to lobby</a></p>`);panel.querySelector('#practiceAgain').onclick=reset;}else makeReady();},Number(rules.delivery.resultHoldMs?.[outcome]??900));
      return;
    }

    const deadBall = outcome === 'DEAD_BALL';
    const holdMs = deadBall
      ? Number(rules.delivery.deadBallHoldMs ?? 1050)
      : Number(rules.delivery.resultHoldMs?.[outcome] ?? rules.delivery.betweenBallsMs);

    delay(() => {
      if (match.status === 'INNINGS_BREAK') {
        show('Innings break', `<p>${match.innings.at(-1).wickets >= match.maxWickets ? `${match.maxWickets} wickets lost` : `${match.ballsPerInnings} balls completed`} · ${match.innings.at(-1).balls}/${match.ballsPerInnings} balls</p><p>${match.battingPlayerId === 'player' ? 'You need' : 'CPU needs'} ${match.target} to win.</p><button id="continueInnings">Start chase</button>`);
        document.querySelector('#continueInnings').onclick = () => { match.startSecondInnings(); cpu.reset(); engine.resetBall(); prepareBowler(); };
      } else if (match.status === 'SUPER_OVER') {
        show('Scores tied', `<p>Three-ball tie-break. Two wickets per side.</p><button id="startTieBreak">Play tie-break</button>`);
        document.querySelector('#startTieBreak').onclick = () => { match.startSuperOver(); cpu.reset(); engine.resetBall(); prepareBowler(); };
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
    bowlerByInnings={};currentBowler='MEDIUM';deliveryPlan=null;
    adapter?.dispose(); cpu?.reset(); engine.resetBall(); onReset(); releaseBats();
    match = new CricketMatchEngine({ format: practice ? 'ONE_OVER' : format, difficulty, players: [{ id: 'player' }, { id: 'cpu' }], maxWickets: isPractice ? 6 : rules.maxWickets, superOver: rules.superOver.enabled, superOverBalls: rules.superOver.ballsPerInnings });
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
        cue.textContent = feedback.lofted ? 'LOFTED · WATCH THE FIELDERS' : feedback.timing === 'PERFECT'
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
    showToss(battingPlayerId === 'player' ? 'You bat first' : 'You bowl first', 'The match is ready to begin.', match.toss.result, '<span>Starting match…</span>');
    delay(() => { match.startInnings(); prepareBowler(); }, rules.toss.roleConfirmMs);
  }
  function coinMarkup(face = 'HEADS', flying = false) {
    const ball = '<circle cx="36" cy="36" r="24"/><path d="M18 52C39 50 50 36 52 18M14 47C33 45 45 33 47 14"/><path class="coin-stitch" d="m20 44 4 4m2-8 4 4m2-9 4 4m2-9 4 4m-1-10 4 4"/>';
    const wickets = '<path d="M20 58V19h32v39M36 19v39M17 13h16m6 0h16M15 59h42"/><path class="coin-stitch" d="M24 24v28m16-28v28"/>';
    const faceMarkup = (side, art) => `<div class="coin-face coin-${side.toLowerCase()}"><small>CRICKET PINBALL</small><svg viewBox="0 0 72 72" aria-hidden="true">${art}</svg><strong>${side}</strong></div>`;
    const rim = Array.from({length:48}, (_, i) => `<i style="--edge-angle:${i * 7.5}deg"></i>`).join('');
    return `<div class="toss-stage"><div class="toss-shadow" aria-hidden="true"></div><div class="toss-lift${flying ? ' tossing' : ''}" style="--toss-duration:${rules.toss.coinMs}ms"><div class="toss-coin ${face === 'TAILS' ? 'tails' : 'heads'}${flying ? ' flipping' : ''}" role="img" aria-label="${flying ? 'Coin flipping in the air' : face}"><div class="coin-edge" aria-hidden="true">${rim}</div>${faceMarkup('HEADS', ball)}${faceMarkup('TAILS', wickets)}</div></div></div>`;
  }
  function showToss(title, subtitle, face = 'HEADS', actions = '', flying = false) {
    show(title, '');
    tossVisible(true);
    panel.innerHTML = `<div class="toss-heading" role="status"><h2>${title}</h2><p>${subtitle}</p></div>${coinMarkup(face, flying)}<div class="toss-actions" id="tossChoice">${actions}</div>`;
  }
  function perform(call, caller) {
    const result = toss.perform(call, caller, caller === 'player' ? 'cpu' : 'player');
    if (!result) return;
    showToss('Coin in the air', `${name(caller)} called ${call.toLowerCase()}.`, result.result, '<span>Waiting for the coin to land…</span>', true);
    const coin = panel.querySelector('.toss-coin');
    const reveal = () => {
      if (panel.querySelector('.toss-coin') !== coin) return;
      match.setToss(result);
      showToss(`${name(result.winnerId)} won the toss`, `Result: ${result.result === 'HEADS' ? 'Heads' : 'Tails'}`, result.result, `<span>${result.winnerId === 'player' ? 'Choose whether to bat or bowl.' : 'CPU is choosing its innings…'}</span>`);
      delay(() => {
        if (result.winnerId === 'player') {
          document.querySelector('#tossChoice').innerHTML = '<button type="button" id="chooseBat">Bat first</button><button type="button" id="chooseBowl">Bowl first</button>';
          document.querySelector('#chooseBat').onclick = () => assign('BAT'); document.querySelector('#chooseBowl').onclick = () => assign('BOWL');
        } else { const choice = Math.random() < .5 ? 'BAT' : 'BOWL'; document.querySelector('#tossChoice').innerHTML = `<span>CPU chooses to ${choice.toLowerCase()} first.</span>`; delay(() => assign(choice), rules.toss.cpuChoiceMs); }
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
    for (const job of timers) clearTimeout(job.id); timers.clear(); paused=pauseReasons.size>0; bowlerByInnings={}; currentBowler='MEDIUM'; toss.reset(); newMatch();
    if (isPractice) { match.assignRoles({ battingPlayerId: practiceRole==='bat'?'player':'cpu', bowlingPlayerId: practiceRole==='bat'?'cpu':'player' }); match.startInnings(); prepareBowler(); }
    else {
      show('Set up your match', '<label>Format<select id="format"><option value="LAST_3">Last 3 balls</option><option value="ONE_OVER">One over</option><option value="TWO_OVER">Two overs</option></select></label><label>Difficulty<select id="difficulty"><option value="EASY">Easy</option><option value="MEDIUM" selected>Normal</option><option value="HARD">Hard</option></select></label><p>One over: 6 balls · Two overs: 12 balls · 2 wickets per innings.</p><button id="beginStadiumToss">Begin toss</button>');
      panel.classList.add('match-setup');
      document.querySelector('#format').value = format; document.querySelector('#difficulty').value = difficulty;
      document.querySelector('#beginStadiumToss').onclick = () => {
        format = document.querySelector('#format').value; difficulty = document.querySelector('#difficulty').value; newMatch();
        const caller = toss.pickCaller(match.players).id;
        if (caller === 'player') {
          showToss('Call the toss', 'Choose heads or tails.', 'HEADS', '<button type="button" id="callHeads">Heads</button><button type="button" id="callTails">Tails</button>');
          document.querySelector('#callHeads').onclick = () => perform('HEADS', caller); document.querySelector('#callTails').onclick = () => perform('TAILS', caller);
        } else { showToss('CPU calls the toss', 'Your opponent makes the call.', 'HEADS', '<span>Waiting for the call…</span>'); delay(() => perform(Math.random() < .5 ? 'HEADS' : 'TAILS', caller), rules.toss.cpuCallMs); }
      };
    }
    render();
  }
  function launch(selectionOverride = null) {
    if (paused || !ready || running || !match.currentInnings || match.currentInnings.complete) return false;
    const selection = normalizeBowling(selectionOverride || (humanBatting()
      ? chooseTacticalBowling(difficulty,rules.cpu,{bowler:currentBowler,history:match.deliveryHistory.filter(d=>d.innings===match.currentInnings.number),state:match.getState()})
      : {
          line: document.querySelector('#line')?.value || 'CENTRE',
          power: Number(document.querySelector('#power')?.value || 50) / 100,
          type: document.querySelector('#deliveryType')?.value || 'PACE',
          length: document.querySelector('#length')?.value || 'GOOD',
          movementScale: 1
        }),currentBowler);
    deliveryPlan=selection;
    if (!match.beginDelivery(selection)) return false;
    const held = Object.fromEntries(['left', 'right'].map(side => [side, engine.flippers.get(side).pressed]));
    engine.resetBall(); cpu.reset(); cpu.observeDelivery(selection,match.getState());
    // Commit CPU shot intent before launch; the same flight/catch rules apply to both sides.
    const state=match.getState();
    const chaseAttack=state.target!==null && state.requiredRuns>state.ballsRemaining*1.5;
    engine.deliveryShotMode=humanBatting() ? engine.shotMode : (chaseAttack || match.currentInnings.balls%3===2 ? 'LOFT':'GROUND');
    if (humanBatting()) for (const side of ['left', 'right']) engine.setFlipper(side, held[side]);
    adapter.armDelivery();
    engine.releaseLaunch({
      line: selection.line,
      charge: selection.power,
      deliveryType: selection.type || 'PACE',
      bowler:selection.bowler, length:selection.length,
      target:selection.target,
      movementScale: selection.movementScale ?? 1
    });
    onFeedback({ type: 'DELIVERY_LAUNCH', selection, practice:isPractice?practiceRole:false, match: displayState() });
    running = true; ready = false; stepAccumulator = 0;
    cue.textContent = humanBatting() ? 'You bat · ball live' : 'CPU batting · ball live';
    controls();
    return true;
  }
  return {
    reset, launch, setPaused, get practice(){return isPractice?practiceRole:false;}, get bowler(){return currentBowler;}, get paused() {return paused;}, get pauseReasons(){return [...pauseReasons];}, get running() { return running; }, get match() { return match; },
    step(dt) {
      if(paused)return;
      if (!running) { engine.updateFlippers(Math.min(Math.max(dt, 0), table.physics.maxFrameDelta)); return; }
      stepAccumulator += Math.min(Math.max(dt, 0), table.physics.maxFrameDelta);
      while (running && stepAccumulator >= table.physics.fixedStep) {
        cpu.update(engine.simTime * 1000, !humanBatting());
        adapter.step(table.physics.fixedStep);
        stepAccumulator -= table.physics.fixedStep;
      }
    },
    bat(side, pressed) { if(paused)return; if (pressed && !canBat()) return; engine.setFlipper(side, pressed); document.querySelector(`#${side}Bat`).classList.toggle('pressed', pressed); }
  };
}
