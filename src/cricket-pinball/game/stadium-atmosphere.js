import * as THREE from 'three';

// Decorative spectators occupy sampled authored stands, never the playing surface.
// Call before static batching removes the source crowd meshes.
export function createStadiumAtmosphere(scene,model){
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  const locations=[];const point=new THREE.Vector3();
  model.updateMatrixWorld(true);
  model.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.visible||!/^Crowd_Band/.test(mesh.name))return;
    const attribute=mesh.geometry.getAttribute('position'),index=mesh.geometry.index;
    const count=index?.count??attribute.count;
    // Evenly sample retained triangles; this respects the cut shooter corridor.
    const stride=Math.max(3,Math.floor(count/48/3)*3);
    for(let i=0;i<count&&locations.length<240;i+=stride){
      point.set(0,0,0);
      for(let j=0;j<3;j++)point.add(new THREE.Vector3().fromBufferAttribute(attribute,index?index.getX(i+j):i+j));
      point.multiplyScalar(1/3).applyMatrix4(mesh.matrixWorld);
      if(point.z< -1.35 || (point.x>1.55&&point.z>1) || (point.x/1.65)**2+(point.z/2.9)**2<1.03)continue;
      locations.push(point.clone().add(new THREE.Vector3(0,.025,0)));
    }
  });
  const crowd=new THREE.InstancedMesh(new THREE.SphereGeometry(.012,5,4),new THREE.MeshBasicMaterial({color:'#adbbc4'}),Math.max(1,locations.length));
  crowd.name='Animated_Crowd_Accents';crowd.count=locations.length;crowd.frustumCulled=false;
  const transform=new THREE.Object3D(),colors=['#587789','#c6b795','#7893a3','#385c86'];
  locations.forEach((p,i)=>{transform.position.copy(p);transform.scale.set(1,.95,1);transform.updateMatrix();crowd.setMatrixAt(i,transform.matrix);crowd.setColorAt(i,new THREE.Color(colors[i%colors.length]));});
  crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(crowd);
  const flash=new THREE.Mesh(new THREE.SphereGeometry(.015,6,4),new THREE.MeshBasicMaterial({color:'#e5efff',transparent:true,opacity:0,depthWrite:false,toneMapped:false}));
  flash.name='Spectator_Camera_Flash';scene.add(flash);
  let elapsed=0,nextFlash=8,flashLife=0,reaction=0,flashCount=0,quality='high';
  return{
    handle(event){
      if(event.type==='MATCH_RESET'){elapsed=0;nextFlash=8;flashLife=reaction=0;flash.material.opacity=0;}
      if(event.type==='OUTCOME'&&['FOUR','SIX','WICKET'].includes(event.outcome))reaction=1.2;
    },
    update(dt,nextQuality='high'){
      quality=nextQuality;
      const active=!reduced&&quality!=='low';crowd.visible=active;flash.visible=active;
      if(dt<=0||!active)return;
      elapsed+=dt;reaction=Math.max(0,reaction-dt);flashLife=Math.max(0,flashLife-dt);
      // Soft local waves, no camera motion, full-screen pulses or random flicker.
      locations.forEach((p,i)=>{
        transform.position.copy(p);transform.position.y+=Math.max(0,Math.sin(elapsed*1.35+i*.73))*(reaction>0?.018:.005);
        transform.updateMatrix();crowd.setMatrixAt(i,transform.matrix);
      });crowd.instanceMatrix.needsUpdate=true;
      if(elapsed>=nextFlash&&locations.length){
        flash.position.copy(locations[(flashCount*47+13)%locations.length]);flash.position.y+=.025;
        flashLife=.10;flashCount++;nextFlash=elapsed+9+(flashCount%5)*1.7;
      }
      flash.material.opacity=Math.min(.6,flashLife*6);
    },
    getState:()=>({reducedMotion:reduced,quality,spectators:locations.length,active:crowd.visible,elapsed,flashCount,flash:flashLife>0,reaction:reaction>0})
  };
}
