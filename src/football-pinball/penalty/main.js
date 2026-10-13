import './style.css';
import { createDuel } from './engine.js';
const ART='/football-pinball/penalty/';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const soundIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3zM16 8q5 4 0 8M19 4q9 8 0 16"/></svg>';
export async function mountPenalty(){
  const root=document.querySelector('#footballApp');root.className='pd-app';
  let settings={total:5,difficulty:'rookie',sound:true};
  try{settings={...settings,...JSON.parse(localStorage.getItem('penalty-duel-settings')||'{}')};}catch{}
  settings.total=settings.total===3?3:5;
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
    root.innerHTML=`${header()}<section class="pd-setup"><div class="pd-intro"><p class="pd-eyebrow">PENALTY SHOOTOUT</p><h1>Penalty Duel</h1><p>Shoot. Save. Win.</p></div><div class="pd-hero"><img src="${ART}settings-hero.webp" alt="Floodlit penalty arena with goalkeeper, football and blue and red boot flippers"></div><form id="pd-options"><fieldset><legend>Match length</legend><div class="pd-length">${[[3,'Quick'],[5,'Classic']].map(([n,t])=>`<label><input type="radio" name="length" value="${n}" ${settings.total===n?'checked':''}><span><strong>${t}</strong><small>${n} each</small><i aria-hidden="true">✓</i></span></label>`).join('')}</div></fieldset><fieldset><legend>Difficulty</legend><div class="pd-level">${['rookie','pro','elite'].map(d=>`<label><input type="radio" name="difficulty" value="${d}" ${settings.difficulty===d?'checked':''}><span>${d[0].toUpperCase()+d.slice(1)}</span></label>`).join('')}</div></fieldset><p class="pd-toss-note"><span aria-hidden="true">◉</span>Win the toss. Choose to shoot or save first.</p><div class="pd-options-row"><button type="button" id="pd-sound" aria-pressed="${settings.sound}">${soundIcon}<span>Sound ${settings.sound?'on':'off'}</span></button><button type="button" id="pd-help">How to play <span aria-hidden="true">↗</span></button></div><button class="pd-primary" id="pd-continue" type="submit">Continue to toss <span aria-hidden="true">→</span></button></form></section><dialog id="pd-help-dialog" class="pd-dialog"><h2>How to play</h2><p>Take turns shooting and saving. Most goals wins. A tie goes to paired sudden death.</p><h3>Shooting</h3><p>Drag inside the goal to aim. When the rolling ball reaches the boots, tap a boot or press ← / →. Clean contact gives the best accuracy.</p><h3>Saving</h3><p>Drag the keeper position slider before the kick. Swipe on the arena to dive, use the five save buttons, or use arrow keys. Commit early for reach, or react to the ball.</p><p>One kick per attempt. A save or miss ends that attempt.</p><button class="pd-primary" id="pd-help-close">Got it</button></dialog>`;
    root.querySelector('#pd-options').onchange=()=>{const data=new FormData(root.querySelector('form'));settings.total=Number(data.get('length'));settings.difficulty=data.get('difficulty');save();};
    root.querySelector('#pd-sound').onclick=e=>{settings.sound=!settings.sound;save();const b=e.currentTarget;b.setAttribute('aria-pressed',settings.sound);b.querySelector('span').textContent=`Sound ${settings.sound?'on':'off'}`;};
    root.querySelector('#pd-help').onclick=()=>root.querySelector('dialog').showModal();
    root.querySelector('#pd-help-close').onclick=()=>root.querySelector('dialog').close();
    root.querySelector('form').onsubmit=e=>{e.preventDefault();if(assetError)return;engine=createDuel({...settings,random});showGame();showToss();};
  }
  function showGame(){
    screen='game';root.dataset.screen='game';
    root.innerHTML=`${header(true)}<section class="pd-scoreboard" aria-label="Score"><div><b class="pd-you">YOU</b><div id="pd-you-dots" class="pd-dots"></div></div><strong id="pd-score">0 — 0</strong><div><b class="pd-cpu">CPU</b><div id="pd-cpu-dots" class="pd-dots"></div></div></section><div class="pd-round"><span id="pd-round">ROUND 1 OF ${settings.total}</span><span id="pd-role" class="pd-role">TOSS</span></div><div class="pd-arena"><canvas id="pd-canvas" aria-label="Penalty arena. Drag inside the goal to aim; swipe to dive when defending."></canvas><div id="pd-overlay" class="pd-overlay" hidden></div><p id="pd-result-flash" hidden></p></div><p id="pd-instruction" class="pd-instruction" role="status" aria-live="polite"></p><section id="pd-striker" class="pd-controls"><button data-boot="left" aria-label="Left boot"><img src="${ART}left.webp" alt=""><span>LEFT BOOT</span></button><div><strong id="pd-contact-label">Time your kick</strong><small>Tap or use ← →</small></div><button data-boot="right" aria-label="Right boot"><img src="${ART}right.webp" alt=""><span>RIGHT BOOT</span></button></section><section id="pd-defender" class="pd-defender" hidden><label>Keeper position <input id="pd-position" aria-label="Keeper starting position" type="range" min="30" max="70" value="50"></label><div class="pd-save-buttons"><button data-dive=".08,.22" aria-label="Dive top left">↖</button><button data-dive=".08,.8" aria-label="Dive low left">↙</button><button data-dive=".5,.65" aria-label="Hold centre">HOLD</button><button data-dive=".92,.8" aria-label="Dive low right">↘</button><button data-dive=".92,.22" aria-label="Dive top right">↗</button></div></section><dialog class="pd-dialog" id="pd-pause-dialog"><h2>Match paused</h2><button class="pd-primary" id="pd-resume">Resume match</button><button class="pd-secondary" id="pd-restart">Back to settings</button></dialog>`;
    root.querySelector('#pd-pause').onclick=pause;
    root.querySelector('#pd-resume').onclick=resume;
    root.querySelector('#pd-pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resume();});
    root.querySelector('#pd-restart').onclick=()=>{root.querySelector('dialog').close();setup();};
    root.querySelectorAll('[data-boot]').forEach(b=>{
      b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);b.classList.add('pressed');engine.kick(b.dataset.boot);};
      const release=()=>b.classList.remove('pressed');b.onpointerup=release;b.onpointercancel=release;b.onlostpointercapture=release;
      b.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();if(!e.repeat)engine.kick(b.dataset.boot);}};
    });
    root.querySelectorAll('[data-dive]').forEach(b=>b.onclick=()=>engine.dive(...b.dataset.dive.split(',').map(Number)));
    root.querySelector('#pd-position').oninput=e=>engine.position(Number(e.target.value)/100);
    const canvas=root.querySelector('canvas');let pointer;
    const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};};
    const aim=p=>engine.aim((p.x-.215)/.57,(p.y-.165)/.135);
    canvas.onpointerdown=e=>{const p=point(e);canvas.setPointerCapture(e.pointerId);pointer=p;if(engine.state.turn==='you'&&p.y<.38)aim(p);};
    canvas.onpointermove=e=>{if(pointer&&engine.state.turn==='you'&&pointer.y<.38)aim(point(e));};
    canvas.onpointerup=e=>{if(!pointer)return;const p=point(e),dx=p.x-pointer.x,dy=p.y-pointer.y;if(engine.state.turn==='cpu'){if(Math.hypot(dx,dy)>.035)engine.dive(engine.state.keeper.x+Math.sign(dx)*.38,dy<-.03?.22:.8);else engine.dive(engine.state.keeper.x,.65);}pointer=null;};
    canvas.onpointercancel=()=>{pointer=null;};
  }
  function overlay(html){const el=root.querySelector('#pd-overlay');el.hidden=false;el.innerHTML=html;return el;}
  function showToss(){
    const el=overlay('<h2>Call the toss</h2><p>Winner chooses the first role.</p><div class="pd-toss-buttons"><button data-call="heads">H<span>Heads</span></button><button data-call="tails">T<span>Tails</span></button></div>');
    el.querySelectorAll('[data-call]').forEach(b=>b.onclick=()=>{engine.toss(b.dataset.call);el.innerHTML='<div class="pd-coin spinning" aria-label="Coin spinning">●</div><p>Coin in the air…</p>';});
  }
  function pause(){if(!engine||engine.state.phase==='ended')return;engine.pause(true);root.querySelector('#pd-pause-dialog').showModal();}
  function resume(){root.querySelector('#pd-pause-dialog')?.close();engine?.pause(false);last=performance.now();}
  const onVisibility=()=>{if(document.hidden&&engine&&!engine.state.paused&&engine.state.phase!=='ended')pause();};
  const onKey=e=>{if(!engine||engine.state.paused||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)||e.target.matches('input,textarea,select'))return;e.preventDefault();if(e.repeat)return;if(engine.state.turn==='you'){if(e.key==='ArrowLeft'||e.key==='ArrowRight')engine.kick(e.key==='ArrowLeft'?'left':'right');}else{const map={ArrowLeft:[.08,.65],ArrowRight:[.92,.65],ArrowUp:[.5,.22],ArrowDown:[.5,.8],' ':[.5,.65]};engine.dive(...map[e.key]);}};
  document.addEventListener('keydown',onKey);document.addEventListener('visibilitychange',onVisibility);
  function draw(){
    const s=engine.state,canvas=root.querySelector('canvas'),r=canvas.getBoundingClientRect();
    const scale=Math.min(devicePixelRatio,2),w=Math.round(r.width*scale),h=Math.round(r.height*scale);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const c=canvas.getContext('2d');c.clearRect(0,0,w,h);c.drawImage(assets.board,0,0,w,h);
    const sprite=(key,x,y,sw,sh,angle=0)=>{c.save();c.translate(x*w,y*h);c.rotate(angle);c.drawImage(assets[key],-sw*w/2,-sh*h/2,sw*w,sh*h);c.restore();};
    // Goal position and keeper hit region use the same projection as engine flight.
    const kx=.215+.57*s.keeper.x,ky=.165+.135*s.keeper.y;
    const angle=s.dive?(s.dive.to.x-s.dive.from.x)*2.6:0;
    sprite('keeper',kx,ky,.23,.20,angle);
    if(s.turn==='you'&&s.phase==='aim'){
      const x=(.215+.57*s.aim.x)*w,y=(.165+.135*s.aim.y)*h;
      c.save();c.strokeStyle='#83d5ff';c.lineWidth=1.5*scale;c.setLineDash([2*scale,10*scale]);c.beginPath();c.moveTo(s.ball.x*w,s.ball.y*h);c.lineTo(x,y);c.stroke();c.setLineDash([]);c.lineWidth=2*scale;c.beginPath();c.arc(x,y,11*scale,0,Math.PI*2);c.moveTo(x-17*scale,y);c.lineTo(x+17*scale,y);c.moveTo(x,y-17*scale);c.lineTo(x,y+17*scale);c.stroke();c.restore();
    }
    // Pivot each sprite at the outer heel; a swing visibly changes its angle.
    for(const side of ['left','right']){
      const left=side==='left';c.save();c.translate((left?.11:.89)*w,.78*h);c.rotate(s.boots[side]*(left?-.42:.42));c.drawImage(assets[side],(left?0:-.37)*w,-.08*h,.37*w,.20*h);c.restore();
    }
    const p=s.flight?clamp(s.flight.elapsed/s.flight.duration,0,1):0;
    const ballSize=.11-.065*p;
    c.save();c.globalAlpha=.30;c.fillStyle='#000';c.beginPath();c.ellipse(s.ball.x*w,(s.ball.y+.045)*h,ballSize*w*.48,ballSize*w*.13,0,0,Math.PI*2);c.fill();c.restore();
    sprite('ball',s.ball.x,s.ball.y,ballSize,ballSize*w/h,(s.elapsed*3));
  }
  let renderedPhase='',hudKey='';
  function hud(){
    const s=engine.state;const goals=t=>s.history[t].filter(x=>x==='goal').length;
    const key=JSON.stringify([s.phase,s.turn,s.history,s.message,s.paused,!!s.dive]);
    if(key===hudKey)return;hudKey=key;
    root.querySelector('#pd-score').textContent=`${goals('you')} — ${goals('cpu')}`;
    for(const team of ['you','cpu']){
      const list=s.history[team],fullCount=Math.max(s.total,list.length+(s.turn===team&&!s.winner?1:0)),offset=Math.max(0,fullCount-5),count=Math.min(5,fullCount);
      root.querySelector(`#pd-${team}-dots`).innerHTML=Array.from({length:count},(_,j)=>{const i=j+offset;return `<span class="${list[i]==='goal'?'goal':list[i]?'miss':''}" aria-label="Attempt ${i+1}: ${list[i]||'remaining'}">${list[i]&&list[i]!=='goal'?'×':''}</span>`;}).join('');
    }
    const round=Math.min(s.history.you.length,s.history.cpu.length)+1;
    root.querySelector('#pd-round').textContent=round>s.total?'SUDDEN DEATH':`ROUND ${Math.min(round,s.total)} OF ${s.total}`;
    root.querySelector('#pd-role').textContent=['setup','toss','choice','countdown'].includes(s.phase)?'TOSS':s.turn==='you'?'YOUR SHOT':'YOUR SAVE';
    root.querySelector('#pd-role').classList.toggle('saving',s.turn==='cpu');
    root.querySelector('#pd-striker').hidden=s.turn!=='you';root.querySelector('#pd-defender').hidden=s.turn!=='cpu';
    root.querySelector('#pd-instruction').textContent=s.message;
    root.querySelectorAll('[data-boot]').forEach(b=>b.disabled=s.phase!=='aim'||s.paused);
    root.querySelectorAll('[data-dive]').forEach(b=>b.disabled=!['aim','flight'].includes(s.phase)||!!s.dive||s.paused);
    root.querySelector('#pd-position').disabled=s.phase!=='aim'||!!s.dive;
    const flash=root.querySelector('#pd-result-flash');flash.hidden=s.phase!=='result';flash.textContent=s.outcome==='goal'?'GOAL':s.outcome==='save'?'SAVED':'MISSED';flash.dataset.outcome=s.outcome;
    if(s.phase!==renderedPhase){
      renderedPhase=s.phase;
      if(s.phase==='choice'){
        const el=overlay(`<div class="pd-coin">${s.toss.face==='heads'?'H':'T'}</div><h2>${s.toss.face}. You win!</h2><p>Choose your first role.</p><button class="pd-primary" data-first="you">Shoot first</button><button class="pd-secondary" data-first="cpu">Save first</button>`);
        el.querySelectorAll('[data-first]').forEach(b=>b.onclick=()=>engine.choose(b.dataset.first));
      }else if(s.phase==='countdown')overlay(`<div class="pd-coin">${s.toss.face==='heads'?'H':'T'}</div><h2>${s.toss.face}. ${s.toss.winner==='you'?'You win':'CPU wins'}.</h2><p>${s.first==='you'?'You shoot first.':'You save first.'}</p><strong>Get ready</strong>`);
      else if(s.phase==='aim'){root.querySelector('#pd-overlay').hidden=true;root.querySelector('#pd-position').value='50';}
      else if(s.phase==='ended'){
        const el=overlay(`<p class="pd-eyebrow">FULL TIME</p><h2>${s.winner==='you'?'You win!':'CPU wins'}</h2><strong class="pd-final-score">${goals('you')} — ${goals('cpu')}</strong><p>${s.history.you.length} shots · ${s.history.cpu.length} CPU shots</p><button class="pd-primary" id="pd-rematch">Play again</button><button class="pd-secondary" id="pd-settings">Match settings</button>`);
        el.querySelector('#pd-rematch').onclick=()=>{engine=createDuel({...settings,random});seen=0;renderedPhase='';hudKey='';showGame();showToss();};el.querySelector('#pd-settings').onclick=setup;
      }
    }
  }
  function loop(now){const dt=last?(now-last)/1000:0;last=now;if(engine&&screen==='game'){
    engine.advance(dt);hud();draw();const s=engine.state;
    root.querySelector('#pd-contact-label').textContent=s.phase==='aim'&&s.ball.y>=.85&&s.ball.y<=.91?'KICK NOW':'Time your kick';
    for(const event of s.events)if(event.id>seen){seen=event.id;if(event.type==='KICK')audio(kickSound);if(event.type==='RESULT'&&((event.turn==='you'&&event.outcome==='goal')||(event.turn==='cpu'&&event.outcome==='save')))audio(cheer);}
  }frame=requestAnimationFrame(loop);}
  setup();const start=root.querySelector('#pd-continue');start.disabled=true;start.textContent='Loading arena…';
  try{
    await Promise.all(['board','keeper','left','right','ball'].map(key=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{assets[key]=img;resolve();};img.onerror=reject;img.src=ART+key+'.webp';})));
    start.disabled=false;start.innerHTML='Continue to toss <span aria-hidden="true">→</span>';
    frame=requestAnimationFrame(loop);
  }catch{assetError=true;start.textContent='Arena unavailable — reload to retry';}
  if(import.meta.env.DEV&&new URLSearchParams(location.search).has('qa'))window.__penalty={get engine(){return engine;},snapshot:()=>engine?.snapshot(),assets};
  window.addEventListener('pagehide',event=>{if(event.persisted){engine?.pause(true);return;}cancelAnimationFrame(frame);document.removeEventListener('keydown',onKey);document.removeEventListener('visibilitychange',onVisibility);kickSound.pause();cheer.pause();},{once:true});
}
