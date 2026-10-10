const KEY='cricket-audio-v1';
export function createStadiumAudio(){
  let saved={};try{saved=JSON.parse(localStorage.getItem(KEY))||{};}catch{}
  let settings={effects:.75,crowd:.45,muted:false,...saved};
  let context,buses,loading=null,primed=false;const buffers=new Map(),last=new Map(),active=new Set();
  const status={loaded:0,played:0,failed:[],lastSound:null};
  function gains(){if(!buses)return;for(const key of ['effects','crowd'])buses[key].gain.value=settings.muted||document.hidden?0:settings[key];}
  async function prime(){
    try{
      context ||= new (window.AudioContext||window.webkitAudioContext)();
      if(!buses){buses={effects:context.createGain(),crowd:context.createGain()};Object.values(buses).forEach(b=>b.connect(context.destination));gains();}
      if(context.state==='suspended')await context.resume();
      primed=true;
      loading ||= Promise.all(['bat','flipper','rail','launch','wicket','crowd'].map(async name=>{
        try{const r=await fetch(`/audio/cricket/${name}.wav`);if(!r.ok)throw Error(r.status);buffers.set(name,await context.decodeAudioData(await r.arrayBuffer()));status.loaded++;}catch{status.failed.push(name);}
      }));await loading;
    }catch{status.failed.push('audio-context');}
  }
  async function play(name,level=1){
    if(!primed || settings.muted || document.hidden)return;
    const now=performance.now();if(now-(last.get(name)||-Infinity)<(name==='rail'?100:45))return;last.set(name,now);
    await loading;
    if(settings.muted||document.hidden||!buffers.has(name)||active.size>=10)return;
    const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffers.get(name);gain.gain.value=level;
    source.connect(gain).connect(buses[name==='crowd'?'crowd':'effects']);active.add(source);source.onended=()=>{active.delete(source);source.disconnect();gain.disconnect();};source.start();status.played++;status.lastSound=name;
  }
  document.addEventListener('visibilitychange',()=>{gains();if(document.hidden)for(const source of active)source.stop();});
  return{prime,play,getSettings:()=>({...settings}),status,configure(next){settings={...settings,...next};for(const key of ['effects','crowd'])settings[key]=Math.max(0,Math.min(1,Number(settings[key])||0));gains();try{localStorage.setItem(KEY,JSON.stringify(settings));}catch{}},handle(event){
    if(event.type==='BAT_CONTACT')play('bat',.7+event.feedback.quality*.3);
    if(event.type==='DELIVERY_LAUNCH')play('launch');
    if(event.type==='OUTCOME'){
      if(event.outcome==='WICKET')play('wicket');
      if(['FOUR','SIX','WICKET'].includes(event.outcome))play('crowd',event.outcome==='SIX'?1:.65);
    }
    if(event.type==='MATCH_RESULT')play('crowd',1);
  }};
}
