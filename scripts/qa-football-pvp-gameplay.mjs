import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5217,hmr:false,watch:{ignored:['**/*']}},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const dir=process.argv[2]||'docs/football-pinball/evidence-pvp-gameplay',checks=[],errors=[],failedRequests=[];
await mkdir(dir,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:430,height:932},hasTouch:true,isMobile:true,deviceScaleFactor:1});page.setDefaultTimeout(60000);
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)failedRequests.push({url:r.url(),status:r.status()});});
 await page.addInitScript(()=>sessionStorage.setItem('infinite-pinball-demo-access','granted'));
 await page.goto('http://127.0.0.1:5217/football-pinball/?mode=pvp&qa');await page.waitForFunction(()=>window.__football);
 await page.evaluate(()=>{window.__draw=window.__football.view.draw;window.__football.view.draw=()=>{};});
 await page.click('#fp-enter-board');await page.click('#fp-serve');
 await page.waitForFunction(()=>['countdown','active'].includes(window.__football.snapshot().state)||(!document.querySelector('#fp-toss-choices').hidden&&!document.querySelector('#fp-toss').hidden));
 if(await page.locator('#fp-toss-choices').isVisible())await page.click('[data-choice=kickoff]');
 await page.waitForFunction(()=>window.__football.snapshot().state==='active');
 assert.deepEqual(await page.evaluate(()=>window.__football.snapshot().keepers),[]);
 // Freeze real-time advance for reproducible contact fixtures, keeping browser controls live.
 await page.evaluate(()=>{window.__advance=window.__football.engine.advance;window.__football.engine.advance=()=>{};});
 const cdp=await page.context().newCDPSession(page);
 for(const side of ['left','right']){
  const id=`blue-${side}`;
  await page.evaluate(id=>{const e=window.__football.engine,b=e.boots.find(b=>b.id===id),ball=e.balls[0];
   e.releaseInputs();for(let i=0;i<24;i++)e.step();
   ball.body.setTranslation({x:b.x+Math.cos(b.rest)*.95,y:.15,z:-(b.y+Math.sin(b.rest)*.95+.31)},true);ball.body.setLinvel({x:0,y:0,z:0},true);window.__eventStart=e.events.length;
  },id);
  const box=await page.locator(`[data-boot=${id}]`).boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
  const hit=await page.evaluate(id=>{const e=window.__football.engine,b=e.boots.find(b=>b.id===id),start=b.angle;let velocity=null,minVz=0;for(let i=0;i<10;i++){const n=e.events.length;e.step();minVz=Math.min(minVz,e.balls[0].body.linvel().z);if(!velocity&&e.events.slice(n).some(v=>v.type==='COLLISION'&&v.targetId===id))velocity={...e.balls[0].body.linvel()};}return {pressed:b.pressed,moved:b.angle!==start,contact:!!velocity,velocity,minVz};},id);
  assert(hit.pressed&&hit.moved&&hit.contact,JSON.stringify(hit));assert(hit.minVz<-8,JSON.stringify({side,hit}));
  assert(Math.hypot(hit.velocity.x,hit.velocity.z)>=10,JSON.stringify({side,hit}));
  await cdp.send('Input.dispatchTouchEvent',{type:side==='left'?'touchEnd':'touchCancel',touchPoints:[]});
  const released=await page.evaluate(id=>{const e=window.__football.engine,b=e.boots.find(b=>b.id===id);for(let i=0;i<24;i++)e.step();return !b.pressed&&Math.abs(b.angle-b.rest)<1e-8;},id);
  assert(released);checks.push({side,hit,released,event:side==='left'?'touchEnd':'touchCancel'});
 }
 await page.evaluate(()=>{const e=window.__football.engine;while(e.state==='relaunch')e.step();});
 assert.equal(await page.evaluate(()=>window.__football.engine.state),'active');
 const recovery=await page.evaluate(()=>{
  const e=window.__football.engine,b=e.balls[0],start=e.events.length;
  e.releaseInputs();b.body.setTranslation({x:0,y:.15,z:0},true);b.body.setLinvel({x:.12,y:0,z:0},true);b.body.setAngvel({x:0,y:0,z:0},true);
  for(let i=0;i<48;i++)e.step();
  return {recovered:e.events.slice(start).some(v=>v.type==='BALL_UNSTUCK'),speed:Math.hypot(b.body.linvel().x,b.body.linvel().z)};
 });assert(recovery.recovered&&recovery.speed>5);checks.push({slowBallRecovery:recovery});
 const miss=await page.evaluate(()=>{
  const e=window.__football.engine,b=e.balls[0];b.body.setTranslation({x:1.7,y:.15,z:-5.45},true);b.body.setLinvel({x:0,y:0,z:0},true);e.step();
  return {state:e.state,restart:e.snapshot().restart,score:e.score};
 });assert.equal(miss.state,'relaunch');assert.equal(miss.restart.team,'red');
 await page.waitForFunction(()=>document.querySelector('#fp-status').textContent.includes('Out of play'));
 checks.push({outOfPlay:miss,status:await page.locator('#fp-status').innerText()});
 const goal=await page.evaluate(()=>{
  const e=window.__football.engine;for(let i=0;i<60;i++)e.step();
  const b=e.balls[0],start=e.events.length;
  b.body.setTranslation({x:0,y:.15,z:-4.05},true);b.body.setLinvel({x:0,y:0,z:-5},true);
  for(let i=0;i<40&&e.state==='active';i++)e.step();
  const result={goals:e.events.slice(start).filter(v=>v.type==='GOAL_SCORED').length,
    saves:e.events.slice(start).filter(v=>v.type==='KEEPER_SAVE').length,restartTicks:e.transitionTick-e.tick};
  for(let i=0;i<60;i++)e.step();
  result.restarted=e.state==='active'&&e.balls.length===1;return result;
 });assert.equal(goal.goals,1);assert.equal(goal.saves,0);assert.equal(goal.restartTicks,60);assert(goal.restarted);checks.push({openGoal:goal});
 for(const width of [390,430]){
  await page.setViewportSize({width,height:width===390?844:932});
  await page.evaluate(()=>{window.__football.view.setQuality('high');window.__draw(window.__football.snapshot());});
  const rendered=await page.evaluate(()=>Object.keys(window.__football.view.metrics().jerseys));
  assert.equal(rendered.length,6);assert(rendered.every(id=>id.startsWith('player-')),'no keeper visual');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#footballApp').screenshot({path:`${dir}/touch-verified-${width}.png`,timeout:120000});
 }
 // Restore the real render/advance loop and observe an unfrozen rally.
 const liveStart=await page.evaluate(()=>{const f=window.__football;f.engine.advance=window.__advance;f.view.draw=window.__draw;return f.engine.activeTicks;});
 await page.waitForFunction(start=>window.__football.engine.activeTicks>=start+240,liveStart);
 const live=await page.evaluate(()=>({ticks:window.__football.engine.activeTicks,balls:window.__football.snapshot().balls,state:window.__football.engine.state}));
 assert(live.ticks>=liveStart+240);checks.push({unfrozenRenderedRally:live});
 assert.deepEqual(errors,[]);
 assert.deepEqual(failedRequests,[]);
 await writeFile(`${dir}/browser.json`,JSON.stringify({method:'Chromium mobile viewport, software GPU. Real CDP touch input with ball-placement fixtures and manually stepped physics, followed by an unfrozen rendered rally. Six midfield player visuals and no keeper visuals; open-goal and half-second restart assertions. No physical iPhone or speaker-quality claim.',checks,errors,failedRequests},null,2));console.log(JSON.stringify(checks));
}finally{await browser.close();await server.close();}
