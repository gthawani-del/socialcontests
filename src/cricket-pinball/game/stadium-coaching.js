const STORAGE_KEY='cricket-pinball-coaching-v1';
const copy={
  bat:[['Try a bat','Tap either bat button to see it move.'],['Watch the ball','Follow the ball from the side lane to the pitch.'],['Read the bounce','Wait for the bounce, then time your swing.'],['Make contact','Tap the left or right bat as the ball reaches it.'],['Check your timing','Use Early / Perfect / Late feedback on your next shot.']],
  bowl:[['Aim your delivery','Drag the pitch ring to aim. Use Delivery to choose a ball, or Field to move your fielders.'],['Pull the lever','Drag the right-side handle down. Red means extra pace with reduced control.'],['Release to bowl','Let go of the handle to deliver the ball.'],['Watch the bounce','The ring marks the first bounce. Red power adds uncertainty.'],['Read the result','Watch the CPU response before choosing your next ball.']]
};
// Advance only from observed game/input events, never from elapsed time.
export function coachingStep(role,step,event){
  if(role==='bat'){
    if(event.type==='BAT_INPUT' && event.pressed!==false)return Math.max(step,1);
    if(event.type==='DELIVERY_LAUNCH')return Math.max(step,2);
    if(event.type==='DELIVERY_BOUNCE')return Math.max(step,3);
    if(event.type==='BAT_CONTACT')return 4;
    if(event.type==='OUTCOME' && event.outcome!=='DEAD_BALL')return 5;
  }else{
    if(event.type==='BOWLING_SELECTION')return Math.max(step,1);
    if(event.type==='LEVER_PULL')return Math.max(step,2);
    if(event.type==='DELIVERY_LAUNCH')return Math.max(step,3);
    if(event.type==='DELIVERY_BOUNCE')return Math.max(step,4);
    if(event.type==='OUTCOME' && event.outcome!=='DEAD_BALL')return 5;
  }
  return step;
}
export function createStadiumCoaching({app,getFlow}){
  let learned={};try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');if(saved && typeof saved==='object')learned=saved;}catch{}
  let role=null,step=0,forced=false,active=false;
  const panel=document.createElement('aside');panel.id='stadiumCoach';panel.hidden=true;panel.setAttribute('aria-label','Interactive game guide');
  const text=document.createElement('div'),title=document.createElement('strong'),body=document.createElement('span');text.append(title,body);
  const close=document.createElement('button');close.type='button';close.textContent='Dismiss';close.setAttribute('aria-label','Dismiss game guide');panel.append(text,close);app.querySelector('.controls').prepend(panel);
  const save=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(learned));}catch{}};
  function dismiss(){if(role){learned[role]=true;save();}forced=false;active=false;panel.hidden=true;}
  close.onclick=dismiss;
  function paint(){
    if(!role || !active){panel.hidden=true;return;}
    panel.hidden=false;
    const instruction=step>=5?['First delivery complete',role==='bat'?'Keep practising your timing. Open Help to replay this guide.':'Vary line, length and pace. Open Help to replay this guide.']:copy[role][step];
    title.textContent=instruction[0];body.textContent=instruction[1];panel.dataset.step=String(step);panel.dataset.role=role;
    close.textContent=step>=5?'Got it':'Dismiss';
  }
  return{
    replay(){forced=true;step=0;active=true;paint();},dismiss,
    handle(event){
      if(event.type==='MATCH_RESET'){step=0;active=false;panel.hidden=true;return;}
      if(event.type==='CONTROL_STATE'){
        const nextRole=(event.practice || getFlow()?.practice)==='bat' || event.humanBatting?'bat':'bowl';
        if(!event.match?.innings && !event.practice)return;
        if(nextRole!==role){role=nextRole;step=0;active=forced || !learned[role];}
        else if(event.ready && step===0)active=forced || !learned[role];
        panel.hidden=event.paused || !active; if(!event.paused)paint();return;
      }
      if(!active || !role)return;
      step=coachingStep(role,step,event);
      if(step>=5){learned[role]=true;save();forced=false;}
      // Retire the completed guide on the next delivery, keeping feedback unobstructed.
      if(event.type==='DELIVERY_LAUNCH' && step>=5){active=false;panel.hidden=true;return;}
      paint();
    }
  };
}
