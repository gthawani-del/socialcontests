import * as THREE from 'three';

function rounded(w, h, r) {
  const p = new THREE.Shape();
  p.moveTo(-w/2+r,-h/2); p.lineTo(w/2-r,-h/2);
  p.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r); p.lineTo(w/2,h/2-r);
  p.quadraticCurveTo(w/2,h/2,w/2-r,h/2); p.lineTo(-w/2+r,h/2);
  p.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r); p.lineTo(-w/2,-h/2+r);
  p.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
  return p;
}

// Shared presentation geometry; inner opening stays outside the physics field.
// The near apron is low, while the sides rise toward the rear goal.
export function addFootballCabinet(parent, {metal, black}) {
  const rise = localY => .58 * THREE.MathUtils.smoothstep(localY, -5.7, 5.7);
  function ring(w,h,r,iw,ih,ir,depth,y,material,profile=false) {
    const shape=rounded(w,h,r);
    shape.holes.push(new THREE.Path(rounded(iw,ih,ir).getPoints(24)));
    const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,
      bevelSegments:4,bevelSize:.045,bevelThickness:.035,curveSegments:24});
    if(profile) {
      const position=g.attributes.position;
      for(let i=0;i<position.count;i++) {
        // Translate the lip, but taper the wall down to a level chassis base.
        const weight=depth>.2 ? THREE.MathUtils.clamp(position.getZ(i)/depth,0,1) : 1;
        position.setZ(i,position.getZ(i)+rise(position.getY(i))*weight);
      }
      g.computeVertexNormals();
    }
    const mesh=new THREE.Mesh(g,material);
    mesh.rotation.x=-Math.PI/2;mesh.position.y=y;
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
  }
  ring(7.58,12.08,.85,6.12,11.02,.44,.48,-.46,black);
  ring(7.6,12.1,.85,7.22,11.72,.72,.14,-.04,metal);
  ring(7.5,12.0,.82,6.62,11.36,.57,.36,.04,black,true);
  ring(7.59,12.09,.86,7.1,11.61,.68,.09,.40,metal,true);
  ring(7.4,11.9,.78,7.27,11.77,.73,.025,.50,black,true);
  ring(6.42,11.32,.51,6.16,11.02,.43,.09,.17,metal);
}
