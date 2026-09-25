import fs from 'node:fs';
import path from 'node:path';

const input = path.resolve('public/models/cricket-world-v2.glb');
const output = path.resolve('public/game/cricket-glb-inspection.json');
const buf = fs.readFileSync(input);

if (buf.toString('utf8', 0, 4) !== 'glTF') throw new Error('Not a GLB file');
const version = buf.readUInt32LE(4);
const totalLength = buf.readUInt32LE(8);
let offset = 12;
let json = null;

while (offset + 8 <= buf.length) {
  const chunkLength = buf.readUInt32LE(offset);
  const chunkType = buf.readUInt32LE(offset + 4);
  const start = offset + 8;
  const end = start + chunkLength;
  if (chunkType === 0x4E4F534A) {
    json = JSON.parse(buf.toString('utf8', start, end).replace(/\0+$/g, '').trim());
    break;
  }
  offset = end;
}
if (!json) throw new Error('GLB JSON chunk not found');

const accessors = json.accessors || [];
const materials = json.materials || [];
const textures = json.textures || [];
const images = json.images || [];
const meshes = json.meshes || [];
const nodes = json.nodes || [];

const materialInfo = materials.map((m, index) => {
  const base = m.pbrMetallicRoughness || {};
  const baseTexIndex = base.baseColorTexture?.index;
  const texture = Number.isInteger(baseTexIndex) ? textures[baseTexIndex] : null;
  const image = texture && Number.isInteger(texture.source) ? images[texture.source] : null;
  return {
    index,
    name: m.name || null,
    baseColorFactor: base.baseColorFactor || null,
    metallicFactor: base.metallicFactor ?? null,
    roughnessFactor: base.roughnessFactor ?? null,
    baseColorTextureIndex: baseTexIndex ?? null,
    imageIndex: texture?.source ?? null,
    imageName: image?.name || null,
    imageMimeType: image?.mimeType || null,
    hasNormalTexture: Boolean(m.normalTexture),
    hasEmissiveTexture: Boolean(m.emissiveTexture),
    emissiveFactor: m.emissiveFactor || null,
    alphaMode: m.alphaMode || 'OPAQUE',
    doubleSided: Boolean(m.doubleSided)
  };
});

const meshUsers = new Map();
nodes.forEach((node, nodeIndex) => {
  if (!Number.isInteger(node.mesh)) return;
  const arr = meshUsers.get(node.mesh) || [];
  arr.push({
    nodeIndex,
    nodeName: node.name || null,
    translation: node.translation || null,
    rotation: node.rotation || null,
    scale: node.scale || null
  });
  meshUsers.set(node.mesh, arr);
});

const meshInfo = meshes.map((mesh, meshIndex) => {
  const primitives = (mesh.primitives || []).map((p, primitiveIndex) => {
    const pos = Number.isInteger(p.attributes?.POSITION) ? accessors[p.attributes.POSITION] : null;
    const uv = Number.isInteger(p.attributes?.TEXCOORD_0) ? accessors[p.attributes.TEXCOORD_0] : null;
    const uv1 = Number.isInteger(p.attributes?.TEXCOORD_1) ? accessors[p.attributes.TEXCOORD_1] : null;
    const material = Number.isInteger(p.material) ? materialInfo[p.material] : null;
    return {
      primitiveIndex,
      materialIndex: p.material ?? null,
      materialName: material?.name || null,
      vertexCount: pos?.count ?? null,
      positionMin: pos?.min || null,
      positionMax: pos?.max || null,
      hasUV0: Boolean(uv),
      uv0Count: uv?.count ?? null,
      hasUV1: Boolean(uv1),
      hasNormals: Number.isInteger(p.attributes?.NORMAL),
      hasTangents: Number.isInteger(p.attributes?.TANGENT),
      mode: p.mode ?? 4
    };
  });
  return {
    meshIndex,
    meshName: mesh.name || null,
    nodeUses: meshUsers.get(meshIndex) || [],
    primitives
  };
});

const report = {
  source: 'public/models/cricket-world-v2.glb',
  generatedAt: new Date().toISOString(),
  glbVersion: version,
  byteLength: totalLength,
  counts: {
    scenes: (json.scenes || []).length,
    nodes: nodes.length,
    meshes: meshes.length,
    materials: materials.length,
    textures: textures.length,
    images: images.length,
    accessors: accessors.length
  },
  materials: materialInfo,
  meshes: meshInfo,
  summary: {
    meshesWithUV0: meshInfo.filter(m => m.primitives.some(p => p.hasUV0)).length,
    meshesWithoutUV0: meshInfo.filter(m => m.primitives.every(p => !p.hasUV0)).length,
    multiMaterialMeshes: meshInfo.filter(m => new Set(m.primitives.map(p => p.materialIndex)).size > 1).length
  }
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log('Cricket GLB inspection written:', output, report.counts, report.summary);
