import {PITCH_TARGET_BOUNDS, normalizePitchTarget} from './bowling-rules.js';

export function createPitchTargetControl({viewport,canvas,project,unproject,getSelection,setTarget,canInteract}) {
  const handle=document.createElement('button');
  handle.id='pitchTarget';handle.type='button';handle.hidden=true;
  handle.setAttribute('aria-label','Landing target. Drag to aim, or use arrow keys.');
  handle.setAttribute('aria-describedby','aimSummary');
  viewport.append(handle);
  let enabled=false,drag=null;
  function move(event) {
    const point=unproject(event.clientX,event.clientY);
    if(point)setTarget(normalizePitchTarget(point));
    position();
  }
  function start(event) {
    if(!enabled || !canInteract() || drag || (event.button!==undefined && event.button!==0))return;
    const p=unproject(event.clientX,event.clientY),b=PITCH_TARGET_BOUNDS;
    if(event.currentTarget===canvas && (!p || p.x<b.minX-.08 || p.x>b.maxX+.08 || p.z<b.minZ-.08 || p.z>b.maxZ+.08))return;
    event.preventDefault();
    drag={id:event.pointerId,element:event.currentTarget,original:{...getSelection().target}};
    drag.element.setPointerCapture(event.pointerId);handle.classList.add('dragging');
    move(event);
  }
  function finish(event,cancelled=false) {
    if(!drag || (event?.pointerId!==undefined && drag.id!==event.pointerId))return;
    const old=drag;drag=null;
    if(cancelled)setTarget(old.original);
    if(old.element.hasPointerCapture(old.id))old.element.releasePointerCapture(old.id);
    handle.classList.remove('dragging');position();
  }
  for(const element of [canvas,handle]) {
    element.addEventListener('pointerdown',start);
    element.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId){e.preventDefault();move(e);}});
    element.addEventListener('pointerup',e=>finish(e));
    element.addEventListener('pointercancel',e=>finish(e,true));
    element.addEventListener('lostpointercapture',e=>finish(e,true));
  }
  window.addEventListener('blur',()=>finish(null,true));
  window.addEventListener('resize',()=>finish(null,true));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(null,true);});
  handle.addEventListener('keydown',e=>{
    if(e.key==='Escape'){finish(null,true);return;}
    if(!enabled || !canInteract() || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();const next={...getSelection().target},step=e.shiftKey?.1:.025;
    if(e.key==='ArrowLeft')next.x-=step;if(e.key==='ArrowRight')next.x+=step;
    if(e.key==='ArrowUp')next.z-=step;if(e.key==='ArrowDown')next.z+=step;
    setTarget(normalizePitchTarget(next));position();
  });
  function position() {
    if(!enabled)return;
    const point=project(getSelection().target),rect=viewport.getBoundingClientRect();
    handle.style.left=`${point.x-rect.left}px`;handle.style.top=`${point.y-rect.top}px`;
  }
  return {position,get dragging(){return Boolean(drag);},setEnabled(value){
    if(!value)finish(null,true);
    enabled=value;handle.hidden=!value;position();
  }};
}
