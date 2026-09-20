const TARGET_OUTCOMES = Object.freeze({
  p: 'ONE',
  a: 'TWO',
  r: 'FOUR',
  i: 'ONE',
  s: 'TWO',
  star: 'FOUR'
});

export function createCricketGameplayAdapter({ engine, matchEngine, maxLiveMs = 10000, onResolved = () => {} }) {
  let resolved = false;
  let timer = null;
  const unsubs = [];

  function armDelivery() {
    resolved = false;
    clearTimeout(timer);
    timer = setTimeout(() => resolve('DOT', { reason: 'TIMEOUT' }), maxLiveMs);
  }

  function resolve(type, metadata = {}) {
    if (resolved || !matchEngine.getState().deliveryOpen) return false;
    resolved = true;
    clearTimeout(timer);
    engine.freezeBall?.();
    const accepted = matchEngine.resolveDelivery(type, metadata);
    if (accepted) onResolved(type, metadata);
    return accepted;
  }

  unsubs.push(engine.on('drain', () => resolve('WICKET', { reason: 'DRAIN' })));
  unsubs.push(engine.on('scoring-zone-hit', () => resolve('SIX', { reason: 'SIX_ZONE' })));
  unsubs.push(engine.on('target-hit', ({ id }) => {
    const type = TARGET_OUTCOMES[id];
    if (type) resolve(type, { reason: 'TARGET', targetId: id });
  }));

  return {
    armDelivery,
    resolve,
    dispose() {
      clearTimeout(timer);
      unsubs.forEach((unsubscribe) => unsubscribe?.());
    }
  };
}
