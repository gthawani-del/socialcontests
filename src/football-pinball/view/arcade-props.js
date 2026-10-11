import * as THREE from 'three';

// Shared decorative props. No colliders, scores or mode rules live here.
export function createArcadeProps({metal,black}) {
  function part(root,geometry,material,y=0){const m=new THREE.Mesh(geometry,material);m.position.y=y;m.castShadow=true;m.receiveShadow=true;root.add(m);return m;}
  function bumper({face,light,radius=.52}){
    const root=new THREE.Group();root.name='ART_arcade_bumper';
    const profile=[[0,0],[.87,0],[1,.07],[1,.15],[.9,.19],[.85,.34],[.94,.38],[.96,.46],[.87,.52],[0,.56]].map(([r,y])=>new THREE.Vector2(r*radius,y));
    part(root,new THREE.LatheGeometry(profile,48),metal);
    part(root,new THREE.CylinderGeometry(radius*.9,radius*.92,.18,48),black,.27);
    const cap=part(root,new THREE.SphereGeometry(radius*.88,40,16,0,Math.PI*2,0,Math.PI/2),face,.48);cap.scale.y=.18;
    for(const y of [.17,.48]){const ring=part(root,new THREE.TorusGeometry(radius*.91,.025,8,48),light,y);ring.rotation.x=-Math.PI/2;}
    const star=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?.095:.21;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?star.lineTo(x,y):star.moveTo(x,y);}star.closePath();
    const icon=part(root,new THREE.ShapeGeometry(star),new THREE.MeshBasicMaterial({color:'#eaf8ff',side:THREE.DoubleSide}),.615);icon.rotation.x=-Math.PI/2;
    return root;
  }
  function wing({face,light}){
    const root=new THREE.Group();root.name='ART_arcade_wing';
    const shape=new THREE.Shape();shape.moveTo(-.4,-.55);shape.lineTo(.42,-.32);shape.lineTo(.32,.55);shape.lineTo(-.4,.55);shape.closePath();
    function layer(material,y,scale,depth){const m=part(root,new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:3,bevelSize:.045,bevelThickness:.035,steps:1}),material,y);m.rotation.x=-Math.PI/2;m.scale.set(scale,scale,1);return m;}
    layer(black,.02,1.15,.2);layer(metal,.24,1.08,.06);layer(light,.32,1,.025);layer(face,.38,.86,.035);
    for(const [x,z] of [[-.3,-.4],[.25,-.25],[.2,.4],[-.3,.4]]){const screw=part(root,new THREE.CylinderGeometry(.045,.045,.025,12),metal,.47);screw.position.x=x;screw.position.z=z;}
    const arrow=new THREE.Shape();arrow.moveTo(0,-.22);arrow.lineTo(.18,.02);arrow.lineTo(.07,.02);arrow.lineTo(.07,.24);arrow.lineTo(-.07,.24);arrow.lineTo(-.07,.02);arrow.lineTo(-.18,.02);arrow.closePath();
    const icon=part(root,new THREE.ShapeGeometry(arrow),new THREE.MeshBasicMaterial({color:'#ffffff',side:THREE.DoubleSide}),.46);icon.rotation.x=Math.PI/2;
    return root;
  }
  return {bumper,wing};
}
