export function createCricketGameplayAdapter({
  engine,
  matchEngine,
  tableConfig,
  cricketRules,
  onResolved = () => {},
  onDeadBall = () => {}
}) {
  let resolved = true;
  let liveStartedAt = null;
  let stalledSince = null;
  let shotLive = false;
  let becameHittable = false;
  let gutterEnteredAt = null;
  const zones = (tableConfig.deliveryZones || []).filter((zone) => zone.terminal);
  const unsubs = [];

  function armDelivery() {
    resolved = false;
    liveStartedAt = engine.simTime * 1000;
    stalledSince = null;
    shotLive = false;
    becameHittable = false;
    gutterEnteredAt = null;
  }

  function resolve(type, metadata = {}) {
    if (resolved || !matchEngine.getState().deliveryOpen) return false;
    const normalized = String(type || '').toUpperCase();
    const runOutcome = ['ONE', 'TWO', 'FOUR', 'SIX'].includes(normalized);
    if (runOutcome && !shotLive) return false;

    resolved = true;
    engine.freezeBall?.();

    const accepted = matchEngine.resolveDelivery(type, metadata);
    if (accepted) onResolved(type, metadata);
    return accepted;
  }

  function step(deltaSeconds) {
    engine.step(deltaSeconds);
    checkDelivery();
  }

  function checkDelivery() {
    if (
      resolved ||
      engine.isAwaitingLaunch() ||
      !engine.ball.active ||
      !matchEngine.getState().deliveryOpen
    ) {
      return;
    }

    // Count physics time, not wall time: slow frames must not abort a ball
    // before the simulation has had time to deliver it.
    const now = engine.simTime * 1000;

    // A delivery is countable only once it reaches the real playable bat gate.
    // The earlier bowling corridor is guidance only; entering it does not consume a ball.
    const playableBatZoneZ = Number(cricketRules.delivery?.battingZoneZ ?? 1.72);
    const playableBatZoneHalfWidth = Math.max(
      Number(cricketRules.delivery?.playableBatZoneHalfWidth ?? 1.42),
      1.42
    );
    if (
      !becameHittable &&
      !engine.launcher.inLane &&
      !engine.launcher.deliveryGuideActive &&
      engine.ball.position.z >= playableBatZoneZ &&
      Math.abs(engine.ball.position.x) <= playableBatZoneHalfWidth
    ) {
      becameHittable = true;
    }

    // A pre-bat side gutter is a dead delivery: it must not consume a ball.
    // Launcher and controlled-delivery phases are excluded from gutter detection.
    const gutterThreshold = (tableConfig.playfield?.drain?.maxX ?? 0.46) + 0.12;
    const inBattingGutter =
      !engine.launcher.inLane &&
      !engine.launcher.deliveryGuideActive &&
      engine.ball.position.z >= 1.72 &&
      Math.abs(engine.ball.position.x) >= gutterThreshold;

    if (engine.launcher.inLane || engine.launcher.deliveryGuideActive) {
      gutterEnteredAt = null;
    } else if (inBattingGutter && !shotLive && !becameHittable) {
      if (gutterEnteredAt === null) gutterEnteredAt = now;
      const deadBallDelayMs = cricketRules.delivery?.deadBallGutterMs ?? 120;
      if (now - gutterEnteredAt >= deadBallDelayMs) {
        resolved = true;
        engine.freezeBall?.();
        if (matchEngine.abortDelivery?.('PRE_BAT_GUTTER', {
          x: engine.ball.position.x,
          z: engine.ball.position.z
        })) {
          onDeadBall('PRE_BAT_GUTTER');
        }
        return;
      }
    } else {
      gutterEnteredAt = null;
    }

    // Cricket runs can only exist after actual bat contact. Stall/timeout and
    // gutter handling still run before contact so a delivery can never hang.
    if (shotLive) {
      for (const zone of zones) {
        if (engine.isDeliveryZoneEligible?.(zone) === false) continue;
        if (zone.direction === 'RETURN' && engine.ball.velocity.z >= -0.05) continue;
        if (zone.direction === 'DELIVERY' && engine.ball.velocity.z <= 0.05) continue;

        const dx = engine.ball.position.x - zone.position[0];
        const dz = engine.ball.position.z - zone.position[1];

        if (Math.hypot(dx, dz) <= zone.radius) {
          resolve(zone.outcome, {
            reason: 'DELIVERY_ZONE',
            zoneId: zone.id,
            runs: zone.runs
          });
          return;
        }
      }
    }
    const speed = Math.hypot(engine.ball.velocity.x, engine.ball.velocity.z);
    const stalledSpeed = cricketRules.delivery?.stalledSpeed ?? 0.2;
    const stalledForMs = cricketRules.delivery?.stalledForMs ?? 1200;

    if (speed <= stalledSpeed) {
      if (stalledSince === null) stalledSince = now;

      if (now - stalledSince >= stalledForMs) {
        if (becameHittable) {
          resolve('DOT', { reason: 'STALLED' });
        } else {
          abortDeadBall('PRE_BAT_STALLED');
        }
        return;
      }
    } else {
      stalledSince = null;
    }

    const maxLiveMs = cricketRules.delivery?.maxLiveMs ?? 10000;
    if (liveStartedAt !== null && now - liveStartedAt >= maxLiveMs) {
      if (becameHittable) {
        resolve('DOT', { reason: 'TIMEOUT' });
      } else {
        abortDeadBall('PRE_BAT_TIMEOUT');
      }
    }
  }

  function abortDeadBall(reason, metadata = {}) {
    if (resolved || !matchEngine.getState().deliveryOpen) return false;
    resolved = true;
    engine.freezeBall?.();
    const accepted = matchEngine.abortDelivery?.(reason, metadata);
    if (accepted) onDeadBall(reason);
    return Boolean(accepted);
  }

  unsubs.push(engine.on('physics:step', checkDelivery));

  unsubs.push(engine.on('flipper-hit', ({ pressed = false, impact = 0 } = {}) => {
    // Actual bat contact is always proof that the delivery became playable,
    // including contact made slightly before the configured bat-gate z line.
    if (
      !shotLive &&
      !resolved &&
      matchEngine.getState().deliveryOpen &&
      pressed &&
      impact > 0
    ) {
      becameHittable = true;
      shotLive = true;
    }
  }));

  unsubs.push(engine.on('drain', ({ safetyReset = false } = {}) => {
    if (!becameHittable && matchEngine.getState().deliveryOpen) {
      resolved = true;
      engine.freezeBall?.();
      if (matchEngine.abortDelivery?.(safetyReset ? 'PRE_BAT_SAFETY_DRAIN' : 'PRE_BAT_DRAIN')) {
        onDeadBall(safetyReset ? 'PRE_BAT_SAFETY_DRAIN' : 'PRE_BAT_DRAIN');
      }
      return;
    }
    if (safetyReset) {
      resolve('DOT', { reason: 'SAFETY_DRAIN' });
      return;
    }
    resolve('WICKET', { reason: 'WICKET_DRAIN' });
  }));

  return {
    armDelivery,
    resolve,
    step,
    dispose() {
      unsubs.forEach((unsubscribe) => unsubscribe?.());
    }
  };
}
