import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=await createServer({server:{host:'127.0.0.1',port:5196,hmr:false},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const dir='docs/football-pinball/penalty-boot-layout';await mkdir(dir,{recursive:true});const results=[];
try{
 for(const [name,width,height] of [['small',360,640],['mobile',390,844],['landscape',844,390]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>sessionStorage.setItem('infinite-pinball-demo-access','granted'));
  await page.goto('http://127.0.0.1:5196/football-pinball/?mode=penalty&qa');await page.waitForFunction(()=>window.__penalty?.assets.ball);
  await page.click('#pd-continue');await page.click('[data-call=heads]');await page.waitForFunction(()=>['choice','countdown','aim'].includes(window.__penalty.snapshot().phase));if(await page.locator('[data-first=you]').isVisible())await page.click('[data-first=you]');
  await page.waitForFunction(()=>window.__penalty.snapshot().phase==='aim'&&window.__penalty.snapshot().turn==='you');
  const cpuBefore=await page.evaluate(()=>window.__penalty.snapshot().history.cpu.length);
  assert((await page.evaluate(()=>window.__penalty.snapshot().ball.y))<=.795);
  await page.screenshot({path:`${dir}/${name}.png`});
  await page.evaluate(()=>{window.ballSamples=[];window.ballSampler=setInterval(()=>{const s=window.__penalty.snapshot();window.ballSamples.push({phase:s.phase,y:s.ball.y,boots:s.boots});},16);});
  const session=await page.context().newCDPSession(page),box=await page.locator('[data-boot=left]').boundingBox();
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
  await page.waitForTimeout(600);const held=await page.evaluate(()=>window.__penalty.snapshot());assert(held.charge.power>.2);assert(held.ball.y<=.795);
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>window.__penalty.snapshot().phase==='flight');assert((await page.evaluate(()=>window.__penalty.snapshot().boots.left))>0);
  await page.waitForFunction(()=>window.__penalty.snapshot().history.you.length===1);
  await page.waitForFunction(before=>window.__penalty.snapshot().history.cpu.length>before&&window.__penalty.snapshot().phase==='aim',cpuBefore);
  const samples=await page.evaluate(()=>{clearInterval(window.ballSampler);return window.ballSamples;});assert(samples.every(s=>s.y<=.795+1e-9));assert(samples.some(s=>s.phase==='flight'&&s.y<.5));assert.deepEqual(errors,[]);
  results.push({name,realTouchChargeRelease:true,bootSwing:true,playerAndCpuShots:true,maxBallY:Math.max(...samples.map(s=>s.y)),errors});await page.close();
 }
 await writeFile(`${dir}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await server.close();}
