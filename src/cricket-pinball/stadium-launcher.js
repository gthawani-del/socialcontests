import * as THREE from 'three';

// Visible shooter lane and mechanism share the physics route, including its turn.
export function createStadiumLauncher(scene, table, model) {
  const group = new THREE.Group(); group.name = 'Integrated_Shooter_Lane'; scene.add(group);
  const gold = new THREE.MeshStandardMaterial({color:'#bc995d',metalness:.65,roughness:.32});
  const navy = new THREE.MeshStandardMaterial({color:'#07111b',metalness:.15,roughness:.65});
  const path = table.launcher.launchPath;
  // Cut a real channel through decorative seating, rather than drawing a lever over it.
  model.updateMatrixWorld(true);
  const channel = [{x:path[0].x,z:path[0].z+1.5},...path];
  const inside = p => channel.slice(1).some((b,i)=>{
    const a=channel[i],dx=b.x-a.x,dz=b.z-a.z;
    const t=THREE.MathUtils.clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz),0,1);
    return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz)<.22;
  });
  model.traverse(mesh=>{
    if(!mesh.isMesh || !/^(Crowd_Band|Seating_Terrace|Individual_Seats|Tier_Gold|R7_(Tier|Upper)|R9_Tier|R11_Tier|Boundary_(Cushion|Gold|Light|Bollard))/.test(mesh.name))return;
    const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),p=g.getAttribute('position'),keep=[];
    for(let i=0;i<p.count;i+=3){
      const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j).applyMatrix4(mesh.matrixWorld));
      const centre=points[0].clone().add(points[1]).add(points[2]).multiplyScalar(1/3);
      if(!inside(centre)&&!points.some(inside))keep.push(i,i+1,i+2);
    }
    g.setIndex(keep);mesh.geometry=g;
  });
  const base=new THREE.Mesh(new THREE.BoxGeometry(.28,.18,.65),navy);base.position.set(path[0].x,.09,path[0].z+.3);group.add(base);
  const vertices=[], indices=[];
  const edges=[[],[]];
  path.forEach((p,i)=>{
    const a=path[Math.max(0,i-1)], b=path[Math.min(path.length-1,i+1)];
    const length=Math.hypot(b.x-a.x,b.z-a.z), nx=-(b.z-a.z)/length, nz=(b.x-a.x)/length;
    for(const [j,sign] of [-1,1].entries()) {
      const x=p.x+nx*.095*sign,z=p.z+nz*.095*sign;
      vertices.push(x,p.height-.008,z); edges[j].push(new THREE.Vector3(x,p.height+.035,z));
    }
    if(i){const k=i*2;indices.push(k-2,k,k-1,k-1,k,k+1);}
  });
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  navy.side=THREE.DoubleSide;
  group.add(new THREE.Mesh(geometry,navy));
  for(const edge of edges) group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge),120,.014,6,false),gold));
  const mechanism = new THREE.Group(); mechanism.position.set(path[0].x,.24,path[0].z);group.add(mechanism);
  const handleMaterial=new THREE.MeshStandardMaterial({color:'#f3e2b1',metalness:.18,roughness:.45,emissive:'#d3ad59',emissiveIntensity:0});
  const knob=new THREE.Mesh(new THREE.CylinderGeometry(.092,.092,.07,24),handleMaterial);knob.rotation.x=Math.PI/2;mechanism.add(knob);
  // The spring and shaft ARE the power scale. Each physical section has its
  // own material so charging lights the mechanism itself, not a strip below it.
  const spring=[], shaft=[];
  const powerColors=['#e4bb3f','#55b866','#ef665b'].map(color=>new THREE.Color(color));
  for(let i=0;i<12;i++) {
    const material=new THREE.MeshStandardMaterial({metalness:.2,roughness:.42});
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.048,.013,8,20),material);
    const rod=new THREE.Mesh(new THREE.CylinderGeometry(.024,.024,1,12),material);
    rod.rotation.x=Math.PI/2;mechanism.add(ring,rod);spring.push(ring);shaft.push(rod);
  }
  const tip=new THREE.Mesh(new THREE.CylinderGeometry(.061,.061,.035,16),gold);tip.rotation.x=Math.PI/2;mechanism.add(tip);
  // Contrast and physical movement identify the control; no idle glow or halo.
  const housing=new THREE.Mesh(new THREE.BoxGeometry(.24,.055,.40),navy);
  housing.position.set(0,-.09,.24);mechanism.add(housing);
  const gripMaterial=new THREE.MeshStandardMaterial({color:'#152633',roughness:.8});
  const grip=new THREE.Mesh(new THREE.TorusGeometry(.093,.012,6,24),gripMaterial);
  grip.rotation.x=Math.PI/2;knob.add(grip);
  let glow=0;
  const world=new THREE.Vector3();
  return {
    getState:()=>({glow}),
    update(state,camera,viewport,element) {
      const active=state.visible && state.enabled && !state.cpuMode;
      glow=active && state.dragging ? .12+state.pull*.18 : 0;
      handleMaterial.emissiveIntensity=glow;
      const pull=state.pull;knob.position.z=.32+pull*.24;tip.position.z=.08+pull*.24;
      knob.scale.setScalar(active?1.2:1);
      const travel=.18+pull*.23, power=.2+.8*pull;
      spring.forEach((ring,i)=>{
        const threshold=.24+i/11*.76;
        const color=powerColors[threshold>(state.band?.red??.9)?2:threshold<(state.band?.low??.5)?0:1];
        const charged=state.visible && threshold<=power;
        ring.material.color.copy(color).multiplyScalar(charged?1:.4);
        ring.material.emissive.copy(color);
        ring.material.emissiveIntensity=charged?.45:0;
        ring.position.z=.11+i*travel/11;
        shaft[i].position.z=.11+(i+.5)*travel/12;
        shaft[i].scale.y=travel/12;
      });
      // Keep the mechanism visible as table artwork; only the invisible hit area
      // changes ownership. No screen-space lever is drawn over the playfield.
      const size=viewport.getBoundingClientRect();
      mechanism.updateWorldMatrix(true, true);
      knob.getWorldPosition(world).project(camera);
      element.style.left=`${THREE.MathUtils.clamp((world.x+1)*size.width/2-32,0,Math.max(0,size.width-64))}px`;
      element.style.top=`${THREE.MathUtils.clamp((1-world.y)*size.height/2-50,0,Math.max(0,size.height-100))}px`;
    }
  };
}
