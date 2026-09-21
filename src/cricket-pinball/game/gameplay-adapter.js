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
  const zones = (tableConfig.deliveryZones || []).filter((zone) => zone.terminal);
  const unsubs = [];

  function armDelivery() {
    resolved = false;
    liveStartedAt = performanceNow();
    stalledSince = null;
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

    const now = performanceNow();
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

  unsubs.push(engine.on('drain', ({ safetyReset = false } = {}) => {
    resolve('WICKET', { reason: safetyReset ? 'SAFETY_DRAIN' : 'DRAIN' });
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
