import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json';
import { STADIUM_PITCH } from './game/stadium-layout.js';

// Editable runtime geometry, sharing the actual physics route and bat transforms.
// No generated bitmap assets: lettering is real vector geometry.
export function buildStadiumArt(scene, model, table) {
  const root = new THREE.Group(); root.name = 'Stadium_Art_Review'; scene.add(root);
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .65, ...extra });
  const sand = mat('#b7a071'), chalk = mat('#fff0d1'), willow = mat('#e4c38c');
  const edge = mat('#a67f43'), navy = mat('#10243b'), rubber = mat('#182433');
  const gold = mat('#d3a957', { metalness: .65, roughness: .32 });
  const steel = mat('#59727c', { metalness: .6, roughness: .4 });
  const font = new FontLoader().parse(fontData);
  function box(name, w, h, d, x, y, z, material, parent = root) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function text(name, value, size, material, parent = root) {
    const geometry = new TextGeometry(value, { font, size, depth: .001, curveSegments: 2, bevelEnabled: false });
    geometry.computeBoundingBox(); geometry.translate(-(geometry.boundingBox.max.x + geometry.boundingBox.min.x) / 2, 0, 0);
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; parent.add(mesh); return mesh;
  }
  model.traverse(o => {
    if (/^(Pitch_Inlay|Crease_|Bat_Left$|Bat_Right$|Wicket_Stump|Wicket_Bails|Six_Ramp$|Six_Rail_)/.test(o.name)) o.visible = false;
  });
  const pitchLength = STADIUM_PITCH.battingZ - STADIUM_PITCH.bowlingZ;
  const pitchWidth = STADIUM_PITCH.widthMetres / STADIUM_PITCH.metresPerUnit;
  const pitch = box('Measured_22_Yard_Pitch', pitchWidth, .008, pitchLength, 0, .003, (STADIUM_PITCH.battingZ + STADIUM_PITCH.bowlingZ) / 2, sand);
  pitch.userData = { lengthMetres: 20.1168, widthMetres: 3.048, metresPerUnit: STADIUM_PITCH.metresPerUnit };
  for (const [end, z, direction] of [['Batting', STADIUM_PITCH.battingZ, -1], ['Bowling', STADIUM_PITCH.bowlingZ, 1]]) {
    box(`${end}_Wicket_Line`, pitchWidth, .002, .008, 0, .009, z, chalk);
    const poppingZ = z + direction * 1.2192 / STADIUM_PITCH.metresPerUnit;
    box(`${end}_Popping_Crease`, pitchWidth * 1.3, .002, .008, 0, .009, poppingZ, chalk);
    for (const sign of [-1, 1]) box(`${end}_Return_Crease_${sign}`, .006, .002, Math.abs(poppingZ - z), sign * pitchWidth / 2, .009, (poppingZ + z) / 2, chalk);
  }
  // Wicket hardware is deliberately enlarged for arcade readability; the pitch
  // itself retains the official length/width ratio. Batting wicket sits behind contact.
  for (const x of [-.06, 0, .06]) box('Batting_Stump', .014, .16, .014, x, .08, STADIUM_PITCH.battingZ, chalk);
  box('Batting_Bails', .15, .012, .014, 0, .163, STADIUM_PITCH.battingZ, gold);

  const bats = {};
  for (const side of ['left', 'right']) {
    const cfg = table.flippers.find(b => b.id === side);
    const bat = new THREE.Group(); bat.name = `Branded_Bat_${side}`; root.add(bat); bats[side] = bat;
    // Centred on the collider, handle at outer pivot, toe pointing inward.
    const length = cfg.length, half = length / 2, width = cfg.radius * 1.75;
    const shape = new THREE.Shape();
    shape.moveTo(-half + length * .31, -width * .32);
    shape.lineTo(-half + length * .41, -width / 2);
    shape.lineTo(half - .035, -width / 2);
    shape.quadraticCurveTo(half, -width / 2, half, 0);
    shape.quadraticCurveTo(half, width / 2, half - .035, width / 2);
    shape.lineTo(-half + length * .41, width / 2);
    shape.lineTo(-half + length * .31, width * .32); shape.closePath();
    const bladeGeometry = new THREE.ExtrudeGeometry(shape, { depth: .045, bevelEnabled: true, bevelThickness: .008, bevelSize: .008, bevelSegments: 2, steps: 1 });
    bladeGeometry.rotateX(-Math.PI / 2);
    const blade = new THREE.Mesh(bladeGeometry, [willow, edge]); blade.name = 'Willow_Blade'; blade.castShadow = true; bat.add(blade);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.023, .023, length * .34, 12), rubber);
    handle.rotation.z = Math.PI / 2; handle.position.set(-half + length * .17, .018, 0); bat.add(handle);
    for (let i = 0; i < 12; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.024, .003, 4, 10), i % 4 === 0 ? gold : rubber);
      ring.rotation.y = Math.PI / 2; ring.position.set(-half + .02 + i * length * .024, .018, 0); bat.add(ring);
    }
    box('Brand_Plate', length * .41, .003, width * .76, length * .13, .055, 0, navy, bat);
    const brand = text('Game_Name', 'CRICKET PINBALL', .025, chalk, bat);
    brand.rotation.set(-Math.PI / 2, 0, side === 'right' ? Math.PI : 0);
    brand.position.set(length * .13, .058, side === 'right' ? -.009 : .009);
  }
  // Deck and rail vertices come directly from collision samples, including y=0
  // at the open mouth. No separate artist-maintained approximation can float.
  const route = table.ramps.find(r => r.id === 'six-ramp');
  const positions = [], indices = [];
  for (const p of route.points) positions.push(p.x - route.halfWidth, p.height, p.z, p.x + route.halfWidth, p.height, p.z);
  for (let i = 1; i < route.points.length; i++) { const j = i * 2; indices.push(j - 2, j - 1, j, j - 1, j + 1, j); }
  const deckGeometry = new THREE.BufferGeometry(); deckGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); deckGeometry.setIndex(indices); deckGeometry.computeVertexNormals();
  const deck = new THREE.Mesh(deckGeometry, steel); deck.name = 'Six_Continuous_Deck'; deck.receiveShadow = true; root.add(deck);
  const underside = deck.clone(); underside.name = 'Six_Deck_Underside'; underside.material = steel.clone(); underside.material.side = THREE.BackSide; underside.position.y = -.012; root.add(underside);
  for (const sign of [-1, 1]) {
    const points = route.points.map(p => new THREE.Vector3(p.x + sign * route.halfWidth, p.height + .025, p.z));
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 58, .008, 6, false), gold); rail.name = `Six_Continuous_Rail_${sign}`; root.add(rail);
  }
  // Restrained pavilion fascia: real model lettering, never an image of a UI.
  const title = text('Pavilion_Game_Name', 'CRICKET PINBALL', .10, chalk);
  title.position.set(0, .83, -2.90);
  root.updateMatrixWorld(true);
  const measuredPitch = new THREE.Box3().setFromObject(pitch).getSize(new THREE.Vector3());
  const deckVertices = deckGeometry.getAttribute('position');
  const parityError = Math.max(...route.points.map((p, i) => Math.max(
    Math.abs(deckVertices.getY(i * 2) - p.height), Math.abs(deckVertices.getZ(i * 2) - p.z),
    Math.abs((deckVertices.getX(i * 2) + deckVertices.getX(i * 2 + 1)) / 2 - p.x)
  )));
  const stats = {
    pitchLengthMetres: measuredPitch.z * STADIUM_PITCH.metresPerUnit,
    pitchWidthMetres: measuredPitch.x * STADIUM_PITCH.metresPerUnit,
    battingZ: STADIUM_PITCH.battingZ, bowlingZ: STADIUM_PITCH.bowlingZ,
    rampMouthHeight: deckVertices.getY(0), rampSurfaceParityError: parityError,
    rampUpwardNormals: Array.from({ length: deckVertices.count }, (_, i) => deckGeometry.getAttribute('normal').getY(i)).every(y => y > 0),
    brandedBats: 2,
    scope: 'Runtime geometry review; stadium architecture remains the earlier GLB.'
  };
  return { bats, stats, update(engine) {
    for (const side of ['left', 'right']) {
      const state = engine.flippers.get(side), cfg = state.config;
      bats[side].position.set(cfg.pivot[0] + Math.cos(state.angle) * cfg.length / 2, .065, cfg.pivot[1] - Math.sin(state.angle) * cfg.length / 2);
      bats[side].rotation.y = state.angle;
    }
  } };
}
