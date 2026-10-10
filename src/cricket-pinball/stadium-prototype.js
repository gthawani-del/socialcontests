import {DELIVERY_LABELS} from './game/bowling-icons.js';
import {createStadiumAtmosphere} from './game/stadium-atmosphere.js';
import {createStadiumCoaching} from './game/stadium-coaching.js';
import {BOWLERS,LENGTHS} from './game/bowling-rules.js';
import './game/match-experience.css';
import { createMatchPresentation } from './game/match-presentation.js';
import { createStadiumAudio } from './game/stadium-audio.js';
import { createStadiumVfx } from './game/stadium-vfx.js';
import { createStadiumLauncher } from './stadium-launcher.js';
import { frameStadium } from './stadium-camera.js';
import { installStadiumBackdrop } from './stadium-backdrop.js';
import { lightStadium } from './stadium-lighting.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { StadiumEngine } from './game/stadium-engine.js';
import { createStadiumTable, STADIUM_SCALE } from './game/stadium-layout.js';
import { createStadiumMatch } from './game/stadium-match.js';
import './ui/stadium-prototype.css';
import { applyStadiumMaterials } from './stadium-materials.js';
import { batchStadium } from './stadium-batching.js';
import { buildStadiumArt } from './stadium-art.js';
import { createStadiumFeedback } from './game/stadium-feedback.js';
import { createPlaytestTelemetry } from './game/playtest-telemetry.js';
import { createBowlingPlunger } from './game/bowling-plunger.js';
import { createWebGLResultLayer } from './game/webgl-result-layer.js';

const practice = ['bat','bowl'].includes(new URLSearchParams(location.search).get('practice')) ? new URLSearchParams(location.search).get('practice') : false;
const app = document.querySelector('#stadiumApp');
const batIcon = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m32 5 5 5-9 10-5-5z" fill="#193149"/><path d="m23 14 8 8-16 20c-2 2-5 2-7 0l-3-3c-2-2-2-5 0-7z" fill="#e7c48a" stroke="#9e793d" stroke-width="1.5"/><path d="m10 33 13-15" stroke="#fff1ca" stroke-width="2"/></svg>';
const resetIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
app.innerHTML = `<header><a href="/cricket-pinball" aria-label="Back to match lobby">CRICKET <b>PINBALL</b></a><button id="restart" aria-label="Restart match">${resetIcon}</button></header>
<div id="score" aria-label="Match score">0 / 0</div>
<section id="viewport" aria-label="Interactive stadium"><div id="loading" role="status">Preparing stadium…</div></section>
<section class="controls"><p id="cue" role="status">Loading…</p><div class="setup legacy-setup" aria-hidden="true"><label>Line<select id="line"><option>LEFT</option><option selected>CENTRE</option><option>RIGHT</option></select></label><label>Movement<select id="deliveryType"><option value="PACE" selected>STRAIGHT</option><option value="SWING_LEFT">SWING LEFT</option><option value="SWING_RIGHT">SWING RIGHT</option><option value="CUTTER_LEFT">CUTTER LEFT</option><option value="CUTTER_RIGHT">CUTTER RIGHT</option><option value="SPIN_LEFT">SPIN LEFT</option><option value="SPIN_RIGHT">SPIN RIGHT</option><option value="SLOWER">SLOWER</option><option value="FLIGHTED">FLIGHTED</option><option value="FLIPPER">FLIPPER</option></select></label><label>Power <output id="powerValue">50%</output><input id="power" type="range" min="20" max="100" value="50"></label><button id="bowl" disabled>Bowl</button></div><div class="bats"><button id="leftBat" aria-label="Left bat">${batIcon}<span>LEFT BAT</span></button><button id="rightBat" aria-label="Right bat">${batIcon}<span>RIGHT BAT</span></button></div></section>`;

try {
  const [base, rules, gltf] = await Promise.all([
    fetch('/game/cricket-table.json').then(r => r.json()),
    fetch('/game/cricket-rules.json').then(r => r.json()),
    new GLTFLoader().loadAsync('/models/cricket-stadium-r28.glb', progress => { if (progress.total) document.querySelector('#loading').textContent = `Loading stadium ${Math.round(progress.loaded / progress.total * 100)}%`; })
  ]);
  const table = createStadiumTable(base), engine = new StadiumEngine(table);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#07111e');
  const model = gltf.scene; model.scale.setScalar(STADIUM_SCALE); scene.add(model);
  const materialStatus = await applyStadiumMaterials(model);
  const shooterArt = createStadiumLauncher(scene, table, model);
  const art = buildStadiumArt(scene, model, table);
  const lighting = lightStadium(scene, model);
  model.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = !/Number|Crowd_Band|Individual_Seats|Seating_Terrace|Lamp|Lens/.test(o.name); } });
  
  const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .35, emissive: 0x000000, emissiveIntensity: 1 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(table.ball.radius, 20, 12), ballMaterial); scene.add(ball);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(table.ball.radius * .99, .0025, 5, 32), new THREE.MeshStandardMaterial({ color: 0xb73d3c })); ball.add(seam);
  ball.castShadow = true;
  const camera = new THREE.PerspectiveCamera(46, 1, .1, 50); camera.near = .1; camera.far = 50;
  const backdrop = await installStadiumBackdrop(scene, model, camera);
  const atmosphere = createStadiumAtmosphere(scene, model);
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .8;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = new RoomEnvironment();
  scene.environment = pmrem.fromScene(environment, .04).texture; scene.environmentIntensity = .2;
  environment.dispose(); pmrem.dispose();
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(390, 700), .18, .35, 1.1);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const viewport = document.querySelector('#viewport'); viewport.append(renderer.domElement);
  const resultLayer = createWebGLResultLayer({ THREE, scene });

  const aimMaterial = new THREE.MeshBasicMaterial({ color: 0xf2c96b, transparent: true, opacity: .82, depthWrite: false });
  const aimRing = new THREE.Mesh(new THREE.RingGeometry(.075, .105, 28), aimMaterial);
  aimRing.rotation.x = -Math.PI / 2;
  aimRing.position.set(0, .026, 1.62);
  aimRing.visible = false;
  scene.add(aimRing);
  const movementGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, .032, 1.62), new THREE.Vector3(0, .032, 1.32)]);
  const movementLine = new THREE.Line(movementGeometry, new THREE.LineBasicMaterial({ color: 0x71b8ff, transparent: true, opacity: .82 }));
  movementLine.visible = false;
  scene.add(movementLine);

  const updateBowlingGuide = (selection = {}, visible = true) => {
    const line = String(selection.line || 'CENTRE').toUpperCase();
    const target = table.launcher.bowlingLines?.[line]?.target || [0, 1.62];
    aimRing.position.x = Number(target[0] || 0);
    const type = String(selection.type || 'PACE').toUpperCase();
    aimRing.position.z = Number(LENGTHS[selection.length || 'GOOD'].bounceZ);
    const direction = type.endsWith('_LEFT') ? -1 : type.endsWith('_RIGHT') ? 1 : 0;
    const attr = movementLine.geometry.getAttribute('position');
    attr.setXYZ(0, aimRing.position.x, .032, aimRing.position.z);
    attr.setXYZ(1, aimRing.position.x + direction * .24, .032, aimRing.position.z + .22);
    attr.needsUpdate = true;
    aimRing.visible = visible;
    movementLine.visible = visible && direction !== 0;
  };

  const feedback = createStadiumFeedback({
    app,
    viewport,
    canvas: renderer.domElement,
    ballMaterial,
    getBallScreenPosition: () => {
      const projected = new THREE.Vector3(
        engine.ball.position.x,
        table.playfield.surfaceY + table.ball.radius + engine.ball.height,
        engine.ball.position.z
      ).project(camera);
      return {
        x: THREE.MathUtils.clamp((projected.x + 1) * 50, 4, 96),
        y: THREE.MathUtils.clamp((1 - projected.y) * 50, 5, 95)
      };
    }
  });
  const sound = createStadiumAudio();
  window.addEventListener('pointerdown', sound.prime, {capture:true});
  window.addEventListener('keydown', sound.prime, {capture:true});
  const vfx = createStadiumVfx(scene,table,ball);
  const telemetry = createPlaytestTelemetry({
    app,
    enabled: new URLSearchParams(location.search).get('telemetry') === '1',
    meta: {
      practice,
      model: 'cricket-stadium-r28.glb',
      rulesVersion: rules.version,
      tableVersion: base.version
    }
  });
  let flow;
  const coach = createStadiumCoaching({app,getFlow:()=>flow});
  const presentation = createMatchPresentation({app,getFlow:()=>flow,audio:sound});
  const controlsRoot = document.querySelector('.controls');
  const deliveryBrief=document.createElement('p');deliveryBrief.id='deliveryBrief';deliveryBrief.hidden=true;controlsRoot.prepend(deliveryBrief);
  const bowlingUi = createBowlingPlunger({
    app,
    viewport,
    controls: controlsRoot,
    cpuPullMs: Math.max(300, Number(rules.delivery.cpuPlungerMs ?? 920) - 220),
    onInteraction: event => coach.handle(event),
    onRelease: selection => flow?.launch(selection),
    onSelectionChange: selection => {
      coach.handle({type:'BOWLING_SELECTION',selection});
      document.querySelector('#line').value = selection.line;
      document.querySelector('#deliveryType').value = selection.type;
      document.querySelector('#power').value = Math.round(selection.power * 100);
      document.querySelector('#powerValue').textContent = `${Math.round(selection.power * 100)}%`;
      updateBowlingGuide(selection, true);
    }
  });

  const gameplayFeedback = event => {
    coach.handle(event);
    atmosphere.handle(event);
    feedback.handle(event);
    sound.handle(event);
    presentation.handle(event);
    vfx.handle(event);
    telemetry.handle(event);

    if(event?.type === 'BOWLER_SELECTED') {bowlingUi.setBowler(event.bowler);deliveryBrief.textContent=`CPU bowler · ${BOWLERS[event.bowler].label}`;}
    if(event?.type === 'CPU_PLUNGER_PREP')deliveryBrief.textContent=`${BOWLERS[event.selection.bowler].label} · ${DELIVERY_LABELS[event.selection.type]} · ${LENGTHS[event.selection.length].label} length`;
    if (event?.type === 'OUTCOME') {
      resultLayer.showOutcome(event.outcome, event.metadata || {});
    } else if (event?.type === 'COUNTDOWN') {
      resultLayer.showCountdown(event.label, event.value);
    } else if (event?.type === 'CONTROL_STATE') {
      deliveryBrief.hidden=!event.humanBatting;
      const inningsActive = Number(event.match?.innings || 0) > 0;
      bowlingUi.setState({
        visible: inningsActive,
        interactive: inningsActive && !event.humanBatting && event.ready && !event.running && !event.paused,
        cpu: inningsActive && event.humanBatting
      });
      if (!inningsActive || event.running) {
        updateBowlingGuide(bowlingUi.getSelection(), false);
      } else {
        updateBowlingGuide(bowlingUi.getSelection(), true);
      }
    } else if (event?.type === 'CPU_PLUNGER_PREP') {
      bowlingUi.setSelection(event.selection || {}, false);
      updateBowlingGuide(event.selection || {}, true);
      bowlingUi.animateCpu(event.selection || {});
    } else if (event?.type === 'DELIVERY_LAUNCH') {
      bowlingUi.setSelection(event.selection || {}, false);
      updateBowlingGuide(event.selection || {}, false);
    }
  };
  const bats = art.bats;
  const batching = batchStadium(model, bats);
  if (!bats.left || !bats.right) throw new Error('Stadium bat meshes are missing');
  let last = performance.now(), contactCount = 0, rampEntries = 0;
  engine.on('wall-hit', () => sound.play('rail',.35));
  engine.on('flipper-hit', () => contactCount++); engine.on('ramp-enter', () => rampEntries++);
  engine.on('delivery-bounce', event => gameplayFeedback({ type: 'DELIVERY_BOUNCE', deliveryType: event.type, event }));
  flow = createStadiumMatch({ engine, table, rules, render,
    practice,
    onReset: () => { contactCount = 0; rampEntries = 0; },
    onFeedback: gameplayFeedback
  });
  const bat = (side, pressed) => {if(pressed && !flow.paused && !document.querySelector(`#${side}Bat`).disabled)coach.handle({type:'BAT_INPUT',pressed,side});if(pressed && !flow.paused && !document.querySelector(`#${side}Bat`).disabled)sound.play('flipper',.4);flow.bat(side,pressed);};
  for (const side of ['left', 'right']) {
    const button = document.querySelector(`#${side}Bat`);
    button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); bat(side, true); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => bat(side, false));
  }
  for (const type of ['keydown', 'keyup']) window.addEventListener(type, e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || /INPUT|SELECT/.test(e.target.tagName)) return;
    e.preventDefault(); bat(e.key === 'ArrowLeft' ? 'left' : 'right', type === 'keydown');
  });
  const interruption=document.createElement('div');interruption.id='interruption';interruption.hidden=true;interruption.innerHTML='<strong>Match paused</strong><p>Your delivery is held in place.</p><button type="button" id="resumeMatch">Resume match</button>';viewport.append(interruption);
  const pauseForInterruption=()=>{if(!flow.match.getState().innings)return;bat('left',false);bat('right',false);flow.setPaused(true,'interruption');interruption.hidden=false;};
  window.addEventListener('blur',pauseForInterruption);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseForInterruption();});
  interruption.querySelector('#resumeMatch').onclick=()=>{flow.setPaused(false,'interruption');interruption.hidden=true;};
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();flow.setPaused(true,'context');interruption.hidden=false;interruption.innerHTML='<strong>Graphics interrupted</strong><p>Reload to start a new match.</p><button type="button" id="reloadGame">Reload game</button>';interruption.querySelector('button').onclick=()=>location.reload();});
  const details=app.querySelector('#matchDetails');
  const help=document.createElement('button');help.type='button';help.id='replayCoach';help.textContent='Replay playing guide';help.onclick=()=>{details.close();coach.replay();};details.append(help);
  const guidance=document.createElement('p');guidance.className='pause-note';guidance.textContent='Shot placement: each bat sends the ball from its own side. Contact position and swing timing change the return angle. Use practice to learn the scoring targets.';details.append(guidance);
  const practiceLinks=document.createElement('p');practiceLinks.className='practice-links';practiceLinks.innerHTML='<a href="/cricket-pinball/play/?practice=bat">Practise batting</a><a href="/cricket-pinball/play/?practice=bowl">Practise bowling</a>';details.append(practiceLinks);
  let qualitySetting='auto',quality='high',slowFrames=0;
  try{const saved=localStorage.getItem('cricket-quality');if(['auto','high','low'].includes(saved))qualitySetting=saved;}catch{}
  const qualityLabel=document.createElement('label');qualityLabel.className='quality-setting';qualityLabel.textContent='Graphics quality';const qualitySelect=document.createElement('select');qualitySelect.id='graphicsQuality';qualitySelect.innerHTML='<option value="auto">Automatic</option><option value="high">Full effects</option><option value="low">Battery saver</option>';qualityLabel.append(qualitySelect);details.append(qualityLabel);qualitySelect.value=qualitySetting;
  const applyQuality=next=>{quality=next;bloom.enabled=next==='high';renderer.shadowMap.enabled=next==='high';renderer.setPixelRatio(Math.min(devicePixelRatio,next==='high'?2:1));resize();};
  qualitySelect.onchange=()=>{qualitySetting=qualitySelect.value;slowFrames=0;try{localStorage.setItem('cricket-quality',qualitySetting);}catch{}applyQuality(qualitySetting==='low'?'low':'high');};

  document.querySelector('#bowl').addEventListener('click', () => flow.launch({
    ...bowlingUi.getSelection(),
    line: document.querySelector('#line').value,
    power: Number(document.querySelector('#power').value) / 100,
    type: document.querySelector('#deliveryType').value,
    movementScale: 1
  }));
  document.querySelector('#restart').addEventListener('click', ()=>{interruption.hidden=true;flow.reset();flow.setPaused(false,'interruption');});
  document.querySelector('#power').addEventListener('input', e => { document.querySelector('#powerValue').textContent = `${e.target.value}%`; });
  function render() {
    ball.position.set(engine.ball.position.x, table.playfield.surfaceY + table.ball.radius + engine.ball.height, engine.ball.position.z);
    art.update(engine);
    shooterArt.update(bowlingUi.getState(), camera, viewport, viewport.querySelector('#pinballPlunger'));
    composer.render();
  }
  function resize() {
    const { width, height } = viewport.getBoundingClientRect(), aspect = width / height;
    frameStadium(camera, aspect); backdrop.resize(); renderer.setSize(width, height); composer.setSize(width, height); render();
  }
  new ResizeObserver(resize).observe(viewport);
  document.querySelector('#loading').remove(); flow.reset(); applyQuality(qualitySetting==='low'?'low':'high');
  let manual = false;
  function frame(now) {
    const elapsed=(now-last)/1000;
    const dt = Math.min(elapsed, .05);
    if(qualitySetting==='auto' && quality==='high' && !document.hidden && !flow.paused){slowFrames=elapsed>.038?slowFrames+1:Math.max(0,slowFrames-2);if(slowFrames>120)applyQuality('low');}
    last = now;
    if (!manual && !document.hidden) flow.step(dt);
    resultLayer.update(now, flow.paused?0:dt);
    vfx.update(flow.paused||document.hidden?0:dt,flow.running,quality);
    atmosphere.update(flow.paused||document.hidden?0:dt,quality);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Development-only evidence hook: browser tests still use real controls to launch/hit.
  if (import.meta.env.DEV) window.__stadiumQA = {
    ready: true, materials: materialStatus, art: art.stats, batching, manual: value => { manual = value; },
    step: (count, draw = true) => { for (let i = 0; i < count; i++) flow.step(1 / 120); if (draw) render(); },
    snapshot: () => ({ bowling:bowlingUi.getSelection(), quality, atmosphere:atmosphere.getState(), rendering: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }, running: flow.running, paused:flow.paused, audio:{...sound.status,settings:sound.getSettings()}, vfx:vfx.getState(), plunger:{...bowlingUi.getState(),...shooterArt.getState()}, match: flow.match.getState(), contactCount, rampEntries, ball: { ...engine.ball.position, height: engine.ball.height, verticalVelocity:engine.verticalVelocity, velocity:{...engine.ball.velocity}, bounced:engine.deliveryVariation?.bounced, deliveryType:engine.deliveryVariation?.type }, score: { ...flow.match.currentInnings },
      flippers: [...engine.flippers].map(([id,s]) => ({id, pressed:s.pressed, angle:s.angle})),
      alignment: ['left', 'right'].map(side => {
        const state = engine.flippers.get(side), cfg = state.config, centre = bats[side].getWorldPosition(new THREE.Vector3());
        return Math.hypot(centre.x - cfg.pivot[0] - Math.cos(state.angle) * cfg.length / 2, centre.z - cfg.pivot[1] + Math.sin(state.angle) * cfg.length / 2);
      }) })
  };
} catch (error) {
  (document.querySelector('#loading') || document.querySelector('#cue')).textContent = `Could not load stadium: ${error.message}`;
  document.querySelector('#cue').textContent = 'Reload to retry'; console.error(error);
}
