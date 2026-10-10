// Shared by UI, CPU and physics. Selection is validated before a ball is launched.
export const BOWLERS = Object.freeze({
 FAST: {label:'Fast',speed:1.1,types:['PACE','SWING_LEFT','SWING_RIGHT','SLOWER']},
 MEDIUM: {label:'Medium pace',speed:1,types:['PACE','SWING_LEFT','SWING_RIGHT','CUTTER_LEFT','CUTTER_RIGHT','SLOWER']},
 SPINNER: {label:'Spinner',speed:.84,types:['SPIN_LEFT','SPIN_RIGHT','PACE','FLIGHTED','FLIPPER']}
});
export const LENGTHS = Object.freeze({
 FULL:{label:'Full',bounceZ:1.88,rebound:.8},
 GOOD:{label:'Good',bounceZ:1.66,rebound:1.05},
 SHORT:{label:'Short',bounceZ:1.22,rebound:.8}
});
export function normalizeBowling(selection={},bowler=selection.bowler||'MEDIUM') {
 bowler=BOWLERS[bowler]?bowler:'MEDIUM';
 const profile=BOWLERS[bowler];
 return {...selection,bowler,type:profile.types.includes(selection.type)?selection.type:profile.types[0],
  line:['LEFT','CENTRE','RIGHT'].includes(selection.line)?selection.line:'CENTRE',
  length:LENGTHS[selection.length]?selection.length:'GOOD',
  power:Math.max(.24,Math.min(1,Number.isFinite(Number(selection.power))?Number(selection.power):.6)),
  movementScale:Number.isFinite(Number(selection.movementScale))?selection.movementScale:1};
}
export function selectionKey(selection={}) {return [selection.bowler,selection.line,selection.type,selection.length].join(':');}

// One source for UI bands and the physical loss of control. No scoring penalty.
export function bowlingPowerBand(selection={}) {
 const s=normalizeBowling(selection);
 const ideal=({SPINNER:.60,MEDIUM:.70,FAST:.80})[s.bowler]+(s.type==='FLIPPER'?.10:['SLOWER','FLIGHTED'].includes(s.type)?-.10:0);
 const red=Math.min(.95,ideal+.20),low=ideal-.20;
 const risk=Math.max(0,(s.power-red)/(1-red));
 return {ideal,low,red,risk,zone:risk>0?'red':s.power<low?'amber':Math.abs(s.power-ideal)<=.030001?'cyan':'green'};
}
export function bowlingDispersion(selection,random=Math.random) {
 const s=normalizeBowling(selection),{risk}=bowlingPowerBand(s);
 if(!risk)return {x:0,z:0,risk:0};
 const spread=({SPINNER:.20,MEDIUM:.16,FAST:.12})[s.bowler]*risk;
 return {x:(random()*2-1)*spread,z:(random()*2-1)*.055*risk,risk};
}
