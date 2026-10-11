import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5223,hmr:false,watch:{ignored:['**/*']}},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const checks=[],errors=[],dir='docs/football-pinball/evidence-controls';await mkdir(dir,{recursive:true});
try{
for(const mode of ['penalty','arcade-rush']){
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>sessionStorage.setItem('infinite-pinball-demo-access','granted'));
 await page.goto(`http://127.0.0.1:5223/football-pinball/?mode=${mode}&qa`);await page.waitForFunction(()=>window.__football);
 await page.evaluate(()=>{window.__draw=window.__football.view.draw;window.__football.view.draw=()=>{};});
 assert(await page.locator('#fp-enter-board').isVisible());assert(!(await page.locator('#fp-settings-open').isVisible()));
 await page.click('#fp-enter-board');await page.click('#fp-serve');await page.waitForFunction(()=>window.__football.snapshot().state==='active');
 await page.evaluate(()=>{window.__football.engine.advance=()=>{};});
 const cdp=await page.context().newCDPSession(page);
 const boxes=await Promise.all(['left','right'].map(side=>page.locator(`[data-boot=blue-${side}]`).boundingBox()));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:boxes.map((b,i)=>({id:i,x:b.x+b.width/2,y:b.y+b.height/2}))});
 const pressed=await page.evaluate(()=>{const e=window.__football.engine;const before=e.boots.map(b=>b.angle);for(let i=0;i<12;i++)e.step();return e.boots.every((b,i)=>b.pressed&&b.angle!==before[i]);});assert(pressed,mode+' simultaneous boot motion');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 assert(await page.evaluate(()=>{const e=window.__football.engine;for(let i=0;i<24;i++)e.step();return e.boots.every(b=>!b.pressed&&Math.abs(b.angle-b.rest)<1e-8);}));
 await page.click('#fp-settings-open');assert(await page.evaluate(()=>window.__football.engine.paused));
 await page.click('#fp-help');assert(await page.locator('#fp-settings-dialog').isVisible());await page.click('#fp-settings-done');await page.waitForFunction(()=>!window.__football.engine.paused);
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const b of await page.locator('[data-boot],#fp-bank').all()){const box=await b.boundingBox();assert(box&&box.y>=0&&box.y+box.height<=844,mode+' controls on screen');}
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.evaluate(()=>{window.__football.view.setQuality('high');window.__draw(window.__football.snapshot());});await page.locator('#footballApp').screenshot({path:`${dir}/${mode}-390.png`});
 if(mode==='crash'){
  await page.evaluate(()=>{window.__football.engine.basePoints=100;});
  await page.click('#fp-bank');await page.evaluate(()=>window.__football.engine.step());await page.waitForFunction(()=>window.__football.snapshot().state==='ended');
  assert(await page.evaluate(()=>window.__football.snapshot().result.bankedPoints>0));
 }
 checks.push({mode,twoThumbPhysics:true,cancelReturnsBoots:true,menuPausesAndHelpResumes:true,widths:[360,390,430],bank:mode==='crash'?'ends round with positive banked points':undefined});await page.close();
}
assert.deepEqual(errors,[]);await writeFile(`${dir}/browser.json`,JSON.stringify({checks,errors,method:'Chromium software GPU; actual CDP two-touch input. Engine time frozen and stepped for reproducible input checks; Crash bank uses 100-point fixture. Not phone performance or human balancing.'},null,2));console.log(JSON.stringify(checks));
}finally{await browser.close();await server.close();}
