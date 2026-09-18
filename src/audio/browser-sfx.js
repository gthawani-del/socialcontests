export class BrowserSfx {
  constructor(config, statusElement = null) {
    this.config = config;
    this.statusElement = statusElement;
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.rolling = null;
    this.muted = false;
    this.unlocking = null;
    this.setStatus('SOUND READY');
  }

  async unlock() {
    if (!this.config.enabled || this.muted) {
      this.setStatus(this.muted ? 'SOUND MUTED' : 'SOUND OFF');
      return;
    }

    if (this.unlocking) return this.unlocking;

    this.unlocking = this.doUnlock();
    try {
      await this.unlocking;
    } finally {
      this.unlocking = null;
    }
  }

  async doUnlock() {
    if (!this.context) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) {
        this.setStatus('SOUND UNSUPPORTED');
        return;
      }

      this.context = new AudioCtor();

      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 16;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.18;

      this.master = this.context.createGain();
      this.master.gain.value = this.config.masterVolume;

      this.compressor.connect(this.master);
      this.master.connect(this.context.destination);

      this.createRollingVoice();
    }

    // iOS Safari can leave Web Audio in a non-running state after navigation,
    // tab switches or an interrupted audio route. Prime the output while this
    // method is still executing from the user's gesture, then resume any
    // non-running context state that can be resumed.
    this.primeOutput();

    if (this.context.state !== 'running' && this.context.state !== 'closed') {
      try {
        await this.context.resume();
      } catch (error) {
        console.warn('Audio resume was blocked:', error);
      }
    }

    if (this.context.state === 'running') this.primeOutput();

    this.setStatus(this.context.state === 'running' ? 'SOUND ON' : 'TAP SOUND');
  }

  isRunning() {
    return Boolean(this.context && this.context.state === 'running');
  }

  async preview() {
    await this.unlock();
    if (!this.isRunning() || this.muted) return false;

    this.tone(620, 0.055, Math.min(0.32, this.config.masterVolume), 'triangle', 90, 0);
    window.setTimeout(
      () => this.tone(880, 0.07, Math.min(0.28, this.config.masterVolume), 'triangle', -80, 0),
      55
    );
    return true;
  }

  primeOutput() {
    if (!this.context || !this.master || this.context.state === 'closed') return;

    try {
      const source = this.context.createBufferSource();
      source.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);

      const gain = this.context.createGain();
      gain.gain.value = 0.00001;

      source.connect(gain);
      gain.connect(this.master);
      source.start(0);
    } catch (error) {
      console.warn('Audio output prime failed:', error);
    }
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.master && this.context) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(
        this.muted ? 0.0001 : this.config.masterVolume,
        now,
        0.02
      );
    }
    this.setStatus(this.muted ? 'SOUND MUTED' : 'SOUND ON');
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  flipper(pan = 0) {
    this.tone(118, 0.05, this.config.flipperGain, 'square', -36, pan);
    this.tone(74, 0.07, this.config.flipperGain * 0.58, 'sine', -12, pan);
    this.noise(0.032, this.config.flipperGain * 0.20, 1500, pan);
  }

  wall(impact = 1, pan = 0) {
    const gain = this.config.wallGain * clamp(impact / 4, 0.35, 1);
    this.tone(520 + Math.min(impact, 4) * 55, 0.04, gain, 'triangle', -140, pan);
    this.noise(0.022, gain * 0.22, 2400, pan);
  }

  slingshot(pan = 0) {
    this.tone(240, 0.06, this.config.slingshotGain, 'square', 210, pan);
    this.tone(720, 0.04, this.config.slingshotGain * 0.70, 'triangle', -260, pan);
    this.noise(0.028, this.config.slingshotGain * 0.28, 1700, pan);
  }

  bumper(pan = 0) {
    this.tone(310, 0.08, this.config.bumperGain, 'square', 250, pan);
    this.tone(880, 0.055, this.config.bumperGain * 0.78, 'triangle', -300, pan);
    this.noise(0.025, this.config.bumperGain * 0.22, 2600, pan);
  }

  target(pan = 0) {
    this.tone(760, 0.055, this.config.targetGain, 'square', -250, pan);
    this.tone(380, 0.045, this.config.targetGain * 0.62, 'triangle', -90, pan);
  }

  bank() {
    this.tone(440, 0.11, this.config.targetGain, 'triangle', 260, -0.4);
    window.setTimeout(() => this.tone(660, 0.12, this.config.targetGain * 0.95, 'triangle', 260, 0), 70);
    window.setTimeout(() => this.tone(880, 0.14, this.config.targetGain * 0.88, 'triangle', 220, 0.4), 140);
  }

  launchCharge() {
    this.tone(96, 0.035, this.config.launcherGain * 0.42, 'triangle', 40, 0.85);
  }

  launch(charge = 0.5) {
    const gain = this.config.launcherGain * (0.72 + clamp(charge, 0, 1) * 0.28);
    this.tone(142, 0.11, gain, 'sawtooth', 290, 0.88);
    this.tone(58, 0.09, gain * 0.62, 'sine', 48, 0.88);
    this.noise(0.07, gain * 0.28, 900, 0.88);
  }

  nudge(pan = 0) {
    this.tone(82, 0.05, this.config.nudgeGain, 'triangle', -14, pan);
    this.noise(0.032, this.config.nudgeGain * 0.30, 500, pan);
  }

  tilt() {
    this.tone(185, 0.18, this.config.tiltGain, 'square', -95, 0);
    window.setTimeout(() => this.tone(118, 0.24, this.config.tiltGain * 0.85, 'square', -48, 0), 80);
  }

  drain() {
    this.tone(92, 0.18, this.config.drainGain, 'sine', -46, 0);
    window.setTimeout(() => this.tone(58, 0.20, this.config.drainGain * 0.78, 'triangle', -18, 0), 50);
  }

  updateRolling(speed, pan = 0, active = true) {
    if (!this.rolling || !this.context || this.context.state !== 'running') return;

    const now = this.context.currentTime;
    const normalized = clamp(speed / 7, 0, 1);
    const targetGain = active && !this.muted
      ? normalized * normalized * this.config.rollGain
      : 0.0001;

    this.rolling.gain.gain.setTargetAtTime(Math.max(0.0001, targetGain), now, 0.035);
    this.rolling.filter.frequency.setTargetAtTime(240 + normalized * 1900, now, 0.04);

    if (this.rolling.panner) {
      this.rolling.panner.pan.setTargetAtTime(clamp(pan, -1, 1), now, 0.03);
    }
  }

  createRollingVoice() {
    const length = Math.floor(this.context.sampleRate * 1.0);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.84 + white * 0.16;
      data[i] = last;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 500;
    filter.Q.value = 0.75;

    const gain = this.context.createGain();
    gain.gain.value = 0.0001;

    const panner = this.context.createStereoPanner
      ? this.context.createStereoPanner()
      : null;

    source.connect(filter);
    filter.connect(gain);
    if (panner) {
      gain.connect(panner);
      panner.connect(this.compressor);
    } else {
      gain.connect(this.compressor);
    }

    source.start();

    this.rolling = { source, filter, gain, panner };
  }

  tone(frequency, duration, gainValue, type, sweep = 0, pan = 0) {
    if (!this.context || this.context.state !== 'running' || !this.compressor || this.muted) return;

    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner ? this.context.createStereoPanner() : null;

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, frequency), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + sweep), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainValue), now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    if (panner) {
      panner.pan.value = clamp(pan, -1, 1);
      gain.connect(panner);
      panner.connect(this.compressor);
    } else {
      gain.connect(this.compressor);
    }

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  noise(duration, gainValue, highpassHz = 1200, pan = 0) {
    if (!this.context || this.context.state !== 'running' || !this.compressor || this.muted) return;

    const now = this.context.currentTime;
    const frameCount = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = highpassHz;

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, gainValue), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    const panner = this.context.createStereoPanner ? this.context.createStereoPanner() : null;

    source.connect(filter);
    filter.connect(gain);
    if (panner) {
      panner.pan.value = clamp(pan, -1, 1);
      gain.connect(panner);
      panner.connect(this.compressor);
    } else {
      gain.connect(this.compressor);
    }

    source.start(now);
  }

  setStatus(text) {
    if (this.statusElement) this.statusElement.textContent = text;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
