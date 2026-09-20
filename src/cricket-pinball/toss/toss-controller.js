export function createTossController({ random = Math.random } = {}) {
  let locked = false;

  function perform(call, callerId, opponentId) {
    if (locked) return null;
    locked = true;

    const normalizedCall = String(call || '').toUpperCase();
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

  return { perform, reset, isLocked };
}
