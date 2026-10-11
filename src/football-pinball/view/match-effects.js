import * as THREE from 'three';

// Shared, bounded feedback: eight shock rings and 96 GPU points. No post-process passes.
export function createMatchEffects(scene) {
  const group=new THREE.Group();group.name='Match feedback';scene.add(group);
  const ringGeometry=new THREE.RingGeometry(.82,1,32);
  const rings=Array.from({length:8},()=>{
    const material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
    const mesh=new THREE.Mesh(ringGeometry,material);mesh.rotation.x=-Math.PI/2;mesh.visible=false;group.add(mesh);
    return {mesh,born:-10,duration:.5,size:1};
  });
  const capacity=96,positions=new Float32Array(capacity*3),colours=new Float32Array(capacity*3);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colours,3));
  const material=new THREE.PointsMaterial({size:.075,vertexColors:true,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending});
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;group.add(points);
  const particles=Array.from({length:capacity},()=>({born:-10,duration:0}));
  const trails=Array.from({length:3},()=>{
    const data=new Float32Array(18*3),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(data,3));g.setDrawRange(0,0);
    const m=new THREE.LineBasicMaterial({color:'#b4e6ff',transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending});
    const line=new THREE.Line(g,m);line.frustumCulled=false;group.add(line);return {line,g,m,data,id:null,history:[]};
  });
  let cursor=0,ringCursor=0,lastId=0,lastTick=-1,session,clock=0,low=false,count=0,lastTime=performance.now();
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
  function clear(){lastId=0;clock=0;for(const p of particles)p.duration=0;for(const r of rings)r.mesh.visible=false;for(const t of trails){t.history=[];t.id=null;}}
  function burst(x,y,z,color,size=1){
    const c=new THREE.Color(color),r=rings[ringCursor++%rings.length];
    r.born=clock;r.duration=reduceMotion.matches?.25:.65;r.size=size;r.mesh.position.set(x,Math.max(.04,y),z);r.mesh.material.color.copy(c);r.mesh.visible=true;
    if(reduceMotion.matches)return;
    for(let i=0;i<(low?4:12);i++){
      const p=particles[cursor++%capacity],angle=i*2.39996;
      Object.assign(p,{born:clock,duration:.5,x,y:Math.max(.08,y),z,vx:Math.cos(angle)*size*1.8,vz:Math.sin(angle)*size*1.8,vy:.8+(i%3)*.25,c});
    }
  }
  function update(s){
    const token=s.events?.[0]?.sessionId;
    if(token!==session||s.tick<lastTick){clear();session=token;lastTick=s.tick;}
    const now=performance.now();
    if(!s.paused)clock+=Math.min(.05,Math.max(0,(now-lastTime)/1000));
    lastTime=now;
    const moved=s.tick!==lastTick;
    lastTick=s.tick;
    trails.forEach((t,i)=>{
      const b=s.balls?.[i];t.line.visible=!!b&&!low&&!reduceMotion.matches;
      if(!b){t.history=[];return;}
      if(t.id!==b.id){t.id=b.id;t.history=[];}
      if(moved&&!s.paused){
        const head=[b.x,b.height+.015,-b.y],previous=t.history[0];
        if(previous&&Math.hypot(...head.map((v,k)=>v-previous[k]))>1.5)t.history=[];
        t.history.unshift(head);t.history.length=Math.min(18,t.history.length);
      }
      t.history.forEach((p,j)=>t.data.set(p,j*3));t.g.setDrawRange(0,t.history.length);t.g.attributes.position.needsUpdate=true;
    });
    for(const event of s.events||[]){
      if(event.eventId<=lastId)continue;
      lastId=event.eventId;
      // Do not replay a whole backlog after tab suspension or a late online join.
      if(s.tick-event.tick>30)continue;
      const ball=s.balls?.find(b=>b.id===event.ballId);
      const target=s.targets?.find(t=>t.id===event.targetId);
      const boot=s.boots?.find(b=>b.id===event.targetId);
      let x=target?.x??ball?.x??0,y=.08,z=-(target?.y??ball?.y??0),color=event.actorId==='red'?'#ff5363':'#52b7ff',size=.5;
      if(event.type==='GOAL_SCORED'){
        const far=s.defendingEnd?.[event.actorId]!=='far';z=far?-4.85:4.85;size=1.35;color='#ffcf55';
      } else if(event.type==='KEEPER_SAVE'){
        const keeper=s.keepers?.find(k=>k.team===event.actorId);x=keeper?.x??x;z=-(keeper?.y??0);size=.8;
      } else if(event.type==='TARGET_HIT'){y=(target?.height||.3)+.04;color=target?.type==='skill'?'#54bfff':target?.type==='pass'?'#ff6173':'#ffcf55';size=.65;}
      else if(event.type==='PERFECT_KICK'){color='#ffffff';size=.75;}
      else if(event.type==='COLLISION'&&boot){x=ball?.x??boot.x;z=-(ball?.y??boot.y);size=.35;}
      else if(['BANK_ACCEPTED','MULTIBALL_STARTED','TIME_EXTENDED'].includes(event.type)){color='#6fffc3';size=1;}
      else continue;
      burst(x,y,z,color,size);count++;
    }
    for(const r of rings){
      if(!r.mesh.visible)continue;
      const t=(clock-r.born)/r.duration;if(t>=1){r.mesh.visible=false;continue;}
      r.mesh.scale.setScalar(r.size*(reduceMotion.matches?.8:.8+t));r.mesh.material.opacity=(1-t)*.55;
    }
    let visible=0;
    for(const p of particles){
      const age=clock-p.born;if(age>=p.duration||p.duration===0)continue;
      const k=visible++*3,fade=1-age/p.duration;
      positions[k]=p.x+p.vx*age;positions[k+1]=Math.max(.025,p.y+p.vy*age-2*age*age);positions[k+2]=p.z+p.vz*age;
      colours[k]=p.c.r*fade;colours[k+1]=p.c.g*fade;colours[k+2]=p.c.b*fade;
    }
    geometry.setDrawRange(0,visible);geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;
  }
  return {update,setReduced(value){low=value;},metrics:()=>({triggered:count,activeRings:rings.filter(r=>r.mesh.visible).length,particles:geometry.drawRange.count,capacity,reduced:low,reducedMotion:reduceMotion.matches}),dispose(){group.removeFromParent();for(const t of trails){t.g.dispose();t.m.dispose();}ringGeometry.dispose();for(const r of rings)r.mesh.material.dispose();geometry.dispose();material.dispose();}};
}
