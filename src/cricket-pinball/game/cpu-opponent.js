export function chooseCpuBowling(difficulty = 'MEDIUM', cpuConfig = {}) {
  const lines = ['LEFT', 'CENTRE', 'RIGHT'];
  const preset = cpuConfig[difficulty] || cpuConfig.MEDIUM || {};
  const min = Number(preset.bowlingPowerMin ?? (difficulty === 'HARD' ? 0.72 : difficulty === 'EASY' ? 0.45 : 0.58));
  const max = Number(preset.bowlingPowerMax ?? (difficulty === 'HARD' ? 0.96 : difficulty === 'EASY' ? 0.72 : 0.86));

  return {
    line: lines[Math.floor(Math.random() * lines.length)],
    power: min + Math.random() * Math.max(0, max - min),
    type: 'PACE'
  };
}

export function createCpuBattingAI({
  engine,
  tableConfig,
  difficulty = 'MEDIUM',
  cpuConfig = {}
}) {
  let swingUntil = 0;
  let cooldownUntil = 0;
  let activeSide = null;

  function reset() {
    swingUntil = 0;
    cooldownUntil = 0;
    activeSide = null;
    engine?.setFlipper('left', false);
    engine?.setFlipper('right', false);
  }

  function update(nowMs, enabled) {
    if (!engine) return;

    if (!enabled || engine.isAwaitingLaunch() || !engine.ball.active) {
      reset();
      return;
    }

    if (nowMs < swingUntil) return;

    if (activeSide) {
      engine.setFlipper('left', false);
      engine.setFlipper('right', false);
      activeSide = null;
    }

    if (nowMs < cooldownUntil) return;

    const preset = cpuConfig[difficulty] || cpuConfig.MEDIUM || {};
    const ball = engine.ball;

    // CPU only reacts to an incoming delivery moving toward the batting end.
    if (ball.velocity.z <= 0) return;

    const triggerZ = Number(preset.battingTriggerZ ?? 1.45);
    const maxTriggerZ = Number(preset.battingMaxZ ?? 2.48);
    if (ball.position.z < triggerZ || ball.position.z > maxTriggerZ) return;

    const centreBand = Number(preset.battingCentreBand ?? 0.18);
    const missChance = clamp(Number(preset.battingMissChance ?? 0.12), 0, 0.75);
    if (Math.random() < missChance) {
      cooldownUntil = nowMs + Number(preset.battingCooldownMs ?? 220);
      return;
    }

    let side;
    if (Math.abs(ball.position.x) <= centreBand) side = 'both';
    else side = ball.position.x < 0 ? 'left' : 'right';

    if (side === 'both') {
      engine.setFlipper('left', true);
      engine.setFlipper('right', true);
    } else {
      engine.setFlipper(side, true);
    }

    activeSide = side;
    swingUntil = nowMs + Number(preset.battingHoldMs ?? 105);
    cooldownUntil = swingUntil + Number(preset.battingCooldownMs ?? 210);
  }

  return { update, reset };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
