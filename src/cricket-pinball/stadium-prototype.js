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

const app = document.querySelector('#stadiumApp');
const batIcon = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m32 5 5 5-9 10-5-5z" fill="#193149"/><path d="m23 14 8 8-16 20c-2 2-5 2-7 0l-3-3c-2-2-2-5 0-7z" fill="#e7c48a" stroke="#9e793d" stroke-width="1.5"/><path d="m10 33 13-15" stroke="#fff1ca" stroke-width="2"/></svg>';
const resetIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
app.innerHTML = `<header><a href="/cricket-pinball" aria-label="Back to match lobby">CRICKET <b>PINBALL</b></a><button id="restart" aria-label="Restart match">${resetIcon}</button></header>
<div id="score" aria-label="Match score">0 / 0</div>
<section id="viewport" aria-label="Interactive stadium"><div id="loading" role="status">Preparing stadium…</div></section>
<section class="controls"><p id="cue" role="status">Loading…</p><div class="setup legacy-setup" aria-hidden="true"><label>Line<select id="line"><option>LEFT</option><option selected>CENTRE</option><option>RIGHT</option></select></label><label>Movement<select id="deliveryType"><option value="PACE" selected>STRAIGHT</option><option value="SWING_LEFT">SWING LEFT</option><option value="SWING_RIGHT">SWING RIGHT</option><option value="CUTTER_LEFT">CUTTER LEFT</option><option value="CUTTER_RIGHT">CUTTER RIGHT</option></select></label><label>Power <output id="powerValue">50%</output><input id="power" type="range" min="20" max="100" value="50"></label><button id="bowl" disabled>Bowl</button></div><div class="bats"><button id="leftBat" aria-label="Left bat">${batIcon}<span>LEFT BAT</span></button><button id="rightBat" aria-label="Right bat">${batIcon}<span>RIGHT BAT</span></button></div></section>`;

try {
  const [base, rules, gltf] = await Promise.all([
    fetch('/game/cricket-table.json').then(r => r.json()),
    fetch('/game/cricket-rules.json').then(r => r.json()),
    new GLTFLoader().loadAsync('/models/cricket-stadium-colosseum-r12.glb', progress => { if (progress.total) document.querySelector('#loading').textContent = `Loading stadium ${Math.round(progress.loaded / progress.total * 100)}%`; })
  ]);
  const table = createStadiumTable(base), engine = new StadiumEngine(table);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#030916'); scene.fog = new THREE.Fog('#030916', 7.5, 16);
  const model = gltf.scene; model.scale.setScalar(STADIUM_SCALE); scene.add(model);
  const materialStatus = await applyStadiumMaterials(model);
  const art = buildStadiumArt(scene, model, table);
  model.traverse(o => { if (o.isLight) o.intensity *= o.isSpotLight ? .05 : .54; });
  scene.add(new THREE.HemisphereLight(0x799ac4, 0x1d211a, .62));
  const key = new THREE.DirectionalLight(0xffc477, 1.35); key.position.set(-4, 7, 3); scene.add(key);
  const pavilionGlow = new THREE.PointLight(0xff9b45, 2.4, 4.2, 2); pavilionGlow.position.set(0, 1.0, -2.75); scene.add(pavilionGlow);
  const fieldGlow = new THREE.PointLight(0xffc06d, .9, 5.2, 2); fieldGlow.position.set(0, .65, -.15); scene.add(fieldGlow);
  const leftFlood = new THREE.SpotLight(0xdde9ff, 3.2, 10, Math.PI / 5, .55, 1.2); leftFlood.position.set(-2.8, 4.4, -1.8); leftFlood.target.position.set(-.25, 0, .2); scene.add(leftFlood, leftFlood.target);
  const rightFlood = new THREE.SpotLight(0xdde9ff, 3.2, 10, Math.PI / 5, .55, 1.2); rightFlood.position.set(2.8, 4.4, -1.8); rightFlood.target.position.set(.25, 0, .2); scene.add(rightFlood, rightFlood.target);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 5, bottom: -5, near: .1, far: 20 });
  key.shadow.normalBias = .015;
  model.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = !/Number|Crowd_Band|Individual_Seats|Seating_Terrace|Lamp|Lens/.test(o.name); } });
  
  const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .35, emissive: 0x000000, emissiveIntensity: 1 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(table.ball.radius, 20, 12), ballMaterial); scene.add(ball);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(table.ball.radius * .99, .0025, 5, 32), new THREE.MeshStandardMaterial({ color: 0xb73d3c })); ball.add(seam);
  ball.castShadow = true;
  const camera = new THREE.PerspectiveCamera(46, 1, .1, 50); camera.near = .1; camera.far = 50;
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .88;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = new RoomEnvironment();
  scene.environment = pmrem.fromScene(environment, .04).texture; scene.environmentIntensity = .24;
  environment.dispose(); pmrem.dispose();
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    const direction = type.endsWith('_LEFT') ? -1 : type.endsWith('_RIGHT') ? 1 : 0;
    const attr = movementLine.geometry.getAttribute('position');
    attr.setXYZ(0, aimRing.position.x, .032, 1.62);
    attr.setXYZ(1, aimRing.position.x + direction * .24, .032, 1.30);
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
  window.addEventListener('pointerdown', feedback.prime, { once: true, capture: true });
  const telemetry = createPlaytestTelemetry({
    app,
    enabled: new URLSearchParams(location.search).get('telemetry') === '1',
    meta: {
      model: 'cricket-stadium-colosseum-r12.glb',
      rulesVersion: rules.version,
      tableVersion: base.version
    }
  });
  let flow;
  const controlsRoot = document.querySelector('.controls');
  const bowlingUi = createBowlingPlunger({
    app,
    viewport,
    controls: controlsRoot,
    cpuPullMs: Math.max(300, Number(rules.delivery.cpuPlungerMs ?? 920) - 220),
    onRelease: selection => flow?.launch(selection),
    onSelectionChange: selection => {
      document.querySelector('#line').value = selection.line;
      document.querySelector('#deliveryType').value = selection.type;
      document.querySelector('#power').value = Math.round(selection.power * 100);
      document.querySelector('#powerValue').textContent = `${Math.round(selection.power * 100)}%`;
      updateBowlingGuide(selection, true);
    }
  });

  const gameplayFeedback = event => {
    feedback.handle(event);
    telemetry.handle(event);

    if (event?.type === 'OUTCOME') {
      resultLayer.showOutcome(event.outcome, event.metadata || {});
    } else if (event?.type === 'COUNTDOWN') {
      resultLayer.showCountdown(event.label, event.value);
    } else if (event?.type === 'CONTROL_STATE') {
      const inningsActive = Number(event.match?.innings || 0) > 0;
      bowlingUi.setState({
        visible: inningsActive,
        interactive: inningsActive && !event.humanBatting && event.ready && !event.running,
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
  engine.on('flipper-hit', () => contactCount++); engine.on('ramp-enter', () => rampEntries++);
  engine.on('delivery-bounce', event => gameplayFeedback({ type: 'DELIVERY_BOUNCE', deliveryType: event.type, event }));
  flow = createStadiumMatch({ engine, table, rules, render,
    practice: import.meta.env.DEV && new URLSearchParams(location.search).has('practice'),
    onReset: () => { contactCount = 0; rampEntries = 0; },
    onFeedback: gameplayFeedback
  });
  const bat = (side, pressed) => flow.bat(side, pressed);
  for (const side of ['left', 'right']) {
    const button = document.querySelector(`#${side}Bat`);
    button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); bat(side, true); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => bat(side, false));
  }
  for (const type of ['keydown', 'keyup']) window.addEventListener(type, e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || /INPUT|SELECT/.test(e.target.tagName)) return;
    e.preventDefault(); bat(e.key === 'ArrowLeft' ? 'left' : 'right', type === 'keydown');
  });
  window.addEventListener('blur', () => { bat('left', false); bat('right', false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { bat('left', false); bat('right', false); } });
  document.querySelector('#bowl').addEventListener('click', () => flow.launch({
    line: document.querySelector('#line').value,
    power: Number(document.querySelector('#power').value) / 100,
    type: document.querySelector('#deliveryType').value,
    movementScale: 1
  }));
  document.querySelector('#restart').addEventListener('click', flow.reset);
  document.querySelector('#power').addEventListener('input', e => { document.querySelector('#powerValue').textContent = `${e.target.value}%`; });
  function render() {
    ball.position.set(engine.ball.position.x, table.playfield.surfaceY + table.ball.radius + engine.ball.height, engine.ball.position.z);
    art.update(engine);
    renderer.render(scene, camera);
  }
  function resize() {
    const { width, height } = viewport.getBoundingClientRect(), aspect = width / height;
    camera.aspect = aspect;
    const target = new THREE.Vector3(0, .16, -.34), back = new THREE.Vector3(0, .43, .903).normalize();
    const up = new THREE.Vector3(0, back.z, -back.y), tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const critical = [[-1.55,0,0],[1.55,0,0],[0,2.12,-3.30],[0,0,2.85],[-1.02,.16,2.22],[1.02,.16,2.22]];
    let distance = 0;
    for (const point of critical) {
      const p = new THREE.Vector3(...point).sub(target);
      distance = Math.max(distance, p.dot(back) + Math.abs(p.x) / (tangent * aspect * 1.00), p.dot(back) + Math.abs(p.dot(up)) / (tangent * 1.00));
    }
    camera.position.copy(target).addScaledVector(back, distance); camera.lookAt(target);
    camera.updateProjectionMatrix(); renderer.setSize(width, height); render();
  }
  new ResizeObserver(resize).observe(viewport);
  document.querySelector('#loading').remove(); flow.reset(); resize();
  let manual = false;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, .05);
    last = now;
    if (!manual && flow.running && !document.hidden) flow.step(dt);
    resultLayer.update(now, dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Development-only evidence hook: browser tests still use real controls to launch/hit.
  if (import.meta.env.DEV) window.__stadiumQA = {
    ready: true, materials: materialStatus, art: art.stats, batching, manual: value => { manual = value; },
    step: count => { for (let i = 0; i < count && flow.running; i++) flow.step(1 / 120); render(); },
    snapshot: () => ({ rendering: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }, running: flow.running, match: flow.match.getState(), contactCount, rampEntries, ball: { ...engine.ball.position, height: engine.ball.height }, score: { ...flow.match.currentInnings },
      alignment: ['left', 'right'].map(side => {
        const state = engine.flippers.get(side), cfg = state.config, centre = bats[side].getWorldPosition(new THREE.Vector3());
        return Math.hypot(centre.x - cfg.pivot[0] - Math.cos(state.angle) * cfg.length / 2, centre.z - cfg.pivot[1] + Math.sin(state.angle) * cfg.length / 2);
      }) })
  };
} catch (error) {
  (document.querySelector('#loading') || document.querySelector('#cue')).textContent = `Could not load stadium: ${error.message}`;
  document.querySelector('#cue').textContent = 'Reload to retry'; console.error(error);
}
