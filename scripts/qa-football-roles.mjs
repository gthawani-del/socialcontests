import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5217,hmr:false,watch:{ignored:['**/*']}},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const dir='docs/football-pinball/evidence-roles',checks=[],errors=[];await mkdir(dir,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:430,height:932},hasTouch:true,isMobile:true,deviceScaleFactor:1});page.setDefaultTimeout(60000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>sessionStorage.setItem('infinite-pinball-demo-access','granted'));
 await page.goto('http://127.0.0.1:5217/football-pinball/?mode=pvp&qa');await page.waitForFunction(()=>window.__football);
 await page.evaluate(()=>{window.__draw=window.__football.view.draw;window.__football.view.draw=()=>{};});
 assert.equal(await page.locator('#fp-preflight-audio').textContent(),'Sound on');
 await page.click('#fp-preflight-audio');assert.equal(await page.locator('#fp-preflight-audio').textContent(),'Sound off');
 await page.click('#fp-preflight-audio');
 await page.click('#fp-enter-board');await page.click('#fp-serve');
 await page.waitForFunction(()=>['countdown','active'].includes(window.__football.snapshot().state)||(!document.querySelector('#fp-toss-choices').hidden&&!document.querySelector('#fp-toss').hidden));
 if(await page.locator('#fp-toss-choices').isVisible())await page.click('[data-choice=kickoff]');
 await page.waitForFunction(()=>window.__football.snapshot().state==='active');
 await page.waitForFunction(()=>window.__football.audio.metrics().state==='running'&&window.__football.audio.metrics().crowd);
 checks.push({audio:'unlocked by browser gesture; crowd active'});
 const formation=await page.evaluate(()=>window.__football.snapshot().targets.filter(t=>t.type==='player'));
 for(const team of ['blue','red'])assert(formation.some(t=>t.team===team&&t.role==='striker'&&t.y*t.homeSign<0));
 checks.push({formation});
 // Freeze real-time advance for reproducible contact fixtures, keeping browser controls live.
 await page.evaluate(()=>{window.__football.engine.advance=()=>{};});
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
  assert(hit.pressed&&hit.moved&&hit.contact,JSON.stringify(hit));assert(hit.minVz<-.1,JSON.stringify({side,hit}));
  await cdp.send('Input.dispatchTouchEvent',{type:side==='left'?'touchEnd':'touchCancel',touchPoints:[]});
  const released=await page.evaluate(id=>{const e=window.__football.engine,b=e.boots.find(b=>b.id===id);for(let i=0;i<24;i++)e.step();return !b.pressed&&Math.abs(b.angle-b.rest)<1e-8;},id);
  assert(released);
  await page.waitForFunction(id=>document.querySelector(`[data-boot=${id}] .fp-power-label`).textContent.startsWith('Power '),id);
  checks.push({side,hit,released,event:side==='left'?'touchEnd':'touchCancel'});
 }
 await page.evaluate(()=>{const e=window.__football.engine;while(e.state==='relaunch')e.step();});
 assert.equal(await page.evaluate(()=>window.__football.engine.state),'active');
 for(const width of [390,430]){
  await page.setViewportSize({width,height:width===390?844:932});
  await page.evaluate(()=>{window.__football.view.setQuality('high');window.__draw(window.__football.snapshot());});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#footballApp').screenshot({path:`${dir}/touch-verified-${width}.png`,timeout:120000});
 }
 await page.click('#fp-settings-open');await page.waitForFunction(()=>!window.__football.audio.metrics().crowd);
 await page.click('#fp-audio');assert.equal(await page.evaluate(()=>window.__football.audio.metrics().muted),true);
 assert.equal(await page.evaluate(()=>window.__football.audio.metrics().activeVoices),0);
 await page.click('#fp-audio');await page.click('#fp-dial-close');await page.waitForFunction(()=>window.__football.audio.metrics().crowd);
 checks.push({power:'both meters reflect contact events',pause:'crowd stops',mute:'voices cleared',resume:'crowd resumes'});
 assert.deepEqual(errors,[]);
 await writeFile(`${dir}/browser.json`,JSON.stringify({method:'Chromium mobile viewport, software GPU. Real CDP touch input with seeded ball-placement fixtures and manually stepped physics. Not physical-device performance, human balancing or speaker verification.',checks,errors},null,2));console.log(JSON.stringify(checks));
}finally{await browser.close();await server.close();}
