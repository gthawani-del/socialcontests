import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { StadiumEngine } from './game/stadium-engine.js';
import { createStadiumTable, STADIUM_SCALE } from './game/stadium-layout.js';
import { createStadiumMatch } from './game/stadium-match.js';
import './ui/stadium-prototype.css';
import { applyStadiumMaterials } from './stadium-materials.js';
import { buildStadiumArt } from './stadium-art.js';

const app = document.querySelector('#stadiumApp');
const batIcon = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m22 3 5 5-5 5-2-2-10 15-5-5L20 11l-2-2z"/></svg>';
app.innerHTML = `<header><div><small>CRICKET PINBALL</small><h1>Cricket stadium</h1></div><button id="restart">Reset</button></header>
<section id="viewport" aria-label="Interactive stadium"><div id="loading" role="status">Loading stadium…</div><div id="score">0 / 0 <span>0 balls</span></div></section>
<section class="controls"><p id="cue" role="status">Loading…</p><div class="setup"><label>Line<select id="line"><option>LEFT</option><option selected>CENTRE</option><option>RIGHT</option></select></label><label>Power <output id="powerValue">50%</output><input id="power" type="range" min="20" max="100" value="50"></label><button id="bowl" disabled>Bowl</button></div><div class="bats"><button id="leftBat" aria-label="Left bat">${batIcon}<span>Left bat</span></button><button id="rightBat" aria-label="Right bat">${batIcon}<span>Right bat</span></button></div><small>Hold bats or use left/right arrow keys. </small></section>`;

try {
  const [base, rules, gltf] = await Promise.all([
    fetch('/game/cricket-table.json').then(r => r.json()),
    fetch('/game/cricket-rules.json').then(r => r.json()),
    new GLTFLoader().loadAsync('/models/cricket-stadium-greybox-r2.glb')
  ]);
  const table = createStadiumTable(base), engine = new StadiumEngine(table);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#111a22');
  const model = gltf.scene; model.scale.setScalar(STADIUM_SCALE); scene.add(model);
  const materialStatus = await applyStadiumMaterials(model);
  const art = buildStadiumArt(scene, model, table);
  model.traverse(o => { if (o.isLight) o.intensity *= .08; });
  scene.add(new THREE.HemisphereLight(0xe3efff, 0x333329, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-4, 7, 3); scene.add(key);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 5, bottom: -5, near: .1, far: 20 });
  key.shadow.normalBias = .015;
  model.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = !/Number|Continuous_Terrace/.test(o.name); } });
  const reference = model.getObjectByName('Ball_Visibility_Reference'); reference.visible = false;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(table.ball.radius, 20, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .35 })); scene.add(ball);
  ball.castShadow = true;
  const camera = new THREE.OrthographicCamera(); camera.position.set(0, 11.25, 8.55); camera.lookAt(0, .18, 0); camera.near = .1; camera.far = 50;
  const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const viewport = document.querySelector('#viewport'); viewport.append(renderer.domElement);
  const bats = art.bats;
  if (!bats.left || !bats.right) throw new Error('Stadium bat meshes are missing');
  let last = performance.now(), contactCount = 0, rampEntries = 0;
  engine.on('flipper-hit', () => contactCount++); engine.on('ramp-enter', () => rampEntries++);
  const flow = createStadiumMatch({ engine, table, rules, render,
    practice: import.meta.env.DEV && new URLSearchParams(location.search).has('practice'),
    onReset: () => { contactCount = 0; rampEntries = 0; }
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
  document.querySelector('#bowl').addEventListener('click', flow.launch); document.querySelector('#restart').addEventListener('click', flow.reset);
  document.querySelector('#power').addEventListener('input', e => { document.querySelector('#powerValue').textContent = `${e.target.value}%`; });
  function render() {
    ball.position.set(engine.ball.position.x, table.playfield.surfaceY + table.ball.radius + engine.ball.height, engine.ball.position.z);
    art.update(engine);
    renderer.render(scene, camera);
  }
  function resize() {
    const { width, height } = viewport.getBoundingClientRect(), aspect = width / height;
    const vertical = Math.max(7.6, 5.0 / aspect);
    camera.left = -vertical * aspect / 2; camera.right = -camera.left; camera.top = vertical / 2; camera.bottom = -camera.top;
    camera.updateProjectionMatrix(); renderer.setSize(width, height); render();
  }
  new ResizeObserver(resize).observe(viewport);
  document.querySelector('#loading').remove(); flow.reset(); resize();
  let manual = false;
  function frame(now) { const dt = Math.min((now - last) / 1000, .05); last = now; if (!manual && flow.running && !document.hidden) flow.step(dt); render(); requestAnimationFrame(frame); }
  requestAnimationFrame(frame);
  // Development-only evidence hook: browser tests still use real controls to launch/hit.
  if (import.meta.env.DEV) window.__stadiumQA = {
    ready: true, materials: materialStatus, art: art.stats, manual: value => { manual = value; },
    step: count => { for (let i = 0; i < count && flow.running; i++) flow.step(1 / 120); render(); },
    snapshot: () => ({ running: flow.running, match: flow.match.getState(), contactCount, rampEntries, ball: { ...engine.ball.position, height: engine.ball.height }, score: { ...flow.match.currentInnings },
      alignment: ['left', 'right'].map(side => {
        const state = engine.flippers.get(side), cfg = state.config, centre = bats[side].getWorldPosition(new THREE.Vector3());
        return Math.hypot(centre.x - cfg.pivot[0] - Math.cos(state.angle) * cfg.length / 2, centre.z - cfg.pivot[1] + Math.sin(state.angle) * cfg.length / 2);
      }) })
  };
} catch (error) {
  (document.querySelector('#loading') || document.querySelector('#cue')).textContent = `Could not load stadium: ${error.message}`;
  document.querySelector('#cue').textContent = 'Reload to retry'; console.error(error);
}
