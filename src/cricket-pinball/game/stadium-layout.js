// Colosseum stadium: authored geometry and matching gameplay colliders.
// Blender (x, y, z-up) becomes engine (x, height, -y), uniformly scaled.
export const STADIUM_SCALE = 0.45;
// Physics uses compact arena units. Convert to real-world metres explicitly;
// never label the old greybox dimensions as a full-size cricket ground.
export const STADIUM_PITCH = Object.freeze({
  battingZ: 2.43, bowlingZ: -.22, lengthMetres: 20.1168, widthMetres: 3.048,
  metresPerUnit: 20.1168 / 2.65
});
export const stadiumPoint = (x, y) => [x * STADIUM_SCALE, -y * STADIUM_SCALE];

export function createStadiumTable(base) {
  const table = structuredClone(base);
  table.world = { ...table.world, glb: '/models/cricket-stadium-colosseum-r5.glb', prototype: false, revision: 5 };
  table.ball.radius = .115 * STADIUM_SCALE;
  table.playfield.surfaceY = 0;
  table.playfield.drain = { minX: -.41 * STADIUM_SCALE, maxX: .41 * STADIUM_SCALE, z: 5.14 * STADIUM_SCALE };
  table.playfield.safetyBounds = { minX: -1.8, maxX: 1.8, minZ: -3, maxZ: 3 };
  table.walls = Array.from({ length: 96 }, (_, i) => {
    const point = n => stadiumPoint(3.55 * Math.cos(n * Math.PI / 48), 6.25 * Math.sin(n * Math.PI / 48));
    return { id: `stadium-boundary-${i}`, a: point(i), b: point(i + 1), restitution: .74 };
  });
  table.flippers = table.flippers.map(bat => ({
    ...bat,
    pivot: stadiumPoint(bat.id === 'left' ? -2.05 : 2.05, -4.8),
    length: 1.85 * STADIUM_SCALE,
    radius: .13 * STADIUM_SCALE,
    restAngleDeg: bat.id === 'left' ? -14.32 : 194.32
  }));
  const positions = {
    'one-gate': [-1.35, .25], 'two-gate': [1.35, .25],
    'straight-drive-four': [0, 3.5], 'four-ramp': [-2.62, 4.25], 'six-ramp': [2.62, 4.25]
  };
  table.deliveryZones = table.deliveryZones.map(zone => ({
    ...zone, position: stadiumPoint(...positions[zone.id]),
    radius: (zone.id.endsWith('ramp') ? .21 : .27) * STADIUM_SCALE,
    ...(zone.id.endsWith('ramp') ? { requiresRoute: zone.id } : {
      entryZ: stadiumPoint(...positions[zone.id])[1] + .125 * STADIUM_SCALE,
      entryHalfWidth: ((zone.id === 'straight-drive-four' ? .82 : .65) / 2 - .04) * STADIUM_SCALE
    })
  }));
  // Same 30-point centreline as the authored ramp, measured at metre scale.
  table.ramps = [{
    id: 'six-ramp', halfWidth: .25 * STADIUM_SCALE,
    points: Array.from({ length: 30 }, (_, i) => {
      const t = i / 29;
      const [x, z] = stadiumPoint(2.62 + .26 * Math.sin(t * Math.PI), -2.75 + 7 * t);
      return { x, z, height: (i === 0 ? 0 : .035 + 1.05 * t) * STADIUM_SCALE };
    })
  }];
  table.ramps.push({
    id: 'four-ramp', halfWidth: .25 * STADIUM_SCALE,
    points: table.ramps[0].points.map(p => ({ x: -p.x, z: p.z, height: .035 * STADIUM_SCALE }))
  });
  const six = table.ramps[0];
  const rectangle = (id, x, z, halfX, halfZ) => {
    const corners = [[x - halfX, z - halfZ], [x + halfX, z - halfZ], [x + halfX, z + halfZ], [x - halfX, z + halfZ]];
    for (let i = 0; i < 4; i++) table.walls.push({ id: `${id}-${i}`, a: corners[i], b: corners[(i + 1) % 4], restitution: .7 });
  };
  // GLB support posts extend from the field to the deck; ground balls hit them.
  for (const i of [5, 10, 15, 20, 25, 29]) {
    const p = six.points[i];
    rectangle(`six-support-${i}`, p.x, p.z, .06 * STADIUM_SCALE, .08 * STADIUM_SCALE);
  }
  // Block the low underside while allowing a ground ball beneath the high span.
  // Captured ramp balls run on top and bypass these ground-plane colliders.
  const clearanceHeight = 2 * table.ball.radius + .08 * STADIUM_SCALE;
  for (let i = 1; i < six.points.length; i++) {
    const a = six.points[i - 1], b = six.points[i];
    if (a.height >= clearanceHeight) break;
    const fraction = Math.min(1, (clearanceHeight - a.height) / (b.height - a.height));
    const end = { x: a.x + (b.x - a.x) * fraction, z: a.z + (b.z - a.z) * fraction };
    for (const sign of [-1, 1]) table.walls.push({ id: `six-low-side-${sign}-${i}`, a: [a.x + sign * six.halfWidth, a.z], b: [end.x + sign * six.halfWidth, end.z], restitution: .7 });
    if (fraction < 1) table.walls.push({ id: 'six-underside-clearance', a: [end.x - six.halfWidth, end.z], b: [end.x + six.halfWidth, end.z], restitution: .7 });
  }
  // Ground-level four lane: the rails physically block entry from its sides.
  const four = table.ramps[1];
  for (let i = 1; i < four.points.length; i++) for (const sign of [-1, 1]) {
    const point = p => [p.x + sign * four.halfWidth, p.z];
    table.walls.push({ id: `four-rail-${sign}-${i}`, a: point(four.points[i - 1]), b: point(four.points[i]), restitution: .7 });
  }
  // Gate posts use the same dimensions as the visible GLB; the centre stays open.
  for (const zone of table.deliveryZones.filter(z => z.entryZ !== undefined)) {
    const half = zone.entryHalfWidth + .04 * STADIUM_SCALE;
    for (const sign of [-1, 1]) {
      const x = zone.position[0] + sign * half, z = zone.position[1] - .08375;
      const corners = [[x - .04 * STADIUM_SCALE, z - .14], [x + .04 * STADIUM_SCALE, z - .14], [x + .04 * STADIUM_SCALE, z + .14], [x - .04 * STADIUM_SCALE, z + .14]];
      for (let i = 0; i < 4; i++) table.walls.push({ id: `${zone.id}-post-${sign}-${i}`, a: corners[i], b: corners[(i + 1) % 4], restitution: .7 });
    }
    // The new alcove has depth: an approach from behind must rebound from
    // its back wall instead of passing through the authored structure.
    table.walls.push({ id: `${zone.id}-recess-back`, a: [zone.position[0] - half, zone.position[1] - .154], b: [zone.position[0] + half, zone.position[1] - .154], restitution: .7 });
  }
  // Bowl from the far end, with guidance released before the bats can make contact.
  table.launcher = {
    ...table.launcher, spawn: [0, STADIUM_PITCH.bowlingZ], direction: [0, 1],
    lane: { minX: -.09, maxX: .09, exitZ: STADIUM_PITCH.bowlingZ + .05, exitDirection: 'GTE' },
    bowlingLines: Object.fromEntries([['LEFT', -.5], ['CENTRE', 0], ['RIGHT', .5]].map(([line, x]) => [line, { target: [x, 1.6] }])),
    deliveryGuide: { halfWidth: .62, releaseZ: 1.55, steering: .22 }
  };
  return table;
}
