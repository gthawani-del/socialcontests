const PRESETS = Object.freeze({
  easy: Object.freeze({
    label: 'EASY',
    flippers: Object.freeze({
      left: Object.freeze({
        restAngleDeg: 44,
        activeAngleDeg: 62,
        speedDegPerSec: 760,
        returnSpeedDegPerSec: 560,
        kick: 1.20
      }),
      right: Object.freeze({
        restAngleDeg: 136,
        activeAngleDeg: 118,
        speedDegPerSec: 760,
        returnSpeedDegPerSec: 560,
        kick: 1.20
      })
    }),
    launcher: Object.freeze({
      minPower: 6.15,
      maxPower: 8.5,
      tapCharge: 0.18
    }),
    nudge: Object.freeze({
      impulse: 0.78,
      maxWarnings: 4,
      windowMs: 2500
    })
  }),

  standard: Object.freeze({
    label: 'STANDARD',
    flippers: Object.freeze({
      left: Object.freeze({
        restAngleDeg: 48,
        activeAngleDeg: 65,
        speedDegPerSec: 700,
        returnSpeedDegPerSec: 520,
        kick: 1.15
      }),
      right: Object.freeze({
        restAngleDeg: 132,
        activeAngleDeg: 115,
        speedDegPerSec: 700,
        returnSpeedDegPerSec: 520,
        kick: 1.15
      })
    }),
    launcher: Object.freeze({
      minPower: 5.7,
      maxPower: 8.5,
      tapCharge: 0.12
    }),
    nudge: Object.freeze({
      impulse: 0.72,
      maxWarnings: 3,
      windowMs: 2500
    })
  }),

  hard: Object.freeze({
    label: 'HARD',
    flippers: Object.freeze({
      left: Object.freeze({
        restAngleDeg: 52,
        activeAngleDeg: 68,
        speedDegPerSec: 660,
        returnSpeedDegPerSec: 500,
        kick: 1.10
      }),
      right: Object.freeze({
        restAngleDeg: 128,
        activeAngleDeg: 112,
        speedDegPerSec: 660,
        returnSpeedDegPerSec: 500,
        kick: 1.10
      })
    }),
    launcher: Object.freeze({
      minPower: 5.55,
      maxPower: 8.5,
      tapCharge: 0.08
    }),
    nudge: Object.freeze({
      impulse: 0.68,
      maxWarnings: 2,
      windowMs: 2500
    })
  })
});

export const DEFAULT_DIFFICULTY = 'standard';

export function resolveDifficulty(requested) {
  const normalized = String(requested || '').trim().toLowerCase();
  return PRESETS[normalized] ? normalized : DEFAULT_DIFFICULTY;
}

export function getDifficultyLabel(level) {
  return PRESETS[resolveDifficulty(level)].label;
}

export function createDifficultyTableConfig(baseConfig, requestedLevel) {
  const level = resolveDifficulty(requestedLevel);
  const preset = PRESETS[level];
  const config = structuredCloneSafe(baseConfig);

  for (const flipper of config.flippers) {
    const flipperPreset = preset.flippers[flipper.id];
    if (!flipperPreset) continue;
    Object.assign(flipper, flipperPreset);
  }

  Object.assign(config.launcher, preset.launcher);
  Object.assign(config.nudge, preset.nudge);

  config.difficulty = level;
  return config;
}

export function getDifficultyMetrics(config) {
  const left = config.flippers.find((item) => item.id === 'left');
  const right = config.flippers.find((item) => item.id === 'right');

  if (!left || !right) {
    return { restGap: null, launchTapPower: null };
  }

  const leftTipX =
    left.pivot[0] + Math.cos(deg(left.restAngleDeg)) * left.length;
  const rightTipX =
    right.pivot[0] + Math.cos(deg(right.restAngleDeg)) * right.length;

  const launchTapPower =
    config.launcher.minPower +
    (config.launcher.maxPower - config.launcher.minPower) *
      config.launcher.tapCharge;

  const restGap = rightTipX - leftTipX;
  const collisionClearance =
    restGap - 2 * (left.radius + config.ball.radius);

  return {
    restGap,
    collisionClearance,
    launchTapPower
  };
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function deg(value) {
  return value * Math.PI / 180;
}
