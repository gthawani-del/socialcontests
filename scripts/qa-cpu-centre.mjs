import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const {default:bundle}=await import(process.env.CHROMIUM_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5186}});await server.listen();
const browser=await chromium.launch({headless:true,args:bundle.args,executablePath:process.env.CHROMIUM_PATH});
try {
 const page=await browser.newPage({viewport:{width:390,height:700},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/qa-centre*',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><main id="stadiumApp"></main><script type="module" src="/src/cricket-pinball/stadium-prototype.js"></script>'}));
 await page.route('**/game/cricket-rules.json',async r=>{const response=await r.fetch(),rules=await response.json();
  Object.assign(rules.cpu.MEDIUM,{bowlingPowerMin:.6,bowlingPowerMax:.6,deliveryMix:{PACE:1}});
  Object.assign(rules.delivery,{cpuDeliveryDelayMs:100,cpuPlungerMs:100,countdownStepMs:20,resultHoldMs:{DOT:20,ONE:20,TWO:20,FOUR:20,SIX:20,WICKET:20}});
  await r.fulfill({json:rules});
 });
 await page.goto('http://127.0.0.1:5186/qa-centre?format=ONE_OVER');await page.waitForFunction(()=>window.__stadiumQA?.ready);
 await page.evaluate(()=>{window.__stadiumQA.manual(true);Math.random=()=>.4;});
 async function toss(role){await page.locator('#beginStadiumToss').click();await page.locator('#callHeads').click();await page.locator(role).click({timeout:15000});}
 await toss('#chooseBowl');await page.waitForFunction(()=>!document.querySelector('#movementPicker').disabled);
 for(const type of ['PACE','SWING_LEFT','SWING_RIGHT','CUTTER_LEFT','CUTTER_RIGHT','SPIN_LEFT','SPIN_RIGHT']){
  await page.locator('#movementPicker').click();await page.locator(`[data-type="${type}"]`).click();
  assert.equal(await page.locator('#deliveryType').inputValue(),type);
  assert.equal(await page.locator(`[data-type="${type}"]`).getAttribute('aria-pressed'),'true');
 }
 await page.locator('#movementPicker').click();await page.locator('[data-type="PACE"]').click();await page.locator('[data-line="CENTRE"]').click();
 // Keyboard is the accessible equivalent of releasing the visible plunger at its default 60%.
 await page.locator('.plunger-handle').press('Enter');
 await page.evaluate(()=>window.__stadiumQA.step(1500));
 const defence=await page.evaluate(()=>window.__stadiumQA.snapshot());
 assert.equal(defence.score.balls,1);assert.equal(defence.score.wickets,0);assert(defence.contactCount>0,'centre must produce actual CPU bat contact');
 await page.locator('#restart').click();await toss('#chooseBat');
 // Centre CPU deliveries, no human bat input: actual drains test the two-wicket cap.
 await page.evaluate(()=>{Math.random=()=>.5;});
 const wickets=[];
 for(let i=1;i<=2;i++){
  await page.waitForFunction(()=>window.__stadiumQA.snapshot().running);
  await page.evaluate(()=>window.__stadiumQA.step(1500));
  const state=await page.evaluate(()=>window.__stadiumQA.snapshot());
  assert.equal(state.score.balls,i);assert.equal(state.score.wickets,i);assert.equal(state.score.complete,i===2);wickets.push(state.score);
 }
 await page.locator('#continueInnings').waitFor();await page.locator('#restart').click();await page.waitForTimeout(500);
 await page.evaluate(()=>window.__stadiumQA.step(1500));
 const reset=await page.evaluate(()=>window.__stadiumQA.snapshot());assert.equal(reset.match.status,'MATCH_INTRO');assert(!reset.running);assert.deepEqual(errors,[]);
 await writeFile('docs/qa/cpu-centre-browser.json',JSON.stringify({defence:{score:defence.score,contactCount:defence.contactCount},wickets,reset:reset.match.status,allDeliveryChoices:true,errors,note:'Seeded/accelerated fixture; real UI inputs, bat contact and drain physics.'},null,2));
 console.log('Centre defence, graphical choices, two-wicket cap and restart passed.');
} finally {await browser.close();await server.close();}
