export function createStadiumFeedback({
  app,
  viewport,
  canvas,
  ballMaterial,
  getBallScreenPosition = () => ({ x: 50, y: 72 })
}) {
  let audio = null;
  let ambience = null;
  let flashTimer = 0;
  const timing = document.createElement('div');
  timing.id = 'contactFeedback';
  timing.setAttribute('aria-live', 'polite');
  timing.hidden = true;
  viewport.append(timing);

  const prime = () => {
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      if (!ambience) {
        const length = Math.max(1, Math.floor(audio.sampleRate * 2));
        const buffer = audio.createBuffer(1, length, audio.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          const envelope = .55 + .45 * Math.sin(i / audio.sampleRate * Math.PI * 1.7);
          data[i] = (Math.random() * 2 - 1) * envelope;
        }
        const source = audio.createBufferSource();
        const filter = audio.createBiquadFilter();
        const gain = audio.createGain();
        source.buffer = buffer;
        source.loop = true;
        filter.type = 'lowpass';
        filter.frequency.value = 620;
        gain.gain.value = .0024;
        source.connect(filter).connect(gain).connect(audio.destination);
        source.start();
        ambience = { source, gain };
      }
    } catch {}
  };

  const tone = (frequency, duration = .07, gain = .045, type = 'triangle', endFrequency = null) => {
    if (!audio) return;
    try {
      const now = audio.currentTime;
      const osc = audio.createOscillator();
      const amp = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);
      if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
      amp.gain.setValueAtTime(gain, now);
      amp.gain.exponentialRampToValueAtTime(.0001, now + duration);
      osc.connect(amp).connect(audio.destination);
      osc.start(now); osc.stop(now + duration);
    } catch {}
  };

  const noise = (duration = .16, gain = .018) => {
    if (!audio) return;
    try {
      const length = Math.max(1, Math.floor(audio.sampleRate * duration));
      const buffer = audio.createBuffer(1, length, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = audio.createBufferSource();
      const amp = audio.createGain();
      source.buffer = buffer;
      amp.gain.setValueAtTime(gain, audio.currentTime);
      amp.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
      source.connect(amp).connect(audio.destination);
      source.start();
    } catch {}
  };

  const vibrate = pattern => {
    try { navigator.vibrate?.(pattern); } catch {}
  };

  const classPulse = (name, duration = 360) => {
    app.classList.remove(name);
    void app.offsetWidth;
    app.classList.add(name);
    setTimeout(() => app.classList.remove(name), duration);
  };

  const impactBurst = strength => {
    const point = getBallScreenPosition();
    const burst = document.createElement('span');
    burst.className = 'impact-fx';
    burst.style.left = `${point.x}%`;
    burst.style.top = `${point.y}%`;
    burst.style.setProperty('--impact-scale', String(.75 + strength * .75));
    viewport.append(burst);
    setTimeout(() => burst.remove(), 380);
  };

  const flashBall = strength => {
    if (!ballMaterial?.emissive) return;
    clearTimeout(flashTimer);
    ballMaterial.emissive.set(strength > .72 ? '#d59a42' : '#8a612c');
    ballMaterial.emissiveIntensity = .55 + strength * .7;
    flashTimer = setTimeout(() => {
      ballMaterial.emissive.set('#000000');
      ballMaterial.emissiveIntensity = 1;
    }, 95);
  };

  const showTiming = feedback => {
    timing.hidden = false;
    timing.textContent = feedback.timing === 'PERFECT'
      ? 'PERFECT'
      : feedback.timing;
    timing.dataset.timing = feedback.timing;
    clearTimeout(showTiming.timer);
    showTiming.timer = setTimeout(() => { timing.hidden = true; }, 620);
  };

  const onBatContact = feedback => {
    prime();
    showTiming(feedback);
    impactBurst(feedback.quality);
    flashBall(feedback.quality);
    classPulse('impact-punch', 190);
    if (feedback.timing === 'PERFECT') {
      tone(215, .08, .06, 'triangle', 105);
      vibrate(18);
    } else {
      tone(165, .065, .045, 'triangle', 90);
      vibrate(10);
    }
  };

  const onOutcome = (outcome, metadata = {}) => {
    prime();
    const value = String(outcome || '').toUpperCase();
    if (metadata.reason === 'SKILL_REJECTED') {
      classPulse('score-miss', 320);
      tone(105, .11, .035, 'sine', 70);
      vibrate(12);
      return;
    }
    if (value === 'SIX') {
      classPulse('score-six', 620);
      tone(330, .10, .055, 'triangle', 660); tone(660, .17, .04, 'sine', 880);
      noise(.32, .028); vibrate([22, 18, 35]);
    } else if (value === 'FOUR') {
      classPulse('score-four', 520);
      tone(280, .09, .05, 'triangle', 520);
      noise(.22, .02); vibrate([18, 14, 20]);
    } else if (value === 'WICKET') {
      classPulse('score-wicket', 620);
      tone(120, .18, .065, 'sawtooth', 48);
      noise(.20, .018); vibrate([35, 25, 45]);
    } else if (value === 'ONE' || value === 'TWO') {
      classPulse('score-run', 300);
      tone(value === 'TWO' ? 230 : 190, .06, .032, 'sine');
      vibrate(8);
    }
  };

  const onMatchResult = result => {
    prime();
    const playerWon = result?.winnerId === 'player';
    if (result?.type === 'TIE' || !result?.winnerId) {
      classPulse('match-tie', 900);
      tone(190, .14, .04, 'triangle', 190);
      return;
    }
    if (playerWon) {
      classPulse('match-win', 1100);
      tone(330, .13, .055, 'triangle', 520);
      tone(520, .20, .045, 'sine', 780);
      noise(.42, .032);
      vibrate([24, 20, 24, 20, 48]);
    } else {
      classPulse('match-loss', 900);
      tone(150, .22, .055, 'sine', 65);
      vibrate([35, 28, 35]);
    }
  };

  const handle = event => {
    if (!event) return;
    if (event.type === 'BAT_CONTACT') onBatContact(event.feedback);
    else if (event.type === 'OUTCOME') onOutcome(event.outcome, event.metadata);
    else if (event.type === 'DELIVERY_BOUNCE' && event.deliveryType !== 'PACE') {
      tone(95, .035, .018, 'sine', 70);
    } else if (event.type === 'MATCH_RESULT') {
      onMatchResult(event.result);
    }
  };

  return { handle, prime };
}
