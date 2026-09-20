export function createTossController({ random = Math.random } = {}) {
  let locked = false;

  function pickCaller(players) {
    if (!Array.isArray(players) || players.length !== 2) throw new Error('Toss requires two players.');
    return players[random() < 0.5 ? 0 : 1];
  }

  function perform(call, callerId, opponentId) {
    if (locked) return null;
    const normalizedCall = String(call || '').toUpperCase();
    if (!['HEADS', 'TAILS'].includes(normalizedCall)) throw new Error('Toss call must be HEADS or TAILS.');
    locked = true;

    const result = random() < 0.5 ? 'HEADS' : 'TAILS';
    const callerWon = normalizedCall === result;

    return {
      call: normalizedCall,
      result,
      callerId,
      winnerId: callerWon ? callerId : opponentId,
      callerWon
    };
  }

  function reset() {
    locked = false;
  }

  function isLocked() {
    return locked;
  }

  return { pickCaller, perform, reset, isLocked };
}
