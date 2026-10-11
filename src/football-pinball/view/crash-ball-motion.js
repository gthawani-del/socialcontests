// Deterministic fixed-step cosmetic pinball physics. Crash payout remains independent.
const targets=[[-1.45,-2.25,.52],[0,-2.65,.58],[1.45,-2.25,.52],[-1.25,1.1,.52],[1.25,1.1,.52],[0,-.1,.62]];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const STEP=1/120, RADIUS=.18;
const boots=[{x:-1.25,z:4,rest:-.3,active:-1.05},{x:1.25,z:4,rest:Math.PI+.3,active:Math.PI+1.05}];
export function createCrashBallMotion(){
  const ball={x:0,z:2.8,vx:1.5,vz:-8.5},history=[],flipperPhase=[0,0],pressed=[false,false],angles=boots.map(b=>b.rest);
  let accumulator=0,clock=0,score=0,hits=0,bootHits=0,lastRound=null,powerUntil=0,powerShots=0,feedback=null,seed=0x12345678,previousShot=[false,false];
  const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
  function reset(roundId){
    Object.assign(ball,{x:0,z:2.8,vx:1.5,vz:-8.5});
    accumulator=0;clock=0;score=0;hits=0;bootHits=0;history.length=0;
    pressed.fill(false);previousShot.fill(false);flipperPhase.fill(0);boots.forEach((b,i)=>angles[i]=b.rest);
    powerUntil=0;powerShots=0;feedback=null;seed=0x12345678;
    lastRound=roundId;
  }
  function input(side,down){if(side===0||side===1)pressed[side]=Boolean(down);}
  function snapshot(){return {x:ball.x,z:ball.z,speed:Math.hypot(ball.vx,ball.vz),history,flipperPhase,score,hits,bootHits,powerShots,powerActive:clock<powerUntil,feedback,angles:[...angles]};}
  function step(dt,roundId){
    if(roundId!==undefined&&roundId!==lastRound)reset(roundId);
    accumulator=Math.min(.08,accumulator+clamp(dt,0,.05));
    while(accumulator>=STEP){
      accumulator-=STEP;clock+=STEP;
      const before=angles.slice();
      for(let i=0;i<2;i++){
        const boot=boots[i],target=pressed[i]?boot.active:boot.rest;
        angles[i]+=(target-angles[i])*Math.min(1,20*STEP);
        flipperPhase[i]=Math.abs(angles[i]-boot.rest)/Math.abs(boot.active-boot.rest);
      }
      ball.x+=ball.vx*STEP;ball.z+=ball.vz*STEP;
      if(ball.x< -2.85||ball.x>2.85){ball.x=clamp(ball.x,-2.85,2.85);ball.vx*=-.91;}
      if(ball.z< -4.45){ball.z=-4.45;ball.vz=Math.abs(ball.vz)*.94;}
      for(let i=0;i<2;i++){
        const boot=boots[i],ang=angles[i],prev=before[i];
        // Boot sweeps a line segment about its pivot; contact produces a normal impulse.
        const length=1.18;
        const tipX=boot.x+Math.cos(ang)*length,tipZ=boot.z+Math.sin(ang)*length;
        const dx=tipX-boot.x,dz=tipZ-boot.z,den=dx*dx+dz*dz;
        const t=clamp(((ball.x-boot.x)*dx+(ball.z-boot.z)*dz)/den,0,1);
        const cx=boot.x+t*dx,cz=boot.z+t*dz,sepX=ball.x-cx,sepZ=ball.z-cz;
        const dist=Math.hypot(sepX,sepZ),limit=RADIUS+.15;
        if(dist<limit){
          const nx=dist>.0001?sepX/dist:0,nz=dist>.0001?sepZ/dist:-1;
          const angular=(ang-prev)/STEP;
          const surfaceVx=-Math.sin(ang)*length*t*angular,surfaceVz=Math.cos(ang)*length*t*angular;
          const relative=(ball.vx-surfaceVx)*nx+(ball.vz-surfaceVz)*nz;
          ball.x=cx+nx*limit;ball.z=cz+nz*limit;
          if(relative<0){
            const kick=Math.min(21,-1.75*relative);
            ball.vx+=nx*kick;ball.vz+=nz*kick;
            if(pressed[i])ball.vz-=2.8;
            bootHits++;
            // Sound consumers observe bootHits; one increment equals one actual contact.
            // Random bonus occurs only on a real boot-ball impact, never from a timer.
            if(pressed[i] && !previousShot[i] && random()<.18){
              const shotSpeed=Math.hypot(ball.vx,ball.vz)||1;
              ball.vx=ball.vx/shotSpeed*15;ball.vz=ball.vz/shotSpeed*15;
              powerUntil=clock+1.4;powerShots++;
              feedback={text:'POWER SHOT!',until:clock+1.2,sequence:bootHits};
            }
            previousShot[i]=true;
          }
        }
      }
      for(let i=0;i<2;i++)if(!pressed[i])previousShot[i]=false;
      // A ball that gets past the boots drains and is re-served for visual continuity.
      if(ball.z>5.05){ball.x=0;ball.z=2.8;ball.vx=1.5;ball.vz=-8.5;history.length=0;}
      for(const [x,z,r] of targets){
        const dx=ball.x-x,dz=ball.z-z,d=Math.hypot(dx,dz),limit=r+RADIUS;
        if(d>0&&d<limit){
          const nx=dx/d,nz=dz/d,dot=ball.vx*nx+ball.vz*nz;
          if(dot<0){ball.vx-=2.05*dot*nx;ball.vz-=2.05*dot*nz;hits++;const award=Math.abs(x)<.2?500:100;score+=award;feedback={text:'+'+award,until:clock+.85,sequence:hits};}
          ball.x=x+nx*limit;ball.z=z+nz*limit;
        }
      }
      if(feedback && clock>feedback.until)feedback=null;
      const speed=Math.hypot(ball.vx,ball.vz);
      if(speed>15){ball.vx*=15/speed;ball.vz*=15/speed;}
      if(speed<2){ball.vz-=1.5*STEP;}
      if(Math.floor(clock*75)!==Math.floor((clock-STEP)*75)){history.unshift({x:ball.x,z:ball.z});history.length=Math.min(history.length,22);}
    }
    return snapshot();
  }
  reset(null);
  return {step,input,reset,snapshot};
}
