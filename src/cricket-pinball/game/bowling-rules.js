import {STADIUM_PITCH} from './stadium-layout.js';
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
// Keep the entire marker within the authored brown pitch, including its outer edge.
export const PITCH_TARGET_RADIUS = .105;
const pitchHalfWidth = STADIUM_PITCH.widthMetres / STADIUM_PITCH.metresPerUnit / 2;
export const PITCH_TARGET_BOUNDS = Object.freeze({
 minX:-pitchHalfWidth+PITCH_TARGET_RADIUS+.003, maxX:pitchHalfWidth-PITCH_TARGET_RADIUS-.003,
 minZ:1.12, maxZ:1.93
});
export function normalizePitchTarget(target) {
 if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.z)) return null;
 const b=PITCH_TARGET_BOUNDS;
 return {x:Math.max(b.minX,Math.min(b.maxX,target.x)),z:Math.max(b.minZ,Math.min(b.maxZ,target.z))};
}
export function pitchTargetFor(selection={}) {
 return normalizePitchTarget(selection.target) || {x:({LEFT:PITCH_TARGET_BOUNDS.minX,CENTRE:0,RIGHT:PITCH_TARGET_BOUNDS.maxX})[selection.line] || 0,z:(LENGTHS[selection.length] || LENGTHS.GOOD).bounceZ};
}
export function describePitchTarget(target) {
 return {line:target.x<PITCH_TARGET_BOUNDS.minX/3?'LEFT':target.x>PITCH_TARGET_BOUNDS.maxX/3?'RIGHT':'CENTRE',
  length:Object.keys(LENGTHS).reduce((a,b)=>Math.abs(target.z-LENGTHS[a].bounceZ)<Math.abs(target.z-LENGTHS[b].bounceZ)?a:b)};
}
export function normalizeBowling(selection={},bowler=selection.bowler||'MEDIUM') {
 bowler=BOWLERS[bowler]?bowler:'MEDIUM';
 const profile=BOWLERS[bowler];
 const target=normalizePitchTarget(selection.target);
 return {...selection,target,bowler,type:profile.types.includes(selection.type)?selection.type:profile.types[0],
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
