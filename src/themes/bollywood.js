import * as THREE from 'three';

const PORTRAIT_SLOTS = Object.freeze({
  Amitabh_Bachchan: 'Portrait_Amitabh_Bachchan',
  Shah_Rukh_Khan: 'Portrait_Shah_Rukh_Khan',
  Madhuri_Dixit: 'Portrait_Madhuri_Dixit',
  Sridevi: 'Portrait_Sridevi',
  Raj_Kapoor: 'Portrait_Raj_Kapoor',
  Rekha: 'Portrait_Rekha',
  Salman_Khan: 'Portrait_Salman_Khan'
});

export async function applyBollywoodGraphics({
  root,
  loader,
  textureLoader,
  renderer,
  themeConfig,
  tableConfig,
  createThemeTargetBank
}) {
  const { environment, fromGlb } = await loadBollywoodEnvironment({
    loader,
    themeConfig
  });

  placeEnvironment(environment);
  root.add(environment);

  await addBollywoodPlayfieldSkin({
    root,
    textureLoader,
    renderer
  });

  await addBollywoodStarSkin({
    root,
    textureLoader,
    renderer
  });

  const portraitResults = await applyPortraits({
    environment,
    portraitAssets: themeConfig.assets.portraits,
    textureLoader,
    renderer,
    fromGlb
  });

  if (typeof createThemeTargetBank === 'function') {
    createThemeTargetBank(
      root,
      tableConfig.targets,
      themeConfig.targetLabels,
      {
        frame: '#12080b',
        border: '#b8862e',
        firstFill: '#f1d8a1',
        secondFill: '#f4e4c0',
        firstBg: '#54101a',
        secondBg: '#241014'
      }
    );
  }

  tintMechanicals(root);
  addBollywoodLighting(root);

  console.info('Bollywood portrait mapping', {
    environment: fromGlb ? 'glb' : 'runtime-fallback',
    mapped: portraitResults.mapped,
    failed: portraitResults.failed
  });
}

async function loadEnvironmentAsset(loader, url) {
  if (!url.endsWith('.gz')) return loader.loadAsync(url);

  if (!('DecompressionStream' in window)) {
    throw new Error('This browser cannot decompress the Bollywood GLB asset.');
  }

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error('Bollywood GLB request failed: ' + response.status);
  }

  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  const arrayBuffer = await new Response(stream).arrayBuffer();
  return loader.parseAsync(arrayBuffer, '');
}

async function loadBollywoodEnvironment({ loader, themeConfig }) {
  try {
    const gltf = await loadEnvironmentAsset(loader, themeConfig.assets.environment);
    const environment = gltf.scene;
    environment.name = 'Bollywood_Legends_Environment';

    const removals = [];
    environment.traverse((object) => {
      if (object.isCamera || object.isLight) removals.push(object);
      if (object.isMesh) {
        object.castShadow = false;
        object.receiveShadow = true;
      }
    });
    removals.forEach((object) => object.parent?.remove(object));

    return { environment, fromGlb: true };
  } catch (error) {
    console.warn(
      'Bollywood GLB unavailable; using lightweight runtime backglass until the asset is uploaded.',
      error
    );

    return {
      environment: createFallbackEnvironment(),
      fromGlb: false
    };
  }
}

function placeEnvironment(environment) {
  environment.updateMatrixWorld(true);

  let box = new THREE.Box3().setFromObject(environment);
  const size = box.getSize(new THREE.Vector3());

  if (size.x > 0.001) {
    const scale = 3.25 / size.x;
    environment.scale.multiplyScalar(scale);
  }

  environment.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(environment);
  const center = box.getCenter(new THREE.Vector3());

  environment.position.x += -center.x;
  environment.position.y += 0.56 - box.min.y;
  environment.position.z += -3.28 - box.max.z;
  environment.updateMatrixWorld(true);
}

async function addBollywoodPlayfieldSkin({ root, textureLoader, renderer }) {
  try {
    const texture = await textureLoader.loadAsync('/themes/bollywood/bollywood-legends-skin.webp');
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    // The source artwork is a 2:3 poster. Crop it to the pinball playfield
    // aspect ratio instead of stretching celebrity faces.
    texture.repeat.set(0.819, 1);
    texture.offset.set(0.0905, 0);
    texture.needsUpdate = true;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: 0xb9a89a,
      toneMapped: false,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4
    });

    const playfield = new THREE.Mesh(
      new THREE.PlaneGeometry(3.18, 5.82),
      material
    );

    playfield.name = 'Bollywood_Stars_Playfield';
    playfield.position.set(0, 0.586, 0.02);
    playfield.rotation.x = -Math.PI / 2;
    playfield.renderOrder = 3;
    root.add(playfield);
  } catch (error) {
    console.warn('Bollywood playfield skin failed to load.', error);
  }
}

async function addBollywoodStarSkin({ root, textureLoader, renderer }) {
  try {
    const texture = await textureLoader.loadAsync('/themes/bollywood/bollywood-legends-skin.webp');
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const skin = new THREE.Mesh(
      new THREE.PlaneGeometry(2.94, 4.41),
      material
    );
    skin.name = 'Bollywood_Stars_Skin';
    skin.position.set(0, 2.78, -3.22);
    skin.renderOrder = 50;
    root.add(skin);
  } catch (error) {
    console.warn('Bollywood star skin failed to load.', error);
  }
}

async function applyPortraits({
  environment,
  portraitAssets,
  textureLoader,
  renderer,
  fromGlb
}) {
  const mapped = [];
  const failed = [];

  await Promise.all(
    Object.entries(PORTRAIT_SLOTS).map(async ([key, meshName]) => {
      const slot = environment.getObjectByName(meshName);
      const url = portraitAssets?.[key];

      if (!slot || !slot.isMesh || !url) {
        failed.push(key);
        return;
      }

      try {
        const texture = await textureLoader.loadAsync(url);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(
          8,
          renderer.capabilities.getMaxAnisotropy()
        );
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.flipY = !fromGlb;
        texture.needsUpdate = true;

        disposeMaterial(slot.material);
        slot.material = new THREE.MeshBasicMaterial({
          map: texture,
          color: 0xffffff,
          toneMapped: false
        });
        slot.material.needsUpdate = true;
        slot.renderOrder = 10;
        mapped.push(key);
      } catch (error) {
        failed.push(key);
        console.warn('Bollywood portrait failed to load:', key, error);
      }
    })
  );

  return { mapped, failed };
}

function createFallbackEnvironment() {
  const group = new THREE.Group();
  group.name = 'Bollywood_Runtime_Fallback';

  const black = new THREE.MeshStandardMaterial({
    color: 0x090709,
    metalness: 0.35,
    roughness: 0.28
  });
  const red = new THREE.MeshStandardMaterial({
    color: 0x4b0a13,
    metalness: 0.2,
    roughness: 0.42
  });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xb8862e,
    metalness: 0.85,
    roughness: 0.22
  });

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(3.25, 4.55, 0.10),
    black
  );
  board.position.y = 2.35;
  group.add(board);

  const sideLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 4.25, 0.08),
    red
  );
  sideLeft.position.set(-1.46, 2.35, 0.08);
  group.add(sideLeft);

  const sideRight = sideLeft.clone();
  sideRight.position.x = 1.46;
  group.add(sideRight);

  const title = makeLabelPlane('BOLLYWOOD\nLEGENDS', 2.72, 0.58, 54);
  title.position.set(0, 4.27, 0.09);
  group.add(title);

  const footer = makeLabelPlane('INDIAN CINEMA', 2.4, 0.38, 38);
  footer.position.set(0, 0.30, 0.09);
  group.add(footer);

  addPortraitFrame(group, 'Portrait_Amitabh_Bachchan', 0, 2.66, 0.94, 1.34, gold);

  [
    ['Portrait_Raj_Kapoor', -1.03, 3.28],
    ['Portrait_Madhuri_Dixit', -1.03, 2.13],
    ['Portrait_Rekha', -1.03, 0.98],
    ['Portrait_Shah_Rukh_Khan', 1.03, 3.28],
    ['Portrait_Sridevi', 1.03, 2.13],
    ['Portrait_Salman_Khan', 1.03, 0.98]
  ].forEach(([name, x, y]) => {
    addPortraitFrame(group, name, x, y, 0.64, 0.92, gold);
  });

  for (const x of [-1.50, 1.50]) {
    for (let y = 0.55; y <= 4.10; y += 0.42) {
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.032, 10, 6),
        new THREE.MeshBasicMaterial({ color: 0xffb14a, toneMapped: false })
      );
      bulb.position.set(x, y, 0.15);
      group.add(bulb);
    }
  }

  return group;
}

function addPortraitFrame(group, name, x, y, width, height, goldMaterial) {
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.09, height + 0.09, 0.07),
    goldMaterial
  );
  frame.position.set(x, y, 0.08);
  group.add(frame);

  const slot = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      color: 0x170d10,
      toneMapped: false
    })
  );
  slot.name = name;
  slot.position.set(x, y, 0.125);
  group.add(slot);
}

function makeLabelPlane(text, width, height, fontSize) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#090709';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#b8862e';
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.fillStyle = '#f1d8a1';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 ' + fontSize + 'px Georgia, serif';

  const lines = text.split('\n');
  lines.forEach((line, index) => {
    const offset = (index - (lines.length - 1) / 2) * (fontSize + 12);
    ctx.fillText(line, canvas.width / 2, canvas.height / 2 + offset);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: false,
      toneMapped: false
    })
  );
}

function tintMechanicals(root) {
  root.traverse((object) => {
    if (!object.isMesh || !object.material) return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    if (/Flipper_Left|Flipper_Right/.test(object.name)) {
      materials.forEach((material) => {
        if (material.color) material.color.set('#b8862e');
        if ('metalness' in material) material.metalness = 0.76;
        if ('roughness' in material) material.roughness = 0.22;
      });
    }

    if (/Jackpot_Ring/.test(object.name)) {
      materials.forEach((material) => {
        if (material.color) material.color.set('#9e2635');
        if (material.emissive) material.emissive.set('#5b0711');
        if ('emissiveIntensity' in material) material.emissiveIntensity = 1.3;
      });
    }
  });
}

function addBollywoodLighting(root) {
  const gold = new THREE.PointLight(0xf0b75d, 10, 7, 2);
  gold.position.set(0, 2.45, -2.72);
  root.add(gold);

  const redLeft = new THREE.PointLight(0xa41428, 6, 6, 2);
  redLeft.position.set(-1.35, 1.8, -2.45);
  root.add(redLeft);

  const redRight = redLeft.clone();
  redRight.position.x = 1.35;
  root.add(redRight);
}

function disposeMaterial(material) {
  const materials = Array.isArray(material) ? material : [material];
  materials.filter(Boolean).forEach((item) => {
    if (item.map) item.map.dispose();
    item.dispose?.();
  });
}
