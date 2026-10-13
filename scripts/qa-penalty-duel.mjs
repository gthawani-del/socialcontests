import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server=await createServer({server:{host:'127.0.0.1',port:5197,hmr:false},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
const dir='docs/football-pinball/penalty-duel';await mkdir(dir,{recursive:true});const results=[];
try{
 for(const [name,width,height] of [['small',360,640],['mobile',390,844],['large-mobile',430,932],['desktop',1440,1000],['landscape',844,390]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:width<700});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>sessionStorage.setItem('infinite-pinball-demo-access','granted'));
  await page.goto('http://127.0.0.1:5197/football-pinball/?mode=penalty&qa');
  await page.waitForFunction(()=>window.__penalty?.assets.ball);
  await page.screenshot({path:`${dir}/settings-${name}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
  await page.locator('#pd-continue').click();await page.locator('[data-call=heads]').click();
  await page.waitForFunction(()=>['choice','countdown','aim'].includes(window.__penalty.snapshot().phase));
  if(await page.locator('[data-first=you]').isVisible())await page.locator('[data-first=you]').click();
  await page.waitForFunction(()=>window.__penalty.snapshot().phase==='aim');
  // Seeded browser fixture sets shooter only, then real touch drives actual aim/contact.
  await page.evaluate(()=>{const s=window.__penalty.engine.state;s.turn='you';s.message='Drag inside the goal to aim';s.elapsed=.1;s.ball={x:.5,y:.68};});
  const box=await page.locator('canvas').boundingBox();const session=await page.context().newCDPSession(page);
  const touch=async(type,x,y)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y}]});
  await touch('touchStart',box.x+box.width*.73,box.y+box.height*.20);await touch('touchEnd');
  assert((await page.evaluate(()=>window.__penalty.snapshot().aim.x))>.8);
  await page.screenshot({path:`${dir}/striker-${name}.png`});
  await page.evaluate(()=>{const e=window.__penalty.engine;e.state.elapsed=2.45;e.state.ball={x:.5,y:.878};});
  const boot=await page.locator('[data-boot=left]').boundingBox();await touch('touchStart',boot.x+boot.width/2,boot.y+boot.height/2);
  await page.waitForFunction(()=>window.__penalty.snapshot().events.some(e=>e.type==='BOOT_CONTACT'));
  const kicked=await page.evaluate(()=>window.__penalty.snapshot());assert(kicked.boots.left>0);assert.equal(kicked.phase,'flight');
  await touch('touchEnd');await page.waitForFunction(()=>window.__penalty.snapshot().history.you.length===1);
  await page.waitForFunction(()=>window.__penalty.snapshot().phase==='aim'&&window.__penalty.snapshot().turn==='cpu');
  await page.locator('#pd-position').fill('65');assert.equal(await page.evaluate(()=>window.__penalty.snapshot().keeper.x),.65);
  await page.screenshot({path:`${dir}/goalkeeper-${name}.png`});
  await page.locator('[aria-label="Dive top left"]').click();await page.waitForFunction(()=>window.__penalty.snapshot().keeper.x<.60);
  assert(await page.evaluate(()=>!!window.__penalty.snapshot().dive));
  await page.locator('#pd-pause').click();const before=await page.evaluate(()=>window.__penalty.snapshot().elapsed);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__penalty.snapshot().elapsed),before);await page.locator('#pd-resume').click();
  const controls=await page.locator('#pd-defender').boundingBox();assert(controls.y+controls.height<=height+1,'controls inside viewport');
  assert.deepEqual(errors,[]);results.push({name,width,height,realTouchAim:true,realTouchBootContact:true,keeperPositionAndDive:true,pause:true,errors});await page.close();
 }
 await writeFile(`${dir}/browser-results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();await server.close();}
