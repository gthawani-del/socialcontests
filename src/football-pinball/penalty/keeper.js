// Metres in the goal plane. Joint positions drive both rendering and saves.
export const GOAL = { width:7.32, height:2.44, left:.215, top:.165, screenWidth:.57, screenHeight:.135 };
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const approach=(x,target,amount)=>x+clamp(target-x,-amount,amount);
const HIP=.846;
export const REST={hip:[.5,.53],neck:[.5,.21],head:[.5,.105],ls:[.36,.24],rs:[.64,.24],le:[.2,.35],re:[.8,.35],lh:[.065,.42],rh:[.935,.42],lp:[.41,.53],rp:[.61,.53],lk:[.31,.72],rk:[.71,.72],la:[.23,.94],ra:[.79,.94],lt:[.18,.98],rt:[.84,.98]};
export const BONES=[['hip','neck',.24],['neck','head',.15],['ls','le',.13],['le','lh',.11],['rs','re',.13],['re','rh',.11],['lp','lk',.17],['lk','la',.12],['rp','rk',.17],['rk','ra',.12],['la','lt',.1],['ra','rt',.1],['ls','rs',.15]];
export function createKeeper(x=.5){return {x:(x-.5)*GOAL.width,z:HIP,vx:0,vz:0,target:null,move:0,mode:'ready',age:0,clock:0,step:0,angle:0,angularVelocity:0,dive:null,feet:[{x:(x-.5)*GOAL.width-.445,z:0,phase:0},{x:(x-.5)*GOAL.width+.478,z:0,phase:.5}]};}
export function requestDive(k,x,y){
 if(k.dive)return false;
 const tx=(clamp(x,.02,.98)-.5)*GOAL.width,tz=(1-clamp(y,.04,.96))*GOAL.height;
 const dir=Math.sign(tx-k.x)||Math.sign(k.vx)||1;
 k.dive={targetX:tx,targetZ:tz,dir,high:tz>1.2};k.mode='windup';k.age=0;k.target=null;k.move=0;return true;
}
export function stepKeeper(k,dt){
 k.age+=dt;k.clock+=dt;
 if(k.mode==='ready'){
  const desired=k.target!==null?clamp((k.target-k.x)*11,-2.9,2.9):k.move*2.9;
  k.vx=approach(k.vx,desired,dt*(desired===0?18:15));k.x+=k.vx*dt;
  k.z=HIP+Math.sin(k.clock*3.2)*.007;
  k.step+=Math.abs(k.vx)*dt*1.4;
  for(let i=0;i<2;i++){
   const f=k.feet[i],p=(k.step+i*.5)%1,offset=i? .478:-.445;
   if(Math.abs(k.vx)<.08){f.z=approach(f.z,0,dt*.8);if(Math.abs(f.x-k.x-offset)>.25)f.x=approach(f.x,k.x+offset,dt*.8);}
   else if(p>=.5){const t=(p-.5)*2;f.x=approach(f.x,k.x+offset+k.vx*.10,dt*5);f.z=Math.sin(Math.PI*t)*.085;}
   else f.z=0;
   f.phase=p;
  }
 }else if(k.mode==='windup'){
  k.vx=approach(k.vx,0,dt*20);k.x+=k.vx*dt;k.z=HIP-.09*Math.min(1,k.age/.10);
  if(k.age>=.10){k.mode='airborne';k.age=0;k.vx=clamp((k.dive.targetX-k.x)/.55,-4.7,4.7);k.vz=k.dive.high?4.05:1.75;}
 }else if(k.mode==='airborne'){
  k.vz-=9.81*dt;k.x+=k.vx*dt;k.z+=k.vz*dt;
  if(k.z<=.24&&k.vz<0){k.z=.24;k.vz=0;k.mode='landing';k.age=0;}
 }else if(k.mode==='landing'){
  k.vx=approach(k.vx,0,dt*12);k.x+=k.vx*dt;
  if(k.age>.28){k.mode='recover';k.age=0;}
 }else if(k.mode==='recover'){
  const t=clamp(k.age/.65,0,1);k.z=.24+(HIP-.24)*(t*t*(3-2*t));
  if(t===1){k.mode='settled';k.feet[0].x=k.x-.445;k.feet[1].x=k.x+.478;}
 }
 k.x=clamp(k.x,-3.28,3.28);
 const tilt=['airborne','landing'].includes(k.mode)?k.dive.dir*(k.dive.high?.85:1.18):k.mode==='windup'?-.06*k.dive.dir:k.mode==='ready'?k.vx*.045:0;
 // Critically damped angular spring: momentum without oscillating like a spring toy.
 k.angularVelocity+=(105*(tilt-k.angle)-20*k.angularVelocity)*dt;k.angle+=k.angularVelocity*dt;
}
function ik(a,b,l1,l2,bend){
 const dx=b.x-a.x,dz=b.z-a.z,d=clamp(Math.hypot(dx,dz),.001,l1+l2-.001),phi=Math.atan2(dz,dx);
 const alpha=Math.acos(clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1));
 return {x:a.x+Math.cos(phi+bend*alpha)*l1,z:a.z+Math.sin(phi+bend*alpha)*l1};
}
export function keeperPose(k){
 const pose={},co=Math.cos(k.angle),si=Math.sin(k.angle);
 for(const [id,[x,y]] of Object.entries(REST)){
  const dx=(x-.5)*1.65,dz=(.53-y)*1.88;
  pose[id]={x:k.x+dx*co+dz*si,z:k.z-dx*si+dz*co};
 }
 const flying=['airborne','landing'].includes(k.mode),landing=k.mode==='landing';
 for(const [i,side] of ['l','r'].entries()){
  if(k.mode==='ready'){
   const f=k.feet[i];pose[side+'a']={x:f.x,z:f.z+.075};pose[side+'t']={x:f.x+(i?.083:-.083),z:f.z};
   pose[side+'k']=ik(pose[side+'p'],pose[side+'a'],.46,.45,i?-1:1);
   const reach=Math.sin(k.clock*2.1+i)*.018;pose[side+'h'].z+=reach;
  }else if(flying){
   const dir=k.dive.dir;
   pose[side+'h']={x:k.x+dir*(i===0?.68:.86),z:k.z+(k.dive.high?.48:.06)+(i===0?.10:0)};
   pose[side+'e']=ik(pose[side+'s'],pose[side+'h'],.38,.38,dir);
   pose[side+'a']={x:k.x-dir*(i===0?.72:.48),z:k.z-.20+(i===0?0:.14)};
   pose[side+'k']=ik(pose[side+'p'],pose[side+'a'],.46,.45,-dir);
   pose[side+'t']={x:pose[side+'a'].x-dir*.10,z:pose[side+'a'].z-.08};
  }
 }
 if(landing||k.mode==='recover')for(const p of Object.values(pose))p.z=Math.max(.035,p.z);
 return pose;
}
export function distanceToSegment(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}
export function keeperSaves(k,target){
 const p={x:(target.x-.5)*GOAL.width,z:(1-target.y)*GOAL.height},pose=keeperPose(k);
 return BONES.some(([a,b,r])=>distanceToSegment(p,pose[a],pose[b])<=r+.11)||['lh','rh'].some(id=>Math.hypot(p.x-pose[id].x,p.z-pose[id].z)<.24);
}
