// Shared table geometry: x in table widths, y in table widths (board height=1.5).
// Renderer and contact solver use this same transform at every viewport size.
export const TABLE_HEIGHT=1.5;
export const BALL_RADIUS=.043;
export const BOOT={leftX:.20,rightX:.80,y:.83*TABLE_HEIGHT,length:.28,radius:.022,rest:.24};
export const FEED={x:.50,y:.69,vx:.012,vy:.13};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function bootSegment(side,stroke){
 const sign=side==='left'?1:-1,angle=BOOT.rest-stroke;
 const a={x:side==='left'?BOOT.leftX:BOOT.rightX,y:BOOT.y};
 return {a,b:{x:a.x+sign*BOOT.length*Math.cos(angle),y:a.y+BOOT.length*Math.sin(angle)},angle,sign};
}
export function bootContact(ball,side,stroke,angularSpeed,power,ratio=TABLE_HEIGHT){
 const segment=bootSegment(side,stroke),{angle,sign}=segment,scale=ratio/TABLE_HEIGHT;
 const a={x:segment.a.x,y:segment.a.y*scale},b={x:segment.b.x,y:segment.b.y*scale},p={x:ball.x,y:ball.y*ratio};
 const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy),0,1);
 const q={x:a.x+t*dx,y:a.y+t*dy},distance=Math.hypot(p.x-q.x,p.y-q.y);
 if(distance>BALL_RADIUS+BOOT.radius||angularSpeed<=0)return null;
 // Forward face transfers its tangential velocity to the ball. No target is chosen.
 const length=Math.hypot(dx,dy),normal={x:sign*dy/length,y:-sign*dx/length};
 const radius=Math.max(.12,t*BOOT.length);
 const surfaceSpeed=angularSpeed*radius*(sign*Math.sin(angle)*normal.x-Math.cos(angle)*scale*normal.y),incoming=ball.vx*normal.x+ball.vy*ratio*normal.y;
 const impulse=Math.max(.38,(.72+.13*power)*surfaceSpeed-incoming);
 const vx=ball.vx*.2+normal.x*impulse,vy=(ball.vy*ratio*.2+normal.y*impulse)/ratio;
 return {vx,vy,point:{x:q.x,y:q.y/ratio},distance,stroke,side,power,surfaceSpeed};
}
export function stepFeed(ball,dt){
 ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
 // A shallow receiving pocket keeps unstruck balls ahead of both flippers.
 if(ball.x<.46||ball.x>.54){ball.x=clamp(ball.x,.46,.54);ball.vx*=-1;}
 if(ball.y>.795){ball.y=.795;ball.vy=-.105;}
 if(ball.y<.72&&ball.vy<0){ball.y=.72;ball.vy=.13;}
}
