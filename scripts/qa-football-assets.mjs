import { createServer } from 'vite';
import assert from 'node:assert/strict';
import {mkdir,readdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5191},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const directory='docs/football-pinball/assets/glb-qa';await mkdir(directory,{recursive:true});
const names=process.argv.slice(2).length?process.argv.slice(2):(await readdir('public/models/football')).filter(f=>f.endsWith('.glb')).map(f=>f.slice(0,-4));
try{
 const page=await browser.newPage({viewport:{width:800,height:600}});await page.addInitScript(()=>sessionStorage.setItem('infinite-pinball-demo-access','granted'));
 for(const name of names){
  await page.goto('http://127.0.0.1:5191/football-pinball/');
  const result=await page.evaluate(async name=>{
   const THREE=await import('/node_modules/three/build/three.module.js');
   const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
   const gltf=await new GLTFLoader().loadAsync('/models/football/'+name+'.glb');
   const scene=new THREE.Scene();scene.background=new THREE.Color('#16222c');
   const toRemove=[];gltf.scene.traverse(o=>{if(o.isCamera||o.isLight)toRemove.push(o);});toRemove.forEach(o=>o.removeFromParent());scene.add(gltf.scene);
   const bounds=new THREE.Box3().setFromObject(gltf.scene,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
   const span=Math.max(size.x,size.y,size.z);const camera=new THREE.PerspectiveCamera(35,800/600,Math.max(.01,span/100),span*10);
   camera.position.copy(center).add(new THREE.Vector3(span*1.6,span*1.15,span*1.8));camera.lookAt(center);
   scene.add(new THREE.HemisphereLight('#e5f0ff','#314032',2.5));const light=new THREE.DirectionalLight('#fff2df',3);light.position.set(3,7,5);scene.add(light);
   const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(800,600);renderer.setPixelRatio(1);renderer.toneMapping=THREE.ACESFilmicToneMapping;
   document.body.innerHTML='';document.body.append(renderer.domElement);renderer.render(scene,camera);
   const geometries=[];gltf.scene.traverse(o=>{if(o.isMesh)geometries.push({name:o.name,vertices:o.geometry.attributes.position.count,triangles:(o.geometry.index?.count||o.geometry.attributes.position.count)/3,uv:!!o.geometry.attributes.uv,material:o.material.name});});
   return {name,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},size:size.toArray(),meshes:geometries,drawCalls:renderer.info.render.calls};
  },name);
  assert(result.meshes.length>0);assert(result.size.every(n=>Number.isFinite(n)&&n>0));assert(result.meshes.every(m=>m.uv));
  await page.screenshot({path:directory+'/'+name+'.png'});await writeFile(directory+'/'+name+'.json',JSON.stringify(result,null,2));console.log(name+' GLB loaded, dimensions '+result.size.map(n=>n.toFixed(3)).join(' x ')+', '+result.drawCalls+' calls');
 }
}finally{await browser.close();await server.close();}
