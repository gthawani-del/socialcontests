// Cosmetic pinball movement for Crash; never changes the multiplier or payout.
const targets=[[-1.45,-2.25,.52],[0,-2.65,.58],[1.45,-2.25,.52],[-1.25,1.1,.52],[1.25,1.1,.52],[0,-.1,.62]];
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function createCrashBallMotion(){
  const ball={x:0,z:2.8,vx:1.5,vz:-8.5},history=[],flipperPhase=[0,0];
  let accumulator=0,clock=0;
  function step(dt){
    accumulator=Math.min(.08,accumulator+clamp(dt,0,.05));
    while(accumulator>=1/120){
      accumulator-=1/120;const h=1/120;clock+=h;
      ball.x+=ball.vx*h;ball.z+=ball.vz*h;
      if(ball.x< -2.85||ball.x>2.85){ball.x=clamp(ball.x,-2.85,2.85);ball.vx*=-.91;}
      if(ball.z< -4.45){ball.z=-4.45;ball.vz=Math.abs(ball.vz)*.94;}
      // Animated physical contact with the boot zone, not an unrelated sine orbit.
      if(ball.z>3.64&&ball.vz>0){
        const side=ball.x<0?0:1;
        flipperPhase[side]=1;
        ball.z=3.64;ball.vz=-Math.max(8,Math.abs(ball.vz)*1.16);
        ball.vx=clamp(ball.vx+(side===0?2.7:-2.7),-9,9);
      }
      for(const [x,z,r] of targets){
        const dx=ball.x-x,dz=ball.z-z,d=Math.hypot(dx,dz),limit=r+.18;
        if(d>0&&d<limit){
          const nx=dx/d,nz=dz/d,dot=ball.vx*nx+ball.vz*nz;
          if(dot<0){ball.vx-=2*dot*nx;ball.vz-=2*dot*nz;ball.vx*=1.06;ball.vz*=1.06;}
          ball.x=x+nx*limit;ball.z=z+nz*limit;
        }
      }
      const speed=Math.hypot(ball.vx,ball.vz);
      if(speed>15){ball.vx*=15/speed;ball.vz*=15/speed;}
      if(speed<5){const multiplier=5/Math.max(speed,.001);ball.vx*=multiplier;ball.vz*=multiplier;}
      for(let i=0;i<2;i++)flipperPhase[i]=Math.max(0,flipperPhase[i]-h*5);
      if(Math.floor(clock*75)!==Math.floor((clock-h)*75)){history.unshift({x:ball.x,z:ball.z});history.length=Math.min(history.length,22);}
    }
    return {x:ball.x,z:ball.z,speed:Math.hypot(ball.vx,ball.vz),history,flipperPhase};
  }
  return {step};
}
