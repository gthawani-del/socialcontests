import {BOWLERS, LENGTHS, normalizeBowling, bowlingPowerBand} from './bowling-rules.js';
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
    <div class="compact-bowling-dock">
      <button type="button" id="lengthPicker" aria-label="Choose landing position" aria-expanded="false" aria-controls="lengthOptions"></button>
      <button type="button" id="movementPicker" aria-label="Choose delivery" aria-expanded="false" aria-controls="deliveryOptions"></button>
    </div>
    <div id="lengthOptions" hidden role="dialog" aria-modal="true" aria-label="Landing position"><div class="delivery-heading"><strong>Place your delivery</strong><button type="button" id="closeLength">Done</button></div>
      <div class="landing-axis"><span></span><span>Left</span><span>Centre</span><span>Right</span></div>
      <div class="landing-editor"><div class="landing-labels"><span>Short</span><span>Good</span><span>Full</span></div><div class="landing-grid" role="group" aria-label="Line and length">${['SHORT','GOOD','FULL'].map(length=>['LEFT','CENTRE','RIGHT'].map(line=>`<button type="button" data-zone-line="${line}" data-zone-length="${length}" aria-label="${line.toLowerCase()}, ${length.toLowerCase()} length"></button>`).join('')).join('')}</div></div>
      <p id="landingReadout" aria-live="polite"></p><p class="landing-help">Tap or drag to set line and length</p></div>
    <div id="deliveryOptions" hidden role="dialog" aria-modal="true" aria-label="Choose delivery"><div class="delivery-heading"><strong id="bowlerName">Medium pace</strong><button type="button" id="closeDelivery">Done</button></div><div class="delivery-grid">${Object.entries(DELIVERY_LABELS).map(([type,label])=>`<button type="button" data-type="${type}">${deliveryIcon(type)}<span>${label}</span></button>`).join('')}</div></div>`;
  const meter=document.createElement('div');meter.id='bowlingPowerMeter';meter.hidden=true;
  meter.innerHTML='<small>POWER</small><output id="bowlingPower">60%</output><div class="colour-power-track" id="powerMeter" role="meter" aria-label="Bowling power" aria-valuemin="24" aria-valuemax="100"><i></i></div><span class="power-status">Controlled</span>';

  const summary=document.createElement("p");summary.id="bowlingSummary";summary.hidden=true;summary.setAttribute("role","status");controls.prepend(summary);
  let lastDelivery=null;


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
  plunger.append(meter);
  viewport.append(plunger);

  const handle = plunger.querySelector('.plunger-handle');
  const powerLabel = plunger.querySelector('#plungerPower');
  const movement = consoleEl.querySelector('#movementPicker');
  const options = consoleEl.querySelector('#deliveryOptions');
  const lengthPicker = consoleEl.querySelector('#lengthPicker'), lengthOptions = consoleEl.querySelector('#lengthOptions');
  const toggleLength = open => {lengthOptions.hidden=!open;lengthPicker.setAttribute('aria-expanded',String(open));if(open)consoleEl.querySelector('#closeLength').focus();};
  lengthPicker.onclick=()=>{toggleOptions(false);toggleLength(lengthOptions.hidden);};
  consoleEl.querySelector('#closeLength').onclick=()=>{toggleLength(false);lengthPicker.focus();};
  const toggleOptions = open => { if(open)toggleLength(false); options.hidden = !open; movement.setAttribute('aria-expanded', String(open));if(open)consoleEl.querySelector('#closeDelivery').focus(); };
  movement.onclick = () => toggleOptions(options.hidden);
  consoleEl.querySelector('#closeDelivery').onclick = () => { toggleOptions(false); movement.focus(); };
  consoleEl.addEventListener('keydown', event => { if(event.key === 'Escape') {toggleLength(false);toggleOptions(false); movement.focus();} });
  const powerReadout = meter.querySelector('#bowlingPower');
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
    const band=bowlingPowerBand(getSelection()),percent=Math.round((.2+.8*pull)*100);
    meter.dataset.zone=band.zone;meter.style.setProperty('--power',percent+'%');
    for(const [key,value] of Object.entries({low:band.low,red:band.red,'ideal-start':band.ideal-.03,'ideal-end':band.ideal+.03}))meter.style.setProperty('--'+key,(value*100)+'%');
    meter.querySelector('#powerMeter').setAttribute('aria-valuenow',percent);
    const status=({red:'Max pace · less accuracy',amber:'Gentle',cyan:'Ideal release',green:'Controlled'})[band.zone];
    meter.querySelector('.power-status').textContent=status;meter.querySelector('#powerMeter').setAttribute('aria-valuetext',percent+'% · '+status);
    handle.setAttribute('aria-label', `Pull and release bowling plunger. Power ${powerLabel.textContent}`);
  }

  function select(kind, value, emit = true) {
    if (kind === 'line') line = value;
    if (kind === 'length') length=value;
    if (kind === 'type') { type = value; movement.innerHTML = `${deliveryIcon(value)}<span><small>DELIVERY</small>${DELIVERY_LABELS[value]}</span><svg class="picker-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>`; }
    consoleEl.querySelectorAll(`[data-${kind}]`).forEach(button => {
      button.classList.toggle('selected', button.dataset[kind] === value);
      button.setAttribute('aria-pressed', String(button.dataset[kind] === value));
    });
    const label=line[0]+line.slice(1).toLowerCase()+' · '+LENGTHS[length].label;
    lengthPicker.innerHTML=`${lineIcon(line)}<span><small>LANDING</small>${label}</span>`;
    consoleEl.querySelector('#landingReadout').textContent=label;
    consoleEl.querySelectorAll('[data-zone-line]').forEach(b=>{const selected=b.dataset.zoneLine===line&&b.dataset.zoneLength===length;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',selected);});
    updatePull(pull);
    if (emit) emitSelection();
  }

  consoleEl.querySelectorAll('[data-type]').forEach(button => { button.onclick = () => { if(enabled && !cpuMode) { select('type', button.dataset.type); toggleOptions(false); movement.focus(); } }; });
  const grid=consoleEl.querySelector('.landing-grid');let aimDrag=null;
  function aim(e){const r=grid.getBoundingClientRect();select('line',['LEFT','CENTRE','RIGHT'][clamp(Math.floor((e.clientX-r.left)/r.width*3),0,2)],false);select('length',['SHORT','GOOD','FULL'][clamp(Math.floor((e.clientY-r.top)/r.height*3),0,2)]);}
  grid.onpointerdown=e=>{if(!enabled||cpuMode)return;e.preventDefault();aimDrag={id:e.pointerId,line,length};grid.setPointerCapture(e.pointerId);aim(e);};
  grid.onpointermove=e=>{if(aimDrag?.id===e.pointerId)aim(e);};grid.onpointerup=()=>{aimDrag=null;};
  grid.onpointercancel=()=>{if(aimDrag){select('line',aimDrag.line,false);select('length',aimDrag.length);aimDrag=null;}};
  grid.querySelectorAll('button').forEach(b=>b.onclick=e=>{if(e.detail===0&&enabled&&!cpuMode){select('line',b.dataset.zoneLine,false);select('length',b.dataset.zoneLength);}});
  for(const [dialog,close,trigger] of [[lengthOptions,()=>toggleLength(false),lengthPicker],[options,()=>toggleOptions(false),movement]])dialog.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.stopPropagation();close();trigger.focus();}
    if(e.key==='Tab'){const items=[...dialog.querySelectorAll('button:not([hidden])')].filter(b=>!b.disabled),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });

  handle.addEventListener('pointerdown', event => {
    if (!enabled || cpuMode || dragging) return;
    event.preventDefault();
    onInteraction({type:'LEVER_PULL'});
    dragging = true;
    pointerId = event.pointerId;
    handle.setPointerCapture?.(pointerId);
    plunger.classList.add('dragging');meter.classList.add('charging');
    startY = event.clientY; startPull = pull;
  });
  handle.addEventListener('pointermove', event => {
    if (!dragging || event.pointerId !== pointerId) return;
    event.preventDefault();
    updatePull(startPull + (event.clientY - startY) / Math.max(60, plunger.clientHeight));
  });
  const release = event => {
    if (!dragging || (event?.pointerId != null && event.pointerId !== pointerId)) return;
    dragging = false;
    plunger.classList.remove('dragging');meter.classList.remove('charging');
    const selection = getSelection();
    if (enabled && !cpuMode) {lastDelivery=selection;onRelease(selection);}
    pointerId = null;
  };
  handle.addEventListener('pointerup', release);
  const cancel = () => { if(dragging)updatePull(startPull);dragging = false; pointerId = null; plunger.classList.remove('dragging');meter.classList.remove('charging'); };
  handle.addEventListener('pointercancel', cancel);
  handle.addEventListener('lostpointercapture', cancel);
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', () => { if(document.hidden) cancel(); });
  handle.addEventListener('keydown', event => {
    if (!enabled || cpuMode) return;
    if (['ArrowDown','ArrowUp','Enter',' '].includes(event.key)) event.preventDefault();
    if(['ArrowDown','ArrowUp'].includes(event.key))meter.classList.add('charging');
    if(event.key === 'ArrowDown') updatePull(pull + .1);
    if(event.key === 'ArrowUp') updatePull(pull - .1);
    if((event.key === 'Enter' || event.key === ' ') && !event.repeat) {lastDelivery=getSelection();meter.classList.remove('charging');onRelease(lastDelivery);}
  });

  function setState({ visible = false, interactive = false, cpu = false, running = false } = {}) {
    summary.hidden=!visible || cpu || !running || !lastDelivery;
    if(!summary.hidden){const s=lastDelivery;summary.textContent=`${DELIVERY_LABELS[s.type]} · ${s.line[0]+s.line.slice(1).toLowerCase()} / ${LENGTHS[s.length].label} · ${Math.round(s.power*100)}%`;}
    if(!visible)lastDelivery=null;
    plunger.hidden = !visible;
    consoleEl.hidden = !visible || !interactive || cpu;
    meter.hidden = !visible || !interactive || cpu;
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

  function setBowler(next){bowler=BOWLERS[next]?next:'MEDIUM';consoleEl.querySelector('#bowlerName').textContent=BOWLERS[bowler].label;consoleEl.querySelectorAll('[data-type]').forEach(button=>{button.hidden=!BOWLERS[bowler].types.includes(button.dataset.type);});if(!BOWLERS[bowler].types.includes(type))select('type',BOWLERS[bowler].types[0],false);updatePull(pull);}

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
    getState: () => ({band: bowlingPowerBand(getSelection()), pull: !enabled && !cpuMode ? .05 : pull, dragging, enabled, cpuMode, visible: !plunger.hidden}),
    animateCpu,
    get line() { return line; },
    get type() { return type; },
    get typeLabel() { return TYPE_LABELS[type] || type; }
  };
}
