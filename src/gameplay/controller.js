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
  leftButton,
  rightButton
}) {
  const engine = new PinballEngine(tableConfig);
  const sfx = new BrowserSfx(rulesConfig.audio);
  const flipperVisuals = new Map();
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

  engine.on('wall-hit', ({ impact }) => sfx.wall(impact));

  engine.on('slingshot-hit', ({ score: value, x, z }) => {
    sfx.slingshot();
    addScore(value, x, z, '+');
  });

  engine.on('bumper-hit', ({ score: value, x, z }) => {
    sfx.bumper();
    addScore(value, x, z, '+');
  });

  engine.on('drain', () => {
    if (resetTimer) return;

    sfx.drain();
    const finalBall = currentBall >= rulesConfig.ballsPerGame;
    setBallState(finalBall ? 'GAME OVER' : 'BALL ' + currentBall + ' DRAINED');

    resetTimer = window.setTimeout(() => {
      if (finalBall) score = 0;
      currentBall = finalBall ? 1 : currentBall + 1;
      engine.resetBall();
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
  }

  function addScore(value, x, z, prefix = '') {
    if (!Number.isFinite(value) || value <= 0) return;
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

    window.setTimeout(() => node.remove(), 750);
  }

  function resetGame() {
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
    currentBall = 1;
    score = 0;
    engine.resetBall();
    updateHud();
  }

  function updateHud() {
    setBallState('BALL ' + currentBall + ' / ' + rulesConfig.ballsPerGame);
    updateScore();
  }

  function updateScore() {
    if (scoreElement) scoreElement.textContent = String(score);
  }

  function setBallState(text) {
    if (ballStateElement) ballStateElement.textContent = text;
  }

  function pressFlipper(id) {
    const state = engine.getFlipper(id);
    if (!state || state.pressed) return;
    engine.setFlipper(id, true);
    sfx.flipper();
  }

  function releaseFlipper(id) {
    engine.setFlipper(id, false);
  }

  function bindInputs() {
    const keyMap = new Map([
      ['ArrowLeft', 'left'],
      ['KeyA', 'left'],
      ['ArrowRight', 'right'],
      ['KeyD', 'right']
    ]);

    window.addEventListener('keydown', async (event) => {
      await sfx.unlock();

      const flipper = keyMap.get(event.code);
      if (flipper) {
        event.preventDefault();
        if (!event.repeat) pressFlipper(flipper);
      }

      if (event.code === 'KeyR') {
        event.preventDefault();
        resetGame();
      }
    });

    window.addEventListener('keyup', (event) => {
      const flipper = keyMap.get(event.code);
      if (!flipper) return;
      event.preventDefault();
      releaseFlipper(flipper);
    });

    bindPointerControl(leftButton, 'left');
    bindPointerControl(rightButton, 'right');
  }

  function bindPointerControl(button, id) {
    if (!button) return;

    const release = (event) => {
      event.preventDefault();
      releaseFlipper(id);
      button.classList.remove('pressed');
    };

    button.addEventListener('pointerdown', async (event) => {
      event.preventDefault();
      await sfx.unlock();
      button.setPointerCapture?.(event.pointerId);
      pressFlipper(id);
      button.classList.add('pressed');
    });

    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
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