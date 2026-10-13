const clamp = value => Math.max(0, Math.min(1, value));
export const PLUNGER_STROKE_PX = 100;
export const PLUNGER_PUSH_PX = 16;
export const PLUNGER_RECOIL_MS = 90;

// A latched spring: lifting a finger holds charge; a deliberate forward push
// releases the stored peak energy, independent of the speed of that push.
export function createPlungerCharge() {
  let charge = 0, gesture = null;
  return {
    get charge() { return charge; },
    get dragging() { return Boolean(gesture); },
    get power() { return charge >= .05 ? .2 + .8 * charge : 0; },
    set(value) { charge = clamp(value); },
    begin(y,stroke=PLUNGER_STROKE_PX) { gesture = {y, peakY:y, initial:charge,stroke}; },
    move(y) {
      if (!gesture) return null;
      gesture.peakY = Math.max(gesture.peakY, y);
      charge = Math.max(charge, clamp(gesture.initial + (y - gesture.y) / gesture.stroke));
      if (charge >= .05 && gesture.peakY - y >= PLUNGER_PUSH_PX) return this.release();
      return null;
    },
    hold() { gesture = null; },
    cancel() { if (gesture) charge = gesture.initial; gesture = null; },
    release() {
      const power = this.power;
      if (!power) return null;
      charge = 0; gesture = null;
      return power;
    },
    reset() { charge = 0; gesture = null; }
  };
}
