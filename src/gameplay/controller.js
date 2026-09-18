import * as THREE from 'three';
import { PinballEngine } from '../physics/pinball-engine.js';
import { BrowserSfx } from '../audio/browser-sfx.js';
import { VfxEngine } from '../vfx/effects.js';
import { GameplayFocusLighting } from './focus-lighting.js';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const MODEL_FLIPPER_REST_DEG = Object.freeze({ left: 18, right: 162 });
const GAME_STATES = Object.freeze({
  READY: 'READY',
  PLAYING: 'PLAYING',
  BALL_LOST: 'BALL_LOST',
  GAME_OVER: 'GAME_OVER'
});

export function createGameplayController({
  root,
  renderer,
  camera,
  tableConfig,
  rulesConfig,
  ballStateElement,
  scoreElement,
  popupLayer,
  tiltStateElement,
  launcherStateElement,
  launchMeterFill,
  fxBadge,
  soundButton,
  soundGateElement,
  enableSoundButton,
  gameOverElement,
  finalScoreElement,
  playAgainButton,
  leftButton,
  rightButton,
  launchButton,
  nudgeLeftButton,
  nudgeRightButton
}) {
  const engine = new PinballEngine(tableConfig);
  const sfx = new BrowserSfx(rulesConfig.audio, soundButton);
  const vfx = new VfxEngine({
    root,
    renderer,
    config: rulesConfig.vfx,
    fxBadge
  });

  const flipperVisuals = new Map();
  const targetVisuals = new Map();
  const bumperVisuals = new Map();
  const scoringZoneVisuals = new Map();
  const slingshotVisuals = createSlingshotVisuals(root, tableConfig);
  const launcherVisual = createLauncherVisuals(root, tableConfig);
  const tempQuat = new THREE.Quaternion();

  let gameState = GAME_STATES.READY;
  let currentBall = 1;
  let score = 0;
  let resetTimer = null;

  root.traverse((object) => {
    if (object.isMesh && /^ball($|[_-])/i.test(object.name)) object.visible = false;
  });

  const ballVisual = new THREE.Mesh(
    new THREE.SphereGeometry(tableConfig.ball.radius, 32, 20),
    new THREE.MeshStandardMaterial({
      color: 0xd7dee8,
      metalness: 0.94,
      roughness: 0.10,
      envMapIntensity: 1.4
    })
  );
  ballVisual.name = 'GameplayBall';
  ballVisual.castShadow = true;
  root.add(ballVisual);

  for (const cfg of tableConfig.flippers) {
    const objectName = cfg.id === 'left' ? 'Flipper_Left' : 'Flipper_Right';
    const object = root.getObjectByName(objectName);
    if (!object) continue;

    flipperVisuals.set(cfg.id, {
      object,
      restAngle: THREE.MathUtils.degToRad(cfg.restAngleDeg),
      modelRestAngle: THREE.MathUtils.degToRad(
        MODEL_FLIPPER_REST_DEG[cfg.id] ?? cfg.restAngleDeg
      ),
      restQuaternion: object.quaternion.clone()
    });
  }

  for (const cfg of tableConfig.targets) {
    const object = root.getObjectByName('Target_' + cfg.id);
    if (!object) continue;
    targetVisuals.set(cfg.id, {
      object,
      baseY: object.position.y,
      pulse: 0
    });
  }

  const bumperNames = {
    metro: 'Paris_AI_Bumper_Metro',
    cafe: 'Paris_AI_Bumper_Cafe',
    paris: 'Paris_AI_Bumper_Landmark'
  };

  for (const cfg of tableConfig.bumpers) {
    const object = root.getObjectByName(bumperNames[cfg.id]);
    if (!object) continue;
    bumperVisuals.set(cfg.id, {
      object,
      baseScale: object.scale.clone(),
      pulse: 0
    });
  }

  for (const cfg of tableConfig.scoringZones || []) {
    if (cfg.id !== 'city-light') continue;

    const ring = root.getObjectByName('Paris_CityLight_ScoreRing');
    const face = root.getObjectByName('Paris_CityLight_ScoreFace');
    if (!ring && !face) continue;

    scoringZoneVisuals.set(cfg.id, {
      ring,
      face,
      ringBaseScale: ring?.scale.clone() || null,
      faceBaseScale: face?.scale.clone() || null,
      pulse: 0
    });
  }

  const lighting = new GameplayFocusLighting({ root, tableConfig });
  lighting.setState(GAME_STATES.READY);

  bindSoundControls();

  engine.on('wall-hit', ({ impact, x }) => {
    const pan = panFromX(x);
    sfx.wall(impact, pan);
    if (impact > 2.1) vfx.kick(0.007 * Math.min(impact, 4), 40);
  });

  engine.on('slingshot-hit', ({ id, score: value, x, z, impact }) => {
    const pan = panFromX(x);
    sfx.slingshot(pan);
    addScore(value, x, z, '+');
    vfx.hit('slingshot', x, z, 0.75 + impact * 0.16);
    lighting.pulseAt(x, z, 0.75 + impact * 0.12);

    const visual = slingshotVisuals.get(id);
    if (visual) visual.pulse = 1;
  });

  engine.on('bumper-hit', ({ id, score: value, x, z, impact }) => {
    const pan = panFromX(x);
    sfx.bumper(pan);
    addScore(value, x, z, '+');
    vfx.hit('bumper', x, z, 0.85 + impact * 0.15);
    lighting.pulseAt(x, z, 0.9 + impact * 0.12);

    const visual = bumperVisuals.get(id);
    if (visual) visual.pulse = 1;
  });

  engine.on('target-hit', ({ id, score: value, x, z, impact }) => {
    sfx.target(panFromX(x));
    addScore(value, x, z, '+');
    vfx.hit('target', x, z, 0.85 + impact * 0.10);
    lighting.pulseAt(x, z, 0.8 + impact * 0.08);

    const visual = targetVisuals.get(id);
    if (visual) visual.pulse = 1;
  });

  engine.on('target-bank-complete', ({ score: value, x, z }) => {
    sfx.bank();
    addScore(value, x, z, 'BANK +');
    vfx.hit('bank', x, z, 1.3);
    lighting.pulseAt(x, z, 1.45);
  });

  engine.on('scoring-zone-hit', ({ id, score: value, x, z }) => {
    sfx.target(panFromX(x));
    addScore(value, x, z, 'CITY LIGHT +');
    vfx.hit('target', x, z, 1.05);
    lighting.pulseAt(x, z, 1.15);

    const visual = scoringZoneVisuals.get(id);
    if (visual) visual.pulse = 1;
  });

  engine.on('launch', ({ charge }) => {
    sfx.launch(charge);
    setLauncherState('IN PLAY');
    vfx.hit(
      'launch',
      tableConfig.launcher.spawn[0],
      tableConfig.launcher.spawn[1] - 0.10,
      0.9 + charge * 0.5
    );
    lighting.pulseAt(
      tableConfig.launcher.spawn[0],
      tableConfig.launcher.spawn[1] - 0.10,
      0.75 + charge * 0.45
    );
  });

  engine.on('nudge', ({ direction }) => {
    sfx.nudge(direction < 0 ? -0.65 : 0.65);
    vfx.kick(0.014, 32);
  });

  engine.on('tilt-warning', ({ warnings }) => {
    if (tiltStateElement) {
      tiltStateElement.textContent = 'TILT WARNING ' + warnings + ' / ' + tableConfig.nudge.maxWarnings;
      tiltStateElement.classList.add('warning');
      tiltStateElement.classList.remove('tilted');
    }
  });

  engine.on('tilt', () => {
    sfx.tilt();
    vfx.hit('tilt', engine.ball.position.x, engine.ball.position.z, 1.2);

    if (tiltStateElement) {
      tiltStateElement.textContent = 'TILT';
      tiltStateElement.classList.remove('warning');
      tiltStateElement.classList.add('tilted');
    }
  });

  engine.on('reset', () => {
    clearTiltHud();
    setLauncherState('HOLD LAUNCH');
  });

  engine.on('drain', () => {
    if (gameState !== GAME_STATES.PLAYING || resetTimer) return;

    setGameState(GAME_STATES.BALL_LOST);
    freezeControls();
    sfx.drain();
    sfx.updateRolling(0, 0, false);

    const finalBall = currentBall >= rulesConfig.ballsPerGame;
    if (finalBall) {
      enterGameOver();
      return;
    }

    setBallState('BALL ' + currentBall + ' DRAINED');
    setLauncherState('NEXT BALL');

    resetTimer = window.setTimeout(() => {
      currentBall += 1;
      engine.resetBall();
      setGameState(GAME_STATES.PLAYING);
      updateHud();
      resetTimer = null;
    }, rulesConfig.drainResetDelayMs);
  });

  bindInputs();
  bindGameOverControls();
  startNewGame();

  function step(delta) {
    if (gameState === GAME_STATES.PLAYING) engine.step(delta);
    animateMechanics(delta);
    vfx.step(delta);
    lighting.update(delta, engine.ball);
  }

  function sync() {
    ballVisual.visible = engine.ball.active;
    ballVisual.position.set(
      engine.ball.position.x,
      tableConfig.playfield.surfaceY + tableConfig.ball.radius,
      engine.ball.position.z
    );

    for (const [id, visual] of flipperVisuals) {
      const state = engine.getFlipper(id);
      if (!state) continue;

      const delta = state.angle - visual.modelRestAngle;
      tempQuat.setFromAxisAngle(Y_AXIS, delta);
      visual.object.quaternion.copy(visual.restQuaternion).premultiply(tempQuat);
    }

    for (const [id, visual] of targetVisuals) {
      const state = engine.getTarget(id);
      if (!state) continue;

      visual.object.position.y = state.active
        ? visual.baseY
        : visual.baseY - 0.20;
      visual.object.visible = true;
    }

    const charge = engine.getLauncherCharge();

    if (launchMeterFill) {
      launchMeterFill.style.width = Math.round(charge * 100) + '%';
    }

    if (launcherVisual) {
      const pull = charge * launcherVisual.pullDistance;
      launcherVisual.knob.position.z = launcherVisual.baseKnobZ + pull;
      launcherVisual.rod.position.z = launcherVisual.baseRodZ + pull * 0.55;
      launcherVisual.spring.scale.z = 1 + charge * 0.85;
    }

    if (engine.isAwaitingLaunch()) {
      setLauncherState(
        charge > 0.01
          ? 'POWER ' + Math.round(charge * 100) + '%'
          : 'HOLD / PULL LAUNCH'
      );
    }

    const speed = Math.hypot(engine.ball.velocity.x, engine.ball.velocity.z);
    const pan = panFromX(engine.ball.position.x);

    const gameplayActive = gameState === GAME_STATES.PLAYING;

    sfx.updateRolling(
      speed,
      pan,
      gameplayActive && engine.ball.active && !engine.isAwaitingLaunch()
    );

    vfx.updateBallTrail(
      engine.ball,
      tableConfig.playfield.surfaceY + tableConfig.ball.radius,
      gameplayActive && engine.ball.active && !engine.isAwaitingLaunch() && speed > 1.0
    );
  }

  function animateMechanics(dt) {
    for (const visual of bumperVisuals.values()) {
      if (visual.pulse <= 0.001) {
        visual.object.scale.copy(visual.baseScale);
        visual.pulse = 0;
        continue;
      }

      visual.pulse *= Math.exp(-9 * dt);
      const bump = 1 + Math.sin((1 - visual.pulse) * Math.PI) * 0.14 * visual.pulse;
      visual.object.scale.set(
        visual.baseScale.x * bump,
        visual.baseScale.y * bump,
        visual.baseScale.z
      );
    }

    for (const visual of slingshotVisuals.values()) {
      if (visual.pulse <= 0.001) {
        visual.group.scale.set(1, 1, 1);
        visual.pulse = 0;
        continue;
      }

      visual.pulse *= Math.exp(-10 * dt);
      const flex = 1 + 0.08 * visual.pulse;
      visual.group.scale.set(flex, 1, 1 + 0.05 * visual.pulse);
    }

    for (const visual of targetVisuals.values()) {
      if (visual.pulse <= 0.001) {
        visual.object.scale.set(1, 1, 1);
        visual.pulse = 0;
        continue;
      }

      visual.pulse *= Math.exp(-11 * dt);
      const scale = 1 + 0.06 * visual.pulse;
      visual.object.scale.set(scale, scale, scale);
    }

    for (const visual of scoringZoneVisuals.values()) {
      if (visual.pulse <= 0.001) {
        if (visual.ring && visual.ringBaseScale) visual.ring.scale.copy(visual.ringBaseScale);
        if (visual.face && visual.faceBaseScale) visual.face.scale.copy(visual.faceBaseScale);
        visual.pulse = 0;
        continue;
      }

      visual.pulse *= Math.exp(-8 * dt);
      const scale = 1 + 0.16 * visual.pulse;
      if (visual.ring && visual.ringBaseScale) {
        visual.ring.scale.set(
          visual.ringBaseScale.x * scale,
          visual.ringBaseScale.y * scale,
          visual.ringBaseScale.z
        );
      }
      if (visual.face && visual.faceBaseScale) {
        visual.face.scale.set(
          visual.faceBaseScale.x * (1 + 0.08 * visual.pulse),
          visual.faceBaseScale.y * (1 + 0.08 * visual.pulse),
          visual.faceBaseScale.z
        );
      }
    }
  }

  function addScore(value, x, z, prefix = '') {
    if (
      gameState !== GAME_STATES.PLAYING ||
      !Number.isFinite(value) ||
      value <= 0 ||
      engine.isTilted()
    ) return;
    score += value;
    updateScore();
    showScorePopup(prefix + value, x, z);
  }

  function showScorePopup(text, x, z) {
    if (!popupLayer || !camera) return;

    const point = new THREE.Vector3(
      x,
      tableConfig.playfield.surfaceY + 0.36,
      z
    );
    root.localToWorld(point);
    point.project(camera);

    const rect = popupLayer.getBoundingClientRect();
    const left = (point.x * 0.5 + 0.5) * rect.width;
    const top = (-point.y * 0.5 + 0.5) * rect.height;

    const node = document.createElement('div');
    node.className = 'score-popup';
    node.textContent = text;
    node.style.left = left + 'px';
    node.style.top = top + 'px';
    popupLayer.appendChild(node);

    window.setTimeout(() => node.remove(), 850);
  }

  function startNewGame() {
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }

    setGameState(GAME_STATES.READY);
    hideGameOver();
    currentBall = 1;
    score = 0;
    engine.resetGame();
    resetTransientEffects();
    setGameState(GAME_STATES.PLAYING);
    updateHud();
  }

  function enterGameOver() {
    setGameState(GAME_STATES.GAME_OVER);
    freezeControls();
    sfx.updateRolling(0, 0, false);
    vfx.updateBallTrail(
      engine.ball,
      tableConfig.playfield.surfaceY + tableConfig.ball.radius,
      false
    );

    setBallState('GAME OVER');
    setLauncherState('FINAL SCORE');
    updateScore();

    if (finalScoreElement) finalScoreElement.textContent = String(score);
    if (gameOverElement) {
      gameOverElement.classList.add('visible');
      gameOverElement.setAttribute('aria-hidden', 'false');
    }
  }

  function hideGameOver() {
    if (!gameOverElement) return;
    gameOverElement.classList.remove('visible');
    gameOverElement.setAttribute('aria-hidden', 'true');
  }

  function setGameState(nextState) {
    gameState = nextState;
    root.userData.gameState = nextState;
    lighting.setState(nextState);
  }

  function resetTransientEffects() {
    popupLayer?.replaceChildren();
    vfx.reset();
    lighting.reset();

    for (const visual of bumperVisuals.values()) {
      visual.pulse = 0;
      visual.object.scale.copy(visual.baseScale);
    }

    for (const visual of slingshotVisuals.values()) {
      visual.pulse = 0;
      visual.group.scale.set(1, 1, 1);
    }

    for (const visual of targetVisuals.values()) {
      visual.pulse = 0;
      visual.object.scale.set(1, 1, 1);
    }

    for (const visual of scoringZoneVisuals.values()) {
      visual.pulse = 0;
      if (visual.ring && visual.ringBaseScale) visual.ring.scale.copy(visual.ringBaseScale);
      if (visual.face && visual.faceBaseScale) visual.face.scale.copy(visual.faceBaseScale);
    }

    clearPressedControls();
  }

  function freezeControls() {
    for (const [id, visual] of flipperVisuals) {
      const state = engine.getFlipper(id);
      if (!state) continue;
      state.pressed = false;
      state.angle = visual.restAngle;
      state.angularVelocity = 0;
    }
    clearPressedControls();
  }

  function clearPressedControls() {
    [leftButton, rightButton, launchButton, nudgeLeftButton, nudgeRightButton]
      .filter(Boolean)
      .forEach((button) => button.classList.remove('pressed'));
  }

  function updateHud() {
    setBallState('BALL ' + currentBall + ' / ' + rulesConfig.ballsPerGame);
    updateScore();
    clearTiltHud();
    setLauncherState(engine.isAwaitingLaunch() ? 'HOLD / PULL LAUNCH' : 'IN PLAY');
  }

  function updateScore() {
    if (scoreElement) scoreElement.textContent = String(score);
  }

  function setBallState(text) {
    if (ballStateElement) ballStateElement.textContent = text;
  }

  function setLauncherState(text) {
    if (launcherStateElement) launcherStateElement.textContent = text;
  }

  function clearTiltHud() {
    if (!tiltStateElement) return;
    tiltStateElement.textContent = '';
    tiltStateElement.classList.remove('warning', 'tilted');
  }

  function panFromX(x = 0) {
    return clamp(x / 1.5, -1, 1);
  }

  function pressFlipper(id) {
    if (gameState !== GAME_STATES.PLAYING || engine.isTilted()) return;
    const state = engine.getFlipper(id);
    if (!state || state.pressed) return;
    engine.setFlipper(id, true);
    sfx.flipper(id === 'left' ? -0.65 : 0.65);
  }

  function releaseFlipper(id) {
    engine.setFlipper(id, false);
  }

  function beginLaunch() {
    if (gameState !== GAME_STATES.PLAYING) return;
    if (engine.beginLaunch()) sfx.launchCharge();
  }

  function releaseLaunch() {
    if (gameState !== GAME_STATES.PLAYING) return;
    engine.releaseLaunch();
  }

  function nudge(direction) {
    if (gameState !== GAME_STATES.PLAYING) return;
    engine.nudge(direction);
  }

  function bindSoundControls() {
    const hideSoundGate = () => {
      if (!soundGateElement) return;
      soundGateElement.classList.add('hidden');
      soundGateElement.setAttribute('aria-hidden', 'true');
    };

    const showSoundGate = () => {
      if (!soundGateElement) return;
      soundGateElement.classList.remove('hidden');
      soundGateElement.setAttribute('aria-hidden', 'false');
    };

    const activateSound = () => {
      if (enableSoundButton) {
        enableSoundButton.disabled = true;
        enableSoundButton.textContent = 'ENABLING…';
      }

      return sfx.activateFromGesture().then((running) => {
        if (enableSoundButton) {
          enableSoundButton.disabled = false;
          enableSoundButton.textContent = running ? 'SOUND ENABLED' : 'TAP TO RETRY';
        }

        if (soundButton) {
          soundButton.classList.remove('muted');
          soundButton.textContent = running ? 'SOUND ON' : 'ENABLE SOUND';
        }

        if (running) {
          hideSoundGate();
        } else {
          showSoundGate();
        }

        return running;
      });
    };

    if (enableSoundButton) {
      enableSoundButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void activateSound();
      });
    }

    if (soundButton) {
      soundButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!sfx.isRunning()) {
          void activateSound();
          return;
        }

        const muted = sfx.toggleMuted();
        soundButton.classList.toggle('muted', muted);
        soundButton.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
      });
    }

    // Keyboard/desktop controls can still unlock sound directly from a gesture.
    window.addEventListener('keydown', () => {
      if (!sfx.isRunning() && !sfx.muted) void sfx.unlock();
    }, { capture: true });

    window.addEventListener('pageshow', () => {
      if (sfx.context && sfx.context.state !== 'running' && !sfx.muted) {
        sfx.setStatus('ENABLE SOUND');
        if (soundButton) soundButton.textContent = 'ENABLE SOUND';
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && sfx.context && sfx.context.state !== 'running' && !sfx.muted) {
        sfx.setStatus('ENABLE SOUND');
        if (soundButton) soundButton.textContent = 'ENABLE SOUND';
      }
    });
  }

  function bindGameOverControls() {
    if (!playAgainButton) return;
    playAgainButton.addEventListener('click', (event) => {
      event.preventDefault();
      void sfx.unlock();
      startNewGame();
    });
  }

  function bindInputs() {
    const flipperKeyMap = new Map([
      ['ArrowLeft', 'left'],
      ['KeyA', 'left'],
      ['ArrowRight', 'right'],
      ['KeyD', 'right']
    ]);

    const nudgeKeyMap = new Map([
      ['KeyQ', -1],
      ['KeyZ', -1],
      ['KeyE', 1],
      ['KeyX', 1]
    ]);

    window.addEventListener('keydown', (event) => {
      const flipper = flipperKeyMap.get(event.code);

      if (flipper) {
        event.preventDefault();
        if (!event.repeat) pressFlipper(flipper);
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) beginLaunch();
        return;
      }

      const nudgeDirection = nudgeKeyMap.get(event.code);
      if (nudgeDirection) {
        event.preventDefault();
        if (!event.repeat) nudge(nudgeDirection);
        return;
      }

      if (event.code === 'KeyR') {
        event.preventDefault();
        startNewGame();
      }
    });

    window.addEventListener('keyup', (event) => {
      const flipper = flipperKeyMap.get(event.code);

      if (flipper) {
        event.preventDefault();
        releaseFlipper(flipper);
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        releaseLaunch();
      }
    });

    bindPointerControl(
      leftButton,
      () => pressFlipper('left'),
      () => releaseFlipper('left')
    );

    bindPointerControl(
      rightButton,
      () => pressFlipper('right'),
      () => releaseFlipper('right')
    );

    bindLaunchControl(launchButton);
    bindTapControl(nudgeLeftButton, () => nudge(-1));
    bindTapControl(nudgeRightButton, () => nudge(1));
  }

  function bindPointerControl(button, onPress, onRelease) {
    if (!button) return;

    const release = (event) => {
      event.preventDefault();
      onRelease();
      button.classList.remove('pressed');
    };

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void sfx.unlock();
      button.setPointerCapture?.(event.pointerId);
      onPress();
      button.classList.add('pressed');
    });

    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  function bindLaunchControl(button) {
    if (!button) return;

    let pointerId = null;
    let startY = 0;
    let active = false;

    const chargeFromClientY = (clientY) => {
      const dragDistance = Math.max(72, Math.min(120, window.innerHeight * 0.09));
      const drag = clamp((clientY - startY) / dragDistance, 0, 1);
      if (drag > 0.015) engine.setLaunchCharge(drag);
    };

    const move = (event) => {
      if (!active || pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      chargeFromClientY(event.clientY);
    };

    const release = (event) => {
      if (!active || pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();

      releaseLaunch();
      button.classList.remove('pressed');
      active = false;
      pointerId = null;
    };

    button.addEventListener('pointerdown', (event) => {
      if (active) return;

      event.preventDefault();
      event.stopPropagation();
      void sfx.unlock();

      pointerId = event.pointerId;
      startY = event.clientY;
      active = true;

      beginLaunch();
      button.classList.add('pressed');

      // Capture is helpful on most browsers, but the global listeners below
      // are the reliability path for iOS Safari when capture is lost.
      try {
        button.setPointerCapture?.(event.pointerId);
      } catch {
        // Global pointer listeners still keep the drag alive.
      }
    });

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', release, { passive: false });
    window.addEventListener('pointercancel', release, { passive: false });

    // Older iOS fallback for browsers that do not expose PointerEvent.
    if (!window.PointerEvent) {
      let touchId = null;

      button.addEventListener('touchstart', (event) => {
        const touch = event.changedTouches[0];
        if (!touch || active) return;

        event.preventDefault();
        event.stopPropagation();
        void sfx.unlock();

        touchId = touch.identifier;
        startY = touch.clientY;
        active = true;
        beginLaunch();
        button.classList.add('pressed');
      }, { passive: false });

      window.addEventListener('touchmove', (event) => {
        if (!active || touchId === null) return;
        const touch = [...event.changedTouches].find((item) => item.identifier === touchId);
        if (!touch) return;

        event.preventDefault();
        chargeFromClientY(touch.clientY);
      }, { passive: false });

      const finishTouch = (event) => {
        if (!active || touchId === null) return;
        const touch = [...event.changedTouches].find((item) => item.identifier === touchId);
        if (!touch) return;

        event.preventDefault();
        releaseLaunch();
        button.classList.remove('pressed');
        active = false;
        touchId = null;
      };

      window.addEventListener('touchend', finishTouch, { passive: false });
      window.addEventListener('touchcancel', finishTouch, { passive: false });
    }
  }

  function bindTapControl(button, handler) {
    if (!button) return;

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void sfx.unlock();
      handler();
      button.classList.add('pressed');
      window.setTimeout(() => button.classList.remove('pressed'), 90);
    });
  }

  return {
    engine,
    step,
    sync,
    resetGame: startNewGame,
    getGameState: () => gameState,
    getScore: () => score
  };
}

function createSlingshotVisuals(root, tableConfig) {
  const visuals = new Map();

  const gold = new THREE.MeshStandardMaterial({
    color: 0xe3ad45,
    metalness: 0.45,
    roughness: 0.28,
    emissive: 0x4b2404,
    emissiveIntensity: 0.35
  });

  const rubber = new THREE.MeshStandardMaterial({
    color: 0xb8332a,
    metalness: 0.05,
    roughness: 0.34,
    emissive: 0x4a0805,
    emissiveIntensity: 0.34
  });

  for (const cfg of tableConfig.slingshots) {
    const group = new THREE.Group();
    group.name = 'Slingshot_' + cfg.id;

    group.add(
      makeBar(
        cfg.a,
        cfg.b,
        tableConfig.playfield.surfaceY + 0.055,
        0.038,
        rubber
      )
    );

    const offset = cfg.id === 'left' ? -0.16 : 0.16;
    const outerA = [cfg.a[0] + offset, cfg.a[1] + 0.05];
    const outerB = [cfg.b[0] + offset * 0.35, cfg.b[1] - 0.05];

    group.add(
      makeBar(
        outerA,
        outerB,
        tableConfig.playfield.surfaceY + 0.035,
        0.024,
        gold
      )
    );

    root.add(group);
    visuals.set(cfg.id, { group, pulse: 0 });
  }

  return visuals;
}

function createLauncherVisuals(root, tableConfig) {
  const cfg = tableConfig.launcher;
  const y = tableConfig.playfield.surfaceY + 0.055;

  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0xd6b66b,
    metalness: 0.88,
    roughness: 0.16
  });

  const metal = new THREE.MeshStandardMaterial({
    color: 0xc3cad4,
    metalness: 0.92,
    roughness: 0.15
  });

  const wood = new THREE.MeshStandardMaterial({
    color: 0x8b4a22,
    metalness: 0.24,
    roughness: 0.32
  });

  const innerRail = makeBar(
    [cfg.lane.minX, cfg.lane.exitZ],
    [cfg.lane.minX, cfg.spawn[1] + 0.46],
    y,
    0.026,
    railMaterial
  );
  innerRail.name = 'LauncherLane_InnerRail';
  root.add(innerRail);

  const rod = makeBar(
    [cfg.spawn[0], cfg.spawn[1] + 0.20],
    [cfg.spawn[0], cfg.spawn[1] + 0.52],
    y + 0.018,
    0.032,
    metal
  );
  rod.name = 'Launcher_Rod';
  root.add(rod);

  const knob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.14, 24),
    wood
  );
  knob.rotation.x = Math.PI / 2;
  knob.position.set(cfg.spawn[0], y + 0.02, cfg.spawn[1] + 0.60);
  knob.castShadow = true;
  knob.name = 'Launcher_Knob';
  root.add(knob);

  const springPoints = [];
  const turns = 11;
  const segments = 96;
  const springLength = 0.38;

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const angle = t * turns * Math.PI * 2;
    springPoints.push(
      new THREE.Vector3(
        Math.cos(angle) * 0.055,
        Math.sin(angle) * 0.055,
        t * springLength
      )
    );
  }

  const spring = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(springPoints),
    new THREE.LineBasicMaterial({
      color: 0xe7edf5,
      transparent: true,
      opacity: 0.88
    })
  );
  spring.position.set(cfg.spawn[0], y + 0.018, cfg.spawn[1] + 0.18);
  spring.name = 'Launcher_Spring';
  root.add(spring);

  return {
    rod,
    knob,
    spring,
    baseRodZ: rod.position.z,
    baseKnobZ: knob.position.z,
    pullDistance: 0.26
  };
}

function makeBar(a, b, y, radius, material) {
  const start = new THREE.Vector3(a[0], y, a[1]);
  const end = new THREE.Vector3(b[0], y, b[1]);
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const length = direction.length();

  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 16),
    material
  );

  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
  mesh.castShadow = true;
  return mesh;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
