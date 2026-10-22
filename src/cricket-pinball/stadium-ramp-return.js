import * as THREE from 'three';

// Render the same polyline used by ramp physics, with a deck and raised rails.
export function createRampReturns(table) {
  const group=new THREE.Group();group.name='ramp-returns';
  const deck=new THREE.MeshStandardMaterial({color:0x203640,roughness:.75,side:THREE.DoubleSide});
  const rail=new THREE.MeshStandardMaterial({color:0xcba85e,metalness:.55,roughness:.4});
  for(const route of table.ramps.filter(r=>r.returnPoints)){
    const points=route.returnPoints,halfWidth=route.halfWidth,edges=[[],[]],vertices=[];
    for(let i=0;i<points.length;i++){
      const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],p=points[i];
      const length=Math.hypot(b.x-a.x,b.z-a.z),nx=-(b.z-a.z)/length,nz=(b.x-a.x)/length;
      for(const [edge,sign] of [[0,-1],[1,1]])edges[edge].push(new THREE.Vector3(p.x+sign*nx*halfWidth,p.height,p.z+sign*nz*halfWidth));
      if(i)for(const v of [edges[0][i-1],edges[1][i-1],edges[0][i],edges[1][i-1],edges[1][i],edges[0][i]])vertices.push(v.x,v.y,v.z);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
    group.add(new THREE.Mesh(geometry,deck));
    for(const edge of edges){
      const path=new THREE.CurvePath();
      for(let i=1;i<edge.length;i++)path.add(new THREE.LineCurve3(edge[i-1].clone().add(new THREE.Vector3(0,.045,0)),edge[i].clone().add(new THREE.Vector3(0,.045,0))));
      group.add(new THREE.Mesh(new THREE.TubeGeometry(path,64,.012,6,false),rail));
    }
  }
  return group;
}
