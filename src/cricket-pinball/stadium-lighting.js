import * as THREE from 'three';

// One restrained night rig. Existing GLB fixtures supply the visible sources;
// the field light casts shadows, while the small architectural fills do not.
export function lightStadium(scene, model) {
  model.traverse(object => { if (object.isLight) object.visible = false; });
  scene.add(new THREE.HemisphereLight(0x93b7e8, 0x253522, .72));
  const field = new THREE.DirectionalLight(0xfff2dc, 2.3);
  field.position.set(-3, 6, -1); field.castShadow = true;
  field.shadow.mapSize.set(1024, 1024);
  Object.assign(field.shadow.camera, { left: -4, right: 4, top: 5, bottom: -5, near: .1, far: 20 });
  field.shadow.normalBias = .008; field.shadow.bias = -.0001;
  scene.add(field);
  const fill = new THREE.DirectionalLight(0xb9d2f2, 1.0);
  fill.position.set(3, 3, 2); scene.add(fill);
  const fixtures = [
    { id: 'pavilion-lower', position: [0, .43, -2.94], intensity: .35, reach: 1.1 },
    { id: 'pavilion-upper', position: [0, .79, -2.94], intensity: .35, reach: 1.1 },
    { id: 'single', position: [-.6075, .12, .02], intensity: .07, reach: .65 },
    { id: 'double', position: [.6075, .12, .02], intensity: .07, reach: .65 },
    { id: 'straight-four', position: [0, .16, -1.4], intensity: .09, reach: .8 }
  ];
  for (const fixture of fixtures) {
    const lamp = new THREE.PointLight(0xffb957, fixture.intensity, fixture.reach, 2);
    lamp.name = fixture.id; lamp.position.set(...fixture.position); scene.add(lamp);
  }
  return { shadowLights: 1, architecturalLights: fixtures.length, fixtures };
}
