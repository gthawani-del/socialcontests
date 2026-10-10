import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const {default:bundle}=await import(process.env.CHROMIUM_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5185}});await server.listen();
const browser=await chromium.launch({headless:true,args:bundle.args,executablePath:process.env.CHROMIUM_PATH});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[],evidence={lengths:[],layouts:[]};page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/qa-upgrade*',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><main id="stadiumApp"></main><script type="module" src="/src/cricket-pinball/stadium-prototype.js"></script>'}));
 // Only waits are accelerated; ball physics, scoring and required bowler selection are unchanged.
 await page.route('**/game/cricket-rules.json',async route=>{const response=await route.fetch(),rules=await response.json();Object.assign(rules.delivery,{betweenBallsMs:20,countdownStepMs:20,resultHoldMs:{ONE:20,TWO:20,FOUR:20,SIX:20,WICKET:20,DOT:20}});await route.fulfill({json:rules});});
 await page.goto('http://127.0.0.1:5185/qa-upgrade?practice=bowl&telemetry=1');await page.waitForFunction(()=>window.__stadiumQA?.ready,null,{timeout:60000});
 await page.evaluate(()=>window.__stadiumQA.manual(true));
 assert(await page.locator('#leftBat').isDisabled());assert(await page.locator('.plunger-handle').isDisabled());
 await page.locator('[data-bowler=FAST]').click();await page.locator('#confirmBowler').click();
 if(await page.locator('#stadiumCoach').isVisible())await page.locator('#stadiumCoach button').click();
 await page.locator('#movementPicker').click();assert.equal(await page.locator('[data-type]:visible').count(),4);assert.equal(await page.locator('[data-type=SPIN_LEFT]:visible').count(),0);assert(await page.locator('[data-type=SLOWER]').isVisible());await page.locator('#closeDelivery').click();
 await page.locator('#score').click();await page.locator('#graphicsQuality').selectOption('high');await page.locator('#closeMatchDetails').click();
 const a=await page.evaluate(()=>window.__stadiumQA.snapshot().atmosphere);await page.waitForTimeout(300);const b=await page.evaluate(()=>window.__stadiumQA.snapshot().atmosphere);assert(b.spectators>0&&b.active&&b.elapsed>a.elapsed,'stadium animation advances');evidence.atmosphere=b;
 for(const length of ['FULL','GOOD','SHORT']){
  await page.waitForFunction(()=>!document.querySelector('#lengthPicker').disabled);
  await page.locator('#lengthPicker').click();await page.locator(`[data-zone-length=${length}][data-zone-line=CENTRE]`).click();await page.locator('#closeLength').click();
  assert.equal(await page.evaluate(()=>window.__stadiumQA.snapshot().bowling.length),length);
  await page.locator('.plunger-handle').press('Enter');await page.waitForFunction(()=>window.__stadiumQA.snapshot().running);
  const bounce=await page.evaluate(()=>{for(let n=0;n<800;n++){window.__stadiumQA.step(1,false);const s=window.__stadiumQA.snapshot();if(s.ball.bounced){window.__stadiumQA.step(0);return s;}}throw Error('No bounce');});
  assert(bounce.ball.verticalVelocity>0);evidence.lengths.push({length,z:bounce.ball.z,height:bounce.ball.height});
  if(length==='FULL'){
   await page.locator('#score').click();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.locator('#closeMatchDetails').click();
   const before=await page.evaluate(()=>window.__stadiumQA.snapshot());await page.evaluate(()=>window.__stadiumQA.step(240));const after=await page.evaluate(()=>window.__stadiumQA.snapshot());assert(after.paused);assert.deepEqual(after.ball,before.ball);assert.equal(after.atmosphere.elapsed,before.atmosphere.elapsed);
   await page.locator('#resumeMatch').click();assert(!(await page.evaluate(()=>window.__stadiumQA.snapshot().paused)));evidence.pauseResume=true;
  }
  await page.evaluate(()=>window.__stadiumQA.step(1800));
 }
 assert(evidence.lengths[0].z>evidence.lengths[1].z&&evidence.lengths[1].z>evidence.lengths[2].z,'length changes actual landing position');
 assert.equal(await page.evaluate(()=>window.__stadiumQA.snapshot().score.balls),3);
 await page.locator('#restart').click();await page.locator('[data-bowler=SPINNER]').click();await page.locator('#confirmBowler').click();await page.locator('#movementPicker').click();
 assert.equal(await page.locator('[data-type]:visible').count(),5);assert.equal(await page.locator('[data-type=SWING_LEFT]:visible').count(),0);assert(await page.locator('[data-type=FLIPPER]').isVisible());await page.locator('#closeDelivery').click();
 await page.locator('#lengthPicker').click();
 for(const [name,width,height] of [['mobile',390,844],['small',320,568],['landscape',844,390],['desktop',1365,900]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(100);
  const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,picker:document.querySelector('#lengthOptions').getBoundingClientRect().toJSON(),score:document.querySelector('#score').getBoundingClientRect().toJSON()}));
  assert(!layout.overflow);assert(layout.picker.x>=0&&layout.picker.right<=width&&layout.picker.y>=0&&layout.picker.bottom<=height);if(width<800&&height>500)assert(layout.score.height<=46);evidence.layouts.push({name,...layout});
  if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({path:`docs/qa/match-upgrade-${name}.png`,timeout:60000});
 }
 await page.locator('#closeLength').click();await page.locator('#score').click();await page.locator('#graphicsQuality').selectOption('low');await page.locator('#closeMatchDetails').click();
 await page.waitForTimeout(100);const low=await page.evaluate(()=>window.__stadiumQA.snapshot());assert.equal(low.quality,'low');assert(!low.atmosphere.active);evidence.lowQuality=true;
 assert.deepEqual(errors,[]);evidence.errors=errors;await writeFile('docs/qa/match-upgrade.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
}finally{await browser.close();await server.close();}
