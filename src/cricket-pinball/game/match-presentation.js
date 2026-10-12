export const overs = balls => `${Math.floor(balls / 6)}.${balls % 6}`;
const names = {player:'You',cpu:'CPU'};
export function deliveryCommentary(outcome, metadata = {}, ballNumber = 1) {
  if(outcome==='DEAD_BALL')return 'Dead ball. No score added; this delivery will be re-bowled.';
  if(metadata.reason==='CAUGHT_OUT')return 'Caught out! The fielder took the ball before it bounced.';
  if(metadata.reason==='FIELDED')return 'Fielded along the ground. Dot ball.';
  if(metadata.reason==='RISK_WICKET')return 'Wicket! The attacking shot was mistimed.';
  if(outcome==='WICKET' && ['WICKET_DRAIN','DRAIN'].includes(metadata.reason))return 'Wicket! The ball entered the wicket drain.';
  if(outcome==='WICKET')return 'Wicket recorded.';
  if(metadata.reason==='SKILL_REJECTED')return 'Dot ball. The shot did not qualify for runs.';
  const lines={ONE:['One run added to the board.','A single. Keep the scoreboard moving.','One more run. Every run counts.'],TWO:['Two runs! A useful addition.','Two more added to the total.'],FOUR:['FOUR! The boundary target delivers.','Four runs! A valuable boundary.'],SIX:['SIX! Maximum runs from the scoring ramp.','Six runs! That gives the score a lift.'],WICKET:['Wicket! The ball finds the wicket drain.'],DOT:['Dot ball. No runs from that delivery.','No addition to the score. A dot ball.']};
  const choices=lines[outcome] || ['Delivery complete.'];return choices[Math.max(0,ballNumber-1)%choices.length];
}
export function matchSituation(state) {
  if (!state || state.result || !state.innings) return '';
  if (state.target != null && state.roundInnings === 2) return `${state.requiredRuns} needed from ${state.ballsRemaining} ball${state.ballsRemaining === 1 ? '' : 's'}${state.ballsRemaining === 1 ? ' · FINAL BALL' : ''}`;
  return state.ballsRemaining === 1 ? 'FINAL BALL OF THE INNINGS' : '';
}
export function matchResultSummary(state) {
  if (!state?.result) return '';
  const result = state.result;
  if (result.type === 'TIE') return 'Match tied · Scores level';
  const unit = result.marginType === 'RUNS' ? (result.margin === 1 ? 'run' : 'runs') : (result.margin === 1 ? 'ball remaining' : 'balls remaining');
  return `${names[result.winnerId] || 'Player'} won · ${result.margin} ${unit}`;
}
export function createMatchPresentation({app,getFlow,audio}) {
  const controls=app.querySelector('.controls');
  const line=document.createElement('p');line.id='matchCommentary';line.setAttribute('role','status');line.textContent='Win the toss. Choose your innings.';controls.prepend(line);
  const score=app.querySelector('#score');score.setAttribute('role','button');score.tabIndex=0;score.setAttribute('aria-label','Open scorecard and commentary');score.setAttribute('aria-haspopup','dialog');
  const dialog=document.createElement('dialog');dialog.id='matchDetails';dialog.innerHTML=`<div class="details-heading"><h2>Scorecard</h2><button type="button" id="closeMatchDetails" aria-label="Close scorecard">Close</button></div><p class="pause-note">Match paused while this panel is open</p><div id="scorecardContent"></div><details class="sound-settings"><summary>Sound settings</summary><label>Sound effects <input id="effectsVolume" type="range" min="0" max="100" step="10"></label><label>Crowd <input id="crowdVolume" type="range" min="0" max="100" step="10"></label><button type="button" id="muteGame">Mute all</button><button type="button" id="testSound">Test sound</button></details>`;app.append(dialog);
  const sound=document.createElement('button');sound.id='soundSettings';sound.type='button';sound.setAttribute('aria-label','Sound settings');sound.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12-1c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></svg>';app.querySelector('header').insertBefore(sound,app.querySelector('#restart'));
  const tension=document.createElement('p');tension.id='matchTension';tension.setAttribute('role','status');tension.hidden=true;controls.prepend(tension);
  let state=null, logs=[],seen=new Set(),previous=null;
  const settings=audio.getSettings();
  for(const [id,key] of [['effectsVolume','effects'],['crowdVolume','crowd']]){
    const input=dialog.querySelector('#'+id);input.value=settings[key]*100;
    input.oninput=()=>audio.configure({[key]:Number(input.value)/100});
  }
  const mute=dialog.querySelector('#muteGame');
  const updateMute=()=>{mute.textContent=audio.getSettings().muted?'Unmute all':'Mute all';mute.setAttribute('aria-pressed',String(audio.getSettings().muted));};updateMute();
  mute.onclick=()=>{audio.configure({muted:!audio.getSettings().muted});updateMute();};
  dialog.querySelector('#testSound').onclick=()=>{audio.prime();audio.play('bat');};
  function paint(){
    const content=dialog.querySelector('#scorecardContent');content.replaceChildren();
    if(state?.result){const summary=document.createElement('p');summary.className='result-summary';summary.textContent=matchResultSummary(state);content.append(summary);}
    if(!state?.inningsHistory?.length){const p=document.createElement('p');p.textContent='The scorecard begins with the first innings.';content.append(p);return;}
    for(const innings of state.inningsHistory){
      const section=document.createElement('section');section.className='innings-score';
      const title=document.createElement('h3');title.textContent=`${innings.number>2?'Tie-break · ':''}Innings ${innings.number} · ${names[innings.battingPlayerId] || 'Player'}`;
      const total=document.createElement('p');total.className='innings-total';total.textContent=`${innings.runs}/${innings.wickets} · ${overs(innings.balls)} overs${innings.complete?' · Complete':''}`;
      const chips=document.createElement('div');chips.className='ball-results';
      for(const delivery of state.deliveryHistory.filter(d=>d.innings===innings.number)){
        const chip=document.createElement('span');chip.dataset.outcome=delivery.result.type;chip.textContent=delivery.result.wicket?'W':String(delivery.result.runs);chip.title=`Ball ${delivery.ballNumber}: ${delivery.result.type}`;chips.append(chip);
      }
      section.append(title,total,chips);content.append(section);
    }
    const chase=document.createElement('p');
    chase.textContent=state.result ? state.result.type==='TIE'?'Scores tied.':`${names[state.result.winnerId]} won · ${state.result.margin} ${state.result.marginType==='RUNS'?'runs':'balls remaining'}` : state.status==='INNINGS_BREAK'?`Target: ${state.target}`:state.target!==null?`${state.requiredRuns} needed from ${state.ballsRemaining} balls · Target ${state.target}`:'';content.append(chase);
    const heading=document.createElement('h3');heading.textContent='Ball-by-ball commentary';content.append(heading);
    const list=document.createElement('ol');list.className='commentary-list';
    for(const log of [...logs].reverse()){const item=document.createElement('li');item.textContent=`${log.label} · ${log.text}`;list.append(item);}content.append(list);
  }
  function open(soundOnly=false){previous=document.activeElement;getFlow()?.setPaused(true);paint();dialog.showModal();dialog.querySelector('.sound-settings').open=soundOnly;dialog.querySelector('#closeMatchDetails').focus();}
  score.onclick=()=>open();score.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};
  sound.onclick=()=>open(true);
  dialog.querySelector('#closeMatchDetails').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{getFlow()?.setPaused(false);previous?.focus();});
  return {handle(event){
    if(event.match)state=event.match;
    if(event.type==='MATCH_RESET'){logs=[];seen.clear();line.textContent='Win the toss. Choose your innings.';}
    if(event.type==='CONTROL_STATE' && event.ready && state?.innings>0 && logs.length===0)line.textContent=event.humanBatting?'Your innings. Use both bats to score.':'CPU batting. Pull the right-side lever to bowl.';
    if(event.type==='CPU_PLUNGER_PREP')line.textContent='CPU preparing to bowl. Watch the release.';
    if(event.type==='DELIVERY_LAUNCH')line.textContent='Ball released. Watch the bounce.';
    if(event.type==='DELIVERY_BOUNCE')line.textContent=state?.battingPlayerId==='player'?'Ball pitched. Time your shot.':'Ball pitched. Watch the CPU response.';
    if(event.type==='BAT_CONTACT')line.textContent='Bat contact. Watch the scoring targets.';
    if(event.type==='OUTCOME'){
      const last=state?.deliveryHistory?.at(-1),dead=event.outcome==='DEAD_BALL';
      const key=dead?null:`${last?.innings}:${last?.ballNumber}`;
      if(key && seen.has(key))return;if(key)seen.add(key);
      const text=deliveryCommentary(event.outcome,event.metadata,last?.ballNumber || 1);
      logs.push({label:dead?`Innings ${state.innings} · Dead ball`:`Innings ${last?.innings}, ball ${last?.ballNumber}`,text});line.textContent=text;
    }
    if(event.type==='MATCH_RESULT')line.textContent=matchResultSummary(state);
    tension.textContent=event.practice || getFlow()?.practice ? 'PRACTICE · No match result' : matchSituation(state);tension.hidden=!tension.textContent;tension.dataset.final=String(state?.ballsRemaining===1);
    if(event.type==='MATCH_RESULT')queueMicrotask(()=>{const panel=app.querySelector('#matchPanel');if(!panel || panel.querySelector('.open-final-scorecard'))return;const button=document.createElement('button');button.type='button';button.className='open-final-scorecard';button.textContent='View scorecard';button.onclick=()=>open();panel.append(button);});
    if(state?.target!==null && state?.roundInnings===2 && !state?.result){score.setAttribute('aria-label',`Scorecard. ${state.requiredRuns} needed from ${state.ballsRemaining} balls`);}
    if(dialog.open)paint();
  }};
}
