import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5212,hmr:false,watch:{ignored:['**/*']}},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const folder='docs/football-pinball/evidence-visual';await mkdir(folder,{recursive:true});const results=[];
try{
 const gate=await browser.newPage({viewport:{width:390,height:844}});
 await gate.goto('http://127.0.0.1:5212/football-pinball/?mode=pvp');
 await gate.locator('.demo-gate').waitFor();assert(await gate.locator('#n').isDisabled());
 await gate.locator('#c').check();await gate.locator('#n').click();
 await gate.locator('#u').fill('incorrect');await gate.locator('#p').fill('incorrect');await gate.locator('#l .demo-primary').click();
 assert(await gate.locator('.demo-gate').isVisible());assert.match(await gate.locator('#e').textContent(),/Incorrect/);
 await gate.locator('#fillDemo').click();assert(await gate.locator('.demo-gate').isVisible());await gate.locator('#l .demo-primary').click();
 await gate.waitForFunction(()=>!document.querySelector('.demo-gate'));await gate.close();console.log('direct route disclaimer/login passed');
 for(const width of [390,430,1440]){
  console.log("viewport",width);
  const height=width===390?844:width===430?932:1000;
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,hasTouch:true,isMobile:width<500});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>sessionStorage.setItem('infinite-pinball-demo-access','granted'));
  await page.goto('http://127.0.0.1:5212/football-pinball/?mode=pvp&qa');await page.waitForFunction(()=>window.__football);
  // Reference captures force full detail on software-rendered QA hardware. Default auto is tested separately.
  console.log("loaded");await page.evaluate(()=>window.__football.view.setQuality('high'));
  assert.equal(await page.locator('.fp-match-settings').count(),0);
  assert.equal(await page.locator('#fp-settings-dialog').isVisible(),false);
  assert(await page.locator('.fp-preflight').isVisible());
  await page.selectOption('[name=format]','classic');
  if(width===430) await page.screenshot({path:`${folder}/pvp-settings-430.png`,timeout:120000});
  await page.click('#fp-enter-board');
  assert.equal(await page.locator('#fp-settings-dialog').isVisible(),false);
  assert.equal(await page.locator('[name=format]').inputValue(),'classic');
  await page.click('#fp-serve');
  await page.waitForFunction(()=>['choice','countdown','active'].includes(window.__football.snapshot().state));
  if(await page.locator('#fp-toss-choices').isVisible())await page.click('[data-choice=kickoff]');
  await page.waitForFunction(()=>window.__football.snapshot().state==='active');console.log('active');
  if(width===430){
    await page.click('#fp-settings-open');
    assert(await page.evaluate(()=>window.__football.engine.paused));
    assert(await page.locator('[name=format]').isDisabled());
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!window.__football.engine.paused);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'fp-settings-open');
    await page.evaluate(()=>window.__football.engine.setPaused(true));
    await page.click('#fp-settings-open');await page.click('#fp-dial-close');
    assert(await page.evaluate(()=>window.__football.engine.paused));
    await page.evaluate(()=>window.__football.engine.setPaused(false));
    console.log('settings dialog: open, persist, lock, Escape, focus, pause/resume passed');
  }

  await page.evaluate(()=>window.scrollTo(0,0));
  const state=await page.evaluate(()=>window.__football.snapshot());assert.equal(state.targets.filter(t=>t.type==='player').length,6);assert.equal(state.targets.filter(t=>t.type==='combo').length,2);assert.equal(state.balls[0].radius,.18);
  const layout=await page.locator('[data-boot]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {y:r.y,bottom:r.bottom,height:r.height,width:r.width};}));
  assert(layout.every(r=>r.height>=56&&r.bottom<=height));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  // Freeze the already-rendered frame for readback on the software GPU, without altering scene state.
  await page.evaluate(()=>{window.__qaDraw=window.__football.view.draw;window.__football.view.draw=()=>{};});
  console.log('capture');await page.screenshot({path:`${folder}/pvp-reference-${width}.png`,timeout:120000});console.log("captured");
  if(width===430){
   // Camera-only fixture verifies the opposite end without changing match ownership.
   await page.evaluate(()=>{window.__football.view.setViewTeam('red');window.__qaDraw(window.__football.snapshot());});
   await page.screenshot({path:`${folder}/pvp-camera-red-430.png`,timeout:120000});
   await page.evaluate(()=>window.__football.view.setViewTeam('blue'));
  }
  await page.evaluate(()=>{window.__football.view.draw=window.__qaDraw;delete window.__qaDraw;});
  const full=await page.evaluate(()=>window.__football.view.metrics());assert.equal(full.failedAssets.length,0);
  await page.evaluate(()=>window.__football.view.setQuality('low'));await page.waitForFunction(()=>window.__football.view.metrics().quality==='low');
  const low=await page.evaluate(()=>window.__football.view.metrics());assert.equal(low.failedAssets.length,0);assert.equal(errors.length,0);
  results.push({width,height,controls:layout,loadedAssets:full.assetsLoaded.length,fullDrawCalls:full.drawCalls,lowDrawCalls:low.drawCalls,errors});await page.close();
 }
 await writeFile(`${folder}/reference-results.json`,JSON.stringify({access:'Direct PvP URL shows disclaimer; invalid credentials rejected; explicit demo login succeeds.',note:'Real start/toss/choice flow. No ball-placement fixture in these screenshots. Full-detail captures use software Chromium, not physical-device FPS evidence. The red-view image is an explicit camera-only fixture.',results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await server.close();}
