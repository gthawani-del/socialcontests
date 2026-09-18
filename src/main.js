import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import './style.css';

const canvas = document.querySelector('#game');
const status = document.querySelector('#status');
const resetViewButton = document.querySelector('#resetView');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.14;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04070d);
scene.fog = new THREE.FogExp2(0x04070d, 0.016);

const camera = new THREE.PerspectiveCamera(
  41,
  window.innerWidth / window.innerHeight,
  0.01,
  100
);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minPolarAngle = THREE.MathUtils.degToRad(34);
controls.maxPolarAngle = THREE.MathUtils.degToRad(72);
controls.minAzimuthAngle = THREE.MathUtils.degToRad(-24);
controls.maxAzimuthAngle = THREE.MathUtils.degToRad(24);

const hemi = new THREE.HemisphereLight(0xc7dcff, 0x17100b, 1.9);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffdfbc, 4.2);
key.position.set(-3.3, 5.3, 7.4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
scene.add(key);

const rim = new THREE.PointLight(0x3588ff, 18, 14, 2);
rim.position.set(3.8, 2.8, 3.5);
scene.add(rim);

const warm = new THREE.PointLight(0xff8a2b, 14, 12, 2);
warm.position.set(-3.2, -1.8, 2.6);
scene.add(warm);

const lowerFill = new THREE.PointLight(0x8fb5ff, 17, 10, 2);
lowerFill.position.set(0, 3.0, 2.3);
scene.add(lowerFill);

const lowerWarm = new THREE.PointLight(0xffc08a, 8, 7, 2);
lowerWarm.position.set(0, 1.4, 3.8);
scene.add(lowerWarm);

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const clock = new THREE.Clock();

let mixer = null;
let modelRoot = null;
const modelSize = new THREE.Vector3();

const PARIS = {
  navy: '#07162e',
  navy2: '#0b2343',
  gold: '#e5ad43',
  warmGold: '#f4cf7a',
  cream: '#f6ead0',
  red: '#b43732',
  blue: '#3a69a7',
  ink: '#111522'
};

function makeCanvasTexture(width, height, draw) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function drawEiffel(ctx, cx, baseY, h, color, lineWidth = 10) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const topY = baseY - h;
  const midY = baseY - h * 0.45;
  const shoulderY = baseY - h * 0.18;
  const halfBase = h * 0.28;
  const halfMid = h * 0.09;

  ctx.beginPath();
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx - halfMid, midY);
  ctx.lineTo(cx - halfBase, baseY);
  ctx.moveTo(cx, topY);
  ctx.lineTo(cx + halfMid, midY);
  ctx.lineTo(cx + halfBase, baseY);
  ctx.moveTo(cx - halfBase * 0.76, shoulderY);
  ctx.quadraticCurveTo(cx, shoulderY - h * 0.10, cx + halfBase * 0.76, shoulderY);
  ctx.moveTo(cx - halfMid, midY);
  ctx.lineTo(cx + halfMid, midY);
  ctx.moveTo(cx - halfBase * 0.42, baseY - h * 0.08);
  ctx.lineTo(cx + halfBase * 0.42, baseY - h * 0.08);
  ctx.stroke();
  ctx.restore();
}

function createParisPlayfieldTexture() {
  return makeCanvasTexture(1024, 1792, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#071326');
    bg.addColorStop(0.55, PARIS.navy2);
    bg.addColorStop(1, '#061426');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Fine premium paper/map texture.
    ctx.globalAlpha = 0.10;
    for (let y = 0; y < h; y += 28) {
      ctx.fillStyle = y % 56 === 0 ? '#f2d28b' : '#8db6df';
      ctx.fillRect(0, y, w, 1);
    }
    ctx.globalAlpha = 1;

    // Stylised Seine.
    ctx.strokeStyle = '#234d78';
    ctx.lineWidth = 92;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.moveTo(-80, h * 0.72);
    ctx.bezierCurveTo(w * 0.18, h * 0.61, w * 0.33, h * 0.82, w * 0.54, h * 0.69);
    ctx.bezierCurveTo(w * 0.72, h * 0.58, w * 0.83, h * 0.76, w + 70, h * 0.65);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Metro / boulevard route network.
    ctx.lineWidth = 5;
    const routes = [
      [PARIS.red, [[80, 210], [280, 370], [440, 600], [700, 810], [920, 1040]]],
      [PARIS.gold, [[945, 160], [760, 330], [660, 540], [480, 810], [180, 1110]]],
      [PARIS.blue, [[95, 1240], [270, 1030], [520, 970], [710, 1120], [930, 1390]]],
      ['#d8d1ba', [[120, 530], [350, 520], [570, 390], [865, 430]]]
    ];
    for (const [color, pts] of routes) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Landmark hero motif.
    drawEiffel(ctx, w / 2, h * 0.70, 650, PARIS.gold, 16);

    // Arc / bridge motifs.
    ctx.strokeStyle = PARIS.warmGold;
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(w * 0.20, h * 0.28, 90, Math.PI, 0);
    ctx.moveTo(w * 0.11, h * 0.28);
    ctx.lineTo(w * 0.29, h * 0.28);
    ctx.arc(w * 0.80, h * 0.31, 82, Math.PI, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Center labels.
    ctx.textAlign = 'center';
    ctx.fillStyle = PARIS.cream;
    ctx.font = '700 58px Georgia, serif';
    ctx.fillText('PARIS', w / 2, h * 0.84);

    ctx.fillStyle = PARIS.gold;
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.letterSpacing = '8px';
    ctx.fillText('CITY OF LIGHTS', w / 2, h * 0.865);

    ctx.fillStyle = PARIS.cream;
    ctx.font = '600 22px Georgia, serif';
    ctx.fillText('RIVE GAUCHE', w * 0.22, h * 0.74);
    ctx.fillText('RIVE DROITE', w * 0.78, h * 0.74);

    // Decorative fleur-de-lis / dots.
    ctx.fillStyle = PARIS.gold;
    for (const [x, y] of [[120, 150], [904, 150], [120, 1580], [904, 1580]]) {
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bottom gold pinstripe.
    ctx.strokeStyle = PARIS.gold;
    ctx.lineWidth = 5;
    ctx.strokeRect(34, 34, w - 68, h - 68);
  });
}

function createRoundLabelTexture(title, subtitle, accent) {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w/2, h/2, 30, w/2, h/2, w/2);
    g.addColorStop(0, '#173154');
    g.addColorStop(1, '#071426');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(w/2, h/2, w*0.46, 0, Math.PI*2);
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.arc(w/2, h/2, w*0.40, 0, Math.PI*2);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = PARIS.cream;
    ctx.font = '700 82px Georgia, serif';
    ctx.fillText(title, w/2, h*0.48);
    ctx.fillStyle = accent;
    ctx.font = '700 32px system-ui, sans-serif';
    ctx.fillText(subtitle, w/2, h*0.66);
  });
}

function createHeroTexture() {
  return makeCanvasTexture(700, 1050, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(w/2, h*0.5, 20, w/2, h*0.5, w*0.42);
    glow.addColorStop(0, 'rgba(244,207,122,0.32)');
    glow.addColorStop(1, 'rgba(244,207,122,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    drawEiffel(ctx, w/2, h*0.82, h*0.72, PARIS.gold, 24);

    ctx.textAlign = 'center';
    ctx.fillStyle = PARIS.cream;
    ctx.font = '700 82px Georgia, serif';
    ctx.fillText('PARIS', w/2, h*0.94);
  });
}

function createBackdropTexture() {
  return makeCanvasTexture(1200, 460, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#071123');
    g.addColorStop(1, '#10294a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Moon.
    ctx.fillStyle = '#f5dca1';
    ctx.beginPath();
    ctx.arc(w*0.18, h*0.28, 52, 0, Math.PI*2);
    ctx.fill();

    // Skyline silhouette.
    ctx.fillStyle = '#02060d';
    const heights = [0.42,0.50,0.38,0.62,0.46,0.54,0.40,0.70,0.48,0.58,0.43,0.64,0.49,0.55,0.39];
    const bw = w / heights.length;
    heights.forEach((p,i) => {
      const bh = h*p;
      ctx.fillRect(i*bw, h-bh, bw+3, bh);
      if (i%3===0) {
        ctx.beginPath();
        ctx.moveTo(i*bw+bw*0.35,h-bh);
        ctx.lineTo(i*bw+bw*0.5,h-bh-52);
        ctx.lineTo(i*bw+bw*0.65,h-bh);
        ctx.fill();
      }
    });

    // Warm windows.
    ctx.fillStyle = '#e7a94c';
    ctx.globalAlpha = 0.78;
    for(let x=24; x<w; x+=46) {
      for(let y=h*0.60; y<h-20; y+=38) {
        if ((x+y)%3 < 1.7) ctx.fillRect(x,y,7,12);
      }
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.fillStyle = PARIS.cream;
    ctx.font = '700 72px Georgia, serif';
    ctx.fillText('PARIS NIGHTS', w/2, 92);
  });
}

function planeFromTexture(texture, width, height, position, rotation = [0,0,0], opacity = 1) {
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.renderOrder = 4;
  return mesh;
}

function applyParisTheme(root) {
  // 1) Main playfield decal layer — preserves the neutral V4 geometry.
  const playfield = planeFromTexture(
    createParisPlayfieldTexture(),
    3.24,
    5.85,
    [0, 0.575, 0.02],
    [-Math.PI / 2, 0, 0],
    0.96
  );
  playfield.name = 'Paris_Playfield_Decal';
  root.add(playfield);

  // 2) Bumper face graphics.
  const bumperDefs = [
    { name:'Paris_Bumper_Metro', pos:[-0.72, 1.045, -0.35], tex:createRoundLabelTexture('M', 'MÉTRO', PARIS.red) },
    { name:'Paris_Bumper_Paris', pos:[0, 1.045, -1.18], tex:createRoundLabelTexture('✦', 'PARIS', PARIS.gold) },
    { name:'Paris_Bumper_Cafe', pos:[0.70, 1.045, -0.40], tex:createRoundLabelTexture('☕', 'CAFÉ', PARIS.gold) }
  ];
  bumperDefs.forEach((b) => {
    const disk = planeFromTexture(b.tex, 0.43, 0.43, b.pos, [-Math.PI/2,0,0], 0.98);
    disk.name = b.name;
    root.add(disk);
  });

  // 3) Eiffel hero centerpiece as an actual scene element.
  const hero = planeFromTexture(
    createHeroTexture(),
    0.82,
    1.24,
    [0, 1.48, -2.76],
    [0,0,0],
    1
  );
  hero.name = 'Paris_Hero_Eiffel';
  root.add(hero);

  // 4) Backdrop / skyline layer.
  const backdrop = planeFromTexture(
    createBackdropTexture(),
    3.2,
    1.23,
    [0, 1.56, -3.17],
    [0,0,0],
    0.98
  );
  backdrop.name = 'Paris_Backdrop';
  root.add(backdrop);

  // 5) Warm the V4 neutral mechanical accents so the theme reads as one system.
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];

    if (/Flipper_Left|Flipper_Right/.test(obj.name)) {
      mats.forEach(m => {
        if ('color' in m) m.color.set('#e3ad45');
        m.metalness = 0.72;
        m.roughness = 0.18;
      });
    }

    if (/Jackpot_Ring/.test(obj.name)) {
      mats.forEach(m => {
        if ('color' in m) m.color.set('#e5ad43');
        if ('emissive' in m) m.emissive.set('#8a4d0a');
        m.emissiveIntensity = 1.2;
      });
    }

    if (/Bumper_.*_Ring/.test(obj.name)) {
      mats.forEach(m => {
        if ('emissiveIntensity' in m) m.emissiveIntensity = 1.45;
      });
    }
  });

  // Theme-specific accent lights.
  const parisGold = new THREE.PointLight(0xffb34d, 9, 7, 2);
  parisGold.position.set(0, 2.2, -2.3);
  root.add(parisGold);

  const parisBlue = new THREE.PointLight(0x315aa0, 6, 8, 2);
  parisBlue.position.set(-1.2, 1.6, -0.4);
  root.add(parisBlue);
}

function applyHeroView() {
  if (!modelRoot) return;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;
  const isPortrait = aspect < 0.82;
  const isWide = aspect > 1.35;

  const tableLength = Math.max(modelSize.z, modelSize.x * 1.55);
  const tableHeight = modelSize.y;

  camera.aspect = aspect;
  camera.fov = isPortrait ? 43 : isWide ? 40 : 41;
  camera.updateProjectionMatrix();

  const target = new THREE.Vector3(
    0,
    Math.max(tableHeight * 0.38, 0.52),
    isPortrait ? 0.10 : 0.06
  );

  if (isPortrait) {
    camera.position.set(0, tableLength * 0.84, tableLength * 1.00);
  } else if (isWide) {
    camera.position.set(0, tableLength * 0.52, tableLength * 0.84);
  } else {
    camera.position.set(0, tableLength * 0.64, tableLength * 0.94);
  }

  controls.target.copy(target);
  controls.minDistance = tableLength * (isPortrait ? 0.78 : 0.70);
  controls.maxDistance = tableLength * 1.75;
  controls.update();
}

loader.load(
  '/models/infinite-pinball-base-v4.glb',
  (gltf) => {
    modelRoot = gltf.scene;

    modelRoot.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(modelRoot);
    const center = box.getCenter(new THREE.Vector3());
    box.getSize(modelSize);

    modelRoot.position.sub(center);
    modelRoot.position.y += modelSize.y * 0.5;

    applyParisTheme(modelRoot);

    scene.add(modelRoot);

    applyHeroView();

    if (gltf.animations?.length) {
      mixer = new THREE.AnimationMixer(modelRoot);
      gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
    }

    status.textContent = 'PARIS THEME · LIVE';
    status.classList.add('ready');
    resetViewButton.disabled = false;
  },
  (progress) => {
    if (progress.total) {
      const pct = Math.round((progress.loaded / progress.total) * 100);
      status.textContent = `Loading Paris · ${pct}%`;
    }
  },
  (error) => {
    console.error(error);
    status.textContent = 'Paris theme failed to load';
    status.classList.add('error');
  }
);

resetViewButton.addEventListener('click', applyHeroView);

let resizeFrame = null;

function resize() {
  if (resizeFrame) cancelAnimationFrame(resizeFrame);

  resizeFrame = requestAnimationFrame(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    if (modelRoot) applyHeroView();
  });
}

window.addEventListener('resize', resize, { passive: true });
window.addEventListener('orientationchange', resize, { passive: true });

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);

  controls.update();
  renderer.render(scene, camera);
}

animate();
