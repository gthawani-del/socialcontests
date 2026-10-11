import * as THREE from 'three';
import { createCrashBallMotion } from './crash-ball-motion.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createFootballVisualKit } from './visual-kit.js';
import { addFootballCabinet } from './cabinet-kit.js';
import { createArcadeProps } from './arcade-props.js';
import { addCrowdTiers } from './stadium-kit.js';

// Cosmetic board only. Nothing here chooses the crash point or changes payout.
export async function createCrashView(container) {
  const renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:import.meta.env.DEV});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);
  const scene=new THREE.Scene(); scene.background=new THREE.Color('#080d12');
  const camera=new THREE.PerspectiveCamera(42,1,.1,70);
  const kit=createFootballVisualKit(scene,renderer);
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(256,512),.38,.5,1.05);composer.addPass(bloom);composer.addPass(new OutputPass());
  const board=new THREE.Group(); scene.add(board);
  const gold=kit.metal.clone(); gold.color.set('#b99750');gold.roughness=.27;
  addFootballCabinet(board,{metal:gold,black:kit.black});
  const amber=new THREE.MeshStandardMaterial({color:'#ffd471',emissive:'#ff9f28',emissiveIntensity:1.7,roughness:.28});
  const textures=[]; const failures=[]; let disposed=false,latest={state:'ready',multiplier:1};
  function mesh(geometry,material,x,y,z){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;board.add(m);return m;}
  const blue=amber.clone();blue.color.set('#55bdff');blue.emissive.set('#0088ff');
  const red=amber.clone();red.color.set('#ff7772');red.emissive.set('#ff1230');
  for(const side of [-1,1])for(let n=0;n<12;n++)mesh(new THREE.BoxGeometry(.08,.06,.55),side<0?blue:red,side*3.24,.48,-4.85+n*.88);
  for(const side of [-1,1]){const light=new THREE.PointLight(side<0?'#168fff':'#ff283f',8,7,2);light.position.set(side*2.6,1.3,1);scene.add(light);}

  // Deterministic turf texture: the same palette/material language as the PvP kit.
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=1024;
  const ctx=canvas.getContext('2d');let seed=701;
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let n=0;n<16;n++){ctx.fillStyle=n%2?'#285b24':'#234c1c';ctx.fillRect(0,n*64,512,64);}
  for(let n=0;n<65000;n++){ctx.fillStyle=rand()>.5?'rgba(162,186,80,.15)':'rgba(0,12,0,.17)';ctx.fillRect(rand()*512,rand()*1024,1,3);}
  try{const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src='/football-pinball/art/turf-detail.webp';});ctx.drawImage(img,0,0,512,1024);for(let n=0;n<16;n++){if(n%2){ctx.fillStyle='rgba(0,24,6,.14)';ctx.fillRect(0,n*64,512,64);}}}catch{failures.push('turf-detail');}
  ctx.strokeStyle='rgba(228,238,201,.7)';ctx.lineWidth=2;ctx.strokeRect(24,44,464,936);
  ctx.beginPath();ctx.moveTo(24,512);ctx.lineTo(488,512);ctx.ellipse(256,512,75,80,0,0,Math.PI*2);ctx.stroke();ctx.strokeRect(125,44,262,150);
  const turf=new THREE.CanvasTexture(canvas);turf.colorSpace=THREE.SRGBColorSpace;textures.push(turf);
  mesh(new THREE.PlaneGeometry(6.1,11.05),new THREE.MeshStandardMaterial({map:turf,color:'#8ba273',bumpMap:kit.cloth,bumpScale:.012,roughness:.96}),0,0,0).rotation.x=-Math.PI/2;
  try {const crowd=await new THREE.TextureLoader().loadAsync('/football-pinball/art/stadium-crowd.png');crowd.colorSpace=THREE.SRGBColorSpace;textures.push(crowd);addCrowdTiers(scene,crowd,kit.black,{tiers:3,near:6.5});}catch{failures.push('stadium-crowd');}
  function batchStatic(root){
    root.updateMatrixWorld(true);const groups=new Map();
    root.traverse(o=>{if(!o.isMesh||Array.isArray(o.material))return;let g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat;}if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(g);});
    const batched=new THREE.Group();for(const [material,parts] of groups){const geometry=mergeGeometries(parts,false);if(!geometry)throw Error('Asset batching failed');batched.add(new THREE.Mesh(geometry,material));parts.forEach(g=>g.dispose());}root.traverse(o=>o.geometry?.dispose());return batched;
  }
  const loader=new GLTFLoader();const models=new Map();
  await Promise.all(['boot-reference','football','goal'].map(async name=>{
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
  mesh(new THREE.BoxGeometry(2.7,.045,.055),amber,0,1.15,-4.65);
  for(const side of [-1,1])mesh(new THREE.BoxGeometry(.055,1.15,.055),amber,side*1.32,.58,-4.65);

  const props=createArcadeProps({metal:gold,black:kit.black});
  const faces=['#073e94','#8b101e','#8a5710'].map(color=>new THREE.MeshPhysicalMaterial({color,metalness:.55,roughness:.24,clearcoat:1}));
  const positions=[[-1.45,-2.25],[0,-2.65],[1.45,-2.25],[-1.25,1.1],[1.25,1.1],[0,-.1]];
  for(const [x,z] of positions){
    const colour=x<0?blue:x>0?red:amber;
    const target=props.bumper({face:faces[x<0?0:x>0?1:2],light:colour,radius:x===0?.65:.55});target.position.set(x,.02,z);board.add(target);
    kit.contact(board,1.1,1.1,x,.012,z);
  }
  board.userData.crashBoots=[];
  for(const side of [-1,1]){
    const curve=new THREE.CatmullRomCurve3([[side*2.7,.15,-3.8],[side*2.5,.15,-.8],[side*2.2,.15,.4]].map(p=>new THREE.Vector3(...p)));
    mesh(new THREE.TubeGeometry(curve,24,.07,8,false),gold,0,0,0);
    for(let n=0;n<5;n++){
      const shape=new THREE.Shape();shape.moveTo(-.17,.05);shape.lineTo(0,.26);shape.lineTo(.17,.05);shape.lineTo(.17,-.08);shape.lineTo(0,.1);shape.lineTo(-.17,-.08);shape.closePath();
      const arrow=mesh(new THREE.ShapeGeometry(shape),side<0?blue:red,side*2.05,.012,2.9-n*.95);arrow.rotation.x=-Math.PI/2;
    }
    const wing=props.wing({face:faces[side<0?0:1],light:side<0?blue:red});wing.position.set(side*2.25,.02,-.25);wing.rotation.y=side*.25;board.add(wing);
    const boot=model('boot-reference',side*1.25,.08,4,2.3,side<0?'blue':'red');
    if(boot){boot.rotation.y=side<0?-.3:Math.PI+.3;board.userData.crashBoots.push(boot);}
  }
  const ball=model('football',0,.2,2.8,.55)||mesh(new THREE.SphereGeometry(.18,20,16),new THREE.MeshStandardMaterial({color:'white',roughness:.4}),0,.2,2.8);
  const corners=[];for(const x of [-3.85,3.85])for(const z of [-6.1,6.1])for(const y of [0,1.1])corners.push(new THREE.Vector3(x,y,z));
  function resize(){
    if(disposed)return;const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
    const fits=d=>{camera.position.set(0,d,d*.62);camera.lookAt(0,0,0);camera.updateMatrixWorld();return corners.every(p=>{const q=p.clone().project(camera);return Math.abs(q.x)<.975&&Math.abs(q.y)<.975;});};
    let lo=5,hi=40;for(let n=0;n<22;n++){const mid=(lo+hi)/2;if(fits(mid))hi=mid;else lo=mid;}fits(hi);composer.render();
  }
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  const motion=createCrashBallMotion();
  let currentRound=null,lastImpactId=0;
  const impactLight=new THREE.PointLight('#ffc476',0,2.2);board.add(impactLight);
  let impactFlash=0;
  const flame=new THREE.PointLight('#ff741c',0,2.4);board.add(flame);
  const trailCount=22, trailPositions=new Float32Array(trailCount*3),trailColors=new Float32Array(trailCount*3);
  const trailGeometry=new THREE.BufferGeometry();
  trailGeometry.setAttribute('position',new THREE.BufferAttribute(trailPositions,3));
  trailGeometry.setAttribute('color',new THREE.BufferAttribute(trailColors,3));
  const trailMaterial=new THREE.PointsMaterial({size:.14,vertexColors:true,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending});
  const trail=new THREE.Points(trailGeometry,trailMaterial);trail.frustumCulled=false;board.add(trail);
  let lastTime=performance.now();
  function update(snapshot={}){
    if(disposed)return;latest=snapshot;const now=performance.now(),dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;
    const active=['active','running','rising'].includes(snapshot.state);
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(snapshot.roundId!==currentRound){currentRound=snapshot.roundId;motion.reset(currentRound);lastImpactId=0;impactFlash=0;}
    const state=motion.step(active&&!snapshot.paused?dt:0);
    ball.position.set(state.x,.16,state.z);
    if(active&&!snapshot.paused){ball.rotation.x+=dt*state.speed*.7;ball.rotation.z+=dt*state.speed*.4;}
    for(let i=0;i<2;i++){
      const boot=board.userData.crashBoots?.[i],physics=state.boots?.[i];
      if(boot&&physics){boot.position.x=physics.x;boot.position.z=physics.z;boot.rotation.y=-physics.angle;}
    }
    if(active&&state.lastImpact?.id>lastImpactId){lastImpactId=state.lastImpact.id;impactFlash=1;impactLight.position.set(state.lastImpact.x,.35,state.lastImpact.z);}
    impactFlash=Math.max(0,impactFlash-dt*5);
    impactLight.intensity=reduced?0:impactFlash*2.8;
    const power=state.powerActive?1:THREE.MathUtils.clamp(state.speed/15,0,1);
    const tint=new THREE.Color(power>=.9?'#ff681a':power>=.66?'#ffa733':power>=.31?'#37baff':'#e5f7ff');
    const history=active&&!reduced?state.history:[];
    for(let i=0;i<history.length&&i<trailCount;i++){
      const h=history[i],fade=1-i/trailCount,offset=i*3;
      trailPositions[offset]=h.x;trailPositions[offset+1]=.17+Math.sin(i*2.7)*.035*power;trailPositions[offset+2]=h.z;
      trailColors[offset]=tint.r*fade;trailColors[offset+1]=tint.g*fade;trailColors[offset+2]=tint.b*fade;
    }
    trailGeometry.setDrawRange(0,history.length);trailGeometry.attributes.position.needsUpdate=true;trailGeometry.attributes.color.needsUpdate=true;
    trailMaterial.size=power>=.9?.34:power>=.66?.24:power>=.31?.15:.09;
    flame.position.set(state.x,.3,state.z);flame.intensity=active&&!reduced&&power>=.9?power*3:0;
    ball.scale.setScalar(power>=.9&&!reduced?1.05:1);
    amber.emissiveIntensity=snapshot.state==='crashed'?.2:active?1.5+Math.sin(now*.004)*.2:1;
    composer.render();
  }
  return {update,getGameStats(){const {score,hits,bootHits,powerShots,powerActive,lastImpact,feedback}=motion.snapshot();return {score,hits,bootHits,powerShots,powerActive,lastImpact,feedback};},setQuality(value){renderer.setPixelRatio(value==='low'?1:Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=value!=='low';kit.setReduced(value==='low');bloom.enabled=value!=='low';resize();},
    metrics(){return {failedAssets:[...failures],canvas:{width:container.clientWidth,height:container.clientHeight},state:latest.state,cosmetic:true,physics:motion.snapshot(),props:{bumpers:6,wings:2},bloom:bloom.enabled};},
    dispose(){if(disposed)return;disposed=true;observer.disconnect();trailGeometry.dispose();trailMaterial.dispose();const geometry=new Set(),materials=new Set();for(const root of [scene,...models.values()])root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])materials.add(m);});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());kit.dispose();composer.dispose();bloom.dispose();renderer.dispose();renderer.domElement.remove();}
  };
}
