// Presentation only: this gauge cannot select a crash point or change payout.
const marks=[1,1.2,1.5,2,3,5,10,25,100];
const yAt=index=>400-index*45;
export function crashMeterMarkup(){
 return `<div class="fc-meter-title">MULTIPLIER<small id="fc-meter-state">READY</small></div><svg class="fc-meter" viewBox="0 0 100 440" role="meter" aria-label="Current payout multiplier" aria-valuemin="1" aria-valuemax="100" aria-valuenow="1"><defs><linearGradient id="fc-meter-colour" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#38bcff"/><stop offset=".42" stop-color="#67ddff"/><stop offset=".65" stop-color="#ff8d88"/><stop offset="1" stop-color="#ffd85b"/></linearGradient><filter id="fc-meter-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2"/></filter></defs><path d="M84 410V22m-8 10 8-12 8 12" fill="none" stroke="url(#fc-meter-colour)" stroke-width="4" opacity=".35"/><path class="fc-meter-fill" d="M84 400V400" fill="none" stroke="url(#fc-meter-colour)" stroke-width="5" stroke-linecap="round"/>${marks.map((value,index)=>`<g data-meter-mark="${value}" class="fc-meter-mark"><rect x="3" y="${yAt(index)-16}" width="63" height="32" rx="6"/><text x="34" y="${yAt(index)+5}" text-anchor="middle">${value}×</text><circle cx="84" cy="${yAt(index)}" r="4"/></g>`).join('')}<g class="fc-meter-indicator" transform="translate(0 400)"><circle cx="84" r="10" fill="#7ee6ff" filter="url(#fc-meter-glow)"/><circle cx="84" r="6" fill="#fff"/><path d="m74 0-5-4v8Z" fill="#fff"/></g></svg>`;
}
export function bindCrashMeter(root){
 const svg=root.querySelector('.fc-meter'),indicator=svg.querySelector('.fc-meter-indicator'),fill=svg.querySelector('.fc-meter-fill'),rows=[...svg.querySelectorAll('[data-meter-mark]')],state=root.querySelector('#fc-meter-state');let prior='';
 return (value,status='idle')=>{
  const n=Math.max(1,Math.min(100,Number(value)||1)),key=n.toFixed(2)+status;if(key===prior)return;prior=key;
  let i=marks.findLastIndex(v=>v<=n);const fraction=i===marks.length-1?0:(Math.log(n)-Math.log(marks[i]))/(Math.log(marks[i+1])-Math.log(marks[i]));const y=yAt(i)-fraction*45;
  indicator.setAttribute('transform',`translate(0 ${y.toFixed(2)})`);fill.setAttribute('d',`M84 400V${y.toFixed(2)}`);
  svg.setAttribute('aria-valuenow',n.toFixed(2));svg.setAttribute('aria-valuetext',`${n.toFixed(2)} times payout`);
  rows.forEach((row,index)=>{row.classList.toggle('fc-meter-passed',index<=i);row.classList.toggle('fc-meter-current',index===i);});
  state.textContent={active:'RISING',ready:'GET READY',crashed:'CRASHED',cashed_out:'SECURED'}[status]||'READY';
 };
}
