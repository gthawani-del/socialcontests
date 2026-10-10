const TYPE_LABELS = {
  PACE: 'STRAIGHT',
  SWING_LEFT: 'SWING ←',
  SWING_RIGHT: 'SWING →',
  CUTTER_LEFT: 'CUTTER ←',
  CUTTER_RIGHT: 'CUTTER →',
  SPIN_LEFT: 'SPIN ←',
  SPIN_RIGHT: 'SPIN →'
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createBowlingPlunger({
  app,
  viewport,
  controls,
  onRelease = () => {},
  onSelectionChange = () => {},
  cpuPullMs = 720
} = {}) {
  const consoleEl = document.createElement('section');
  consoleEl.id = 'bowlingConsole';
  consoleEl.hidden = true;
  consoleEl.innerHTML = `
    <div class="bowl-selector">
      <small>LINE</small>
      <div class="segmented line-options">
        <button type="button" data-line="LEFT">LEFT</button>
        <button type="button" data-line="CENTRE" class="selected">CENTRE</button>
        <button type="button" data-line="RIGHT">RIGHT</button>
      </div>
    </div>
    <div class="bowl-selector movement-selector">
      <small>DELIVERY</small><select id="bowlingMovement" aria-label="Delivery movement">
        <option value="PACE">Straight</option><option value="SWING_LEFT">Swing left</option><option value="SWING_RIGHT">Swing right</option><option value="CUTTER_LEFT">Cutter left</option><option value="CUTTER_RIGHT">Cutter right</option><option value="SPIN_LEFT">Spin left</option><option value="SPIN_RIGHT">Spin right</option>
      </select><output id="bowlingPower" aria-label="Bowling power">60%</output>
    </div>`;

  const plunger = document.createElement('div');
  plunger.id = 'pinballPlunger'; plunger.classList.add('integrated-plunger');
  plunger.hidden = true;
  plunger.innerHTML = `
    <div class="plunger-label"><b>POWER</b><span id="plungerPower">50%</span></div>
    <div class="plunger-track">
      <div class="plunger-spring"></div>
      <button type="button" class="plunger-handle" aria-label="Pull and release bowling plunger"><span></span></button>
    </div>
    <small class="plunger-help">PULL<br>& RELEASE</small>`;

  controls.prepend(consoleEl);
  viewport.append(plunger);

  const handle = plunger.querySelector('.plunger-handle');
  const powerLabel = plunger.querySelector('#plungerPower');
  const movement = consoleEl.querySelector('#bowlingMovement');
  const powerReadout = consoleEl.querySelector('#bowlingPower');
  let startY = 0, startPull = .5;
  const track = plunger.querySelector('.plunger-track');

  let enabled = false;
  let cpuMode = false;
  let dragging = false;
  let pointerId = null;
  let pull = .5;
  let line = 'CENTRE';
  let type = 'PACE';
  let cpuTimer = null;

  const emitSelection = () => onSelectionChange({ line, type, power: .2 + .8 * pull });

  function updatePull(next, animate = false) {
    pull = clamp(next, .05, 1);
    plunger.style.setProperty('--pull', pull.toFixed(3));
    plunger.classList.toggle('animated', animate);
    powerLabel.textContent = `${Math.round((.2 + .8 * pull) * 100)}%`;
    powerReadout.textContent = powerLabel.textContent;
    handle.setAttribute('aria-label', `Pull and release bowling plunger. Power ${powerLabel.textContent}`);
  }

  function select(kind, value, emit = true) {
    if (kind === 'line') line = value;
    if (kind === 'type') { type = value; movement.value = value; }
    consoleEl.querySelectorAll(`[data-${kind}]`).forEach(button => {
      button.classList.toggle('selected', button.dataset[kind] === value);
      button.setAttribute('aria-pressed', String(button.dataset[kind] === value));
    });
    if (emit) emitSelection();
  }

  consoleEl.querySelectorAll('[data-line]').forEach(button => {
    button.onclick = () => { if (enabled && !cpuMode) select('line', button.dataset.line); };
  });
  movement.addEventListener('change', () => { if(enabled && !cpuMode) select('type', movement.value); });

  handle.addEventListener('pointerdown', event => {
    if (!enabled || cpuMode) return;
    event.preventDefault();
    dragging = true;
    pointerId = event.pointerId;
    handle.setPointerCapture?.(pointerId);
    plunger.classList.add('dragging');
    startY = event.clientY; startPull = pull;
  });
  handle.addEventListener('pointermove', event => {
    if (!dragging || event.pointerId !== pointerId) return;
    event.preventDefault();
    updatePull(startPull + (event.clientY - startY) / 100);
  });
  const release = event => {
    if (!dragging || (event?.pointerId != null && event.pointerId !== pointerId)) return;
    dragging = false;
    plunger.classList.remove('dragging');
    const selection = { line, type, power: .2 + .8 * pull, movementScale: 1 };
    if (enabled && !cpuMode) onRelease(selection);
    updatePull(.18, true);
    setTimeout(() => updatePull(.5, true), 260);
    pointerId = null;
  };
  handle.addEventListener('pointerup', release);
  const cancel = () => { dragging = false; pointerId = null; plunger.classList.remove('dragging'); };
  handle.addEventListener('pointercancel', cancel);
  handle.addEventListener('lostpointercapture', cancel);
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', () => { if(document.hidden) cancel(); });
  handle.addEventListener('keydown', event => {
    if (!enabled || cpuMode) return;
    if (['ArrowDown','ArrowUp','Enter',' '].includes(event.key)) event.preventDefault();
    if(event.key === 'ArrowDown') updatePull(pull + .1);
    if(event.key === 'ArrowUp') updatePull(pull - .1);
    if((event.key === 'Enter' || event.key === ' ') && !event.repeat) onRelease(getSelection());
  });

  function setState({ visible = false, interactive = false, cpu = false } = {}) {
    plunger.hidden = !visible;
    consoleEl.hidden = !visible;
    enabled = Boolean(interactive);
    if(!enabled) cancel();
    movement.disabled = !enabled || cpu;
    cpuMode = Boolean(cpu);
    plunger.classList.toggle('cpu', cpuMode);
    plunger.classList.toggle('disabled', !enabled && !cpuMode);
    consoleEl.classList.toggle('cpu', cpuMode);
    consoleEl.querySelectorAll('button').forEach(button => { button.disabled = !enabled || cpuMode; });
    handle.disabled = !enabled || cpuMode;
  }

  function setSelection(selection = {}, emit = false) {
    if (selection.line) select('line', String(selection.line).toUpperCase(), false);
    if (selection.type) select('type', String(selection.type).toUpperCase(), false);
    if (Number.isFinite(Number(selection.power))) updatePull(clamp((Number(selection.power) - .2) / .8, .05, 1), true);
    if (emit) emitSelection();
  }

  function animateCpu(selection = {}) {
    clearTimeout(cpuTimer);
    setSelection(selection, false);
    setState({ visible: true, interactive: false, cpu: true });
    plunger.classList.add('cpu-pulling');
    updatePull(.12, true);
    return new Promise(resolve => {
      requestAnimationFrame(() => updatePull(clamp((Number(selection.power ?? .6) - .2) / .8, .12, 1), true));
      cpuTimer = setTimeout(() => {
        plunger.classList.add('cpu-release');
        updatePull(.10, true);
        setTimeout(() => {
          plunger.classList.remove('cpu-pulling', 'cpu-release');
          resolve();
        }, 220);
      }, cpuPullMs);
    });
  }

  function getSelection() {
    return { line, type, power: .2 + .8 * pull, movementScale: 1 };
  }

  updatePull(.5);
  select('line', line, false);
  select('type', type, false);

  return {
    setState,
    setSelection,
    getSelection,
    getState: () => ({pull, dragging, enabled, cpuMode, visible: !plunger.hidden}),
    animateCpu,
    get line() { return line; },
    get type() { return type; },
    get typeLabel() { return TYPE_LABELS[type] || type; }
  };
}
