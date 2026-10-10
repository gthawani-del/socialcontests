import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer, preview } from 'vite';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = 'docs/football-pinball/evidence';
await mkdir(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 5187 }, logLevel: 'error' });
await server.listen();
const production = await preview({ preview: { host: '127.0.0.1', port: 5188 }, logLevel: 'error' });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const report = { browser: browser.version(), physicsFixtures: [], viewports: [], limitations: ['Chromium touch emulation is not real iPhone/Android testing.', 'WebKit downloaded, but missing host libraries; dependency installer failed on setgroups/permission errors. Safari and real devices unverified.', 'Graybox only; no CPU, GLB, online or Crash fairness claims.'] };
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  const errors = [], failedRequests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => failedRequests.push(r.url()));
  await page.goto('http://127.0.0.1:5187/football-pinball/?qa');
  await page.waitForFunction(() => window.__footballQA);
  assert(await page.locator('#fp-serve').isDisabled());
  assert.equal((await page.evaluate(() => window.__footballQA.snapshot())).tick,0);
  await page.locator('#c').check(); await page.locator('#n').click();
  await page.locator('#fillDemo').click(); await page.locator('#l button').click();
  await page.waitForFunction(() => !document.body.classList.contains('demo-locked'));
  await page.locator('#fp-serve').click();
  await page.waitForTimeout(120);
  assert((await page.evaluate(() => window.__footballQA.snapshot())).ball.y < -0.2);
  report.access = 'deep-link gate holds simulation; existing consent/login flow unlocks it';

  // Browser-generated multi-touch, not clicks or DOM-only assertions.
  await page.locator('#fp-reset').click();
  const cdp = await context.newCDPSession(page);
  const buttons = ['blue-left','blue-right'];
  const points = await Promise.all(buttons.map(async (id, i) => {
    const r = await page.locator(`[data-boot="${id}"]`).boundingBox();
    return { x:r.x+r.width/2, y:r.y+r.height/2, id:i+1 };
  }));
  const rests = (await page.evaluate(() => window.__footballQA.snapshot())).boots;
  await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:points });
  await page.waitForTimeout(150);
  const pressed = (await page.evaluate(() => window.__footballQA.snapshot())).boots;
  for(let i=0;i<2;i++) assert(Math.abs(pressed[i].angle-rests[i].angle)>.5);
  assert.equal(pressed[2].angle, rests[2].angle);
  await cdp.send('Input.dispatchTouchEvent', { type:'touchCancel', touchPoints:[] });
  await page.waitForTimeout(150);
  assert((await page.evaluate(() => window.__footballQA.snapshot())).boots.every(b=>!b.pressed));
  report.multitouch = 'two simultaneous blue touches rotate both physical colliders; touchCancel releases both';

  // Browser pointer inputs against four deterministic ball fixtures.
  for(const id of ['blue-left','blue-right','red-left','red-right']) {
    const blue = id.startsWith('blue'), left=id.endsWith('left');
    const pivotX=left?-1.95:1.95, pivotY=blue?-3.7:3.7;
    const angle=left?(blue?-.35:.35):(blue?Math.PI+.35:Math.PI-.35);
    await page.evaluate(({x,y}) => window.__footballQA.fixture({x,y},{x:0,y:0}),
      {x:pivotX+Math.cos(angle)*.95,y:pivotY+Math.sin(angle)*.95+(blue?1:-1)*.34});
    const r=await page.locator(`[data-boot="${id}"]`).boundingBox();
    await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();
    await page.waitForFunction(id => window.__footballQA.snapshot().events.some(e=>e.type==='COLLISION'&&e.targetId===id),id);
    const s=await page.evaluate(()=>window.__footballQA.snapshot());
    assert(s.velocity.y*(blue?1:-1)>1);
    await page.mouse.up();report.physicsFixtures.push({id,velocity:s.velocity,contact:true});
  }
  for(const sign of [-1,1]) {
    await page.evaluate(sign=>window.__footballQA.fixture({x:0,y:sign*4.7},{x:0,y:sign*4}),sign);
    await page.waitForFunction(()=>window.__footballQA.snapshot().state==='goal');
    const team=sign>0?'blue':'red';assert.equal(await page.locator(`#${team}Score`).textContent(),'1');
    await page.waitForTimeout(150);assert.equal(await page.locator(`#${team}Score`).textContent(),'1');
    report.physicsFixtures.push({goal:team,scoreOnce:true});
  }

  await page.locator('#fp-reset').click();await page.locator('#fp-serve').click();
  await page.locator('#fp-pause').click();
  const frozen=await page.evaluate(()=>window.__footballQA.snapshot());await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>window.__footballQA.snapshot()),frozen);
  await page.locator('#fp-pause').click();await page.waitForTimeout(50);
  assert((await page.evaluate(()=>window.__footballQA.snapshot())).tick>frozen.tick);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  assert((await page.evaluate(()=>window.__footballQA.snapshot())).paused);
  report.lifecycle='pause freezes ball/ticks; resume advances; blur pauses and clears held controls';

  for(const [width,height] of [[360,740],[390,844],[430,932],[1440,1000],[844,390]]) {
    await page.setViewportSize({width,height});await page.locator('#fp-reset').click();
    await page.waitForTimeout(100);
    const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,
      buttons:[...document.querySelectorAll('[data-boot]')].map(e=>({w:e.clientWidth,h:e.clientHeight})),
      canvas:{w:document.querySelector('canvas').clientWidth,h:document.querySelector('canvas').clientHeight}}));
    assert(!layout.overflow);assert(layout.buttons.every(b=>b.w>=56&&b.h>=54));
    assert(layout.canvas.w>200&&layout.canvas.h>=230);
    await page.screenshot({path:`${out}/graybox-${width}x${height}.png`,fullPage:true});
    report.viewports.push({width,height,...layout});
  }
  // Record a normal serve and timed keyboard inputs. No physics fixtures during this recording.
  await page.setViewportSize({width:390,height:844});
  await page.locator('#fp-reset').click();await page.locator('#fp-serve').click();
  await mkdir(`${out}/frames`,{recursive:true});
  for(let i=0;i<70;i++) {
    if(i%8===3) {await page.keyboard.down('a');await page.keyboard.down('d');}
    if(i%8===5) {await page.keyboard.up('a');await page.keyboard.up('d');}
    if(i%8===0) {await page.keyboard.down('j');await page.keyboard.down('l');}
    if(i%8===2) {await page.keyboard.up('j');await page.keyboard.up('l');}
    if(await page.locator('#fp-serve').isEnabled()) await page.locator('#fp-serve').click();
    await page.screenshot({path:`${out}/frames/${String(i).padStart(3,'0')}.png`});
    await page.waitForTimeout(50);
  }
  await page.keyboard.up('a');await page.keyboard.up('d');await page.keyboard.up('j');await page.keyboard.up('l');
  report.recording='Normal serve + timed keyboard inputs, 70 browser screenshots; video assembled at 10fps, not a real-time performance benchmark.';
  report.runtime=await page.evaluate(async()=>{
    const samples=[];let last=performance.now();
    for(let i=0;i<180;i++) {await new Promise(requestAnimationFrame);const now=performance.now();samples.push(now-last);last=now;}
    const metrics=window.__footballQA.metrics();samples.sort((a,b)=>a-b);
    return {frameMsMedian:samples[90],frameMsP95:samples[171],renderer:metrics};
  });
  // Build route/navigation regression using production output and ordinary UI.
  await page.goto('http://127.0.0.1:5188/');
  await page.locator('#demoConsent').check();await page.locator('#continueDemo').click();
  await page.locator('#demoFill').click();await page.locator('#loginStep button[type=submit]').click();
  const link=page.locator('a.cover[href="/football-pinball/"]');assert.equal(await link.count(),1);
  assert.equal(await page.locator('a.cover[href="/cricket-pinball"]').count(),1);
  await link.click();await page.locator('#fp-serve').waitFor({state:'visible'});
  await page.locator('#fp-serve').click();assert(await page.locator('#fp-serve').isDisabled());
  assert.equal(await page.evaluate(()=>typeof window.__footballQA),'undefined');
  await page.screenshot({path:`${out}/production-mobile.png`,fullPage:true});
  await page.goto('http://127.0.0.1:5188/cricket-pinball/');
  assert(await page.locator('body').innerText());
  report.integration='Built homepage -> Football route works; production has no QA hook; Cricket lobby loads; Cricket source unchanged.';
  assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);
  report.errors=errors;report.failedRequests=failedRequests;
  await writeFile(`${out}/qa-results.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally { await browser.close();await server.close();await new Promise(resolve=>production.httpServer.close(resolve)); }
