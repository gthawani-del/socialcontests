import * as THREE from 'three';

// Visible shooter lane and mechanism share the physics route, including its turn.
export function createStadiumLauncher(scene, table, model) {
  const group = new THREE.Group(); group.name = 'Integrated_Shooter_Lane'; scene.add(group);
  const gold = new THREE.MeshStandardMaterial({color:'#bc995d',metalness:.65,roughness:.32});
  const steel = new THREE.MeshStandardMaterial({color:'#b9c7d2',metalness:.45,roughness:.38,emissive:'#32495a',emissiveIntensity:.35});
  const navy = new THREE.MeshStandardMaterial({color:'#102738',metalness:.3,roughness:.5});
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
  const rod=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.38,12),steel);rod.rotation.x=Math.PI/2;rod.position.z=.22;mechanism.add(rod);
  const knob=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,.07,24),gold);knob.rotation.x=Math.PI/2;mechanism.add(knob);
  const spring=[];
  for(let i=0;i<12;i++) {const ring=new THREE.Mesh(new THREE.TorusGeometry(.048,.01,6,16),steel);mechanism.add(ring);spring.push(ring);}
  const tip=new THREE.Mesh(new THREE.CylinderGeometry(.061,.061,.035,16),gold);tip.rotation.x=Math.PI/2;mechanism.add(tip);
  const glowMaterial = gold.clone(); glowMaterial.emissive.set('#ffc65b'); knob.material = glowMaterial; tip.material = glowMaterial;
  const halo = new THREE.Mesh(new THREE.RingGeometry(.095,.125,40),new THREE.MeshBasicMaterial({color:'#ffd77b',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
  halo.rotation.x=-Math.PI/2;halo.position.set(path[0].x,.19,path[0].z+.32);group.add(halo);
  let wasDragging=false, flashUntil=0, glow=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const world=new THREE.Vector3();
  return {
    getState:()=>({glow}),
    update(state,camera,viewport,element) {
      const now=performance.now();
      if(wasDragging && !state.dragging && !state.enabled) flashUntil=now+180;
      wasDragging=state.dragging;
      const active=state.visible && state.enabled && !state.cpuMode;
      const intensity=now<flashUntil?2.5:active?(state.dragging?.8+state.pull*1.8:reduced?.65:.6+.25*Math.sin(now*.004)):0;
      glow=intensity;glowMaterial.emissiveIntensity=intensity; halo.material.opacity=Math.min(.8,intensity*.4);
      halo.scale.setScalar(1+(active && !reduced?.12*Math.sin(now*.004):0));
      const pull=state.pull;knob.position.z=.32+pull*.13;tip.position.z=.08+pull*.13;
      spring.forEach((ring,i)=>{ring.position.z=.11+i*(.18+pull*.12)/11;});
      // Keep the mechanism visible as table artwork; only the invisible hit area
      // changes ownership. No screen-space lever is drawn over the playfield.
      const size=viewport.getBoundingClientRect();
      world.set(path[0].x,.24,path[0].z+.30).project(camera);
      element.style.left=`${THREE.MathUtils.clamp((world.x+1)*size.width/2-32,0,Math.max(0,size.width-64))}px`;
      element.style.top=`${THREE.MathUtils.clamp((1-world.y)*size.height/2-50,0,Math.max(0,size.height-100))}px`;
    }
  };
}
