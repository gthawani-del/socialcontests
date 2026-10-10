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
