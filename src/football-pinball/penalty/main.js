import './style.css';
import { drawKeeper } from './keeper-view.js';
import {BOOT,TABLE_HEIGHT,BALL_RADIUS,bootSegment} from './contact.js';
import { createDuel, duelScore } from './engine.js';
const ART='/football-pinball/penalty/';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const soundIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3zM16 8q5 4 0 8M19 4q9 8 0 16"/></svg>';
export async function mountPenalty(){
  const root=document.querySelector('#footballApp');root.className='pd-app';
  let settings={format:'standard',total:5,difficulty:'rookie',sound:true};
  try{settings={...settings,...JSON.parse(localStorage.getItem('penalty-duel-settings')||'{}')};}catch{}
  settings.total=settings.total===3?3:5;settings.format=settings.format==='fixed'?'fixed':'standard';
  if(!['rookie','pro','elite'].includes(settings.difficulty))settings.difficulty='rookie';
  let engine,frame,last=0,seen=0,screen='setup',assetError=false;
  const random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
  const assets={};
  const kickSound=new Audio('/football-pinball/audio/Soccer-kick.mp3');kickSound.volume=.45;
  const cheer=new Audio('/football-pinball/audio/crowd-cheering.mp3');cheer.volume=.18;
  const audio=clip=>{if(settings.sound){clip.currentTime=0;clip.play().catch(()=>{});}};
  const save=()=>{try{localStorage.setItem('penalty-duel-settings',JSON.stringify(settings));}catch{}};
  const header=(play=false)=>`<header class="pd-header"><a href="/football-pinball/" aria-label="Game selection" class="pd-back">‹</a><a href="/football-pinball/" class="pd-brand">FOOTBALL <span>PINBALL</span></a>${play?'<button class="pd-icon" id="pd-pause" aria-label="Pause game">Ⅱ</button>':'<span class="pd-header-spacer"></span>'}</header>`;
  function setup(){
    screen='setup';engine=null;seen=0;root.dataset.screen='setup';
    root.innerHTML=`${header()}<section class="pd-setup"><div class="pd-intro"><p class="pd-eyebrow">PENALTY SHOOTOUT</p><h1>Penalty Duel</h1><p>Shoot. Save. Win.</p></div><div class="pd-hero"><img src="${ART}settings-hero.webp" alt="Floodlit penalty arena with goalkeeper, football and blue and red boot flippers"></div><form id="pd-options"><fieldset><legend>Game mode</legend><div class="pd-length">${[['standard','Standard','Switch roles after each shot'],['fixed','Fixed Role','One role for the whole round']].map(([v,t,d])=>`<label><input type="radio" name="format" value="${v}" ${settings.format===v?'checked':''}><span><strong>${t}</strong><small>${d}</small><i aria-hidden="true">✓</i></span></label>`).join('')}</div></fieldset><fieldset><legend>Match length</legend><div class="pd-length">${[[3,'Quick'],[5,'Classic']].map(([n,t])=>`<label><input type="radio" name="length" value="${n}" ${settings.total===n?'checked':''}><span><strong>${t}</strong><small>${n} ${settings.format==='fixed'?'attempts':'each'}</small><i aria-hidden="true">✓</i></span></label>`).join('')}</div></fieldset><fieldset><legend>Difficulty</legend><div class="pd-level">${['rookie','pro','elite'].map(d=>`<label><input type="radio" name="difficulty" value="${d}" ${settings.difficulty===d?'checked':''}><span>${d[0].toUpperCase()+d.slice(1)}</span></label>`).join('')}</div></fieldset><p class="pd-toss-note"><span aria-hidden="true">◉</span>Win the toss. Choose your role. Standard switches after each shot; Fixed Role stays for the round.</p><div class="pd-options-row"><button type="button" id="pd-sound" aria-pressed="${settings.sound}">${soundIcon}<span>Sound ${settings.sound?'on':'off'}</span></button><button type="button" id="pd-help">How to play <span aria-hidden="true">↗</span></button></div><button class="pd-primary" id="pd-continue" type="submit">Continue to toss <span aria-hidden="true">→</span></button></form></section><dialog id="pd-help-dialog" class="pd-dialog"><h2>How to play</h2><p>Standard: switch roles after each penalty; most goals wins, with paired sudden death. Fixed Role: keep your chosen role; goals score for the striker and stops score for the keeper. First to a majority wins.</p><h3>Shooting</h3><p>The ball rolls into the boots. Hold a boot or ← / → to build power, then release as it reaches the boot. Contact angle sends the ball left or right. Choose Low or High for shot height. A swing that misses uses your attempt.</p><h3>Saving</h3><p>Drag the keeper on the arena or hold ← / → to move. Use the diagonal buttons to dive. Movement continues during ball flight until you commit to a dive.</p><p>One kick per attempt. A save or miss ends that attempt.</p><button class="pd-primary" id="pd-help-close">Got it</button></dialog>`;
    root.querySelector('#pd-options').onchange=()=>{const data=new FormData(root.querySelector('form'));settings.format=data.get('format');settings.total=Number(data.get('length'));root.querySelectorAll('[name=length]').forEach(i=>i.nextElementSibling.querySelector('small').textContent=`${i.value} ${settings.format==='fixed'?'attempts':'each'}`);settings.difficulty=data.get('difficulty');save();};
    root.querySelector('#pd-sound').onclick=e=>{settings.sound=!settings.sound;save();const b=e.currentTarget;b.setAttribute('aria-pressed',settings.sound);b.querySelector('span').textContent=`Sound ${settings.sound?'on':'off'}`;};
    root.querySelector('#pd-help').onclick=()=>root.querySelector('dialog').showModal();
    root.querySelector('#pd-help-close').onclick=()=>root.querySelector('dialog').close();
    root.querySelector('form').onsubmit=e=>{e.preventDefault();if(assetError)return;engine=createDuel({...settings,random});showGame();showToss();};
  }
  function showGame(){
    screen='game';root.dataset.screen='game';
    root.innerHTML=`${header(true)}<section class="pd-scoreboard" aria-label="Score"><div><b class="pd-you">YOU</b><div id="pd-you-dots" class="pd-dots"></div></div><strong id="pd-score">0 — 0</strong><div><b class="pd-cpu">CPU</b><div id="pd-cpu-dots" class="pd-dots"></div></div></section><div class="pd-round"><span id="pd-round">ROUND 1 OF ${settings.total}</span><span id="pd-role" class="pd-role">TOSS</span></div><div class="pd-arena"><canvas id="pd-canvas" aria-label="Penalty arena. Watch the ball and release a boot to strike. Drag to move your goalkeeper when defending."></canvas><div id="pd-overlay" class="pd-overlay" hidden></div><p id="pd-pressure" hidden></p><p id="pd-cue" hidden></p><p id="pd-result-flash" hidden></p></div><p id="pd-instruction" class="pd-instruction" role="status" aria-live="polite"></p><section id="pd-striker" class="pd-controls"><button data-boot="left" aria-label="Left boot"><img src="${ART}left.webp" alt=""><span>LEFT BOOT</span></button><div><strong id="pd-contact-label">HOLD TO CHARGE</strong><div class="pd-height" aria-label="Shot height"><button data-height=".72" aria-pressed="true">LOW</button><button data-height=".22" aria-pressed="false">HIGH</button></div><div class="pd-meter pd-power" aria-label="Shot power"><span id="pd-power"></span></div><small id="pd-power-label">POWER · 0%</small></div><button data-boot="right" aria-label="Right boot"><img src="${ART}right.webp" alt=""><span>RIGHT BOOT</span></button></section><section id="pd-defender" class="pd-defender" hidden><div class="pd-move"><button data-move="-1" aria-label="Move keeper left">← MOVE</button><small>DRAG KEEPER · HOLD TO MOVE</small><button data-move="1" aria-label="Move keeper right">MOVE →</button></div><div class="pd-save-buttons"><button data-dive=".08,.22" aria-label="Dive top left">↖</button><button data-dive=".08,.8" aria-label="Dive low left">↙</button><button data-dive=".5,.65" aria-label="Hold centre">HOLD</button><button data-dive=".92,.8" aria-label="Dive low right">↘</button><button data-dive=".92,.22" aria-label="Dive top right">↗</button></div></section><dialog class="pd-dialog" id="pd-pause-dialog"><h2>Match paused</h2><button class="pd-primary" id="pd-resume">Resume match</button><button class="pd-secondary" id="pd-restart">Back to settings</button></dialog>`;
    root.querySelector('#pd-pause').onclick=pause;
    root.querySelector('#pd-resume').onclick=resume;
    root.querySelector('#pd-pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resume();});
    root.querySelector('#pd-restart').onclick=()=>{root.querySelector('dialog').close();setup();};
    root.querySelectorAll('[data-boot]').forEach(b=>{
      b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);b.classList.add('pressed');engine.startCharge(b.dataset.boot);};
      const cancel=()=>{b.classList.remove('pressed');engine.cancelCharge();};b.onpointerup=()=>{b.classList.remove('pressed');engine.releaseCharge(b.dataset.boot);};b.onpointercancel=cancel;b.onlostpointercapture=cancel;b.onkeyup=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();engine.releaseCharge(b.dataset.boot);}};
      b.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();if(!e.repeat)engine.startCharge(b.dataset.boot);}};
    });
    root.querySelectorAll('[data-height]').forEach(b=>b.onclick=()=>{engine.aim(.5,Number(b.dataset.height));root.querySelectorAll('[data-height]').forEach(v=>v.setAttribute('aria-pressed',v===b));});
    root.querySelectorAll('[data-dive]').forEach(b=>b.onclick=()=>engine.dive(...b.dataset.dive.split(',').map(Number)));
    root.querySelectorAll('[data-move]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);engine.moveKeeper(Number(b.dataset.move));};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>engine.stopKeeper();});
    const canvas=root.querySelector('canvas');let pointer;
    const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};};
    canvas.onpointerdown=e=>{const p=point(e);canvas.setPointerCapture(e.pointerId);pointer=p;if(engine.state.turn==='cpu')engine.position((p.x-.215)/.57);};
    canvas.onpointermove=e=>{if(pointer&&engine.state.turn==='cpu')engine.position((point(e).x-.215)/.57);};
    canvas.onpointerup=()=>{pointer=null;};canvas.onpointercancel=()=>{pointer=null;engine.stopKeeper();};
  }
  function overlay(html){const el=root.querySelector('#pd-overlay');el.hidden=false;el.innerHTML=html;return el;}
  function showToss(){
    const el=overlay('<h2>Call the toss</h2><p>Winner chooses the first role.</p><div class="pd-toss-buttons"><button data-call="heads">H<span>Heads</span></button><button data-call="tails">T<span>Tails</span></button></div>');
    el.querySelectorAll('[data-call]').forEach(b=>b.onclick=()=>{engine.toss(b.dataset.call);el.innerHTML='<div class="pd-coin spinning" aria-label="Coin spinning">●</div><p>Coin in the air…</p>';});
  }
  function pause(){if(!engine||engine.state.phase==='ended')return;engine.pause(true);root.querySelector('#pd-pause-dialog').showModal();}
  function resume(){root.querySelector('#pd-pause-dialog')?.close();engine?.pause(false);last=performance.now();}
  const onVisibility=()=>{if(document.hidden&&engine&&!engine.state.paused&&engine.state.phase!=='ended')pause();};
  const onKey=e=>{
    if(!engine||engine.state.paused||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)||e.target.matches('input,textarea,select')||(e.key===' '&&e.target.matches('button')))return;
    e.preventDefault();if(e.repeat)return;
    if(engine.state.turn==='you'){if(e.key==='ArrowLeft'||e.key==='ArrowRight')engine.startCharge(e.key==='ArrowLeft'?'left':'right');}
    else if(e.key==='ArrowLeft'||e.key==='ArrowRight')engine.moveKeeper(e.key==='ArrowLeft'?-1:1);
    else engine.dive(.5,e.key==='ArrowUp'?.12:.8);
  };
  const onKeyUp=e=>{if(!engine)return;if(['ArrowLeft','ArrowRight'].includes(e.key)){engine.releaseCharge(e.key==='ArrowLeft'?'left':'right');engine.stopKeeper();}};
  const cancelInputs=()=>{engine?.cancelCharge();engine?.stopKeeper();};
  document.addEventListener('keydown',onKey);document.addEventListener('keyup',onKeyUp);window.addEventListener('blur',cancelInputs);document.addEventListener('visibilitychange',onVisibility);
  function draw(){
    const s=engine.state,canvas=root.querySelector('canvas'),r=canvas.getBoundingClientRect();
    engine.resizeArena(r.width,r.height);
    const scale=Math.min(devicePixelRatio,2),w=Math.round(r.width*scale),h=Math.round(r.height*scale);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const c=canvas.getContext('2d');c.clearRect(0,0,w,h);c.drawImage(assets.board,0,0,w,h);
    const sprite=(key,x,y,sw,sh,angle=0)=>{c.save();c.translate(x*w,y*h);c.rotate(angle);c.drawImage(assets[key],-sw*w/2,-sh*h/2,sw*w,sh*h);c.restore();};
    // Goal position and keeper hit region use the same projection as engine flight.
    c.save();c.lineWidth=2*scale;
    for(const [x,y,color] of [[.27,.19,'#ff8a28'],[.73,.19,'#ff8a28'],[.27,.275,'#26aaff'],[.73,.275,'#26aaff']]){
      c.strokeStyle=color;c.shadowColor=color;c.shadowBlur=12*scale;
      for(const radius of [9,14]){c.beginPath();c.arc(x*w,y*h,radius*scale,0,Math.PI*2);c.stroke();}
    }
    for(const [x,color] of [[.08,'#258dff'],[.92,'#ff4058']]){c.strokeStyle=color;c.shadowColor=color;c.shadowBlur=9*scale;c.beginPath();c.moveTo(x*w,.42*h);c.lineTo((x<.5?.035:.965)*w,.75*h);c.stroke();}
    c.restore();drawKeeper(c,assets.keeper,s.keeper,w,h);
    // A receiving pocket provides a visible boundary in front of the flippers.
    if(s.phase==='aim'){
      c.save();c.strokeStyle='#c6e5dd70';c.lineWidth=1.5*scale;c.setLineDash([3*scale,5*scale]);c.beginPath();c.ellipse(.5*w,.785*h,.063*w,.020*h,0,0,Math.PI);c.stroke();c.restore();
    }
    for(const side of ['left','right']){
      const left=side==='left',seg=bootSegment(side,s.boots[side]);
      c.save();c.translate(seg.a.x*w,seg.a.y/TABLE_HEIGHT*h);c.scale(w,h/TABLE_HEIGHT);c.rotate(left?-s.boots[side]:s.boots[side]);
      c.drawImage(assets[side],left?0:-BOOT.length,-.06*TABLE_HEIGHT,BOOT.length,.15*TABLE_HEIGHT);c.restore();
      if(s.cue?.side===side&&s.phase==='aim'){
        c.save();c.strokeStyle=s.cue.stage==='strike'?'#fff0ad':'#ffb95c';c.shadowColor=c.strokeStyle;c.shadowBlur=10*scale;c.lineWidth=3*scale;c.beginPath();c.arc(seg.a.x*w,(seg.a.y/TABLE_HEIGHT)*h,16*scale,0,Math.PI*2);c.stroke();c.restore();
      }
    }
    const p=s.flight?clamp(s.flight.elapsed/s.flight.duration,0,1):0;
    if(s.flight&&s.flight.elapsed<.12){const hit=s.flight.contact.point;c.save();c.strokeStyle='#fff4c4';c.lineWidth=2*scale;c.globalAlpha=1-s.flight.elapsed/.12;c.beginPath();c.arc(hit.x*w,hit.y*h,(5+s.flight.elapsed*90)*scale,0,Math.PI*2);c.stroke();c.restore();}
    const ballSize=BALL_RADIUS*2-(BALL_RADIUS*2-.035)*p;
    c.save();c.globalAlpha=.30;c.fillStyle='#000';c.beginPath();c.ellipse(s.ball.x*w,(s.ball.y+.045)*h,ballSize*w*.48,ballSize*w*.13,0,0,Math.PI*2);c.fill();c.restore();
    sprite('ball',s.ball.x,s.ball.y,ballSize,ballSize*w/h,(s.elapsed*3));
  }
  let renderedPhase='',hudKey='';
  function hud(){
    const s=engine.state;const score=duelScore(s),goals=t=>score[t];
    const key=JSON.stringify([s.phase,s.turn,s.history,s.message,s.paused,!!s.dive,!!s.swing,s.pressure]);
    if(key===hudKey)return;hudKey=key;
    root.querySelector('#pd-score').textContent=`${goals('you')} — ${goals('cpu')}`;
    for(const team of ['you','cpu']){
      const list=s.format==='fixed'?s.history[s.first||s.turn].map(v=>(team===(s.first||s.turn)?v==='goal':v!=='goal')?'goal':'miss'):s.history[team],fullCount=Math.max(s.total,list.length+(s.turn===team&&!s.winner?1:0)),offset=Math.max(0,fullCount-5),count=Math.min(5,fullCount);
      root.querySelector(`#pd-${team}-dots`).innerHTML=Array.from({length:count},(_,j)=>{const i=j+offset;return `<span class="${list[i]==='goal'?'goal':list[i]?'miss':''}" aria-label="Attempt ${i+1}: ${list[i]||'remaining'}">${list[i]&&list[i]!=='goal'?'×':''}</span>`;}).join('');
    }
    const round=(s.format==='fixed'?s.history[s.first||s.turn].length:Math.min(s.history.you.length,s.history.cpu.length))+1;
    root.querySelector('#pd-round').textContent=round>s.total?'SUDDEN DEATH':`ROUND ${Math.min(round,s.total)} OF ${s.total}`;
    root.querySelector('#pd-role').textContent=['setup','toss','choice','countdown'].includes(s.phase)?'TOSS':s.turn==='you'?'YOUR SHOT':'YOUR SAVE';
    root.querySelector('#pd-role').classList.toggle('saving',s.turn==='cpu');
    root.querySelector('#pd-striker').hidden=s.turn!=='you';root.querySelector('#pd-defender').hidden=s.turn!=='cpu';
    root.querySelector('#pd-instruction').textContent=s.message;
    const pressure=root.querySelector('#pd-pressure');pressure.hidden=!s.pressure||!['aim','flight'].includes(s.phase);pressure.textContent=s.pressure;
    root.querySelectorAll('[data-height]').forEach(b=>{b.disabled=s.phase!=='aim'||s.paused||!!s.swing;b.setAttribute('aria-pressed',Math.abs(Number(b.dataset.height)-s.aim.y)<.1);});
    root.querySelectorAll('[data-boot]').forEach(b=>b.disabled=s.phase!=='aim'||!!s.swing||s.paused);
    root.querySelectorAll('[data-dive]').forEach(b=>b.disabled=!['aim','flight'].includes(s.phase)||!!s.dive||s.paused);
    root.querySelectorAll('[data-move]').forEach(b=>b.disabled=!['aim','flight'].includes(s.phase)||!!s.dive||s.paused);
    const flash=root.querySelector('#pd-result-flash');flash.hidden=s.phase!=='result';flash.textContent=s.outcome==='goal'?'GOAL':s.outcome==='save'?'SAVED':'MISSED';flash.dataset.outcome=s.outcome;
    if(s.phase!==renderedPhase){
      renderedPhase=s.phase;
      if(s.phase==='choice'){
        const el=overlay(`<div class="pd-coin">${s.toss.face==='heads'?'H':'T'}</div><h2>${s.toss.face}. You win!</h2><p>${s.format==='fixed'?'Choose your role for the whole round.':'Choose your first role.'}</p><button class="pd-primary" data-first="you">${s.format==='fixed'?'Play striker':'Shoot first'}</button><button class="pd-secondary" data-first="cpu">${s.format==='fixed'?'Play goalkeeper':'Save first'}</button>`);
        el.querySelectorAll('[data-first]').forEach(b=>b.onclick=()=>engine.choose(b.dataset.first));
      }else if(s.phase==='countdown')overlay(`<div class="pd-coin">${s.toss.face==='heads'?'H':'T'}</div><h2>${s.toss.face}. ${s.toss.winner==='you'?'You win':'CPU wins'}.</h2><p>${s.format==='fixed'?(s.first==='you'?'You are striker this round.':'You are goalkeeper this round.'):(s.first==='you'?'You shoot first.':'You save first.')}</p><strong>Get ready</strong>`);
      else if(s.phase==='aim'){root.querySelector('#pd-overlay').hidden=true;}
      else if(s.phase==='ended'){
        const el=overlay(`<p class="pd-eyebrow">FULL TIME</p><h2>${s.winner==='you'?'You win!':'CPU wins'}</h2><strong class="pd-final-score">${goals('you')} — ${goals('cpu')}</strong><p>${s.history.you.length} shots · ${s.history.cpu.length} CPU shots</p><button class="pd-primary" id="pd-rematch">Play again</button><button class="pd-secondary" id="pd-settings">Match settings</button>`);
        el.querySelector('#pd-rematch').onclick=()=>{engine=createDuel({...settings,random});seen=0;renderedPhase='';hudKey='';showGame();showToss();};el.querySelector('#pd-settings').onclick=setup;
      }
    }
  }
  function loop(now){const dt=last?(now-last)/1000:0;last=now;if(engine&&screen==='game'){
    engine.advance(dt);hud();draw();const s=engine.state;
    const q=s.charge,power=q?.power??s.swing?.power??s.flight?.contact?.power??0;
    root.querySelector('#pd-contact-label').textContent=s.swing?'SWINGING':q?'WATCH THE BALL':'HOLD TO CHARGE';
    const cue=root.querySelector('#pd-cue');cue.hidden=s.turn!=='cpu'||s.phase!=='aim'||!s.cue;cue.textContent=s.cue?.stage==='strike'?'KICK COMING':'WATCH THE BOOT';
    root.querySelector('#pd-power').style.width=`${power*100}%`;
    root.querySelector('#pd-power-label').textContent=`POWER · ${Math.round(power*100)}%`;

    for(const event of s.events)if(event.id>seen){seen=event.id;if(event.type==='KICK')audio(kickSound);if(event.type==='RESULT'&&((event.turn==='you'&&event.outcome==='goal')||(event.turn==='cpu'&&event.outcome==='save')))audio(cheer);}
  }frame=requestAnimationFrame(loop);}
  setup();const start=root.querySelector('#pd-continue');start.disabled=true;start.textContent='Loading arena…';
  try{
    await Promise.all(['board','keeper','left','right','ball'].map(key=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{assets[key]=img;resolve();};img.onerror=reject;img.src=ART+key+'.webp';})));
    start.disabled=false;start.innerHTML='Continue to toss <span aria-hidden="true">→</span>';
    frame=requestAnimationFrame(loop);
  }catch{assetError=true;start.textContent='Arena unavailable — reload to retry';}
  if(import.meta.env.DEV&&new URLSearchParams(location.search).has('qa'))window.__penalty={get engine(){return engine;},snapshot:()=>engine?.snapshot(),assets};
  window.addEventListener('pagehide',event=>{if(event.persisted){pause();return;}cancelAnimationFrame(frame);document.removeEventListener('keydown',onKey);document.removeEventListener('keyup',onKeyUp);window.removeEventListener('blur',cancelInputs);document.removeEventListener('visibilitychange',onVisibility);kickSound.pause();cheer.pause();},{once:true});
}
