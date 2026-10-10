import * as THREE from 'three';
export function createStadiumVfx(scene,table,ball){
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  const points=Array.from({length:10},()=>new THREE.Vector3());
  const trailGeometry=new THREE.BufferGeometry().setFromPoints(points);
  const trail=new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({color:'#fff0cf',transparent:true,opacity:.38,depthWrite:false}));scene.add(trail);
  const positions=new Float32Array(24*3),velocities=new Float32Array(24*3);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const sparks=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#ffdc82',size:.018,transparent:true,opacity:0,depthWrite:false}));sparks.frustumCulled=false;scene.add(sparks);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.065,.082,32),new THREE.MeshBasicMaterial({color:'#ffd77b',side:THREE.DoubleSide,transparent:true,opacity:0,depthWrite:false}));ring.rotation.x=-Math.PI/2;scene.add(ring);
  // A contact shadow makes airborne height readable even on low shadow-map quality.
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(table.ball.radius*1.1,24),new THREE.MeshBasicMaterial({color:'#081014',transparent:true,opacity:.45,depthWrite:false}));
  shadow.name='Ball_Contact_Shadow';shadow.rotation.x=-Math.PI/2;shadow.position.y=.008;scene.add(shadow);
  let life=0,ringLife=0,ringDuration=.65,wasLive=false,sampleTime=0,quality='high';
  function burst(position,color){
    if(reduced||quality==='low')return;life=.24;sparks.material.color.set(color);
    for(let i=0;i<24;i++){
      const angle=i*2.39996,speed=.2+(i%5)*.08;
      positions.set([position.x,position.y,position.z],i*3);
      velocities.set([Math.cos(angle)*speed,.15+(i%7)*.04,Math.sin(angle)*speed],i*3);
    }geometry.attributes.position.needsUpdate=true;
  }
  function impact(x,z,color,duration){ring.position.set(x,.013,z);ring.material.color.set(color);ringLife=ringDuration=duration;ring.scale.setScalar(1);ring.material.opacity=.7;}
  return{handle(event){
    if(event.type==='MATCH_RESET'){life=ringLife=0;wasLive=false;trail.visible=shadow.visible=false;sparks.material.opacity=ring.material.opacity=0;}
    if(event.type==='BAT_CONTACT')burst(ball.position,'#ffe2a0');
    if(event.type==='DELIVERY_BOUNCE'){
      const bounce=event.event??event;
      impact(bounce.x,bounce.z,'#e5d3ae',.26);
    }
    if(event.type==='OUTCOME'){
      const zone=table.deliveryZones.find(z=>z.id===event.metadata?.zoneId);
      if(zone && !['DOT','DEAD_BALL','WICKET'].includes(event.outcome)){
        impact(zone.position[0],zone.position[1],'#ffd77b',.65);
        burst(ball.position,'#ffde94');
      }
      if(event.outcome==='WICKET'){impact(0,table.playfield.drain.z,'#e66b55',.65);burst(ball.position,'#e66b55');}
    }
  },update(dt,live,nextQuality='high'){
    quality=nextQuality;
    sparks.visible=!reduced&&quality!=='low';
    shadow.visible=live;
    const height=Math.max(0,ball.position.y-table.ball.radius);
    shadow.position.set(ball.position.x,.008,ball.position.z);
    shadow.scale.setScalar(1+Math.min(height,1)*1.25);
    shadow.material.opacity=.48/(1+height*2);
    if(dt<=0)return; // Pausing freezes effects and their history.
    trail.visible=live&&!reduced&&quality!=='low';
    if(!wasLive||!live){points.forEach(p=>p.copy(ball.position));sampleTime=0;}
    else{
      sampleTime+=dt;
      if(sampleTime>=1/60){for(let i=points.length-1;i>0;i--)points[i].copy(points[i-1]);sampleTime=0;}
      points[0].copy(ball.position);
      // Keep history short even after a fast shot or low frame rate.
      for(let i=1;i<points.length;i++)if(points[i].distanceTo(ball.position)>.55)points[i].copy(points[i-1]);
    }
    const trailPositions=trailGeometry.attributes.position;
    points.forEach((p,i)=>trailPositions.setXYZ(i,p.x,p.y,p.z));trailPositions.needsUpdate=true;trail.frustumCulled=false;wasLive=live;
    life=Math.max(0,life-dt);sparks.material.opacity=life/.24;
    if(life>0){for(let i=0;i<positions.length;i++)positions[i]+=velocities[i]*dt;geometry.attributes.position.needsUpdate=true;}
    ringLife=Math.max(0,ringLife-dt);ring.material.opacity=.7*ringLife/ringDuration;ring.scale.setScalar(reduced?1:1+(1-ringLife/ringDuration)*1.5);
  },getState:()=>({trail:trail.visible,sparks:life>0,target:ringLife>0,shadow:shadow.visible,shadowScale:shadow.scale.x,shadowOpacity:shadow.material.opacity,reducedMotion:reduced,quality})};
}
