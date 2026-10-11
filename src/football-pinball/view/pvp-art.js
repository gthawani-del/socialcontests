import * as THREE from 'three';
import { addFootballCabinet } from './cabinet-kit.js';
import { addCrowdTiers } from './stadium-kit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Presentation only: dimensions follow the existing 6 x 10 metre physics table.
// Seeded cosmetic variation never consumes the match RNG.
export function buildPvpArt(scene, renderer, kit) {
  const group = new THREE.Group(); group.name = 'PVP_STADIUM'; scene.add(group);
  const textures = [];
  let seed = 74031;
  const random = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0) / 4294967296);
  const {metal,black}=kit;
  const lit = color => new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.1,roughness:.3});
  const blueLight=lit('#2497ff'),redLight=lit('#ff3945'),whiteLight=lit('#ffe7b0');
  function add(geometry,material,x=0,y=0,z=0,parent=group){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  addFootballCabinet(group, {metal, black});
  // Sculpted dark side panels and segmented inset LEDs, outside playable collider edges.
  for(const side of [-1,1])for(let i=0;i<12;i++){
    const z=-4.95+i*.9,material=z<0?redLight:blueLight;
    const bezel=add(new THREE.BoxGeometry(.11,.16,.61),black,side*3.29,.4,z);bezel.rotation.z=side*.28;
    add(new THREE.BoxGeometry(.06,.035,.46),material,side*3.23,.5,z);
    add(new THREE.SphereGeometry(.035,8,5),metal,side*3.47,.43,z+.32);
  }
  for(const z of [-5.72,5.72])for(const x of [-2.45,-1.8,1.8,2.45])add(new THREE.BoxGeometry(.35,.045,.07),whiteLight,x,.43,z);
  // Swept side channels add contour and layered reflective trim outside the playfield.
  function pipe(points,r,material,parent=group){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return add(new THREE.TubeGeometry(curve,64,r,8,false),material,0,0,0,parent);}
  for(const side of [-1,1]){
    const pts=[[-5.1,3.1],[-4,3.42],[-2.9,3.25],[-1.8,3.42],[0,3.3],[1.8,3.42],[3.2,3.35],[4.8,3.48],[5.4,3.1]];
    pipe(pts.map(([z,x])=>[side*x,.6,z]),.085,metal);
    pipe(pts.map(([z,x])=>[side*(x-.07),.53,z]),.03,side<0?blueLight:redLight);
    for(const z of [-3,-.8,1.6,3.8]){const plate=add(new THREE.BoxGeometry(.28,.065,.55),black,side*3.35,.58,z);plate.rotation.y=side*.22;}
  }
  for(const sign of [-1,1]){const z=sign*5.05,mat=sign<0?redLight:blueLight;pipe([[-1.12,.04,z],[-1.12,1.17,z],[1.12,1.17,z],[1.12,.04,z]],.022,mat);}
  // Turf contains only field markings and surface detail, never a flattened game board.
  const c=document.createElement('canvas');c.width=1024;c.height=2048;const ctx=c.getContext('2d');
  for(let row=0;row<16;row++){ctx.fillStyle=row%2?'#326321':'#285219';ctx.fillRect(0,row*128,1024,128);}
  for(let i=0;i<180000;i++){const x=random()*1024,y=random()*2048;ctx.fillStyle=random()>.5?'rgba(149,169,59,.13)':'rgba(0,20,6,.19)';ctx.fillRect(x,y,1+random()*1.3,2+random()*4);}
  ctx.strokeStyle='rgba(231,240,207,.65)';ctx.lineWidth=4;ctx.strokeRect(44,107,936,1834);ctx.beginPath();ctx.moveTo(44,1024);ctx.lineTo(980,1024);ctx.stroke();ctx.beginPath();ctx.ellipse(512,1024,140,154,0,0,Math.PI*2);ctx.stroke();
  for(const y of [107,1941]){ctx.strokeRect(238,y===107?y:y-265,548,265);ctx.strokeRect(337,y===107?y:y-110,350,110);}
  // Faint original star motif and directional markings remain part of the turf.
  ctx.save();ctx.translate(512,1024);ctx.fillStyle='rgba(190,213,143,.25)';
  for(let star=0;star<5;star++){const a=star*Math.PI*2/5;ctx.save();ctx.translate(Math.sin(a)*83,Math.cos(a)*83);ctx.rotate(-a);ctx.beginPath();for(let j=0;j<10;j++){const q=j*Math.PI/5,r=j%2?17:37;ctx.lineTo(Math.sin(q)*r,-Math.cos(q)*r);}ctx.closePath();ctx.fill();ctx.restore();}ctx.restore();
  for(const side of [-1,1])for(const y of [390,690,1330,1640]){ctx.fillStyle=y<1024?'rgba(244,68,72,.7)':'rgba(72,173,255,.75)';ctx.beginPath();const x=512+side*315;ctx.moveTo(x,y+(y<1024?20:-20));ctx.lineTo(x-16,y);ctx.lineTo(x+16,y);ctx.closePath();ctx.fill();}
  ctx.fillStyle='rgba(232,238,214,.5)';ctx.beginPath();ctx.arc(512,1024,5,0,Math.PI*2);ctx.fill();
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textures.push(texture);
  const turf=add(new THREE.PlaneGeometry(6.1,11.05),new THREE.MeshStandardMaterial({map:texture,roughness:.97,metalness:0,bumpMap:kit.cloth,bumpScale:.014}),0,.003,0);turf.rotation.x=-Math.PI/2;
  // Continuous rising terraces replace isolated floating seat modules.
  const standMat=new THREE.MeshStandardMaterial({color:'#050a13',roughness:.92});
  for(const side of [-1,1])for(let tier=0;tier<5;tier++)add(new THREE.BoxGeometry(.55,.38,17),standMat,side*(4.05+tier*.52),-.1+tier*.4,-1);
  for(let tier=0;tier<5;tier++)add(new THREE.BoxGeometry(13,.38,.55),standMat,0,-.1+tier*.4,-6.8-tier*.52);
  // Instancing keeps the populated stadium to two crowd draw calls.
  const crowd=[];const palette=['#202d49','#425d85','#7c292d','#be8b60','#d8c7ae','#1c2437','#c8cbcb','#1a4c7a'];
  for(const side of [-1,1])for(let row=0;row<10;row++)for(let j=0;j<85;j++)crowd.push([side*(4+row*.26+random()*.12),.15+row*.2,-8.9+j*.195+random()*.1]);
  for(let row=0;row<10;row++)for(let j=0;j<65;j++)crowd.push([-6+j*.19,.15+row*.2,-6.8-row*.26]);
  const bodies=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.074,.18,2,5),new THREE.MeshStandardMaterial({color:'#78838d',roughness:.8}),crowd.length);
  const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(.05,7,5),new THREE.MeshStandardMaterial({color:'#b0a096',roughness:.9}),crowd.length);const temp=new THREE.Object3D();
  crowd.forEach(([x,y,z],i)=>{temp.position.set(x,y,z);temp.scale.set(.85+random()*.3,.65+random()*.7,1);temp.updateMatrix();bodies.setMatrixAt(i,temp.matrix);bodies.setColorAt(i,new THREE.Color(palette[Math.floor(random()*palette.length)]));temp.position.y+=.155;temp.scale.setScalar(1);temp.updateMatrix();heads.setMatrixAt(i,temp.matrix);heads.setColorAt(i,new THREE.Color(['#ba8b6b','#765244','#d6ac88'][i%3]));});group.add(bodies,heads);
  // Shared tier builder: the crowd texture never contains gameplay objects.
  const failedAssets=[];
  const ready=new THREE.TextureLoader().loadAsync('/football-pinball/art/stadium-crowd.png').then(texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textures.push(texture);
    addCrowdTiers(group, texture, black);
    bodies.visible=false;heads.visible=false;
  }).catch(()=>failedAssets.push('stadium-crowd'));
  for(const side of [-1,1])for(const z of [-6.1,1.7]){
    add(new THREE.BoxGeometry(.08,2.6,.08),metal,side*5.3,1.5,z);
    const panel=add(new THREE.BoxGeometry(1.05,.58,.14),black,side*5.3,2.85,z);panel.rotation.y=side*.3;
    for(let i=0;i<4;i++)for(let j=0;j<2;j++)add(new THREE.BoxGeometry(.17,.17,.07),whiteLight,side*5.3+(i-1.5)*.23,2.72+j*.25,z+.1);
  }
  // Stadium advertising boards are editable world artwork, separate from game UI.
  for(const side of [-1,1]){
    const board=document.createElement('canvas');board.width=256;board.height=512;const b=board.getContext('2d');b.fillStyle=side<0?'#102c52':'#481521';b.fillRect(0,0,256,512);b.strokeStyle='#9faebb';b.lineWidth=6;b.strokeRect(8,8,240,496);b.fillStyle='#ebedf0';b.textAlign='center';b.font='bold 35px sans-serif';const words=side<0?['FOOTBALL','PINBALL','','PLAY','COMPETE','BELONG']:['RIVALS','TODAY','','LEGENDS','TOMORROW'];words.forEach((word,i)=>b.fillText(word,128,80+i*60));
    const t=new THREE.CanvasTexture(board);t.colorSpace=THREE.SRGBColorSpace;textures.push(t);const banner=add(new THREE.PlaneGeometry(1.15,2.5),new THREE.MeshStandardMaterial({map:t,roughness:.85,side:THREE.DoubleSide}),side*4.25,1.5,-3.6);banner.rotation.y=side*-.38;
  }
  // Batch static cabinet/terrace geometry by material: keep visual detail without one call per bolt/LED.
  group.updateMatrixWorld(true);const batches=new Map();
  for(const object of [...group.children]){if(!object.isMesh||object.isInstancedMesh)continue;const g=object.geometry.clone().applyMatrix4(object.matrix);if(!batches.has(object.material))batches.set(object.material,[]);batches.get(object.material).push(g);object.removeFromParent();object.geometry.dispose();}
  for(const [material,parts] of batches){const flat=parts.map(g=>g.index?g.toNonIndexed():g);const joined=mergeGeometries(flat,false);flat.forEach(g=>g.dispose());if(joined){const m=new THREE.Mesh(joined,material);m.castShadow=true;m.receiveShadow=true;group.add(m);}parts.forEach(g=>g.dispose());}

  const glowCanvas=document.createElement('canvas');glowCanvas.width=128;glowCanvas.height=128;const gc=glowCanvas.getContext('2d');const gradient=gc.createRadialGradient(64,64,25,64,64,64);gradient.addColorStop(0,'rgba(255,255,255,0)');gradient.addColorStop(.35,'rgba(255,255,255,.7)');gradient.addColorStop(1,'rgba(255,255,255,0)');gc.fillStyle=gradient;gc.fillRect(0,0,128,128);const glowTexture=new THREE.CanvasTexture(glowCanvas);textures.push(glowTexture);
  function dress(root,name,team){
    const tint=team==='red'?'#ff2439':'#1688ff';
    root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){
      if(m.name==='Base_Steel'||m.name==='Brushed_Metal'){m.color.set('#151e29');m.metalness=.9;m.roughness=.2;}
      if(m.name==='Team_Primary'){if(name.includes('target')){m.color.set(team==='red'?'#27050b':'#041531');m.metalness=.65;m.roughness=.24;}}
      if(m.name==='Frame_White'){m.color.set('#abb4bf');m.metalness=.95;m.roughness=.16;}
    }});
    if(name==='player-bumper')kit.contact(root,.82,.72,0,.008,.035);
    if(name==='round-target'||name==='triangle-target')kit.contact(root,.95,.95,0,.008,.03);
    if(name==='triangle-target'){
      pipe([[-.29,.215,.2],[.29,.215,.2],[0,.215,-.25],[-.29,.215,.2]],.016,team==='red'?redLight:blueLight,root);
    }
    if(name==='player-bumper'||name==='round-target'){
      const radius=name==='player-bumper'?.251:.345, y=name==='player-bumper'?.055:.19;
      const rim=add(new THREE.TorusGeometry(radius+.015,.024,8,48),metal,0,y-.015,0,root);rim.rotation.x=Math.PI/2;
      const torus=add(new THREE.TorusGeometry(radius,.012,6,48),team==='red'?redLight:blueLight,0,y,0,root);torus.rotation.x=Math.PI/2;torus.castShadow=false;
      const glow=add(new THREE.PlaneGeometry(radius*3.2,radius*3.2),new THREE.MeshBasicMaterial({map:glowTexture,color:tint,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),0,.013,0,root);glow.rotation.x=-Math.PI/2;glow.castShadow=false;
    }
  }
  function numberPlayer(root,number){
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='white';c.font='bold 92px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(number,64,66);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;textures.push(t);
    // Sample the actual batched shirt surface; fixed offsets hid numbers inside the torso.
    const shirt=[];root.traverse(o=>{if(o.isMesh && o.material.name==='Team_Primary')shirt.push(o);});
    for(const side of [-1,1]){
      const ray=new THREE.Raycaster(new THREE.Vector3(0,.65,side*.5),new THREE.Vector3(0,0,-side));
      const hits=shirt.flatMap(o=>ray.intersectObject(new THREE.Mesh(o.geometry,o.material),false));
      const surface=hits.sort((a,b)=>a.distance-b.distance)[0]?.point.z ?? side*.11;
      const patch=add(new THREE.PlaneGeometry(.135,.14),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),0,.65,surface+side*.012,root);
      if(side<0)patch.rotation.y=Math.PI;patch.castShadow=false;
    }
    root.traverse(o=>{if(o.isMesh && o.material.map===t)o.userData.shirtNumber=true;});
    root.userData.numbered=true;
  }
  return {group,textures,dress,numberPlayer,ready,failedAssets,dispose(){textures.forEach(t=>t.dispose());},setReduced(low){bodies.count=low?Math.floor(crowd.length*.65):crowd.length;heads.count=bodies.count;}};
}
