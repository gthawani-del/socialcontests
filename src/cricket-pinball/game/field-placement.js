export function createFieldPlacement({viewport,table,engine,project,unproject,preview,canEdit,onChange,onOpenChange}) {
  const editor=document.createElement('div');editor.id='fieldEditor';editor.hidden=true;
  editor.innerHTML=`<div class="field-editor-toolbar"><strong>Set your field</strong><button type="button" id="defaultField">Reset</button><button type="button" id="closeField">Done</button></div>
    <div class="field-position-pins" aria-hidden="true"></div><div class="field-position-buttons" role="group" aria-label="Move fielders"></div>
    <div class="field-editor-footer"><p id="fieldHint" role="status">Drag a fielder to a highlighted spot, or tap to select.</p><label id="fieldPositionLabel" hidden>Move selected fielder<select id="fieldPosition"><option value="">Choose a position…</option></select></label></div>`;
  viewport.append(editor);
  const root=editor.querySelector('.field-position-buttons'),pins=editor.querySelector('.field-position-pins'),hint=editor.querySelector('#fieldHint'),select=editor.querySelector('#fieldPosition');
  let opened=false,selected=null,drag=null;
  const occupied=slot=>table.fielders.some(f=>f.id!==selected && Math.hypot(f.x-slot.x,f.z-slot.z)<.3);
  const label=f=>table.fieldingSlots.find(s=>s.id===f.slotId)?.label || f.label;
  function renderSelection(message) {
    pins.replaceChildren();select.replaceChildren(new Option('Choose a position…',''));
    editor.querySelector('#fieldPositionLabel').hidden=!selected;
    hint.textContent=message || (selected?'Drag to a gold spot, tap a spot, or choose a position below.':'Drag a fielder to a highlighted spot, or tap to select.');
    for(const button of root.children)button.setAttribute('aria-pressed',String(button.dataset.fielderId===selected));
    if(selected)for(const [i,slot] of table.fieldingSlots.entries()) {
      const pin=document.createElement('span');pin.dataset.pinId=slot.id;pin.textContent=occupied(slot)?'×':i+1;pin.classList.toggle('occupied',occupied(slot));pins.append(pin);
      const option=new Option(`${i+1} · ${slot.label}${occupied(slot)?' · occupied':''}`,slot.id);option.disabled=occupied(slot);select.append(option);
    }
    position();
  }
  function choose(id) {selected=id;renderSelection();}
  function commit(slot) {
    if(!canEdit() || !selected || !slot || !engine.setFieldPosition(selected,slot.id))return false;
    const name=slot.label;preview(selected,null);selected=null;onChange();renderSelection(`Fielder moved to ${name}. Drag either fielder to adjust.`);return true;
  }
  function nearest(x,y) {
    return table.fieldingSlots.map(slot=>({slot,d:Math.hypot(project(slot).x-x,project(slot).y-y)})).sort((a,b)=>a.d-b.d)[0];
  }
  function clearDrag(cancelled=false) {
    if(!drag)return;
    const old=drag;drag=null;preview(old.id,null);old.button.classList.remove('dragging');
    if(old.button.hasPointerCapture(old.pointerId))old.button.releasePointerCapture(old.pointerId);
    if(cancelled)renderSelection('Move cancelled. Your field is unchanged.');
    position();
  }
  for(const fielder of table.fielders) {
    const button=document.createElement('button');button.type='button';button.dataset.fielderId=fielder.id;
    button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="3" fill="currentColor"/><path d="M5 12l7-3 7 3M12 10v6m0-1-5 6m5-6 5 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg><span></span>';
    button.setAttribute('aria-describedby','fieldHint');root.append(button);
    button.onpointerdown=e=>{
      if(!canEdit() || drag || e.button!==0)return;e.preventDefault();e.stopPropagation();
      choose(fielder.id);drag={id:fielder.id,pointerId:e.pointerId,button,startX:e.clientX,startY:e.clientY,moved:false,point:null,slot:null};
      button.setPointerCapture(e.pointerId);
    };
    button.onpointermove=e=>{
      if(drag?.pointerId!==e.pointerId)return;e.preventDefault();
      if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<6&&!drag.moved)return;
      drag.moved=true;button.classList.add('dragging');
      const point=unproject(e.clientX,e.clientY),candidate=nearest(e.clientX,e.clientY);
      drag.slot=candidate?.d<=38?candidate.slot:null;
      drag.point=point && {x:Math.max(-1.4,Math.min(1.4,point.x)),z:Math.max(-1.6,Math.min(.5,point.z))};
      preview(fielder.id,drag.point);
      for(const pin of pins.children)pin.classList.toggle('candidate',pin.dataset.pinId===drag.slot?.id&&!occupied(drag.slot));
      hint.textContent=drag.slot?(occupied(drag.slot)?'That position is occupied. Choose another spot.':`Release to place at ${drag.slot.label}.`):'Move onto a highlighted spot, then release.';
      position();
    };
    button.onpointerup=e=>{
      if(drag?.pointerId!==e.pointerId)return;e.stopPropagation();const old=drag;clearDrag();
      if(old.moved && !commit(old.slot))renderSelection('Choose a free highlighted spot. Your field is unchanged.');
    };
    button.onpointercancel=()=>clearDrag(true);button.onlostpointercapture=()=>clearDrag(true);
    button.onclick=e=>{if(e.detail===0 && canEdit())choose(fielder.id);};
  }
  // The visible pins are small enough to distinguish nearby field positions.
  // Tap resolution chooses the nearest pin; the select provides full-size touch/keyboard access.
  editor.addEventListener('pointerup',e=>{
    if(!selected || drag || e.target.closest('button,select,label,.field-editor-footer,.field-editor-toolbar'))return;
    const candidate=nearest(e.clientX,e.clientY);if(candidate?.d<=28)commit(candidate.slot);
  });
  select.onchange=()=>commit(table.fieldingSlots.find(s=>s.id===select.value));
  editor.querySelector('#defaultField').onclick=()=>{if(canEdit()){clearDrag();engine.resetFieldPositions();selected=null;onChange();renderSelection('Default field restored.');}};
  editor.querySelector('#closeField').onclick=()=>close(true);
  editor.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(drag)clearDrag(true);else close(true);}});
  window.addEventListener('blur',()=>clearDrag(true));window.addEventListener('resize',()=>clearDrag(true));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearDrag(true);});
  function position() {
    if(!opened)return;const rect=viewport.getBoundingClientRect();
    for(const button of root.children){
      const f=table.fielders.find(f=>f.id===button.dataset.fielderId),p=project(drag?.id===f.id&&drag.point?drag.point:f);
      button.style.left=`${p.x-rect.left}px`;button.style.top=`${p.y-rect.top}px`;
      button.querySelector('span').textContent=label(f);button.setAttribute('aria-label',`Move fielder at ${label(f)}`);
    }
    for(const pin of pins.children){const slot=table.fieldingSlots.find(s=>s.id===pin.dataset.pinId),p=project(slot);pin.style.left=`${p.x-rect.left}px`;pin.style.top=`${p.y-rect.top}px`;}
  }
  function close(restoreFocus=false) {
    if(!opened)return;clearDrag();opened=false;selected=null;editor.hidden=true;onOpenChange(false);
    if(restoreFocus)document.querySelector('#editField').focus();
  }
  return {get opened(){return opened;},position,close,open(){if(!canEdit())return;opened=true;selected=null;editor.hidden=false;onOpenChange(true);renderSelection();editor.querySelector('#closeField').focus();}};
}
