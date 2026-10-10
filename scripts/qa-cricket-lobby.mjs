import {preview} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {default:bundle}=await import(process.env.CHROMIUM_MODULE);
const server=await preview({preview:{host:'127.0.0.1',port:5180}});
const browser=await chromium.launch({headless:true,args:bundle.args,executablePath:process.env.CHROMIUM_PATH});
try{
const page=await browser.newPage({viewport:{width:390,height:700},hasTouch:true});
const errors=[],models=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('.glb'))models.push(r.url());});
await page.goto('http://127.0.0.1:5180/cricket-pinball/');
const gate=await readFile('src/access/demo-gate.js','utf8');
await page.locator('#c').check();await page.locator('#n').click();await page.locator('#u').fill(gate.match(/U='([^']+)'/)[1]);await page.locator('#p').fill(gate.match(/P='([^']+)'/)[1]);await page.locator('#l button').click();
await page.locator('#cricketStart').waitFor();
await page.waitForFunction(()=>document.querySelector('.stadium-preview img').naturalWidth>0);
const layouts=[];
for(const [name,width,height] of [['mobile',390,700],['small',320,568],['desktop',1365,900],['landscape',844,390]]){
 await page.setViewportSize({width,height});
 const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,play:document.querySelector('#cricketStart').getBoundingClientRect().toJSON(),targets:[...document.querySelectorAll('.cricket-segmented button')].map(b=>b.getBoundingClientRect().height)}));
 assert(!result.overflow,`${name}: horizontal overflow`);assert(result.targets.every(h=>h>=44));
 if(name==='mobile')assert(result.play.bottom<height,'play visible above fold');
 layouts.push({name,width,height,...result});
 await page.screenshot({path:`docs/qa/cricket-lobby-${name}.png`,fullPage:true});
}
assert.equal(models.length,0,'lobby must not load an obsolete GLB');
await page.setViewportSize({width:390,height:700});
await page.locator('.how-pin-trigger').click();await page.locator('#howPinCricketDialog').waitFor();
assert.match(await page.locator('#howPinCricketDialog').innerText(),/right-side plunger/);
await page.locator('.how-pin-close').click();assert(await page.locator('#howPinCricketDialog').isHidden());
await page.locator('[data-format="TWO_OVER"]').click();await page.locator('[data-difficulty="HARD"]').click();
assert.equal(await page.locator('[data-format="TWO_OVER"]').getAttribute('aria-pressed'),'true');
await page.locator('#cricketStart').click();await page.waitForURL('**/cricket-pinball/play/**');
const url=new URL(page.url());assert.equal(url.searchParams.get('format'),'TWO_OVER');assert.equal(url.searchParams.get('difficulty'),'HARD');
await page.locator('#beginStadiumToss').waitFor({timeout:60000});
await page.goto('http://127.0.0.1:5180/cricket-pinball/');
assert.equal(await page.locator('[data-format="TWO_OVER"]').getAttribute('aria-pressed'),'true');
assert.equal(await page.locator('[data-difficulty="HARD"]').getAttribute('aria-pressed'),'true');
await page.route('**/stadium-lobby-r28.png',r=>r.abort());await page.reload();await page.locator('figcaption').waitFor();assert(await page.locator('#cricketStart').isEnabled());
assert.deepEqual(errors,[]);
await writeFile('docs/qa/cricket-lobby-checks.json',JSON.stringify({layouts,errors,oldModelRequests:0,help:true,preferences:true,playRoute:true,previewFailureFallback:true},null,2));
console.log('Lobby checks passed: layouts, controls, help, preferences, play route, image fallback.');
}finally{await browser.close();await new Promise(r=>server.httpServer.close(r));}
