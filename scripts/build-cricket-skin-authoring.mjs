import fs from 'node:fs';
import path from 'node:path';

const input = path.resolve('public/models/cricket-world-v2.glb');
const outDir = path.resolve('public/cricket-skin-authoring');
fs.mkdirSync(outDir, { recursive: true });

const buf = fs.readFileSync(input);
if (buf.toString('utf8',0,4) !== 'glTF') throw new Error('Invalid GLB');

let offset = 12;
let json = null;
let binChunk = null;
while (offset + 8 <= buf.length) {
  const len = buf.readUInt32LE(offset);
  const type = buf.readUInt32LE(offset + 4);
  const start = offset + 8, end = start + len;
  if (type === 0x4E4F534A) json = JSON.parse(buf.toString('utf8', start, end).replace(/\0+$/g,'').trim());
  if (type === 0x004E4942) binChunk = buf.subarray(start, end);
  offset = end;
}
if (!json || !binChunk) throw new Error('Missing GLB chunks');

const accessors = json.accessors || [];
const bufferViews = json.bufferViews || [];
const meshes = json.meshes || [];
const nodes = json.nodes || [];
const materials = json.materials || [];
const textures = json.textures || [];
const images = json.images || [];

function safe(s){ return String(s||'unnamed').replace(/[^a-zA-Z0-9._-]+/g,'_'); }
function componentSize(ct){ return ({5120:1,5121:1,5122:2,5123:2,5125:4,5126:4})[ct]; }
function numComps(type){ return ({SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16})[type]; }
function readerFor(ct, dv, o){
  if (ct===5126) return dv.getFloat32(o,true);
  if (ct===5125) return dv.getUint32(o,true);
  if (ct===5123) return dv.getUint16(o,true);
  if (ct===5122) return dv.getInt16(o,true);
  if (ct===5121) return dv.getUint8(o);
  if (ct===5120) return dv.getInt8(o);
  throw new Error('Unsupported component type '+ct);
}
function readAccessor(index){
  const a=accessors[index]; if(!a) throw new Error('Accessor '+index+' missing');
  const bv=bufferViews[a.bufferView]; if(!bv) throw new Error('BufferView missing');
  const comps=numComps(a.type), cs=componentSize(a.componentType);
  const stride=bv.byteStride || comps*cs;
  const start=(bv.byteOffset||0)+(a.byteOffset||0);
  const dv=new DataView(binChunk.buffer, binChunk.byteOffset, binChunk.byteLength);
  const out=[];
  for(let i=0;i<a.count;i++){
    const row=[];
    for(let c=0;c<comps;c++) row.push(readerFor(a.componentType,dv,start+i*stride+c*cs));
    out.push(row);
  }
  return out;
}

const materialToImage = new Map();
materials.forEach((m,mi)=>{
  const ti=m.pbrMetallicRoughness?.baseColorTexture?.index;
  const tex=Number.isInteger(ti)?textures[ti]:null;
  if(tex && Number.isInteger(tex.source)) materialToImage.set(mi,tex.source);
});

const extractedImages=[];
images.forEach((img,ii)=>{
  if(!Number.isInteger(img.bufferView)) return;
  const bv=bufferViews[img.bufferView];
  const start=bv.byteOffset||0;
  const bytes=binChunk.subarray(start,start+bv.byteLength);
  const ext=img.mimeType==='image/jpeg'?'jpg':img.mimeType==='image/webp'?'webp':'png';
  const file=`embedded_${String(ii).padStart(2,'0')}_${safe(img.name||'image')}.${ext}`;
  fs.writeFileSync(path.join(outDir,file),bytes);
  extractedImages.push({imageIndex:ii,name:img.name||null,mimeType:img.mimeType||null,file,bytes:bytes.length});
});

const nodeByMesh=new Map();
nodes.forEach((n,ni)=>{ if(Number.isInteger(n.mesh)){ const a=nodeByMesh.get(n.mesh)||[]; a.push({nodeIndex:ni,nodeName:n.name||null}); nodeByMesh.set(n.mesh,a);} });

const authoringTargets=[];
const targetRe=/(Cricket_Pavilion$|Cricket_Player_Tunnel$|Cricket_Ramp_Four_Bed$|Cricket_Ramp_Six_Bed$|Cricket_Wicket_Backboard$|Cricket_Wicket_Main$|Skin_Pitch_Surface$|Skin_Playfield_Surface$|Cricket_Stand_|Flipper_Left$|Flipper_Right$)/i;

for(let mi=0; mi<meshes.length; mi++){
  const mesh=meshes[mi];
  const uses=nodeByMesh.get(mi)||[];
  if(!uses.some(u=>targetRe.test(u.nodeName||''))) continue;
  for(let pi=0; pi<(mesh.primitives||[]).length; pi++){
    const p=mesh.primitives[pi];
    const uvIndex=p.attributes?.TEXCOORD_0;
    if(!Number.isInteger(uvIndex)) continue;
    const uv=readAccessor(uvIndex);
    let indices=null;
    if(Number.isInteger(p.indices)) indices=readAccessor(p.indices).flat();
    else indices=Array.from({length:uv.length},(_,i)=>i);
    const width=1024,height=1024,pad=24;
    const lines=[];
    for(let i=0;i+2<indices.length;i+=3){
      const pts=[indices[i],indices[i+1],indices[i+2]].map(idx=>{
        const [u,v]=uv[idx];
        return [pad+u*(width-2*pad), pad+(1-v)*(height-2*pad)];
      });
      lines.push(`<path d="M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)} L ${pts[1][0].toFixed(2)} ${pts[1][1].toFixed(2)} L ${pts[2][0].toFixed(2)} ${pts[2][1].toFixed(2)} Z"/>`);
    }
    const mat=materials[p.material]||{};
    const label=uses.map(u=>u.nodeName).filter(Boolean).join('__')||mesh.name||`mesh_${mi}`;
    const svgFile=`uv_${String(mi).padStart(3,'0')}_${safe(label)}.svg`;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="100%" height="100%" fill="#111"/>
<g fill="none" stroke="#fff" stroke-width="1" opacity=".75">${lines.join('')}</g>
<text x="24" y="32" fill="#ffdf70" font-family="monospace" font-size="18">${label} | ${mat.name||'no-material'}</text>
</svg>`;
    fs.writeFileSync(path.join(outDir,svgFile),svg);
    authoringTargets.push({
      meshIndex:mi, meshName:mesh.name||null, nodeNames:uses.map(u=>u.nodeName),
      primitiveIndex:pi, materialIndex:p.material??null, materialName:mat.name||null,
      sourceImageIndex:materialToImage.get(p.material)??null,
      uvTemplate:svgFile, vertexCount:uv.length, triangleCount:Math.floor(indices.length/3)
    });
  }
}

const manifest={
  source:'public/models/cricket-world-v2.glb',
  generatedAt:new Date().toISOString(),
  rule:'Do not assign generated artwork directly unless authored against the listed UV template.',
  extractedImages,
  authoringTargets
};
fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Skin authoring pack generated', {images:extractedImages.length,targets:authoringTargets.length});
