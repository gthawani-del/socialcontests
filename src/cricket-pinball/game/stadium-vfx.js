import * as THREE from 'three';
export function createStadiumVfx(scene,table,ball){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const points=Array.from({length:14},()=>new THREE.Vector3());
  const trailGeometry=new THREE.BufferGeometry().setFromPoints(points);
  const trail=new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({color:'#ffdda0',transparent:true,opacity:.42,depthWrite:false}));scene.add(trail);
  const positions=new Float32Array(32*3),velocities=new Float32Array(32*3);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const sparks=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#ffdc82',size:.022,transparent:true,opacity:0,depthWrite:false}));scene.add(sparks);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.11,.14,36),new THREE.MeshBasicMaterial({color:'#ffd77b',side:THREE.DoubleSide,transparent:true,opacity:0,depthWrite:false}));ring.rotation.x=-Math.PI/2;scene.add(ring);
  let life=0,ringLife=0,wasLive=false;
  function burst(position,color){
    if(reduced)return;life=.3;sparks.material.color.set(color);
    for(let i=0;i<32;i++){
      const angle=i*2.39996,speed=.3+(i%5)*.12;
      positions.set([position.x,position.y,position.z],i*3);
      velocities.set([Math.cos(angle)*speed,.2+(i%7)*.06,Math.sin(angle)*speed],i*3);
    }geometry.attributes.position.needsUpdate=true;
  }
  return{handle(event){
    if(event.type==='MATCH_RESET'){life=ringLife=0;wasLive=false;trail.visible=false;}
    if(event.type==='BAT_CONTACT')burst(ball.position,'#ffe2a0');
    if(event.type==='OUTCOME'){
      const zone=table.deliveryZones.find(z=>z.id===event.metadata?.zoneId);
      if(zone && !['DOT','DEAD_BALL','WICKET'].includes(event.outcome)){
        ring.position.set(zone.position[0],.07,zone.position[1]);ring.material.color.set('#ffd77b');ringLife=.65;
      }
      if(event.outcome==='WICKET'){ring.position.set(0,.07,table.playfield.drain.z);ring.material.color.set('#e66b55');ringLife=.65;burst(ball.position,'#e66b55');}
    }
  },update(dt,live){
    trail.visible=live&&!reduced;
    if(!wasLive||!live)points.forEach(p=>p.copy(ball.position));else{for(let i=points.length-1;i>0;i--)points[i].copy(points[i-1]);points[0].copy(ball.position);}
    trailGeometry.setFromPoints(points);wasLive=live;
    life=Math.max(0,life-dt);sparks.material.opacity=life/.3;
    if(life>0){for(let i=0;i<positions.length;i++)positions[i]+=velocities[i]*dt;geometry.attributes.position.needsUpdate=true;}
    ringLife=Math.max(0,ringLife-dt);ring.material.opacity=ringLife/.65;ring.scale.setScalar(reduced?1:1+(1-ringLife/.65)*2);
  },getState:()=>({trail:trail.visible,sparks:life>0,target: ringLife>0})};
}
