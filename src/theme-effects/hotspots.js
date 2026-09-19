export const BOMBAY_HOTSPOTS = Object.freeze([
  Object.freeze({
    id: 'tram-bumper',
    kind: 'circle',
    position: [-0.72, 1.045, -0.35],
    radius: 0.34,
    color: 0xe0ad46,
    maxLight: 4.8
  }),
  Object.freeze({
    id: 'vt-bumper',
    kind: 'circle',
    position: [0.70, 1.045, -0.40],
    radius: 0.34,
    color: 0xf1c878,
    maxLight: 4.5
  }),
  Object.freeze({
    id: 'dock-bumper',
    kind: 'circle',
    position: [0, 1.045, -1.18],
    radius: 0.34,
    color: 0xa84a3e,
    maxLight: 4.2
  }),
  Object.freeze({
    id: 'bombay-bank',
    kind: 'rect',
    position: [0, 0.82, -2.055],
    size: [1.62, 0.42, 0.18],
    color: 0xd6a84b
  }),
  Object.freeze({
    id: 'tram-bell-zone',
    kind: 'circle',
    position: [0, 0.605, 1.02],
    radius: 0.36,
    color: 0xf0c567
  }),
  Object.freeze({
    id: 'jackpot-crest',
    kind: 'rect',
    position: [0, 1.30, -2.545],
    size: [1.36, 0.94, 0.18],
    color: 0x9a3f35
  })
]);

export const BOMBAY_EFFECT_IDS = Object.freeze({
  bumper: Object.freeze({
    metro: 'tram-bumper',
    cafe: 'vt-bumper',
    paris: 'dock-bumper'
  }),
  targetBank: 'bombay-bank',
  scoringZone: 'tram-bell-zone',
  jackpot: 'jackpot-crest'
});
