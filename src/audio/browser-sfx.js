export class BrowserSfx {
  constructor(config) {
    this.config = config;
    this.context = null;
    this.master = null;
  }

  async unlock() {
    if (!this.config.enabled) return;
    if (!this.context) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      this.context = new AudioCtor();
      this.master = this.context.createGain();
      this.master.gain.value = this.config.masterVolume;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  flipper() {
    this.tone(118, 0.05, this.config.flipperGain, 'square', -36);
    this.tone(74, 0.065, this.config.flipperGain * 0.5, 'sine', -12);
  }

  wall(impact = 1) {
    const gain = this.config.wallGain * clamp(impact / 4, 0.35, 1);
    this.tone(520 + Math.min(impact, 4) * 55, 0.04, gain, 'triangle', -140);
  }

  slingshot() {
    this.tone(240, 0.06, this.config.slingshotGain, 'square', 210);
    this.tone(720, 0.035, this.config.slingshotGain * 0.65, 'triangle', -260);
  }

  bumper() {
    this.tone(310, 0.08, this.config.bumperGain, 'square', 250);
    this.tone(880, 0.05, this.config.bumperGain * 0.75, 'triangle', -300);
  }

  target() {
    this.tone(760, 0.055, this.config.targetGain, 'square', -250);
    this.tone(380, 0.045, this.config.targetGain * 0.6, 'triangle', -90);
  }

  bank() {
    this.tone(440, 0.11, this.config.targetGain, 'triangle', 260);
    window.setTimeout(() => this.tone(660, 0.12, this.config.targetGain * 0.9, 'triangle', 260), 70);
    window.setTimeout(() => this.tone(880, 0.14, this.config.targetGain * 0.85, 'triangle', 220), 140);
  }

  launchCharge() {
    this.tone(95, 0.035, this.config.launcherGain * 0.45, 'triangle', 45);
  }

  launch(charge = 0.5) {
    const gain = this.config.launcherGain * (0.65 + clamp(charge, 0, 1) * 0.35);
    this.tone(135, 0.10, gain, 'sawtooth', 240);
    this.tone(54, 0.08, gain * 0.55, 'sine', 40);
  }

  nudge() {
    this.tone(82, 0.045, this.config.nudgeGain, 'triangle', -14);
  }

  tilt() {
    this.tone(185, 0.18, this.config.tiltGain, 'square', -95);
    window.setTimeout(() => this.tone(118, 0.24, this.config.tiltGain * 0.85, 'square', -48), 80);
  }

  drain() {
    this.tone(92, 0.18, this.config.drainGain, 'sine', -46);
    window.setTimeout(() => this.tone(58, 0.2, this.config.drainGain * 0.75, 'triangle', -18), 50);
  }

  tone(frequency, duration, gainValue, type, sweep = 0) {
    if (!this.context || this.context.state !== 'running' || !this.master) return;

    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, frequency), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + sweep), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}