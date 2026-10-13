import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);const {default:bundle}=await import(process.env.CHROMIUM_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5187}});await server.listen();
const browser=await chromium.launch({headless:true,args:bundle.args,executablePath:process.env.CHROMIUM_PATH});
try{
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('cricket-quality','low'));
await page.route('**/qa-compact*',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><main id="stadiumApp"></main><script type="module" src="/src/cricket-pinball/stadium-prototype.js"></script>'}));
await page.goto('http://127.0.0.1:5187/qa-compact?practice=bowl');await page.waitForFunction(()=>window.__stadiumQA?.ready);console.log('ready');
await page.locator('#confirmBowler').click();await page.waitForFunction(()=>!document.querySelector('#lengthPicker').disabled);await page.evaluate(()=>window.__stadiumQA.manual(true));
await page.locator('#stadiumCoach button').click();assert(!(await page.locator('#stadiumCoach').isVisible()));
for(const [width,height] of [[390,844],[320,568],[844,390],[1365,900]]){
 await page.setViewportSize({width,height});await page.waitForTimeout(400);
 const dock=await page.locator('#bowlingConsole').boundingBox();assert(dock.height<=110);console.log('dock',width,dock.height);
 const text=await page.locator('#movementPicker').evaluate(e=>({font:getComputedStyle(e).fontSize,overflow:e.scrollWidth>e.clientWidth}));assert.equal(text.font,'14px');assert(!text.overflow);
 await page.locator('#movementPicker').click();await page.locator('#lengthPicker').click();const sheet=await page.locator('#lengthOptions').boundingBox();assert(sheet.x>=0&&sheet.y>=0&&sheet.x+sheet.width<=width&&sheet.y+sheet.height<=height);
 await page.locator('[data-zone-line=RIGHT][data-zone-length=FULL]').click();assert.equal((await page.evaluate(()=>window.__stadiumQA.snapshot())).bowling.length,'FULL');await page.locator('#closeLength').click();
 if(width===390)await page.screenshot({path:'docs/qa/compact-bowling-mobile.png',timeout:60000});
}
await page.setViewportSize({width:390,height:844});await page.locator('.plunger-handle').press('ArrowDown');for(let i=0;i<5;i++)await page.locator('.plunger-handle').press('ArrowDown');
assert.equal(await page.locator('#bowlingPowerMeter').getAttribute('data-zone'),'red');await page.locator('.plunger-handle').press('Enter');
assert(!(await page.locator('#bowlingPowerMeter').isVisible()));assert(!(await page.locator('#bowlingConsole').isVisible()));
assert(await page.locator('#bowlingSummary').isVisible());
assert.match(await page.locator('#bowlingSummary').innerText(),/Right \/ Full · 100%/);
await page.waitForTimeout(350);
const result=await page.evaluate(()=>window.__stadiumQA.snapshot());
assert.equal(result.bowling.power,1,'power does not reset after release');assert(result.accuracy.risk>0);assert(result.running);assert.deepEqual(errors,[]);
await page.evaluate(()=>window.__stadiumQA.step(3000,false));
await page.waitForFunction(()=>!document.querySelector('#lengthPicker').disabled);
const restored=await page.evaluate(()=>window.__stadiumQA.snapshot().bowling);
assert.equal(restored.power,1);assert.equal(restored.line,'RIGHT');assert.equal(restored.length,'FULL');
assert(!(await page.locator('#bowlingSummary').isVisible()));assert(await page.locator('#bowlingConsole').isVisible());
await writeFile('docs/qa/compact-bowling-checks.json',JSON.stringify({result,errors,graphics:'battery saver',realPointerInput:true},null,2));console.log('Compact dock, dismissible guide, actual red-zone launch passed');
}finally{await browser.close();await server.close();}
