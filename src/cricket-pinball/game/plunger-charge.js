const clamp = value => Math.max(0, Math.min(1, value));
export const PLUNGER_STROKE_PX = 100;
export const PLUNGER_RECOIL_MS = 90;

// A manual spring plunger: power follows its current displacement. Moving the
// handle forwards reduces compression; only releasing the handle fires it.
export function createPlungerCharge() {
  let charge = 0, gesture = null;
  return {
    get charge() { return charge; },
    get dragging() { return Boolean(gesture); },
    get power() { return charge >= .05 ? .2 + .8 * charge : 0; },
    set(value) { charge = clamp(value); },
    begin(y,stroke=PLUNGER_STROKE_PX) { gesture = {y, initial:charge,stroke}; },
    move(y) {
      if (!gesture) return;
      charge = clamp(gesture.initial + (y - gesture.y) / gesture.stroke);
    },
    cancel() { this.reset(); },
    release() {
      const power = this.power;
      this.reset();
      return power || null;
    },
    reset() { charge = 0; gesture = null; }
  };
}
