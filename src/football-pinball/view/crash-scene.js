import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createFootballVisualKit } from './visual-kit.js';
import { addFootballCabinet } from './cabinet-kit.js';
import { addCrowdTiers } from './stadium-kit.js';

// Cosmetic board only. Nothing here chooses the crash point or changes payout.
export async function createCrashView(container) {
  const renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:import.meta.env.DEV});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=.95;
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);
  const scene=new THREE.Scene(); scene.background=new THREE.Color('#080d12');
  const camera=new THREE.PerspectiveCamera(42,1,.1,70);
  const kit=createFootballVisualKit(scene,renderer);
  const board=new THREE.Group(); scene.add(board);
  const gold=kit.metal.clone(); gold.color.set('#b99750');gold.roughness=.27;
  addFootballCabinet(board,{metal:gold,black:kit.black});
  const amber=new THREE.MeshStandardMaterial({color:'#ffd471',emissive:'#ff9f28',emissiveIntensity:1.7,roughness:.28});
  const textures=[]; const failures=[]; const rings=[]; let disposed=false,latest={state:'ready',multiplier:1};
  function mesh(geometry,material,x,y,z){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;board.add(m);return m;}
  for(const side of [-1,1])for(let n=0;n<12;n++)mesh(new THREE.BoxGeometry(.055,.04,.55),amber,side*3.24,.48,-4.85+n*.88);
  // Deterministic turf texture: the same palette/material language as the PvP kit.
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=1024;
  const ctx=canvas.getContext('2d');let seed=701;
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let n=0;n<16;n++){ctx.fillStyle=n%2?'#285b24':'#234c1c';ctx.fillRect(0,n*64,512,64);}
  for(let n=0;n<65000;n++){ctx.fillStyle=rand()>.5?'rgba(162,186,80,.15)':'rgba(0,12,0,.17)';ctx.fillRect(rand()*512,rand()*1024,1,3);}
  ctx.strokeStyle='rgba(228,238,201,.55)';ctx.lineWidth=2;ctx.strokeRect(24,44,464,936);
  ctx.beginPath();ctx.moveTo(24,512);ctx.lineTo(488,512);ctx.ellipse(256,512,75,80,0,0,Math.PI*2);ctx.stroke();ctx.strokeRect(125,44,262,150);
  const turf=new THREE.CanvasTexture(canvas);turf.colorSpace=THREE.SRGBColorSpace;textures.push(turf);
  mesh(new THREE.PlaneGeometry(6.1,11.05),new THREE.MeshStandardMaterial({map:turf,bumpMap:kit.cloth,bumpScale:.012,roughness:.96}),0,0,0).rotation.x=-Math.PI/2;
  try {const crowd=await new THREE.TextureLoader().loadAsync('/football-pinball/art/stadium-crowd.png');crowd.colorSpace=THREE.SRGBColorSpace;textures.push(crowd);addCrowdTiers(scene,crowd,kit.black,{tiers:3,near:6.5});}catch{failures.push('stadium-crowd');}
  function batchStatic(root){
    root.updateMatrixWorld(true);const groups=new Map();
    root.traverse(o=>{if(!o.isMesh||Array.isArray(o.material))return;let g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat;}if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(g);});
    const batched=new THREE.Group();for(const [material,parts] of groups){const geometry=mergeGeometries(parts,false);if(!geometry)throw Error('Asset batching failed');batched.add(new THREE.Mesh(geometry,material));parts.forEach(g=>g.dispose());}root.traverse(o=>o.geometry?.dispose());return batched;
  }
  const loader=new GLTFLoader();const models=new Map();
  await Promise.all(['boot-reference','football','goal','round-target'].map(async name=>{
    try{const g=await loader.loadAsync(`/models/football/${name}.glb`);const remove=[];g.scene.traverse(o=>{if(o.isLight||o.isCamera)remove.push(o);});remove.forEach(o=>o.removeFromParent());models.set(name,name==='boot-reference'?batchStatic(g.scene):g.scene);}catch{failures.push(name);}
  }));
  function model(name,x,y,z,width,team='blue'){
    const source=models.get(name);if(!source)return null;
    const root=source.clone(true);root.traverse(o=>{if(o.isMesh)o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();});
    kit.finish(root,name==='boot-reference'?'boot':name,team);
    const bounds=new THREE.Box3().setFromObject(root);const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const holder=new THREE.Group();const scale=width/Math.max(size.x,.001);root.scale.setScalar(scale);root.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);holder.add(root);holder.position.set(x,y,z);board.add(holder);return holder;
  }
  model('goal',0,.02,-4.65,2.65,'red');
  const positions=[[-1.45,-2.15],[0,-2.7],[1.45,-2.15],[-1.1,1.5],[1.1,1.5]];
  for(const [x,z] of positions){
    model('round-target',x,.025,z,.85);
    const ring=mesh(new THREE.TorusGeometry(.44,.035,8,40),amber,x,.1,z);ring.rotation.x=-Math.PI/2;rings.push(ring);
    kit.contact(board,1.1,1.1,x,.012,z);
  }
  for(const side of [-1,1]){
    const curve=new THREE.CatmullRomCurve3([[side*2.7,.15,-3.8],[side*2.5,.15,-.8],[side*2.2,.15,.4]].map(p=>new THREE.Vector3(...p)));
    mesh(new THREE.TubeGeometry(curve,24,.07,8,false),gold,0,0,0);
    const boot=model('boot-reference',side*1.25,.08,4,2.05,side<0?'blue':'red');
    if(boot)boot.rotation.y=side<0?-.3:Math.PI+.3;
  }
  const ball=model('football',0,.2,2.8,.36)||mesh(new THREE.SphereGeometry(.18,20,16),new THREE.MeshStandardMaterial({color:'white',roughness:.4}),0,.2,2.8);
  const corners=[];for(const x of [-3.85,3.85])for(const z of [-6.1,6.1])for(const y of [0,1.1])corners.push(new THREE.Vector3(x,y,z));
  function resize(){
    if(disposed)return;const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    const fits=d=>{camera.position.set(0,d,d*.55);camera.lookAt(0,0,0);camera.updateMatrixWorld();return corners.every(p=>{const q=p.clone().project(camera);return Math.abs(q.x)<.975&&Math.abs(q.y)<.975;});};
    let lo=5,hi=40;for(let n=0;n<22;n++){const mid=(lo+hi)/2;if(fits(mid))hi=mid;else lo=mid;}fits(hi);renderer.render(scene,camera);
  }
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  let motion=0,lastTime=performance.now();
  function update(snapshot={}){
    if(disposed)return;latest=snapshot;const now=performance.now(),dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;
    const active=['active','running','rising'].includes(snapshot.state);
    if(active&&!snapshot.paused&&!matchMedia('(prefers-reduced-motion: reduce)').matches){motion+=dt;ball.position.set(Math.sin(motion*2.1)*1.8,.16,Math.cos(motion*1.3)*3.1);ball.rotation.x+=dt*4;ball.rotation.z+=dt*2;}
    amber.emissiveIntensity=snapshot.state==='crashed'?.2:active?1.5+Math.sin(motion*4)*.2:1;
    renderer.render(scene,camera);
  }
  return {update,setQuality(value){renderer.setPixelRatio(value==='low'?1:Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=value!=='low';kit.setReduced(value==='low');resize();},
    metrics(){return {failedAssets:[...failures],canvas:{width:container.clientWidth,height:container.clientHeight},state:latest.state,cosmetic:true};},
    dispose(){if(disposed)return;disposed=true;observer.disconnect();const geometry=new Set(),materials=new Set();for(const root of [scene,...models.values()])root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])materials.add(m);});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());kit.dispose();renderer.dispose();renderer.domElement.remove();}
  };
}
