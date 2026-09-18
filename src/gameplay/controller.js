import * as THREE from 'three';
import { PinballEngine } from '../physics/pinball-engine.js';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

export function createGameplayController({
  root,
  tableConfig,
  rulesConfig,
  ballStateElement,
  leftButton,
  rightButton
}) {
  const engine = new PinballEngine(tableConfig);
  const flipperVisuals = new Map();
  const tempQuat = new THREE.Quaternion();
  let currentBall = 1;
  let resetTimer = null;

  root.traverse((object) => {
    if (object.isMesh && /^ball($|[_-])/i.test(object.name)) {
      object.visible = false;
    }
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

  for (const cfg of tableConfig.flippers) {
    const objectName = cfg.id === 'left' ? 'Flipper_Left' : 'Flipper_Right';
    const object = root.getObjectByName(objectName);
    if (!object) {
      console.warn('Missing visual flipper:', objectName);
      continue;
    }

    flipperVisuals.set(cfg.id, {
      object,
      restAngle: THREE.MathUtils.degToRad(cfg.restAngleDeg),
      restQuaternion: object.quaternion.clone()
    });
  }

  engine.on('drain', () => {
    if (resetTimer) return;

    const finalBall = currentBall >= rulesConfig.ballsPerGame;
    setBallState(finalBall ? 'GAME OVER' : 'BALL ' + currentBall + ' DRAINED');

    resetTimer = window.setTimeout(() => {
      currentBall = finalBall ? 1 : currentBall + 1;
      engine.resetBall();
      updateBallState();
      resetTimer = null;
    }, finalBall ? rulesConfig.gameResetDelayMs : rulesConfig.drainResetDelayMs);
  });

  bindInputs();
  updateBallState();

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

  function resetGame() {
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
    currentBall = 1;
    engine.resetBall();
    updateBallState();
  }

  function updateBallState() {
    setBallState('BALL ' + currentBall + ' / ' + rulesConfig.ballsPerGame);
  }

  function setBallState(text) {
    if (ballStateElement) ballStateElement.textContent = text;
  }

  function bindInputs() {
    const keyMap = new Map([
      ['ArrowLeft', 'left'],
      ['KeyA', 'left'],
      ['ArrowRight', 'right'],
      ['KeyD', 'right']
    ]);

    window.addEventListener('keydown', (event) => {
      const flipper = keyMap.get(event.code);
      if (flipper) {
        event.preventDefault();
        engine.setFlipper(flipper, true);
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
      engine.setFlipper(flipper, false);
    });

    bindPointerControl(leftButton, 'left');
    bindPointerControl(rightButton, 'right');
  }

  function bindPointerControl(button, id) {
    if (!button) return;

    const release = (event) => {
      event.preventDefault();
      engine.setFlipper(id, false);
      button.classList.remove('pressed');
    };

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      engine.setFlipper(id, true);
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