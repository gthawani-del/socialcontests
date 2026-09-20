const STORAGE_KEY = 'cricket-pinball-fan-picks-v1';
const PROFILE_KEY = 'cricket-pinball-fan-profile-v1';

export function createPredictionStore(matchId) {
  const data = readPicks();
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
    if (!pick?.locked || pick.result) return pick ? { ...pick } : null;

    const correct = pick.playerId === winnerId;
    pick.result = correct ? 'CORRECT' : 'INCORRECT';

    const profile = readProfile();
    profile.points = Number(profile.points || 0) + (correct ? 1 : 0);
    profile.streak = correct ? Number(profile.streak || 0) + 1 : 0;
    profile.bestStreak = Math.max(Number(profile.bestStreak || 0), profile.streak);
    writeProfile(profile);
    persist();

    return { ...pick };
  }

  function get() {
    return pick ? { ...pick } : null;
  }

  function getProfile() {
    return { ...readProfile() };
  }

  function persist() {
    const all = readPicks();
    if (pick) all[matchId] = pick;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {}
  }

  return { select, confirm, lock, resolve, get, getProfile };
}

function readPicks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function readProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {
      points: 0,
      streak: 0,
      bestStreak: 0
    };
  } catch {
    return { points: 0, streak: 0, bestStreak: 0 };
  }
}

function writeProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {}
}
