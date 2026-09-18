import * as THREE from 'three';
import { PinballEngine } from '../physics/pinball-engine.js';
import { BrowserSfx } from '../audio/browser-sfx.js';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

export function createGameplayController({
  root,
  camera,
  tableConfig,
  rulesConfig,
  ballStateElement,
  scoreElement,
  popupLayer,
  tiltStateElement,
  launcherStateElement,
  launchMeterFill,
  leftButton,
  rightButton,
  launchButton,
  nudgeLeftButton,
  nudgeRightButton
}) {
  const engine = new PinballEngine(tableConfig);
  const sfx = new BrowserSfx(rulesConfig.audio);
  const flipperVisuals = new Map();
  const targetVisuals = new Map();
  const tempQuat = new THREE.Quaternion();

  let currentBall = 1;
  let score = 0;
  let resetTimer = null;

  root.traverse((object) => {
    if (object.isMesh && /^ball($|[_-])/i.test(object.name)) object.visible = false;
  });

  const ballVisual = new THREE.Mesh(
    new THREE.SphereGeometry(tableConfig.ball.radius, 32, 20),
    new THREE.MeshStandardMaterial({
      color: 0xc8d0da,
      metalness: 0.92,
      roughness: 0.12
    })
  );
  ballVisual.name = 'GameplayBall';
  ballVisual.castShadow = true;
  root.add(ballVisual);

  createSlingshotVisuals(root, tableConfig);
  const launcherVisual = createLauncherVisuals(root, tableConfig);

  for (const cfg of tableConfig.flippers) {
    const objectName = cfg.id === 'left' ? 'Flipper_Left' : 'Flipper_Right';
    const object = root.getObjectByName(objectName);
    if (!object) continue;

    flipperVisuals.set(cfg.id, {
      object,
      restAngle: THREE.MathUtils.degToRad(cfg.restAngleDeg),
      restQuaternion: object.quaternion.clone()
    });
  }

  for (const cfg of tableConfig.targets) {
    const object = root.getObjectByName('Target_' + cfg.id);
    if (!object) continue;

    targetVisuals.set(cfg.id, {
      object,
      baseY: object.position.y
    });
  }

  engine.on('wall-hit', ({ impact }) => sfx.wall(impact));

  engine.on('slingshot-hit', ({ score: value, x, z }) => {
    sfx.slingshot();
    addScore(value, x, z, '+');
  });

  engine.on('bumper-hit', ({ score: value, x, z }) => {
    sfx.bumper();
    addScore(value, x, z, '+');
  });

  engine.on('target-hit', ({ score: value, x, z }) => {
    sfx.target();
    addScore(value, x, z, '+');
  });

  engine.on('target-bank-complete', ({ score: value, x, z }) => {
    sfx.bank();
    addScore(value, x, z, 'BANK +');
  });

  engine.on('launch', ({ charge }) => {
    sfx.launch(charge);
    setLauncherState('IN PLAY');
  });

  engine.on('nudge', () => sfx.nudge());

  engine.on('tilt-warning', ({ warnings }) => {
    if (tiltStateElement) {
      tiltStateElement.textContent = 'TILT WARNING ' + warnings + ' / ' + tableConfig.nudge.maxWarnings;
      tiltStateElement.classList.add('warning');
      tiltStateElement.classList.remove('tilted');
    }
  });

  engine.on('tilt', () => {
    sfx.tilt();
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
    if (resetTimer) return;

    sfx.drain();
    const finalBall = currentBall >= rulesConfig.ballsPerGame;
    setBallState(finalBall ? 'GAME OVER' : 'BALL ' + currentBall + ' DRAINED');

    resetTimer = window.setTimeout(() => {
      if (finalBall) {
        score = 0;
        currentBall = 1;
        engine.resetGame();
      } else {
        currentBall += 1;
        engine.resetBall();
      }

      updateHud();
      resetTimer = null;
    }, finalBall ? rulesConfig.gameResetDelayMs : rulesConfig.drainResetDelayMs);
  });

  bindInputs();
  updateHud();

  function step(delta) {
    engine.step(delta);
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

      const delta = state.angle - visual.restAngle;
      tempQuat.setFromAxisAngle(Y_AXIS, delta);
      visual.object.quaternion.copy(visual.restQuaternion).premultiply(tempQuat);
    }

    for (const [id, visual] of targetVisuals) {
      const state = engine.getTarget(id);
      if (!state) continue;
      visual.object.position.y = state.active ? visual.baseY : visual.baseY - 0.20;
      visual.object.visible = true;
    }

    const charge = engine.getLauncherCharge();
    if (launchMeterFill) launchMeterFill.style.width = Math.round(charge * 100) + '%';
    if (launcherVisual) {
      launcherVisual.plunger.position.z =
        launcherVisual.baseZ + charge * launcherVisual.pullDistance;
    }

    if (engine.isAwaitingLaunch()) {
      setLauncherState(charge > 0 ? 'POWER ' + Math.round(charge * 100) + '%' : 'HOLD LAUNCH');
    }
  }

  function addScore(value, x, z, prefix = '') {
    if (!Number.isFinite(value) || value <= 0 || engine.isTilted()) return;
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

  function resetGame() {
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }

    currentBall = 1;
    score = 0;
    engine.resetGame();
    updateHud();
  }

  function updateHud() {
    setBallState('BALL ' + currentBall + ' / ' + rulesConfig.ballsPerGame);
    updateScore();
    clearTiltHud();
    setLauncherState(engine.isAwaitingLaunch() ? 'HOLD LAUNCH' : 'IN PLAY');
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

  function pressFlipper(id) {
    if (engine.isTilted()) return;
    const state = engine.getFlipper(id);
    if (!state || state.pressed) return;
    engine.setFlipper(id, true);
    sfx.flipper();
  }

  function releaseFlipper(id) {
    engine.setFlipper(id, false);
  }

  function beginLaunch() {
    if (engine.beginLaunch()) sfx.launchCharge();
  }

  function releaseLaunch() {
    engine.releaseLaunch();
  }

  function nudge(direction) {
    engine.nudge(direction);
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

    window.addEventListener('keydown', async (event) => {
      await sfx.unlock();

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
        resetGame();
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

    bindPointerControl(leftButton, () => pressFlipper('left'), () => releaseFlipper('left'));
    bindPointerControl(rightButton, () => pressFlipper('right'), () => releaseFlipper('right'));
    bindPointerControl(launchButton, beginLaunch, releaseLaunch);
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

    button.addEventListener('pointerdown', async (event) => {
      event.preventDefault();
      await sfx.unlock();
      button.setPointerCapture?.(event.pointerId);
      onPress();
      button.classList.add('pressed');
    });

    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  function bindTapControl(button, handler) {
    if (!button) return;

    button.addEventListener('pointerdown', async (event) => {
      event.preventDefault();
      await sfx.unlock();
      handler();
      button.classList.add('pressed');
      window.setTimeout(() => button.classList.remove('pressed'), 90);
    });
  }

  return {
    engine,
    step,
    sync,
    resetGame
  };
}

function createSlingshotVisuals(root, tableConfig) {
  const gold = new THREE.MeshStandardMaterial({
    color: 0xe3ad45,
    metalness: 0.45,
    roughness: 0.28,
    emissive: 0x4b2404,
    emissiveIntensity: 0.35
  });

  const rubber = new THREE.MeshStandardMaterial({
    color: 0x9f2d25,
    metalness: 0.05,
    roughness: 0.38,
    emissive: 0x3a0704,
    emissiveIntensity: 0.28
  });

  for (const cfg of tableConfig.slingshots) {
    const group = new THREE.Group();
    group.name = 'Slingshot_' + cfg.id;

    group.add(makeBar(cfg.a, cfg.b, tableConfig.playfield.surfaceY + 0.055, 0.035, rubber));

    const offset = cfg.id === 'left' ? -0.16 : 0.16;
    const outerA = [cfg.a[0] + offset, cfg.a[1] + 0.05];
    const outerB = [cfg.b[0] + offset * 0.35, cfg.b[1] - 0.05];
    group.add(makeBar(outerA, outerB, tableConfig.playfield.surfaceY + 0.035, 0.022, gold));

    root.add(group);
  }
}

function createLauncherVisuals(root, tableConfig) {
  const cfg = tableConfig.launcher;
  const y = tableConfig.playfield.surfaceY + 0.05;

  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0xd6b66b,
    metalness: 0.85,
    roughness: 0.18
  });

  const plungerMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b4a22,
    metalness: 0.45,
    roughness: 0.30
  });

  const innerRail = makeBar(
    [cfg.lane.minX, cfg.lane.exitZ],
    [cfg.lane.minX, cfg.spawn[1] + 0.40],
    y,
    0.026,
    railMaterial
  );
  innerRail.name = 'LauncherLane_InnerRail';
  root.add(innerRail);

  const plunger = makeBar(
    [cfg.spawn[0], cfg.spawn[1] + 0.18],
    [cfg.spawn[0], cfg.spawn[1] + 0.56],
    y + 0.015,
    0.045,
    plungerMaterial
  );
  plunger.name = 'Launcher_Plunger';
  root.add(plunger);

  return {
    plunger,
    baseZ: plunger.position.z,
    pullDistance: 0.18
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