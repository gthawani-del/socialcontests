import {BOWLERS, LENGTHS, normalizeBowling, bowlingPowerBand, pitchTargetFor, normalizePitchTarget, describePitchTarget} from './bowling-rules.js';
import {createPlungerCharge, PLUNGER_RECOIL_MS} from './plunger-charge.js';
import {lineIcon, deliveryIcon, DELIVERY_LABELS} from './bowling-icons.js';
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
  onPowerChange = () => {},
  onFieldEdit = () => {},
  canPull = () => true,
  cpuPullMs = 720
} = {}) {
  const consoleEl = document.createElement('section');
  consoleEl.id = 'bowlingConsole';
  consoleEl.hidden = true;
  consoleEl.innerHTML = `
    <div class="compact-bowling-dock"><button type="button" id="movementPicker" aria-expanded="false" aria-controls="deliveryOptions"><span><small>Delivery</small><strong id="deliveryLabel">Straight</strong></span><span aria-hidden="true">⌄</span></button><button type="button" id="editField" aria-expanded="false" aria-controls="fieldEditor"><span><small>Field</small><strong id="fieldLabel">Default</strong></span><span aria-hidden="true">⌄</span></button></div>
    <div class="bowling-instruction"><p id="aimSummary">Pull to charge. Push to bowl.</p><button type="button" id="resetCharge" disabled>Clear power</button></div>
    <div id="lengthOptions" hidden role="dialog" aria-modal="true" aria-label="Landing position"><div class="delivery-heading"><strong>Place your delivery</strong><button type="button" id="closeLength">Done</button></div>
      <div class="landing-axis"><span></span><span>Left</span><span>Centre</span><span>Right</span></div>
      <div class="landing-editor"><div class="landing-labels"><span>Short</span><span>Good</span><span>Full</span></div><div class="landing-grid" role="group" aria-label="Line and length">${['SHORT','GOOD','FULL'].map(length=>['LEFT','CENTRE','RIGHT'].map(line=>`<button type="button" data-zone-line="${line}" data-zone-length="${length}" aria-label="${line.toLowerCase()}, ${length.toLowerCase()} length"></button>`).join('')).join('')}</div></div>
      <p id="landingReadout" aria-live="polite"></p><p class="landing-help">Tap or drag to set line and length</p></div>
    <div id="deliveryOptions" hidden role="dialog" aria-modal="true" aria-label="Choose delivery"><div class="delivery-heading"><strong id="bowlerName">Medium pace</strong><button type="button" id="closeDelivery">Done</button></div><button type="button" id="lengthPicker" aria-label="Choose landing position" aria-expanded="false" aria-controls="lengthOptions">Aim with buttons</button><div class="delivery-grid">${Object.entries(DELIVERY_LABELS).map(([type,label])=>`<button type="button" data-type="${type}">${deliveryIcon(type)}<span>${label}</span></button>`).join('')}</div></div>`;
  const meter=document.createElement('div');meter.id='bowlingPowerMeter';meter.hidden=true;
  meter.innerHTML='<small>POWER</small><output id="bowlingPower">0%</output><div class="colour-power-track" id="powerMeter" role="meter" aria-label="Bowling power" aria-valuemin="0" aria-valuemax="100"><i></i></div><span class="power-status">Controlled</span>';

  const summary=document.createElement("p");summary.id="bowlingSummary";summary.hidden=true;summary.setAttribute("role","status");controls.prepend(summary);
  let lastDelivery=null;


  const plunger = document.createElement('div');
  plunger.id = 'pinballPlunger'; plunger.classList.add('integrated-plunger');
  plunger.hidden = true;
  plunger.innerHTML = `
    <div class="plunger-label"><b>POWER</b><span id="plungerPower">50%</span></div>
    <div class="plunger-track">
      <div class="plunger-spring"></div>
      <button type="button" class="plunger-handle" aria-label="Pull to charge, push to bowl"><span></span></button>
    </div>
    <small class="plunger-help">PULL THEN<br>PUSH</small>`;

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
  consoleEl.querySelector('#editField').onclick=()=>{if(enabled&&!cpuMode){toggleOptions(false);onFieldEdit();}};
  consoleEl.querySelector('#closeLength').onclick=()=>{toggleLength(false);movement.focus();};
  const toggleOptions = open => { if(open)toggleLength(false); options.hidden = !open; movement.setAttribute('aria-expanded', String(open));if(open)consoleEl.querySelector('#closeDelivery').focus(); };
  movement.onclick = () => toggleOptions(options.hidden);
  consoleEl.querySelector('#closeDelivery').onclick = () => { toggleOptions(false); movement.focus(); };
  consoleEl.addEventListener('keydown', event => { if(event.key === 'Escape') {toggleLength(false);toggleOptions(false); movement.focus();} });
  const powerReadout = meter.querySelector('#bowlingPower');
  const spring = createPlungerCharge();
  const clearPower = consoleEl.querySelector('#resetCharge');
  let recoil = null, releaseTimer = null, cpuGeneration = 0;

  let enabled = false;
  let cpuMode = false;
  let dragging = false;
  let pointerId = null;
  let pull = 0;
  let line = 'CENTRE';
  let type = 'PACE', bowler='MEDIUM', length='GOOD';
  let target = pitchTargetFor({line,length});
  let cpuTimer = null;

  const emitSelection = () => onSelectionChange(getSelection());

  function updatePull(next, animate = false) {
    pull = clamp(next, 0, 1);
    plunger.style.setProperty('--pull', pull.toFixed(3));
    plunger.classList.toggle('animated', animate);
    powerLabel.textContent = `${Math.round((pull>=.05 ? .2 + .8 * pull : 0) * 100)}%`;
    powerReadout.textContent = powerLabel.textContent;
    const band=bowlingPowerBand(getSelection()),percent=parseInt(powerLabel.textContent,10);
    meter.dataset.zone=band.zone;meter.style.setProperty('--power',percent+'%');
    for(const [key,value] of Object.entries({low:band.low,red:band.red,'ideal-start':band.ideal-.03,'ideal-end':band.ideal+.03}))meter.style.setProperty('--'+key,(value*100)+'%');
    meter.querySelector('#powerMeter').setAttribute('aria-valuenow',percent);
    const status=pull<.05?'Pull to charge':({red:'Max pace · less accuracy',amber:'Gentle',cyan:'Ideal release',green:'Controlled'})[band.zone];
    meter.querySelector('.power-status').textContent=status;meter.querySelector('#powerMeter').setAttribute('aria-valuetext',percent+'% · '+status);
    handle.setAttribute('aria-label', `Pull to charge, push to bowl. Power ${powerLabel.textContent}. Down arrow charges, Up arrow or Enter bowls, Escape clears.`);
    clearPower.disabled=!enabled||cpuMode||pull<.05||Boolean(recoil);
    consoleEl.querySelector('#aimSummary').textContent=pull>=.05?'Power held. Push forward to bowl.':'Pull to charge. Push to bowl.';
    onPowerChange(getSelection());
  }

  function select(kind, value, emit = true) {
    if (kind === 'line') line = value;
    if (kind === 'length') length=value;
    if (kind === 'line' || kind === 'length') target=pitchTargetFor({line,length});
    if (kind === 'type') type = value;
    consoleEl.querySelectorAll(`[data-${kind}]`).forEach(button => {
      button.classList.toggle('selected', button.dataset[kind] === value);
      button.setAttribute('aria-pressed', String(button.dataset[kind] === value));
    });
    const label=line[0]+line.slice(1).toLowerCase()+' · '+LENGTHS[length].label;
    lengthPicker.innerHTML=`${lineIcon(line)}<span><small>AIM WITH BUTTONS</small>${label}</span>`;
    consoleEl.querySelector('#landingReadout').textContent=label;
    consoleEl.querySelectorAll('[data-zone-line]').forEach(b=>{const selected=b.dataset.zoneLine===line&&b.dataset.zoneLength===length;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',selected);});
    consoleEl.querySelector('#deliveryLabel').textContent=DELIVERY_LABELS[type];
    consoleEl.querySelector('#lengthPicker').setAttribute('aria-label',`Aim with buttons. ${label}`);
    updatePull(pull);
    if (emit) emitSelection();
  }

  consoleEl.querySelectorAll('[data-type]').forEach(button => { button.onclick = () => { if(enabled && !cpuMode) { select('type', button.dataset.type); toggleOptions(false); movement.focus(); } }; });
  const grid=consoleEl.querySelector('.landing-grid');let aimDrag=null;
  function aim(e){const r=grid.getBoundingClientRect();select('line',['LEFT','CENTRE','RIGHT'][clamp(Math.floor((e.clientX-r.left)/r.width*3),0,2)],false);select('length',['SHORT','GOOD','FULL'][clamp(Math.floor((e.clientY-r.top)/r.height*3),0,2)]);}
  grid.onpointerdown=e=>{if(!enabled||cpuMode)return;e.preventDefault();aimDrag={id:e.pointerId,line,length,target};grid.setPointerCapture(e.pointerId);aim(e);};
  grid.onpointermove=e=>{if(aimDrag?.id===e.pointerId)aim(e);};grid.onpointerup=()=>{aimDrag=null;};
  grid.onpointercancel=()=>{if(aimDrag){setTarget(aimDrag.target);aimDrag=null;}};
  grid.querySelectorAll('button').forEach(b=>b.onclick=e=>{if(e.detail===0&&enabled&&!cpuMode){select('line',b.dataset.zoneLine,false);select('length',b.dataset.zoneLength);}});
  for(const [dialog,close,trigger] of [[lengthOptions,()=>toggleLength(false),movement],[options,()=>toggleOptions(false),movement]])dialog.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.stopPropagation();close();trigger.focus();}
    if(e.key==='Tab'){const items=[...dialog.querySelectorAll('button:not([hidden])')].filter(b=>!b.disabled),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });

  function endDrag() {
    const oldPointer=pointerId;
    dragging=false;pointerId=null;
    plunger.classList.remove('dragging');meter.classList.remove('charging');
    if(oldPointer!==null&&handle.hasPointerCapture?.(oldPointer))handle.releasePointerCapture(oldPointer);
  }
  const cancel = () => {spring.cancel();endDrag();updatePull(spring.charge);};
  function resetCharge() {
    clearTimeout(releaseTimer);releaseTimer=null;recoil=null;
    clearTimeout(cpuTimer);cpuGeneration++;
    spring.reset();endDrag();updatePull(0);
  }
  function bowl(power) {
    if(power===null||!enabled||cpuMode||recoil)return;
    const selection={...getSelection(),power};
    endDrag();spring.reset();
    recoil={from:pull,to:0,start:performance.now(),duration:PLUNGER_RECOIL_MS};
    clearPower.disabled=true;handle.disabled=true;
    // The ball leaves when the spring has driven the rod back to its rest stop.
    releaseTimer=setTimeout(()=>{
      releaseTimer=null;recoil=null;updatePull(0);
      if(enabled&&!cpuMode){lastDelivery=selection;onRelease(selection);}
      handle.disabled=!enabled||cpuMode;
    },PLUNGER_RECOIL_MS);
  }
  clearPower.onclick=()=>{resetCharge();handle.focus();};
  handle.addEventListener('pointerdown', event => {
    if (!enabled || cpuMode || dragging || recoil || !canPull() || event.button!==0) return;
    event.preventDefault();onInteraction({type:'LEVER_PULL'});
    dragging=true;pointerId=event.pointerId;spring.begin(event.clientY,Math.min(100,Math.max(32,window.innerHeight-event.clientY-12)));
    handle.setPointerCapture?.(pointerId);
    plunger.classList.add('dragging');meter.classList.add('charging');
  });
  handle.addEventListener('pointermove', event => {
    if (!dragging || event.pointerId !== pointerId) return;
    event.preventDefault();
    const power=spring.move(event.clientY);
    if(power!==null)bowl(power);else updatePull(spring.charge);
  });
  handle.addEventListener('pointerup', event => {
    if(!dragging||event.pointerId!==pointerId)return;
    spring.hold();endDrag(); // Lifting holds the charge. It never bowls.
  });
  handle.addEventListener('pointercancel', cancel);
  handle.addEventListener('lostpointercapture',()=>{if(dragging)cancel();});
  window.addEventListener('blur',resetCharge);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)resetCharge();});
  handle.addEventListener('keydown', event => {
    if (!enabled || cpuMode || recoil || !canPull()) return;
    if (['ArrowDown','ArrowUp','Enter',' ','Escape'].includes(event.key)) event.preventDefault();
    if(event.key==='Escape'){resetCharge();return;}
    if(event.key==='ArrowDown'){spring.set(spring.charge+.1);updatePull(spring.charge);}
    if(['ArrowUp','Enter',' '].includes(event.key)&&!event.repeat)bowl(spring.release());
  });

  function setState({ visible = false, interactive = false, cpu = false, running = false } = {}) {
    summary.hidden=!visible || cpu || !running || !lastDelivery;
    if(!summary.hidden){const s=lastDelivery;summary.textContent=`${DELIVERY_LABELS[s.type]} · ${s.line[0]+s.line.slice(1).toLowerCase()} / ${LENGTHS[s.length].label} · ${Math.round(s.power*100)}%`;}
    if(!visible)lastDelivery=null;
    plunger.hidden = !visible;
    consoleEl.hidden = !visible || !interactive || cpu;
    meter.hidden = !visible || !interactive || cpu;
    enabled = Boolean(interactive);
    if(!enabled) { if(!cpu||!visible||running)resetCharge();else cancel(); toggleOptions(false); toggleLength(false); }
    movement.disabled = !enabled || cpu;
    cpuMode = Boolean(cpu);
    plunger.classList.toggle('cpu', cpuMode);
    plunger.classList.toggle('disabled', !enabled && !cpuMode);
    consoleEl.classList.toggle('cpu', cpuMode);
    consoleEl.querySelectorAll('button').forEach(button => { button.disabled = !enabled || cpuMode; });
    handle.disabled = !enabled || cpuMode;
    clearPower.disabled=!enabled||cpuMode||pull<.05;
  }

  function setBowler(next){bowler=BOWLERS[next]?next:'MEDIUM';consoleEl.querySelector('#bowlerName').textContent=BOWLERS[bowler].label;consoleEl.querySelectorAll('[data-type]').forEach(button=>{button.hidden=!BOWLERS[bowler].types.includes(button.dataset.type);});if(!BOWLERS[bowler].types.includes(type))select('type',BOWLERS[bowler].types[0],false);updatePull(pull);}

  function setSelection(selection = {}, emit = false) {
    const nextTarget=pitchTargetFor(selection.target || selection.line || selection.length ? selection : getSelection());
    if(selection.bowler)setBowler(selection.bowler);
    selection=normalizeBowling({...getSelection(),...selection},bowler);
    if(selection.length)select('length',selection.length,false);
    if (selection.line) select('line', String(selection.line).toUpperCase(), false);
    if (selection.type) select('type', String(selection.type).toUpperCase(), false);
    setTarget(nextTarget,false);
    if (Number.isFinite(Number(selection.power))) {spring.set((Number(selection.power)-.2)/.8);updatePull(spring.charge,true);}
    if (emit) emitSelection();
  }

  function animateCpu(selection = {}) {
    resetCharge();setSelection(selection,false);
    setState({visible:true,interactive:false,cpu:true});
    const generation=cpuGeneration,charged=clamp((Number(selection.power??.6)-.2)/.8,0,1);
    updatePull(charged);
    recoil={from:0,to:charged,start:performance.now(),duration:cpuPullMs};
    cpuTimer=setTimeout(()=>{
      if(generation!==cpuGeneration)return;
      recoil={from:charged,to:0,start:performance.now(),duration:220};
      cpuTimer=setTimeout(()=>{if(generation===cpuGeneration){recoil=null;updatePull(0);}},220);
    },cpuPullMs);
  }

  function getSelection() {
    return { bowler, length, line, type, target:{...target}, power: pull>=.05 ? .2 + .8 * pull : 0, movementScale: 1 };
  }

  function setTarget(next,emit=true) {
    next=normalizePitchTarget(next);if(!next)return;
    const description=describePitchTarget(next);
    select('line',description.line,false);select('length',description.length,false);
    target=next;
    consoleEl.querySelectorAll('[data-zone-line]').forEach(b=>{const p=pitchTargetFor({line:b.dataset.zoneLine,length:b.dataset.zoneLength}),exact=Math.hypot(p.x-target.x,p.z-target.z)<.015;b.classList.toggle('selected',exact);b.setAttribute('aria-pressed',String(exact));});
    updatePull(pull);
    if(emit)emitSelection();
  }

  updatePull(0);
  select('line', line, false);
  select('type', type, false);
  select('length', length, false);
  setBowler(bowler);

  return {
    setState,
    setAim: (lineValue,lengthValue) => {if(enabled&&!cpuMode){select('line',lineValue,false);select('length',lengthValue);}},
    setTarget: next => {if(enabled&&!cpuMode&&!dragging)setTarget(next);},
    setFieldLabel: custom => {consoleEl.querySelector('#fieldLabel').textContent=custom?'Custom':'Default';},
    setFieldEditing: open => {consoleEl.querySelector('#editField').setAttribute('aria-expanded',String(open));},
    setBowler,
    setSelection,
    getSelection,
    resetCharge,
    getState: () => ({band: bowlingPowerBand(getSelection()),
      pull:recoil?recoil.from+(recoil.to-recoil.from)*Math.min(1,(performance.now()-recoil.start)/recoil.duration):pull,
      charge:pull,power:pull>=.05?.2+.8*pull:0,recoiling:Boolean(recoil),
      dragging,busy:dragging||Boolean(recoil),enabled,cpuMode,visible:!plunger.hidden}),
    animateCpu,
    get line() { return line; },
    get type() { return type; },
    get typeLabel() { return TYPE_LABELS[type] || type; }
  };
}
