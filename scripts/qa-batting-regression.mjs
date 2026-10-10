import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const {default:bundle}=await import(process.env.CHROMIUM_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5182}});await server.listen();
const browser=await chromium.launch({headless:true,args:bundle.args,executablePath:process.env.CHROMIUM_PATH});
try {
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
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
const idleStart=await page.evaluate(()=>window.__stadiumQA.snapshot());
const idleBox=await page.locator('#leftBat').boundingBox();
await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:idleBox.x+idleBox.width/2,y:idleBox.y+idleBox.height/2,id:1}]});
const idleHeld=await page.evaluate(()=>{window.__stadiumQA.step(20);return window.__stadiumQA.snapshot();});
assert(idleHeld.flippers[0].angle-idleStart.flippers[0].angle>.5,'bat responds during preparation');
await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
const cancelled=await page.evaluate(()=>{window.__stadiumQA.step(20);return window.__stadiumQA.snapshot();});
assert(!cancelled.flippers[0].pressed);assert(Math.abs(cancelled.flippers[0].angle-idleStart.flippers[0].angle)<.001);
await page.waitForFunction(()=>window.__stadiumQA.snapshot().running);
const result={before:await page.evaluate(()=>window.__stadiumQA.snapshot())};
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
await page.screenshot({path:'docs/qa/batting-launcher-preview.png'});
const innings=[];
for(let ball=1;ball<=6;ball++){
 await page.waitForFunction(()=>window.__stadiumQA.snapshot().running);
 // First delivery already advanced 80 ticks while checking each bat.
 await page.evaluate(n=>window.__stadiumQA.step(n),ball===1?89:169);
 const box=await page.locator('#leftBat').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await page.evaluate(()=>window.__stadiumQA.step(18));await page.mouse.up();
 await page.evaluate(()=>window.__stadiumQA.step(1400));
 const state=await page.evaluate(()=>window.__stadiumQA.snapshot());
 assert(state.contactCount>0,'real bat/ball contact required');
 assert.equal(state.score.balls,ball);assert.equal(state.score.complete,ball===6);
 innings.push(state);
}
result.fullOver=innings;
await page.locator('#continueInnings').waitFor();
await page.screenshot({path:'docs/qa/full-over-completed.png'});
assert.deepEqual(errors, [], 'no browser runtime errors');
await writeFile('docs/qa/batting-regression.json',JSON.stringify({result,idleStart,idleHeld,cancelled,errors},null,2));console.log(JSON.stringify({samples:Object.fromEntries(Object.entries(result).filter(([k])=>k!=='fullOver').map(([k,v])=>[k,{flippers:v.flippers,ball:v.ball,score:v.score,running:v.running}])),errors}));
}finally{await browser.close();await server.close();}
