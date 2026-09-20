import { PinballEngine } from '../../physics/pinball-engine.js';

export function createCricketGameplayAdapter({
  tableConfig,
  cricketRules,
  matchEngine,
  onEvent = () => {}
}) {
  const engine = new PinballEngine(tableConfig);
  const zones = (tableConfig.deliveryZones || []).filter((zone) => zone.terminal);

  let deliveryResolved = true;
  let liveStartedAt = 0;
  let stalledSince = null;
  let pendingBowling = null;

  engine.on('drain', ({ safetyReset = false } = {}) => {
    if (deliveryResolved) return;
    resolveOfficialOutcome('WICKET', {
      reason: safetyReset ? 'SAFETY_DRAIN' : 'DRAIN'
    });
  });

  engine.on('launch', ({ charge, line, deliveryType }) => {
    if (deliveryResolved) return;
    liveStartedAt = performance.now();
    pendingBowling = {
      line: line || 'CENTRE',
      power: charge,
      type: deliveryType || 'PACE'
    };
    onEvent('delivery:launch', { ...pendingBowling });
  });

  function beginDelivery() {
    if (!matchEngine.readyDelivery()) return false;

    deliveryResolved = false;
    stalledSince = null;
    liveStartedAt = 0;
    pendingBowling = null;
    engine.resetBall();
    onEvent('delivery:ready', matchEngine.getState());
    return true;
  }

  function beginCharge() {
    if (deliveryResolved) return false;
    return engine.beginLaunch();
  }

  function launch({ charge, line, deliveryType = 'PACE' }) {
    if (deliveryResolved) return false;
    return engine.releaseLaunch({ charge, line, deliveryType });
  }

  function setFlipper(side, pressed) {
    if (deliveryResolved) return false;
    engine.setFlipper(side, pressed);
    return true;
  }

  function step(deltaSeconds) {
    engine.step(deltaSeconds);

    if (deliveryResolved || engine.isAwaitingLaunch() || !engine.ball.active) return;

    const now = performance.now();
    checkTerminalZones();
    if (deliveryResolved) return;

    const speed = Math.hypot(engine.ball.velocity.x, engine.ball.velocity.z);
    const stalledSpeed = cricketRules.delivery?.stalledSpeed ?? 0.2;
    const stalledForMs = cricketRules.delivery?.stalledForMs ?? 1200;

    if (speed <= stalledSpeed) {
      if (stalledSince === null) stalledSince = now;

      if (now - stalledSince >= stalledForMs) {
        resolveOfficialOutcome('DOT', { reason: 'STALLED' });
        return;
      }
    } else {
      stalledSince = null;
    }

    const maxLiveMs = cricketRules.delivery?.maxLiveMs ?? 10000;
    if (liveStartedAt && now - liveStartedAt >= maxLiveMs) {
      resolveOfficialOutcome('DOT', { reason: 'TIMEOUT' });
    }
  }

  function checkTerminalZones() {
    for (const zone of zones) {
      const dx = engine.ball.position.x - zone.position[0];
      const dz = engine.ball.position.z - zone.position[1];

      if (Math.hypot(dx, dz) <= zone.radius) {
        resolveOfficialOutcome(zone.outcome, {
          zoneId: zone.id,
          runs: zone.runs
        });
        return;
      }
    }
  }

  function resolveOfficialOutcome(type, metadata = {}) {
    if (deliveryResolved) return false;

    deliveryResolved = true;
    engine.freezeBall();

    const resolved = matchEngine.resolveDelivery({
      type,
      bowling: pendingBowling || {},
      durationMs: liveStartedAt
        ? Math.max(0, performance.now() - liveStartedAt)
        : 0
    });

    if (!resolved.accepted) return false;

    const payload = {
      ...resolved.delivery,
      metadata,
      match: resolved.state
    };

    onEvent('delivery:resolved', payload);
    if (type === 'WICKET') onEvent('wicket', payload);
    if (type === 'FOUR') onEvent('boundary:four', payload);
    if (type === 'SIX') onEvent('boundary:six', payload);

    return true;
  }

  return {
    engine,
    beginDelivery,
    beginCharge,
    launch,
    setFlipper,
    step,
    resolveOfficialOutcome,
    isDeliveryResolved: () => deliveryResolved
  };
}
