import * as THREE from 'three';

export function createStadiumFielders(scene, table) {
  const figures = new Map();
  const kit = new THREE.MeshStandardMaterial({color:'#579bd5',roughness:.85});
  const skin = new THREE.MeshStandardMaterial({color:'#b87e55',roughness:.9});
  for (const f of table.fielders || []) {
    const group = new THREE.Group(); group.position.set(f.x,0,f.z); scene.add(group);
    const ring = new THREE.Mesh(new THREE.RingGeometry(f.radius-.012,f.radius,32),new THREE.MeshBasicMaterial({color:'#efbe62',side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2;ring.position.y=.008;group.add(ring);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.042,.09,4,8),kit);body.position.y=.16;group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.036,10,8),skin);head.position.y=.27;group.add(head);
    for (const sign of [-1,1]) {
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(.018,.016,.095,8),kit);leg.position.set(sign*.026,.06,0);group.add(leg);
    }
    const arms = new THREE.Group(); arms.position.y=.20;group.add(arms);
    for (const sign of [-1,1]) {
      const arm=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.105,8),skin);arm.rotation.z=sign*.75;arm.position.set(sign*.055,.015,0);arms.add(arm);
    }
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#071622';ctx.fillRect(0,0,256,64);ctx.fillStyle='#ffe0a1';ctx.font='bold 26px Arial';ctx.textAlign='center';ctx.fillText(f.label,128,42);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false}));label.position.set(0,.40,0);label.scale.set(.34,.085,1);group.add(label);
    figures.set(f.id,{arms,ring,elapsed:Infinity});
  }
  return {
    handle(event) {
      if(event.type==='MATCH_RESET')for(const figure of figures.values())figure.elapsed=Infinity;
      if(event.type==='OUTCOME' && event.metadata?.reason==='CAUGHT_OUT') {
        const figure=figures.get(event.metadata.fielderId);if(figure)figure.elapsed=0;
      }
    },
    update(dt) {
      for(const f of figures.values()) {
        f.elapsed+=dt;const active=f.elapsed<1.35;
        f.arms.position.y=active?.27:.20;
        f.ring.material.color.set(active?'#ff795c':'#efbe62');
      }
    }
  };
}
