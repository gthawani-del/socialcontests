export const overs = balls => `${Math.floor(balls / 6)}.${balls % 6}`;
const names = {player:'You',cpu:'CPU'};
export function deliveryCommentary(outcome, metadata = {}, ballNumber = 1) {
  if(outcome==='DEAD_BALL')return 'Dead ball. No score added; this delivery will be re-bowled.';
  if(metadata.reason==='RISK_WICKET')return 'Wicket! The attacking shot was mistimed.';
  if(metadata.reason==='SKILL_REJECTED')return 'Dot ball. The shot did not qualify for runs.';
  const lines={ONE:['One run added to the board.','A single. Keep the scoreboard moving.','One more run. Every run counts.'],TWO:['Two runs! A useful addition.','Two more added to the total.'],FOUR:['FOUR! The boundary target delivers.','Four runs! A valuable boundary.'],SIX:['SIX! Maximum runs from the scoring ramp.','Six runs! That gives the score a lift.'],WICKET:['Wicket! The ball finds the wicket drain.'],DOT:['Dot ball. No runs from that delivery.','No addition to the score. A dot ball.']};
  const choices=lines[outcome] || ['Delivery complete.'];return choices[Math.max(0,ballNumber-1)%choices.length];
}
export function createMatchPresentation({app,getFlow,audio}) {
  const controls=app.querySelector('.controls');
  const line=document.createElement('p');line.id='matchCommentary';line.setAttribute('role','status');line.textContent='Win the toss. Choose your innings.';controls.prepend(line);
  const score=app.querySelector('#score');score.setAttribute('role','button');score.tabIndex=0;score.setAttribute('aria-label','Open scorecard and commentary');score.setAttribute('aria-haspopup','dialog');
  const dialog=document.createElement('dialog');dialog.id='matchDetails';dialog.innerHTML=`<div class="details-heading"><h2>Scorecard</h2><button type="button" id="closeMatchDetails" aria-label="Close scorecard">Close</button></div><p class="pause-note">Match paused while this panel is open</p><div id="scorecardContent"></div><details class="sound-settings"><summary>Sound settings</summary><label>Sound effects <input id="effectsVolume" type="range" min="0" max="100" step="10"></label><label>Crowd <input id="crowdVolume" type="range" min="0" max="100" step="10"></label><button type="button" id="muteGame">Mute all</button><button type="button" id="testSound">Test sound</button></details>`;app.append(dialog);
  const sound=document.createElement('button');sound.id='soundSettings';sound.type='button';sound.setAttribute('aria-label','Sound settings');sound.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12-1c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></svg>';app.querySelector('header').insertBefore(sound,app.querySelector('#restart'));
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
    for(const log of logs.toReversed()){const item=document.createElement('li');item.textContent=`${log.label} · ${log.text}`;list.append(item);}content.append(list);
  }
  function open(soundOnly=false){previous=document.activeElement;getFlow()?.setPaused(true);paint();dialog.showModal();dialog.querySelector('.sound-settings').open=soundOnly;dialog.querySelector('#closeMatchDetails').focus();}
  score.onclick=()=>open();score.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};
  sound.onclick=()=>open(true);
  dialog.querySelector('#closeMatchDetails').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{getFlow()?.setPaused(false);previous?.focus();});
  return {handle(event){
    if(event.match)state=event.match;
    if(event.type==='MATCH_RESET'){logs=[];seen.clear();line.textContent='Win the toss. Choose your innings.';}
    if(event.type==='CONTROL_STATE' && state?.innings>0 && logs.length===0)line.textContent=event.humanBatting?'Your innings. Use both bats to score.':'CPU batting. Pull the right-side lever to bowl.';
    if(event.type==='OUTCOME'){
      const last=state?.deliveryHistory?.at(-1),dead=event.outcome==='DEAD_BALL';
      const key=dead?null:`${last?.innings}:${last?.ballNumber}`;
      if(key && seen.has(key))return;if(key)seen.add(key);
      const text=deliveryCommentary(event.outcome,event.metadata,last?.ballNumber || 1);
      logs.push({label:dead?`Innings ${state.innings} · Dead ball`:`Innings ${last?.innings}, ball ${last?.ballNumber}`,text});line.textContent=text;
    }
    if(event.type==='MATCH_RESULT')line.textContent=event.result?.type==='TIE'?'Scores tied.':`${names[event.result?.winnerId]} won the match.`;
    if(state?.target!==null && state?.roundInnings===2 && !state?.result){score.setAttribute('aria-label',`Scorecard. ${state.requiredRuns} needed from ${state.ballsRemaining} balls`);}
    if(dialog.open)paint();
  }};
}
