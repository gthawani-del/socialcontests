import {REST,BONES,GOAL,keeperPose,distanceToSegment} from './keeper.js';
// A small skinned mesh articulates the existing photographed keeper texture.
// No rigid-image rotation: elbows, knees, feet and gloves follow physical joints.
const restWorld=Object.fromEntries(Object.entries(REST).map(([id,[x,y]])=>[id,{x:(x-.5)*1.65,z:(.53-y)*1.88}]));
const vertices=[],triangles=[],cols=10,rows=14;
for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
 const u=i/cols,v=j/rows,p={x:(u-.5)*1.65,z:(.53-v)*1.88};
 const nearest=BONES.map(([a,b],index)=>({index,d:distanceToSegment(p,restWorld[a],restWorld[b])})).sort((a,b)=>a.d-b.d).slice(0,2);
 const sum=nearest.reduce((s,n)=>s+1/(n.d+.025)**4,0);
 vertices.push({u,v,p,weights:nearest.map(n=>({index:n.index,w:(1/(n.d+.025)**4)/sum}))});
}
for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+1,c=a+cols+1,d=c+1;triangles.push([a,b,c],[b,d,c]);}
export function drawKeeper(ctx,img,k,w,h){
 const pose=keeperPose(k);
 const screen=p=>({x:(GOAL.left+GOAL.screenWidth*(.5+p.x/GOAL.width))*w,y:(GOAL.top+GOAL.screenHeight*(1-p.z/GOAL.height))*h});
 const pixels=vertices.map(v=>{
  const out={x:0,z:0};
  for(const weight of v.weights){
   const [a,b]=BONES[weight.index],r=restWorld[a],r2=restWorld[b],p=pose[a],p2=pose[b];
   const dx=r2.x-r.x,dz=r2.z-r.z,len=Math.hypot(dx,dz),cos=dx/len,sin=dz/len;
   const along=(v.p.x-r.x)*cos+(v.p.z-r.z)*sin,across=-(v.p.x-r.x)*sin+(v.p.z-r.z)*cos;
   const nx=(p2.x-p.x)/len,nz=(p2.z-p.z)/len;
   out.x+=(p.x+along*nx-across*nz)*weight.w;out.z+=(p.z+along*nz+across*nx)*weight.w;
  }
  return screen(out);
 });
 const base=screen({x:k.x,z:0});ctx.save();ctx.fillStyle='#00130db0';ctx.beginPath();ctx.ellipse(base.x,base.y+2,w*.06/(1+k.z*.3),h*.008,0,0,Math.PI*2);ctx.fill();ctx.restore();
 for(const ids of triangles){
  const src=ids.map(i=>({x:vertices[i].u*img.width,y:vertices[i].v*img.height})),dst=ids.map(i=>pixels[i]);
  const [a,b,c]=src,[A,B,C]=dst;
  const det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);if(Math.abs(det)<.001)continue;
  const m11=((B.x-A.x)*(c.y-a.y)-(C.x-A.x)*(b.y-a.y))/det;
  const m12=((B.y-A.y)*(c.y-a.y)-(C.y-A.y)*(b.y-a.y))/det;
  const m21=((C.x-A.x)*(b.x-a.x)-(B.x-A.x)*(c.x-a.x))/det;
  const m22=((C.y-A.y)*(b.x-a.x)-(B.y-A.y)*(c.x-a.x))/det;
  // Overlap clipped edges slightly to prevent background seams between triangles.
  const centre={x:(A.x+B.x+C.x)/3,y:(A.y+B.y+C.y)/3};
  const expanded=[A,B,C].map(p=>{const dx=p.x-centre.x,dy=p.y-centre.y,d=Math.hypot(dx,dy)||1;return {x:p.x+dx/d*.65,y:p.y+dy/d*.65};});
  ctx.save();ctx.beginPath();expanded.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
  ctx.setTransform(m11,m12,m21,m22,A.x-m11*a.x-m21*a.y,A.y-m12*a.x-m22*a.y);ctx.drawImage(img,0,0);ctx.restore();
 }
 return pose;
}
