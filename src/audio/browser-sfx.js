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