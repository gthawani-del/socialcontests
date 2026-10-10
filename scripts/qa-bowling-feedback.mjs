import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const {default:bundle}=await import(process.env.CHROMIUM_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5183}});await server.listen();
const browser=await chromium.launch({headless:true,args:bundle.args,executablePath:process.env.CHROMIUM_PATH});
try{
const page=await browser.newPage({viewport:{width:390,height:700},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/qa-bowling*',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><main id="stadiumApp"></main><script type="module" src="/src/cricket-pinball/stadium-prototype.js"></script>'}));
await page.goto('http://127.0.0.1:5183/qa-bowling?format=ONE_OVER');await page.waitForFunction(()=>window.__stadiumQA?.ready);
await page.evaluate(()=>{Math.random=()=>.1;window.__stadiumQA.manual(true);});
await page.locator('#beginStadiumToss').click();await page.locator('#callHeads').click();await page.locator('#chooseBowl').click({timeout:15000});
await page.waitForFunction(()=>!document.querySelector('#bowlingMovement').disabled);
await page.locator('[data-line="LEFT"]').click();await page.locator('#bowlingMovement').selectOption('SWING_RIGHT');
const layouts=[];
for(const [name,w,h] of [['mobile',390,700],['small',320,568],['landscape',844,390],['desktop',1365,900]]){
 await page.setViewportSize({width:w,height:h});await page.waitForFunction(()=>document.querySelector("#pinballPlunger").getBoundingClientRect().right<=innerWidth && document.querySelector("#pinballPlunger").getBoundingClientRect().bottom<=innerHeight && Math.abs(document.querySelector("#viewport canvas").width-document.querySelector("#viewport").clientWidth*Math.min(devicePixelRatio,2))<2);
 const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('#bowlingConsole button,#bowlingMovement')].map(b=>({height:b.getBoundingClientRect().height,font:parseFloat(getComputedStyle(b).fontSize)})),plunger:document.querySelector('#pinballPlunger').getBoundingClientRect().toJSON(),glow:window.__stadiumQA.snapshot().plunger.glow}));
 console.log(name,JSON.stringify(layout));assert(!layout.overflow);assert(layout.buttons.every(b=>b.height>=44&&b.font>=11));assert(layout.glow>0);assert(layout.plunger.x>=0&&layout.plunger.right<=w);assert(layout.plunger.bottom<=h);
 layouts.push({name,...layout});await page.screenshot({path:`docs/qa/bowling-feedback-${name}.png`});
}
await page.setViewportSize({width:390,height:700});await page.waitForFunction(()=>document.querySelector("#pinballPlunger").getBoundingClientRect().right<=innerWidth && document.querySelector("#pinballPlunger").getBoundingClientRect().bottom<=innerHeight && Math.abs(document.querySelector("#viewport canvas").width-document.querySelector("#viewport").clientWidth*Math.min(devicePixelRatio,2))<2);
const cdp=await page.context().newCDPSession(page);const box=await page.locator('.plunger-handle').boundingBox();const x=box.x+box.width/2,y=box.y+box.height/2;
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+30,id:1}]});
await page.waitForTimeout(60);const held=await page.evaluate(()=>window.__stadiumQA.snapshot().plunger);assert(held.dragging&&held.pull>.5&&held.glow>1);
await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await page.evaluate(()=>window.__stadiumQA.snapshot().running),false);
await page.locator('#score').click();assert(await page.evaluate(()=>window.__stadiumQA.snapshot().paused));await page.locator('#closeMatchDetails').click();await page.waitForFunction(()=>!window.__stadiumQA.snapshot().paused);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await page.waitForFunction(()=>window.__stadiumQA.snapshot().running);
await page.waitForFunction(()=>window.__stadiumQA.snapshot().plunger.glow===0);const live=await page.evaluate(()=>window.__stadiumQA.snapshot());assert.equal(live.plunger.glow,0);
await page.evaluate(()=>window.__stadiumQA.step(1600));
assert.equal((await page.evaluate(()=>window.__stadiumQA.snapshot())).score.balls,1);
assert.equal(await page.locator('#matchCommentary').innerText()==='',false);
await page.locator('#score').click();assert.equal(await page.locator('.ball-results span').count(),1);assert.equal(await page.locator('.commentary-list li').count(),1);
assert.deepEqual(errors,[]);await writeFile('docs/qa/bowling-feedback.json',JSON.stringify({layouts,held,live,errors,cancelDoesNotLaunch:true,oneReleaseOneDelivery:true},null,2));console.log('Bowling feedback checks passed');
}finally{await browser.close();await server.close();}
