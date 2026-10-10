// Small, scalable cricket diagrams; geometry conveys line and movement.
const svg = body => `<svg viewBox="0 0 48 40" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
export const DELIVERY_LABELS = {PACE:'Straight',SWING_LEFT:'Swing left',SWING_RIGHT:'Swing right',CUTTER_LEFT:'Cutter left',CUTTER_RIGHT:'Cutter right',SPIN_LEFT:'Spin left',SPIN_RIGHT:'Spin right'};
export function lineIcon(line) {
 const x={LEFT:12,CENTRE:24,RIGHT:36}[line];
 return svg(`<path d="M17 4h14l4 32H13Z" opacity=".35"/><path d="M16 30h16M21 27v6m3-6v6m3-6v6" opacity=".6"/><path d="M24 5 Q24 15 ${x} 24" stroke-dasharray="3 3"/><circle cx="${x}" cy="24" r="4" fill="currentColor" stroke="none"/>`);
}
export function deliveryIcon(type) {
 const right=type.endsWith('RIGHT'),end=right?37:11;
 const d=type==='PACE'?'M24 5v25':type.startsWith('SWING')?`M24 5 Q24 18 ${end} 30`:type.startsWith('CUTTER')?`M24 5 L24 22 L${end} 30`:`M24 5 Q17 14 24 22 Q29 29 ${end} 30`;
 return svg(`<path d="M8 35h32" opacity=".3"/><path d="${d}"/><circle cx="${type==='PACE'?24:end}" cy="30" r="4" fill="currentColor" stroke="none"/>${type.startsWith('SPIN')||type.startsWith('CUTTER')?'<ellipse cx="24" cy="22" rx="5" ry="2" opacity=".6"/>':''}`);
}
