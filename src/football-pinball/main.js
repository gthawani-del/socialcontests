import '../access/demo-gate.js';
import './style.css';
import { createEngine } from './core/engine.js';
import { createRenderer } from './renderer.js';
import { bindInputs } from './input.js';

const root = document.querySelector('#footballApp');
root.innerHTML = `<header><a href="/" aria-label="Back to Infinite Pinball">← Games</a><h1>Football Pinball <small>GRAYBOX · LOCAL PRACTICE</small></h1></header>
<section class="fp-score" aria-label="Goal score"><span class="fp-blue">BLUE <b id="blueScore">0</b></span><span>GOALS</span><span class="fp-red"><b id="redScore">0</b> RED</span></section>
<div id="fp-arena"><p id="fp-loading" role="status">Preparing physics…</p></div>
<p id="fp-status" role="status">Loading…</p>
<section class="fp-controls" aria-label="Team flipper controls">
<div><button data-boot="red-left" aria-pressed="false">Red left <kbd>J</kbd></button><button data-boot="red-right" aria-pressed="false">Red right <kbd>L</kbd></button></div>
<div><button data-boot="blue-left" aria-pressed="false">Blue left <kbd>A</kbd></button><button data-boot="blue-right" aria-pressed="false">Blue right <kbd>D</kbd></button></div>
</section><nav class="fp-actions" aria-label="Practice actions"><button id="fp-serve" disabled>Serve ball</button><button id="fp-pause" disabled>Pause</button><button id="fp-reset" disabled>Reset</button></nav>`;

let engine, view, inputs, frame;
const abort = new AbortController();
try {
  engine = await createEngine();
  view = createRenderer(root.querySelector('#fp-arena'), engine);
  const gateOpen = () => !document.body.classList.contains('demo-locked');
  const allowed = () => gateOpen() && !engine.paused && engine.state !== 'goal';
  inputs = bindInputs(root, engine, allowed);
  const serve = root.querySelector('#fp-serve'), pause = root.querySelector('#fp-pause');
  const reset = root.querySelector('#fp-reset'), status = root.querySelector('#fp-status');
  function sync() {
    root.querySelector('#blueScore').textContent = engine.score.blue;
    root.querySelector('#redScore').textContent = engine.score.red;
    serve.disabled = !gateOpen() || engine.paused || engine.state === 'active';
    pause.disabled = reset.disabled = !gateOpen();
    pause.textContent = engine.paused ? 'Resume' : 'Pause';
    serve.textContent = engine.state === 'goal' ? 'Next serve' : 'Serve ball';
    status.textContent = engine.paused ? 'Paused — resume when ready.' : engine.state === 'goal'
      ? `${engine.events.findLast(e => e.type === 'GOAL_SCORED')?.actorId === 'blue' ? 'Blue' : 'Red'} goal. Next serve to continue.`
      : engine.state === 'active' ? 'Defend your goal. Time your flips.' : 'Serve, then use the four team controls.';
    root.querySelectorAll('[data-boot]').forEach(button => { button.disabled = !allowed(); });
  }
  serve.onclick = () => { inputs.clear(); engine.serve(); sync(); };
  pause.onclick = () => { inputs.clear(); engine.setPaused(!engine.paused); sync(); };
  reset.onclick = () => { inputs.clear(); engine.reset(); sync(); };
  function suspend() { inputs.clear(); engine.setPaused(true); sync(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); }, { signal: abort.signal });
  window.addEventListener('blur', suspend, { signal: abort.signal });
  view.draw();
  root.querySelector('#fp-loading').remove();
  let last = performance.now(), lastState = '';
  function animate(now) {
    const delta = (now - last) / 1000; last = now;
    if (gateOpen()) engine.advance(delta);
    const state = `${gateOpen()}-${engine.state}-${engine.paused}-${engine.score.blue}-${engine.score.red}`;
    if (state !== lastState) { sync(); lastState = state; }
    view.draw();
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);
  // Development-only fixtures for repeatable collision QA; stripped from the production bundle.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) {
    window.__footballQA = { snapshot: () => engine.snapshot(), metrics: view.metrics,
      fixture(position, velocity) {
        inputs.clear(); engine.reset(); engine.serve(); engine.placeBall(position, velocity); sync();
      } };
  }
  window.addEventListener('pagehide', event => {
    if (event.persisted) { suspend(); return; }
    cancelAnimationFrame(frame); inputs.dispose(); view.dispose(); engine.dispose(); abort.abort();
  }, { once: false });
} catch (error) {
  cancelAnimationFrame(frame); inputs?.dispose(); view?.dispose(); engine?.dispose(); abort.abort();
  root.querySelector('#fp-loading')?.remove();
  root.querySelector('#fp-status').textContent = 'Could not start 3D physics. Reload this page to retry.';
  root.querySelectorAll('button').forEach(button => { button.disabled = true; });
  console.error('Football Pinball initialization failed', error);
}
