import * as THREE from 'three';

// Only distant scenery is replaced. Playfield, boundary, ramps, targets and
// foreground seating retain their GLB geometry and depth relationships.
export async function installStadiumBackdrop(scene, model, camera) {
  const texture = await new THREE.TextureLoader().loadAsync('/assets/cricket/world/stadium-pavilion-night-v1.webp');
  texture.colorSpace = THREE.SRGBColorSpace;
  const replaced = [];
  model.updateMatrixWorld(true);
  model.traverse(object => {
    if (/^(Pavilion_|R\d+_Pavilion_|R27_(Balcony|Balustrade|Gallery|Interior)_|R9_City|R10_SkyTower|R11_(Sky|Stand)|Canopy_|Floodlight_|R13_Flood)/.test(object.name)) replaced.push(object);
    else if (object.isMesh && /^(Crowd_Band|Seating_Terrace|Individual_Seats|Tier_Gold|R7_(Tier|Upper)|R9_Tier|R11_(Stand|Tier))/.test(object.name)) {
      // Retain near-side spectator geometry, replacing only its far arc.
      const original = object.geometry;
      const geometry = original.index ? original.toNonIndexed() : original.clone();
      const positions = geometry.getAttribute('position'), kept = [], point = new THREE.Vector3();
      for (let i = 0; i < positions.count; i += 3) {
        let z = 0;
        for (let j = 0; j < 3; j++) z += point.fromBufferAttribute(positions, i + j).applyMatrix4(object.matrixWorld).z;
        if (z / 3 >= -1.35) kept.push(i, i + 1, i + 2);
      }
      geometry.setIndex(kept); object.geometry = geometry;
    }
  });
  // Remove before static batching so the retired architecture cannot reappear.
  for (const object of replaced) object.removeFromParent();
  const material = new THREE.MeshBasicMaterial({ map: texture, depthWrite: false, toneMapped: false });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  plate.name = 'Pavilion_Backdrop'; plate.renderOrder = -1; plate.frustumCulled = false;
  camera.add(plate); scene.add(camera);
  function resize() {
    const distance = 40;
    const height = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const width = height * camera.aspect;
    // The photographed boundary sits at 66% of the image. Register it against
    // the actual far field on resize rather than letting a desktop stretch
    // move the pavilion down behind the scoring targets.
    camera.updateMatrixWorld(true);
    const boundary = new THREE.Vector3(0, 0, -2.2).project(camera);
    const artHeight = height * (1 - boundary.y) / 2 / .66;
    plate.scale.set(width, artHeight, 1);
    plate.position.set(0, height / 2 - artHeight / 2, -distance);
  }
  return { resize, replaced: replaced.length, asset: texture.image.src };
}
