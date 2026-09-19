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
    renderer,
    portraitAssets: themeConfig.assets.portraits
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

async function addBollywoodPlayfieldSkin({ root, textureLoader, renderer, portraitAssets }) {
  const backgroundTexture = makeBollywoodPlayfieldTexture(renderer);

  const playfield = new THREE.Mesh(
    new THREE.PlaneGeometry(3.18, 5.82),
    new THREE.MeshBasicMaterial({
      map: backgroundTexture,
      toneMapped: false,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4
    })
  );

  playfield.name = 'Bollywood_Playfield_Background';
  playfield.position.set(0, 0.586, 0.02);
  playfield.rotation.x = -Math.PI / 2;
  playfield.renderOrder = 2;
  root.add(playfield);

  const portraitLayout = [
    ['Shah_Rukh_Khan', -0.98, -1.78, 0.72, 1.02],
    ['Amitabh_Bachchan', 0.00, -2.02, 0.82, 1.18],
    ['Madhuri_Dixit', 0.98, -1.78, 0.72, 1.02],
    ['Salman_Khan', -1.04, 0.18, 0.62, 0.88],
    ['Sridevi', -0.34, 0.42, 0.62, 0.88],
    ['Raj_Kapoor', 0.34, 0.42, 0.62, 0.88],
    ['Rekha', 1.04, 0.18, 0.62, 0.88]
  ];

  await Promise.all(
    portraitLayout.map(async ([key, x, z, width, height]) => {
      const url = portraitAssets?.[key];
      if (!url) return;

      try {
        const texture = await textureLoader.loadAsync(url);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;

        const frame = new THREE.Mesh(
          new THREE.PlaneGeometry(width + 0.07, height + 0.07),
          new THREE.MeshBasicMaterial({
            color: 0xc39135,
            toneMapped: false,
            side: THREE.DoubleSide,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -6,
            polygonOffsetUnits: -6
          })
        );
        frame.position.set(x, 0.589, z);
        frame.rotation.x = -Math.PI / 2;
        frame.renderOrder = 4;
        frame.name = 'Bollywood_Frame_' + key;
        root.add(frame);

        const portrait = new THREE.Mesh(
          new THREE.PlaneGeometry(width, height),
          new THREE.MeshBasicMaterial({
            map: texture,
            color: 0xffffff,
            toneMapped: false,
            side: THREE.DoubleSide,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -8,
            polygonOffsetUnits: -8
          })
        );

        portrait.position.set(x, 0.591, z);
        portrait.rotation.x = -Math.PI / 2;
        portrait.renderOrder = 5;
        portrait.name = 'Bollywood_Playfield_' + key;
        root.add(portrait);
      } catch (error) {
        console.warn('Bollywood playfield portrait failed:', key, error);
      }
    })
  );
}

function makeBollywoodPlayfieldTexture(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1800;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#18070b');
  bg.addColorStop(0.48, '#090608');
  bg.addColorStop(1, '#030304');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(512, 410, 30, 512, 410, 540);
  glow.addColorStop(0, 'rgba(236,178,79,.34)');
  glow.addColorStop(0.36, 'rgba(155,47,35,.18)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, 1050);

  ctx.strokeStyle = '#b8862e';
  ctx.lineWidth = 14;
  ctx.strokeRect(32, 32, canvas.width - 64, canvas.height - 64);

  ctx.strokeStyle = 'rgba(229,191,116,.48)';
  ctx.lineWidth = 3;
  ctx.strokeRect(52, 52, canvas.width - 104, canvas.height - 104);

  // Stage-light rays.
  ctx.save();
  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = '#f1c66f';
  ctx.lineWidth = 6;
  for (let i = 0; i < 9; i += 1) {
    const x = 160 + i * 88;
    ctx.beginPath();
    ctx.moveTo(512, 170);
    ctx.lineTo(x, 1050);
    ctx.stroke();
  }
  ctx.restore();

  // Marquee title panel.
  roundRect2D(ctx, 175, 95, 674, 165, 28);
  ctx.fillStyle = '#080607';
  ctx.fill();
  ctx.strokeStyle = '#d0a34e';
  ctx.lineWidth = 7;
  ctx.stroke();

  ctx.fillStyle = '#f4d69a';
  ctx.textAlign = 'center';
  ctx.font = '800 58px Georgia, serif';
  ctx.fillText('BOLLYWOOD', 512, 165);

  ctx.fillStyle = '#c69a42';
  ctx.font = '800 34px Georgia, serif';
  ctx.fillText('LEGENDS', 512, 215);

  // Cinema ribbon near the flippers.
  roundRect2D(ctx, 235, 1415, 554, 96, 18);
  ctx.fillStyle = '#14090b';
  ctx.fill();
  ctx.strokeStyle = '#9d1b2a';
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = '#f0d49b';
  ctx.font = '800 28px ui-monospace, Menlo, monospace';
  ctx.fillText('INDIAN CINEMA', 512, 1475);

  // Film-reel / spotlight motifs.
  for (const [cx, cy] of [[125, 1280], [899, 1280]]) {
    ctx.strokeStyle = '#b8862e';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, 66, 0, Math.PI * 2);
    ctx.stroke();

    for (let a = 0; a < 5; a += 1) {
      const angle = -Math.PI / 2 + a * (Math.PI * 2 / 5);
      ctx.beginPath();
      ctx.arc(
        cx + Math.cos(angle) * 30,
        cy + Math.sin(angle) * 30,
        13,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  }

  ctx.fillStyle = 'rgba(243,221,173,.58)';
  ctx.font = '700 19px ui-monospace, Menlo, monospace';
  ctx.fillText('LIGHTS  •  CAMERA  •  PLAY', 512, 1680);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}

function roundRect2D(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

async function addBollywoodStarSkin({ root }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, '#130608');
  bg.addColorStop(0.5, '#050405');
  bg.addColorStop(1, '#130608');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#b8862e';
  ctx.lineWidth = 18;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.fillStyle = '#f1d8a1';
  ctx.textAlign = 'center';
  ctx.font = '800 88px Georgia, serif';
  ctx.fillText('BOLLYWOOD', 512, 215);

  ctx.fillStyle = '#c79b45';
  ctx.font = '800 54px Georgia, serif';
  ctx.fillText('LEGENDS', 512, 300);

  ctx.fillStyle = '#f0d49b';
  ctx.font = '700 24px ui-monospace, Menlo, monospace';
  ctx.fillText('INDIAN CINEMA', 512, 376);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const skin = new THREE.Mesh(
    new THREE.PlaneGeometry(2.94, 1.47),
    new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );

  skin.name = 'Bollywood_Marquee_Backglass';
  skin.position.set(0, 1.88, -3.20);
  skin.renderOrder = 20;
  root.add(skin);
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
