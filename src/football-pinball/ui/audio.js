/** Short synthesized match feedback. No external audio downloads. */
export function createAudio(root) {
  let context,
    muted = true,
    lastEvent = 0;
  try {
    muted = localStorage.getItem("football-audio") !== "on";
  } catch {}
  const button = document.createElement("button");
  button.id = "fp-audio";
  button.type = "button";
  root.querySelector(".fp-actions").append(button);
  const activate = () => {
    if (!muted) {
      context ??= new (window.AudioContext || window.webkitAudioContext)();
      context.resume();
    }
  };
  root.addEventListener("pointerdown", activate);
  const label = () => {
    button.textContent = muted ? "Sound off" : "Sound on";
    button.setAttribute("aria-pressed", String(!muted));
  };
  label();
  button.onclick = () => {
    muted = !muted;
    if (!muted) {
      context ??= new (window.AudioContext || window.webkitAudioContext)();
      context.resume();
    }
    try {
      localStorage.setItem("football-audio", muted ? "off" : "on");
    } catch {}
    label();
  };
  function tone(frequency, duration = 0.07) {
    if (muted || !context || context.state !== "running") return;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.07, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + duration,
    );
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }
  return {
    update(events) {
      for (const event of events || []) {
        if (event.eventId <= lastEvent) continue;
        lastEvent = event.eventId;
        if (event.type === "GOAL_SCORED") tone(660, 0.2);
        else if (event.type === "TARGET_HIT") tone(440);
        else if (event.type === "FLIP_DOWN") tone(150, 0.035);
        else if (event.type === "BANK_ACCEPTED") tone(880, 0.25);
      }
    },
    reset() {
      lastEvent = 0;
    },
    dispose() {
      root.removeEventListener("pointerdown", activate);
      context?.close();
      button.remove();
    },
  };
}
