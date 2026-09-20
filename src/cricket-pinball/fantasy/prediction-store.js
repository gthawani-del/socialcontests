const STORAGE_KEY = 'cricket-pinball-fan-picks-v1';

export function createPredictionStore(matchId) {
  const data = read();
  let pick = data[matchId] || null;

  function select(playerId) {
    if (pick?.locked) return pick;
    pick = { matchId, playerId, confirmed: false, locked: false, result: null };
    persist();
    return { ...pick };
  }

  function confirm() {
    if (!pick || pick.locked) return pick ? { ...pick } : null;
    pick.confirmed = true;
    persist();
    return { ...pick };
  }

  function lock() {
    if (!pick?.confirmed) return pick ? { ...pick } : null;
    pick.locked = true;
    persist();
    return { ...pick };
  }

  function resolve(winnerId) {
    if (!pick?.locked) return pick ? { ...pick } : null;
    pick.result = pick.playerId === winnerId ? 'CORRECT' : 'INCORRECT';
    persist();
    return { ...pick };
  }

  function get() {
    return pick ? { ...pick } : null;
  }

  function persist() {
    const all = read();
    if (pick) all[matchId] = pick;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  return { select, confirm, lock, resolve, get };
}

function read() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
