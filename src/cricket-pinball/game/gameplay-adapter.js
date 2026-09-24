export function createCricketGameplayAdapter({
  engine,
  matchEngine,
  tableConfig,
  cricketRules,
  onResolved = () => {}
}) {
  let resolved = true;
  let liveStartedAt = 0;
  let stalledSince = null;
  let battingContact = false;
  let gutterRescues = 0;
  let gutterEnteredAt = null;
  const zones = (tableConfig.deliveryZones || []).filter((zone) => zone.terminal);
  const unsubs = [];

  function armDelivery() {
    resolved = false;
    liveStartedAt = performanceNow();
    stalledSince = null;
    battingContact = false;
    gutterRescues = 0;
    gutterEnteredAt = null;
  }

  function resolve(type, metadata = {}) {
    if (resolved || !matchEngine.getState().deliveryOpen) return false;

    resolved = true;
    engine.freezeBall?.();

    const accepted = matchEngine.resolveDelivery(type, metadata);
    if (accepted) onResolved(type, metadata);
    return accepted;
  }

  function step(deltaSeconds) {
    engine.step(deltaSeconds);

    if (
      resolved ||
      engine.isAwaitingLaunch() ||
      !engine.ball.active ||
      !matchEngine.getState().deliveryOpen
    ) {
      return;
    }

    const now = performanceNow();

    // Side gutters are not free/dead balls. Before bat contact, allow one
    // controlled rescue pop back into play; a repeated/trapped gutter is DOT.
    const gutterCfg = cricketRules.delivery || {};
    const gutterThreshold = (tableConfig.playfield?.drain?.maxX ?? 0.46) + 0.12;
    // The physical launcher lane occupies the same right-side coordinates as
    // the batting gutter. Never apply gutter rescue until resolveLauncherLane()
    // has confirmed the ball crossed the configured lane exit.
    const inBattingGutter =
      !engine.launcher.inLane &&
      engine.ball.position.z >= 1.72 &&
      Math.abs(engine.ball.position.x) >= gutterThreshold;

    if (engine.launcher.inLane) {
      gutterEnteredAt = null;
    }

    if (inBattingGutter) {
      if (gutterEnteredAt === null) gutterEnteredAt = now;

      if (
        !battingContact &&
        gutterCfg.gutterRescueEnabled !== false &&
        gutterRescues < (gutterCfg.gutterRescueMax ?? 1)
      ) {
        const side = Math.sign(engine.ball.position.x) || 1;
        engine.ball.velocity.x = -side * (gutterCfg.gutterRescueImpulseX ?? 2.4);
        engine.ball.velocity.z = -(gutterCfg.gutterRescueImpulseZ ?? 2.2);
        gutterRescues += 1;
        gutterEnteredAt = null;
      } else if (now - gutterEnteredAt >= (gutterCfg.gutterTrapMs ?? 1200)) {
        resolve('DOT', {
          reason: battingContact ? 'POST_BAT_GUTTER' : 'GUTTER_TRAPPED',
          gutterRescues
        });
        return;
      }
    } else {
      gutterEnteredAt = null;
    }

    // Cricket runs can only exist after actual bat contact. Stall/timeout and
    // gutter handling still run before contact so a delivery can never hang.
    if (battingContact) {
      for (const zone of zones) {
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
        resolve('DOT', { reason: 'STALLED' });
        return;
      }
    } else {
      stalledSince = null;
    }

    const maxLiveMs = cricketRules.delivery?.maxLiveMs ?? 10000;
    if (liveStartedAt && now - liveStartedAt >= maxLiveMs) {
      resolve('DOT', { reason: 'TIMEOUT' });
    }
  }

  unsubs.push(engine.on('flipper-hit', ({ pressed = false } = {}) => {
    if (
      !resolved &&
      matchEngine.getState().deliveryOpen &&
      pressed &&
      engine.ball.position.z >= 1.72
    ) {
      battingContact = true;
    }
  }));

  unsubs.push(engine.on('drain', ({ safetyReset = false } = {}) => {
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

function performanceNow() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}
