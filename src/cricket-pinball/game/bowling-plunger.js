import {BOWLERS, LENGTHS, normalizeBowling} from './bowling-rules.js';
import {lineIcon, deliveryIcon, lengthIcon, DELIVERY_LABELS} from './bowling-icons.js';
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
  onInteraction = () => {},
  onSelectionChange = () => {},
  cpuPullMs = 720
} = {}) {
  const consoleEl = document.createElement('section');
  consoleEl.id = 'bowlingConsole';
  consoleEl.hidden = true;
  consoleEl.innerHTML = `
    <div class="bowler-heading"><strong id="bowlerName">Medium pace</strong><span>Bowling plan</span></div>
    <div class="bowl-selector">
      <small>LINE</small>
      <div class="segmented line-options">
        ${['LEFT','CENTRE','RIGHT'].map(line => `<button type="button" data-line="${line}">${lineIcon(line)}<span>${line[0]+line.slice(1).toLowerCase()}</span></button>`).join('')}
      </div>
    </div>
    <div class="bowl-selector movement-selector">

      <button type="button" id="movementPicker" aria-label="Choose delivery" aria-expanded="false" aria-controls="deliveryOptions"></button>
      <button type="button" id="lengthPicker" aria-label="Choose length" aria-expanded="false" aria-controls="lengthOptions"></button>
      <div class="power-meter"><small>POWER</small><output id="bowlingPower" aria-label="Bowling power">60%</output><meter id="powerMeter" min="0" max="100" value="60" aria-label="Bowling power"></meter></div>
    </div>
    <div id="lengthOptions" hidden><div class="delivery-heading"><strong>Where should it bounce?</strong><button type="button" id="closeLength">Close</button></div><div class="length-grid">${Object.entries(LENGTHS).map(([key,item])=>`<button type="button" data-length="${key}">${lengthIcon(key)}<span>${item.label}</span></button>`).join('')}</div></div>
    <div id="deliveryOptions" hidden><div class="delivery-heading"><strong>Choose delivery</strong><button type="button" id="closeDelivery" aria-label="Close delivery choices">Close</button></div><div class="delivery-grid">${Object.entries(DELIVERY_LABELS).map(([type,label])=>`<button type="button" data-type="${type}">${deliveryIcon(type)}<span>${label}</span></button>`).join('')}</div></div>`;

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
  const movement = consoleEl.querySelector('#movementPicker');
  const options = consoleEl.querySelector('#deliveryOptions');
  const lengthPicker = consoleEl.querySelector('#lengthPicker'), lengthOptions = consoleEl.querySelector('#lengthOptions');
  const toggleLength = open => {lengthOptions.hidden=!open;lengthPicker.setAttribute('aria-expanded',String(open));};
  lengthPicker.onclick=()=>{toggleOptions(false);toggleLength(lengthOptions.hidden);};
  consoleEl.querySelector('#closeLength').onclick=()=>{toggleLength(false);lengthPicker.focus();};
  const toggleOptions = open => { if(open)toggleLength(false); options.hidden = !open; movement.setAttribute('aria-expanded', String(open)); };
  movement.onclick = () => toggleOptions(options.hidden);
  consoleEl.querySelector('#closeDelivery').onclick = () => { toggleOptions(false); movement.focus(); };
  consoleEl.addEventListener('keydown', event => { if(event.key === 'Escape') {toggleLength(false);toggleOptions(false); movement.focus();} });
  const powerReadout = consoleEl.querySelector('#bowlingPower');
  let startY = 0, startPull = .5;
  const track = plunger.querySelector('.plunger-track');

  let enabled = false;
  let cpuMode = false;
  let dragging = false;
  let pointerId = null;
  let pull = .5;
  let line = 'CENTRE';
  let type = 'PACE', bowler='MEDIUM', length='GOOD';
  let cpuTimer = null;

  const emitSelection = () => onSelectionChange(getSelection());

  function updatePull(next, animate = false) {
    pull = clamp(next, .05, 1);
    plunger.style.setProperty('--pull', pull.toFixed(3));
    plunger.classList.toggle('animated', animate);
    powerLabel.textContent = `${Math.round((.2 + .8 * pull) * 100)}%`;
    powerReadout.textContent = powerLabel.textContent;
    consoleEl.querySelector('#powerMeter').value = Math.round((.2 + .8 * pull) * 100);
    handle.setAttribute('aria-label', `Pull and release bowling plunger. Power ${powerLabel.textContent}`);
  }

  function select(kind, value, emit = true) {
    if (kind === 'line') line = value;
    if (kind === 'length') {length=value;lengthPicker.innerHTML=`${lengthIcon(value)}<span><small>LENGTH</small>${LENGTHS[value].label}</span>`;}
    if (kind === 'type') { type = value; movement.innerHTML = `${deliveryIcon(value)}<span>${DELIVERY_LABELS[value]}</span><svg class="picker-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>`; }
    consoleEl.querySelectorAll(`[data-${kind}]`).forEach(button => {
      button.classList.toggle('selected', button.dataset[kind] === value);
      button.setAttribute('aria-pressed', String(button.dataset[kind] === value));
    });
    if (emit) emitSelection();
  }

  consoleEl.querySelectorAll('[data-line]').forEach(button => {
    button.onclick = () => { if (enabled && !cpuMode) select('line', button.dataset.line); };
  });
  consoleEl.querySelectorAll('[data-type]').forEach(button => { button.onclick = () => { if(enabled && !cpuMode) { select('type', button.dataset.type); toggleOptions(false); movement.focus(); } }; });

  consoleEl.querySelectorAll('[data-length]').forEach(button=>{button.onclick=()=>{if(enabled&&!cpuMode){select('length',button.dataset.length);toggleLength(false);lengthPicker.focus();}};});

  handle.addEventListener('pointerdown', event => {
    if (!enabled || cpuMode) return;
    event.preventDefault();
    onInteraction({type:'LEVER_PULL'});
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
    const selection = getSelection();
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
    if(!enabled) { cancel(); toggleOptions(false); toggleLength(false); }
    movement.disabled = !enabled || cpu;
    cpuMode = Boolean(cpu);
    plunger.classList.toggle('cpu', cpuMode);
    plunger.classList.toggle('disabled', !enabled && !cpuMode);
    consoleEl.classList.toggle('cpu', cpuMode);
    consoleEl.querySelectorAll('button').forEach(button => { button.disabled = !enabled || cpuMode; });
    handle.disabled = !enabled || cpuMode;
  }

  function setBowler(next){bowler=BOWLERS[next]?next:'MEDIUM';consoleEl.querySelector('#bowlerName').textContent=BOWLERS[bowler].label;consoleEl.querySelectorAll('[data-type]').forEach(button=>{button.hidden=!BOWLERS[bowler].types.includes(button.dataset.type);});if(!BOWLERS[bowler].types.includes(type))select('type',BOWLERS[bowler].types[0],false);}

  function setSelection(selection = {}, emit = false) {
    if(selection.bowler)setBowler(selection.bowler);
    selection=normalizeBowling({...getSelection(),...selection},bowler);
    if(selection.length)select('length',selection.length,false);
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
    return { bowler, length, line, type, power: .2 + .8 * pull, movementScale: 1 };
  }

  updatePull(.5);
  select('line', line, false);
  select('type', type, false);
  select('length', length, false);
  setBowler(bowler);

  return {
    setState,
    setBowler,
    setSelection,
    getSelection,
    getState: () => ({pull, dragging, enabled, cpuMode, visible: !plunger.hidden}),
    animateCpu,
    get line() { return line; },
    get type() { return type; },
    get typeLabel() { return TYPE_LABELS[type] || type; }
  };
}
