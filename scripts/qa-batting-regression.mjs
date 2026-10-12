import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const {default:bundle}=await import(process.env.CHROMIUM_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5182}});await server.listen();
const browser=await chromium.launch({headless:true,args:bundle.args,executablePath:process.env.CHROMIUM_PATH});
try {
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
if(process.env.QA_LOW_GRAPHICS)await page.addInitScript(()=>{localStorage.setItem('cricket-quality','low');Object.defineProperty(window,'devicePixelRatio',{get:()=>.5});const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>setTimeout(()=>raf(fn),100);});
await page.route('**/qa-batting*',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><main id="stadiumApp"></main><script type="module" src="/src/cricket-pinball/stadium-prototype.js"></script>'}));
// Seed delivery selection, shorten result waits, and extend preparation to observe idle input.
// Match/scoring rules remain unchanged; this is a controlled fixture, not production timing.
await page.route('**/game/cricket-rules.json',async route=>{
 const response=await route.fetch(),rules=await response.json();
 Object.assign(rules.cpu.MEDIUM,{bowlingPowerMin:.2,bowlingPowerMax:.2,deliveryMix:{PACE:1}});
 Object.assign(rules.delivery,{cpuDeliveryDelayMs:5000,cpuPlungerMs:50,countdownStepMs:20,betweenBallsMs:20,resultHoldMs:{ONE:20,TWO:20,FOUR:20,SIX:20,WICKET:20,DOT:20}});
 await route.fulfill({json:rules});
});
await page.goto('http://127.0.0.1:5182/qa-batting?format=ONE_OVER&difficulty=MEDIUM');
await page.waitForFunction(()=>window.__stadiumQA?.ready,null,{timeout:60000});
await page.evaluate(()=>{window.__stadiumQA.manual(true);Math.random=()=>.1;});
await page.locator('#beginStadiumToss').click();await page.locator('#callHeads').click();await page.locator('#chooseBat').click({timeout:15000});
await page.waitForFunction(()=>window.__stadiumQA.snapshot().score.number===1 && !window.__stadiumQA.snapshot().running);
const touch=await page.context().newCDPSession(page);
const batPosition=await page.locator('#leftBat').boundingBox();
const bothBoxes=await Promise.all(['left','right'].map(side=>page.locator('#'+side+'Bat').boundingBox()));
await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:bothBoxes.map((b,i)=>({x:b.x+b.width/2,y:b.y+b.height/2,id:i+1}))});
const bothHeld=await page.evaluate(()=>{window.__stadiumQA.step(20);return window.__stadiumQA.snapshot();});
assert(bothHeld.flippers.every(b=>b.pressed),'both thumbs hold independent bats');
await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[{x:bothBoxes[0].x+bothBoxes[0].width/2,y:bothBoxes[0].y+bothBoxes[0].height/2,id:1}]});
const oneHeld=await page.evaluate(()=>window.__stadiumQA.snapshot());
console.log('two-thumb release',oneHeld.flippers.map(b=>({id:b.id,pressed:b.pressed})));
assert(!oneHeld.flippers[0].pressed && oneHeld.flippers[1].pressed,'releasing left preserves right thumb');
await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
await page.evaluate(()=>window.__stadiumQA.step(20));
const idleStart=await page.evaluate(()=>window.__stadiumQA.snapshot());
const idleBox=await page.locator('#leftBat').boundingBox();
await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:idleBox.x+idleBox.width/2,y:idleBox.y+idleBox.height/2,id:1}]});
const idleHeld=await page.evaluate(()=>{window.__stadiumQA.step(20);return window.__stadiumQA.snapshot();});
assert(idleHeld.flippers[0].angle-idleStart.flippers[0].angle>.5,'bat responds during preparation');
await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
const cancelled=await page.evaluate(()=>{window.__stadiumQA.step(20);return window.__stadiumQA.snapshot();});
assert(!cancelled.flippers[0].pressed);assert(Math.abs(cancelled.flippers[0].angle-idleStart.flippers[0].angle)<.001);
await page.waitForFunction(()=>window.__stadiumQA.snapshot().running);
const liveBatPosition=await page.locator('#leftBat').boundingBox();
assert(Math.abs(liveBatPosition.y-batPosition.y)<1,'bat row stays stationary from preparation to live delivery');
const result={before:await page.evaluate(()=>window.__stadiumQA.snapshot())};
await page.locator('#score').click();
const pausedBefore=await page.evaluate(()=>window.__stadiumQA.snapshot());
const pausedAfter=await page.evaluate(()=>{window.__stadiumQA.step(300);return window.__stadiumQA.snapshot();});
assert(pausedAfter.paused);assert.deepEqual(pausedAfter.ball,pausedBefore.ball);assert.equal(pausedAfter.score.balls,pausedBefore.score.balls);
await page.locator('#closeMatchDetails').click();
await page.waitForFunction(()=>!window.__stadiumQA.snapshot().paused);

for(const side of ['left','right']){
 const b=await page.locator('#'+side+'Bat').boundingBox();
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});
 result[side+'down']=await page.evaluate(()=>{window.__stadiumQA.step(20);return window.__stadiumQA.snapshot();});
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 result[side+'up']=await page.evaluate(()=>{window.__stadiumQA.step(20);return window.__stadiumQA.snapshot();});
}
for(const [index,side] of ['left','right'].entries()) {
 assert(result[side+'down'].flippers[index].pressed);
 assert(Math.abs(result[side+'down'].flippers[index].angle-result.before.flippers[index].angle)>.5);
 assert(!result[side+'up'].flippers[index].pressed);
 assert(Math.abs(result[side+'up'].flippers[index].angle-result.before.flippers[index].angle)<.001);
}
assert.equal(result.rightup.score.balls,0,'shooter lane must not count a delivery');
if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({timeout:60000,path:'docs/qa/batting-launcher-preview.png'});
const innings=[];
for(let ball=1;ball<=6;ball++){
 await page.waitForFunction(()=>window.__stadiumQA.snapshot().running);
 // Track the actual flight. FAST/FULL and later tactical variations no longer
 // arrive on the old fixed tick. No position, score or outcome is injected.
 const approach=await page.evaluate(()=>{const qa=window.__stadiumQA;let n=0;while(n++<800){const s=qa.snapshot();if(!s.running || (s.ball.z>1.6 && s.ball.velocity.z>0 && s.ball.bounced))return {n,state:s};qa.step(1,false);}throw new Error('No hittable approach');});
 assert(approach.state.running && approach.state.ball.bounced,'delivery reaches its real pitch bounce');
 const box=await page.locator('#leftBat').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await page.evaluate(()=>window.__stadiumQA.step(18));await page.mouse.up();
 await page.evaluate(()=>window.__stadiumQA.step(1400));
 const state=await page.evaluate(()=>window.__stadiumQA.snapshot());
 assert(state.contactCount>approach.state.contactCount,'each delivery requires new real bat/ball contact');
 assert.equal(state.score.balls,ball);assert.equal(state.score.complete,ball===6);
 innings.push(state);
}
result.fullOver=innings;
await page.locator('#continueInnings').waitFor();
await page.locator('#score').click();
assert.equal(await page.locator('.ball-results span').count(),6);
assert.equal(await page.locator('.commentary-list li').count(),6);
assert.equal(await page.locator('.innings-total').innerText(),`${innings.at(-1).score.runs}/${innings.at(-1).score.wickets} · 1.0 overs · Complete`);
if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({timeout:60000,path:'docs/qa/scorecard-feedback.png'});
await page.locator('.sound-settings summary').click();
await page.locator('#muteGame').click();
assert(await page.evaluate(()=>window.__stadiumQA.snapshot().audio.settings.muted));
await page.locator('#muteGame').click();
await page.waitForFunction(()=>window.__stadiumQA.snapshot().audio.loaded===6);
assert.deepEqual(await page.evaluate(()=>window.__stadiumQA.snapshot().audio.failed),[]);
assert((await page.evaluate(()=>window.__stadiumQA.snapshot().audio.played))>0);
await page.locator('#closeMatchDetails').click();

if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({timeout:60000,path:'docs/qa/full-over-completed.png'});
// Separate hands-off CENTRE/GOOD match verifies two physical drains.
// Switch the RNG only after toss result: MEDIUM bowler, CENTRE line, GOOD length.
// LEFT deliveries can legitimately time out as dots without any batting input.
await page.locator('#restart').click();
await page.locator('#beginStadiumToss').click();await page.locator('#callHeads').click();await page.locator('#chooseBat').waitFor({timeout:15000});
await page.evaluate(()=>{Math.random=()=>.5;});await page.locator('#chooseBat').click();
const wickets=[];
for(let wicket=1;wicket<=2;wicket++){
 await page.waitForFunction(()=>window.__stadiumQA.snapshot().running);
 const state=await page.evaluate(()=>{window.__stadiumQA.step(2000,false);return window.__stadiumQA.snapshot();});
 assert.equal(state.score.wickets,wicket,'untouched delivery must physically reach the wicket drain');
 assert.equal(state.score.balls,wicket,'wicket counts exactly one delivery');
 assert.equal(state.score.complete,wicket===2,'first wicket continues; second wicket ends innings');
 wickets.push(state);
}
result.twoWicketFinish=wickets;
assert.deepEqual(errors, [], 'no browser runtime errors');
await writeFile('docs/qa/batting-regression.json',JSON.stringify({result,idleStart,idleHeld,cancelled,errors},null,2));console.log(JSON.stringify({samples:Object.fromEntries(Object.entries(result).filter(([k])=>!['fullOver','twoWicketFinish'].includes(k)).map(([k,v])=>[k,{flippers:v.flippers,ball:v.ball,score:v.score,running:v.running}])),errors}));
}finally{await browser.close();await server.close();}
