import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const PATH = "/models/football/";
const assetNames = [
  "boot",
  "football",
  "goal",
  "player-bumper",
  "keeper",
  "round-target",
  "triangle-target",
  "stadium-tier",
  "ramp",
  "field",
  "rail",
  "coin",
];
const colors = {
  blue: "#3277bf",
  red: "#bb424b",
  gold: "#caad65",
  green: "#659b7d",
};

export async function createMatchView(container, mode) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor("#0d1821");
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
  const ambient = new THREE.HemisphereLight(0xe1efff, 0x263e32, 2);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xfff0d9, 3);
  key.position.set(-5, 10, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbdd8ff, 1);
  fill.position.set(5, 6, -5);
  scene.add(fill);
  const bounds = new Map();
  function cleanAsset(root) {
    const remove = [];
    root.traverse((o) => {
      if (o.isLight || o.isCamera || /^(CAM_|LGT_)/.test(o.name))
        remove.push(o);
    });
    remove.forEach((o) => o.removeFromParent());
    return root;
  }
  function measure(name, root) {
    const box = new THREE.Box3().setFromObject(root, true);
    bounds.set(name, {
      min: box.min.clone(),
      size: box.getSize(new THREE.Vector3()),
    });
  }
  const models = new Map(),
    failedAssets = [],
    instances = new Map();
  const loader = new GLTFLoader();
  // Assets are individually loaded and independently replaceable. Gameplay never depends on GLB success.
  await Promise.all(
    assetNames.map(async (name) => {
      try {
        const gltf = await loader.loadAsync(`${PATH}${name}.glb`);
        const root = cleanAsset(gltf.scene);
        measure(name, root);
        models.set(name, root);
      } catch {
        failedAssets.push(name);
      }
    }),
  );
  const materials = new Map();
  function mat(color, metalness = 0) {
    const key = `${color}-${metalness}`;
    if (!materials.has(key))
      materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness: metalness ? 0.38 : 0.78,
          metalness,
        }),
      );
    return materials.get(key);
  }
  function mesh(geometry, color, parent = scene) {
    const m = new THREE.Mesh(geometry, mat(color));
    parent.add(m);
    return m;
  }
  function model(name, team, parent = scene) {
    const asset = models.get(name);
    if (!asset) return null;
    const clone = asset.clone(true);
    clone.traverse((o) => {
      if (o.isMesh) {
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
      }
    });
    tint(clone, team);
    clone.userData.assetName = name;
    clone.userData.team = team;
    if (!instances.has(name)) instances.set(name, new Set());
    instances.get(name).add(clone);
    parent.add(clone);
    return clone;
  }
  function tint(root, team) {
    if (!team) return;
    root.traverse((o) => {
      if (o.isMesh)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          if (/Team_Primary/i.test(m.name)) m.color.set(colors[team] || team);
      if (o.userData.assetName) o.userData.team = team;
    });
    root.userData.team = team;
  }
  function fit(root, width, height, depth) {
    const b = bounds.get(root.userData.assetName);
    if (!b) return;
    root.scale.set(width / b.size.x, height / b.size.y, depth / b.size.z);
    root.position.y = -b.min.y * root.scale.y;
  }
  const coinAnchor = new THREE.Group();
  scene.add(coinAnchor);
  coinAnchor.visible = false;
  const coin = model("coin", null, coinAnchor);
  if (coin) {
    coin.scale.setScalar(2.6);
    coin.position.y = -0.052;
  }
  let tossStart = null,
    tossToken = null,
    coinFace = null;
  let fieldModel = null;
  if (models.has("field")) fieldModel = model("field");
  else {
    const field = mesh(new THREE.BoxGeometry(6.4, 0.18, 11.65), "#183e30");
    field.position.y = -0.13;
    for (let i = 0; i < 10; i += 2) {
      const stripe = mesh(new THREE.BoxGeometry(6, 0.009, 1), "#214b39");
      stripe.position.set(0, -0.032, i - 4.5);
    }
  }
  const lineMaterial = new THREE.LineBasicMaterial({
    color: "#93aa95",
    transparent: true,
    opacity: 0.75,
  });
  function line(points) {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(([x, y]) => new THREE.Vector3(x, 0.005, -y)),
    );
    scene.add(new THREE.Line(geometry, lineMaterial));
  }
  if (!models.has("field")) {
    line([
      [-2.8, -4.8],
      [-2.8, 4.8],
      [2.8, 4.8],
      [2.8, -4.8],
      [-2.8, -4.8],
    ]);
    line([
      [-2.8, 0],
      [2.8, 0],
    ]);
    line(
      Array.from({ length: 65 }, (_, i) => [
        0.82 * Math.cos((i / 64) * Math.PI * 2),
        0.82 * Math.sin((i / 64) * Math.PI * 2),
      ]),
    );
  }
  const bootMeshes = new Map(),
    ballMeshes = new Map(),
    targetMeshes = new Map(),
    keeperMeshes = new Map(),
    labels = new Map();
  const labelLayer = document.createElement("div");
  labelLayer.className = "fp-target-labels";
  labelLayer.setAttribute("aria-hidden", "true");
  container.append(labelLayer);
  let built = false,
    latest,
    disposed = false,
    viewTeam = "blue";
  let quality = "auto",
    reduced = false,
    lastDraw = performance.now(),
    slowFrames = 0;
  function applyQuality(low) {
    reduced = low;
    renderer.setPixelRatio(low ? 0.75 : Math.min(devicePixelRatio, 1.5));
    for (const tier of instances.get("stadium-tier") || []) tier.visible = !low;
    resize();
  }
  function resize() {
    const width = container.clientWidth,
      height = container.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    const centerY = latest?.geometry.fieldCenterY || 0;
    const distance = Math.max(
      mode === "penalty" ? 16 : 18,
      (mode === "penalty" ? 7.5 : 9) / camera.aspect,
    );
    camera.position.set(
      0,
      distance,
      -centerY + distance * 0.32 * (viewTeam === "red" ? -1 : 1),
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, -centerY);
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  function setup(s) {
    if (mode === "penalty" && fieldModel) {
      const b = bounds.get("field");
      fieldModel.scale.set(
        (s.geometry.halfWidth * 2 + 0.4) / b.size.x,
        1,
        (s.geometry.fieldLength + 1) / b.size.z,
      );
      fieldModel.position.z = -(s.geometry.fieldCenterY + 0.3);
    }
    resize();
    for (const rail of s.geometry.rails) {
      const m = model(
        "rail",
        mode === "pvp"
          ? "blue"
          : mode === "crash"
            ? "gold"
            : mode === "penalty"
              ? "red"
              : "green",
      );
      if (m) {
        fit(m, rail.hx * 2, rail.height || 0.45, rail.hy * 2);
        m.position.x = rail.x;
        m.position.z = -rail.y;
      } else {
        const box = mesh(
          new THREE.BoxGeometry(rail.hx * 2, rail.height || 0.45, rail.hy * 2),
          "#5c6871",
        );
        box.position.set(rail.x, (rail.height || 0.45) / 2, -rail.y);
      }
    }
    const signs = mode === "pvp" ? [-1, 1] : [1];
    for (const sign of signs) {
      const goal = model("goal", sign > 0 ? "red" : "blue");
      if (goal) {
        goal.position.set(0, 0, -sign * s.geometry.goalPlane);
        if (sign > 0) goal.rotation.y = Math.PI;
      } else {
        const bar = mesh(
          new THREE.BoxGeometry(s.geometry.goalHalfWidth * 2, 0.07, 0.07),
          "#e0e4de",
        );
        bar.position.set(
          0,
          s.geometry.goalHeight || 1.2,
          -sign * s.geometry.goalPlane,
        );
      }
      line([
        [-1.7, sign * 4.95],
        [-1.7, sign * 3.95],
        [1.7, sign * 3.95],
        [1.7, sign * 4.95],
      ]);
    }
    for (const x of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const tier = model("stadium-tier");
        if (tier) {
          tier.position.set(
            x * (mode === "penalty" ? 3.1 : 3.8),
            0,
            -3.8 + i * 2.5,
          );
          tier.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
          tier.scale.setScalar(0.6);
        }
      }
    }
    if (s.geometry.ramps)
      for (const ramp of s.geometry.ramps) {
        const r = model("ramp");
        if (r) {
          r.position.set(ramp.x, 0, -ramp.y);
          /* Authored curved deck: +Z entry to -Z exit; collider shares its profile. */ r.rotation.set(
            0,
            0,
            0,
          );
        }
      }
    built = true;
  }
  function draw(s) {
    if (disposed || !s) return;
    latest = s;
    if (!built) setup(s);
    for (const boot of s.boots) {
      let m = bootMeshes.get(boot.id);
      if (!m) {
        m = new THREE.Group();
        scene.add(m);
        if (!model("boot", boot.team, m)) {
          const proxy = mesh(
            new THREE.CapsuleGeometry(
              boot.radius || 0.16,
              boot.length - 0.32,
              4,
              12,
            ),
            colors[boot.team],
            m,
          );
          proxy.rotation.z = -Math.PI / 2;
          proxy.position.x = boot.length / 2;
        }
        bootMeshes.set(boot.id, m);
      }
      m.position.set(boot.x, (boot.height || 0) + 0.075, -boot.y);
      m.rotation.y = boot.angle;
      if (m.userData.team !== boot.team) tint(m, boot.team);
    }
    const live = new Set();
    for (const ball of s.balls) {
      live.add(ball.id);
      let m = ballMeshes.get(ball.id);
      if (!m) {
        m =
          model("football") ||
          mesh(
            new THREE.SphereGeometry(ball.radius || 0.13, 16, 12),
            "#f5f2de",
          );
        ballMeshes.set(ball.id, m);
      }
      m.visible = true;
      m.position.set(ball.x, ball.height ?? 0.13, -ball.y);
      m.rotation.set(-ball.y / 0.13, 0, -ball.x / 0.13);
    }
    for (const [id, m] of ballMeshes)
      if (!live.has(id)) {
        m.removeFromParent();
        instances.get("football")?.delete(m);
        m.traverse((o) => {
          if (o.isMesh && models.has("football"))
            for (const material of Array.isArray(o.material)
              ? o.material
              : [o.material])
              material.dispose();
        });
        ballMeshes.delete(id);
      }
    for (const target of s.targets) {
      let m = targetMeshes.get(target.id);
      if (!m) {
        const type = target.type;
        const name =
          type === "player"
            ? "player-bumper"
            : type === "combo"
              ? "triangle-target"
              : "round-target";
        m =
          model(name, target.team) ||
          mesh(
            new THREE.CylinderGeometry(target.radius, target.radius, 0.18, 20),
            target.team ? colors[target.team] : colors.gold,
          );
        targetMeshes.set(target.id, m);
      }
      m.position.set(target.x, 0, -target.y);
      if (m.userData.assetName) {
        const b = bounds.get(m.userData.assetName),
          diameter = target.radius * 2;
        const horizontal = diameter / Math.max(b.size.x, b.size.z);
        m.scale.set(horizontal, target.height / b.size.y, horizontal);
        m.position.y = -b.min.y * m.scale.y;
      } else m.position.y = target.height / 2;
      if (m.userData.team !== target.team) tint(m, target.team);
      if (target.type === "player") m.rotation.y = target.y < 0 ? Math.PI : 0;
      if (target.type !== "player") {
        let label = labels.get(target.id);
        if (!label) {
          label = document.createElement("span");
          label.className = "fp-target-label";
          labelLayer.append(label);
          labels.set(target.id, label);
        }
        const titles = {
          skill: "SKILL",
          pass: "PASS",
          combo: "COMBO",
          time: "+10s",
          multiball: "MULTIBALL",
          goal: "GOAL",
          wing: "WING",
        };
        label.textContent = titles[target.type] || String(target.points || "•");
        const point = new THREE.Vector3(
          target.x,
          target.height + 0.09,
          -target.y,
        ).project(camera);
        label.style.left = `${(point.x + 1) * 50}%`;
        label.style.top = `${(1 - point.y) * 50}%`;
      }
    }
    for (const keeper of s.keepers) {
      let m = keeperMeshes.get(keeper.id);
      if (!m) {
        m =
          model("keeper", keeper.team) ||
          mesh(
            new THREE.BoxGeometry(keeper.width, keeper.height, 0.15),
            colors[keeper.team] || colors.red,
          );
        keeperMeshes.set(keeper.id, m);
      }
      m.position.set(keeper.x, 0, -keeper.y);
      if (m.userData.assetName)
        fit(m, keeper.width, keeper.height, keeper.depth || 0.22);
      else m.position.y = keeper.height / 2;
      if (m.userData.team !== keeper.team) tint(m, keeper.team);
      m.rotation.y = keeper.y < 0 ? Math.PI : 0;
    }
    // Coin animation is cosmetic and derives its final face from authoritative toss state.
    const showCoin =
      models.has("coin") &&
      !!s.toss &&
      ["toss", "choice", "countdown"].includes(s.state);
    coinAnchor.visible = showCoin;
    if (showCoin) {
      const token = JSON.stringify(s.toss);
      if (tossToken !== token || s.tick < (tossStart ?? 0)) {
        tossStart = s.tick;
        tossToken = token;
      }
      const progress = matchMedia("(prefers-reduced-motion: reduce)").matches?1:Math.min(1, Math.max(0, (s.tick - tossStart) / 100));
      const ease = 1 - Math.pow(1 - progress, 3);
      coinFace = s.toss.face;
      coinAnchor.position.set(0, 0.6 + Math.sin(progress * Math.PI) * 1.7, 0);
      coinAnchor.rotation.set(
        ease * (Math.PI * 8 + (coinFace === "tails" ? Math.PI : 0)),
        0,
        0.12 * Math.sin(progress * Math.PI),
      );
    } else {
      tossStart = null;
      tossToken = null;
      coinFace = null;
    }
    const now = performance.now(),
      delta = now - lastDraw;
    lastDraw = now;
    if (quality === "auto" && !reduced) {
      slowFrames = delta > 45 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames >= 20) applyQuality(true);
    }
    renderer.render(scene, camera);
  }
  return {
    draw,
    setQuality(value) {
      if (!["auto", "high", "low"].includes(value))
        throw Error("Invalid quality");
      quality = value;
      slowFrames = 0;
      applyQuality(value === "low");
    },
    setViewTeam(team) {
      viewTeam = team;
      resize();
    },
    getSnapshot: () => latest,
    metrics: () => ({
      assetsLoaded: [...models.keys()],
      failedAssets: [...failedAssets],
      ...renderer.info.memory,
      drawCalls: renderer.info.render.calls,
      quality: reduced ? "low" : quality,
      coinVisible: coinAnchor.visible,
      coinFace,
      coinRotation: coinAnchor.rotation.x,
      coinHeight: coinAnchor.position.y,
      assetBounds: Object.fromEntries(
        [...bounds].map(([name, b]) => [
          name,
          { min: b.min.toArray(), size: b.size.toArray() },
        ]),
      ),
    }),
    async replaceAsset(name, url) {
      if (!assetNames.includes(name))
        throw new Error("Unknown replaceable asset");
      const gltf = await loader.loadAsync(url);
      const old = models.get(name);
      const cleaned = cleanAsset(gltf.scene);
      measure(name, cleaned);
      models.set(name, cleaned);
      const failed = failedAssets.indexOf(name);
      if (failed >= 0) failedAssets.splice(failed, 1);
      const existing = [...(instances.get(name) || [])];
      instances.set(name, new Set());
      for (const root of existing) {
        const replacement = model(name, root.userData.team, root.parent);
        replacement.position.copy(root.position);
        replacement.rotation.copy(root.rotation);
        replacement.scale.copy(root.scale);
        replacement.visible = root.visible;
        for (const map of [ballMeshes, targetMeshes, keeperMeshes])
          for (const [id, value] of map)
            if (value === root) map.set(id, replacement);
        root.removeFromParent();
        root.traverse((o) => {
          if (o.isMesh)
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material])
              m.dispose();
        });
      }
      old?.traverse((o) => {
        o.geometry?.dispose();
        if (o.material)
          for (const material of Array.isArray(o.material)
            ? o.material
            : [o.material])
            material.dispose();
      });
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      const geometries = new Set(),
        mats = new Set();
      scene.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
        if (o.material)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            mats.add(m);
      });
      models.forEach((root) =>
        root.traverse((o) => {
          if (o.geometry) geometries.add(o.geometry);
          if (o.material)
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material])
              mats.add(m);
        }),
      );
      geometries.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.remove();
    },
  };
}
