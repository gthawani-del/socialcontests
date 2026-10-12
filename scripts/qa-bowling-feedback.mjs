import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const {default:bundle}=await import(process.env.CHROMIUM_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5183}});await server.listen();
const browser=await chromium.launch({headless:true,args:bundle.args,executablePath:process.env.CHROMIUM_PATH});
try{
const page=await browser.newPage({viewport:{width:390,height:700},hasTouch:true});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
page.on('console',m=>{if(m.type()==='error')console.error(m.text());});
if(process.env.QA_LOW_GRAPHICS)await page.addInitScript(()=>{localStorage.setItem('cricket-quality','low');Object.defineProperty(window,'devicePixelRatio',{get:()=>.5});const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>setTimeout(()=>raf(fn),100);});
await page.route('**/qa-bowling*',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><main id="stadiumApp"></main><script type="module" src="/src/cricket-pinball/stadium-prototype.js"></script>'}));
await page.goto('http://127.0.0.1:5183/qa-bowling?format=ONE_OVER');await page.waitForFunction(()=>window.__stadiumQA?.ready,null,{timeout:60000});console.log('Stadium ready');
await page.evaluate(()=>{Math.random=()=>.1;window.__stadiumQA.manual(true);});
const setupLayouts=[];
for(const [name,w,h] of [['mobile',390,700],['small',320,568],['landscape',844,390],['desktop',1365,900]]){
 await page.setViewportSize({width:w,height:h});
 assert.equal(await page.locator('#score').isVisible(),false,'hide score during setup');
 const layout=await page.locator('#matchPanel').evaluate(p=>{const r=p.getBoundingClientRect(),v=document.querySelector('#viewport').getBoundingClientRect(),s=document.querySelector('#score').getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height,viewportHeight:v.height,scoreBottom:s.bottom,overflow:p.scrollWidth>p.clientWidth};});
 assert(!layout.overflow);assert(layout.x>=0&&layout.right<=w&&layout.bottom<=h);
 if(w<800&&h>500){assert(layout.y>=layout.scoreBottom,'setup must clear HUD');assert(layout.height<layout.viewportHeight*.8,'setup must not stretch to fill table');}
 setupLayouts.push({name,...layout});if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({timeout:60000,path:`docs/qa/match-setup-${name}.png`});
}
await page.setViewportSize({width:390,height:700});
await page.locator('#beginStadiumToss').click();
// Pause on animation creation, before a slow software renderer can finish it.
await page.evaluate(()=>{const pause=e=>{if(!e.target.matches('.toss-lift,.toss-coin'))return;e.target.getAnimations().forEach(a=>a.pause());};window.__pauseToss=pause;document.addEventListener('animationstart',pause);});
await page.locator('#callHeads').click();
await page.waitForSelector('.toss-coin.flipping');
assert.equal(await page.locator('#score').isVisible(),false,'hide score during toss');
const tossMotion=await page.evaluate(()=>{
 const lift=document.querySelector('.toss-lift'),coin=document.querySelector('.toss-coin');
 const a=lift.getAnimations()[0],b=coin.getAnimations()[0];
 a.pause();b.pause();a.currentTime=0;b.currentTime=0;const start=lift.getBoundingClientRect().y;
 a.currentTime=1170;b.currentTime=1170;
 const motion={lift:start-lift.getBoundingClientRect().y,matrix:getComputedStyle(coin).transform,faces:[...coin.querySelectorAll('strong')].map(x=>x.textContent)};
 return motion;
});
await page.evaluate(()=>document.removeEventListener('animationstart',window.__pauseToss));
assert(tossMotion.lift>50);assert(tossMotion.matrix.startsWith('matrix3d'));assert.deepEqual(tossMotion.faces,['HEADS','TAILS']);
await page.waitForTimeout(2900);
assert.equal(await page.locator('#matchPanel h2').innerText(),'Coin in the air');
assert.equal(await page.locator('#chooseBat').count(),0);
await page.evaluate(()=>document.querySelector('.toss-lift').getAnimations()[0].finish());
assert.equal(await page.locator('#matchPanel h2').innerText(),'Coin in the air');
await page.evaluate(()=>document.querySelector('.toss-coin').getAnimations()[0].finish());
await page.waitForSelector('.toss-coin.heads:not(.flipping)');assert.equal(await page.locator('.toss-coin').getAttribute('aria-label'),'HEADS');
if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({timeout:60000,path:'docs/qa/toss-heads.png'});
await page.locator('#chooseBowl').click({timeout:15000});
await page.locator('#confirmBowler').click();
assert.equal(await page.locator('#score').isVisible(),true,'show score for innings');
await page.waitForFunction(()=>!document.querySelector('#movementPicker').disabled);
await page.locator('#lengthPicker').click();await page.locator('[data-zone-line="LEFT"][data-zone-length="GOOD"]').click();await page.locator('#closeLength').click();await page.locator('#movementPicker').click();await page.locator('[data-type="SWING_RIGHT"]').click();
await writeFile('docs/qa/match-setup-layouts.json',JSON.stringify(setupLayouts,null,2));
const layouts=[];
for(const [name,w,h] of [['mobile',390,700],['small',320,568],['landscape',844,390],['desktop',1365,900]]){
 await page.setViewportSize({width:w,height:h});await page.waitForFunction(()=>document.querySelector("#pinballPlunger").getBoundingClientRect().right<=innerWidth && document.querySelector("#pinballPlunger").getBoundingClientRect().bottom<=innerHeight && Math.abs(document.querySelector("#viewport canvas").width-document.querySelector("#viewport").clientWidth*Math.min(devicePixelRatio,2))<2);
 const meterBox=await page.locator('#bowlingPowerMeter').boundingBox();assert(meterBox.x>=0 && meterBox.x+meterBox.width<=w,'power readout stays in viewport');
 const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('#bowlingConsole button,#movementPicker')].filter(b=>b.getBoundingClientRect().height>0).map(b=>({height:b.getBoundingClientRect().height,font:parseFloat(getComputedStyle(b).fontSize)})),plunger:document.querySelector('#pinballPlunger').getBoundingClientRect().toJSON(),glow:window.__stadiumQA.snapshot().plunger.glow}));
 console.log(name,JSON.stringify(layout));assert(!layout.overflow);assert(layout.buttons.every(b=>b.height>=44&&b.font>=11));assert.equal(layout.glow,0);assert(layout.plunger.x>=0&&layout.plunger.right<=w);assert(layout.plunger.bottom<=h);
 await page.locator('#movementPicker').click();
 const picker=await page.locator('#deliveryOptions').boundingBox();assert(picker.x>=0&&picker.y>=0&&picker.x+picker.width<=w&&picker.y+picker.height<=h);
 assert.equal(await page.locator('[data-type]:visible svg').count(),6);
 if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({timeout:60000,path:`docs/qa/delivery-options-${name}.png`});
 await page.locator('#closeDelivery').click();
 assert.equal(await page.locator('#movementPicker').getAttribute('aria-expanded'),'false');
 if(process.env.QA_CAPTURE)await page.screenshot({timeout:60000,path:`docs/qa/cricket-integrated-lever-${name}.png`});
 layouts.push({name,...layout});if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({timeout:60000,path:`docs/qa/bowling-feedback-${name}.png`});
}
await page.setViewportSize({width:390,height:700});await page.waitForFunction(()=>document.querySelector("#pinballPlunger").getBoundingClientRect().right<=innerWidth && document.querySelector("#pinballPlunger").getBoundingClientRect().bottom<=innerHeight && Math.abs(document.querySelector("#viewport canvas").width-document.querySelector("#viewport").clientWidth*Math.min(devicePixelRatio,2))<2);
const cdp=await page.context().newCDPSession(page);const box=await page.locator('.plunger-handle').boundingBox();const x=box.x+box.width/2,y=box.y+box.height/2;
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+30,id:1}]});
await page.waitForTimeout(60);const held=await page.evaluate(()=>window.__stadiumQA.snapshot().plunger);assert(held.dragging&&held.pull>.5&&held.glow>0);
await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await page.evaluate(()=>window.__stadiumQA.snapshot().running),false);
await page.locator('#score').click();assert(await page.evaluate(()=>window.__stadiumQA.snapshot().paused));await page.locator('#closeMatchDetails').click();await page.waitForFunction(()=>!window.__stadiumQA.snapshot().paused);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await page.waitForFunction(()=>window.__stadiumQA.snapshot().running);
await page.waitForFunction(()=>window.__stadiumQA.snapshot().plunger.glow===0);const live=await page.evaluate(()=>window.__stadiumQA.snapshot());assert.equal(live.plunger.glow,0);
await page.evaluate(()=>window.__stadiumQA.step(1600));
assert.equal((await page.evaluate(()=>window.__stadiumQA.snapshot())).score.balls,1);
assert.equal(await page.locator('#matchCommentary').innerText()==='',false);
await page.locator('#score').click();assert.equal(await page.locator('.ball-results span').count(),1);assert.equal(await page.locator('.commentary-list li').count(),1);
assert.deepEqual(errors,[]);await writeFile('docs/qa/bowling-feedback.json',JSON.stringify({layouts,held,live,errors,cancelDoesNotLaunch:true,oneReleaseOneDelivery:true},null,2));await page.locator('#closeMatchDetails').click();await page.locator('#restart').click();assert.equal(await page.locator('#score').isVisible(),false,'restart hides score');
await page.locator('#beginStadiumToss').click();await page.waitForSelector('#callHeads');
await page.evaluate(()=>{Math.random=()=>.9;});await page.locator('#callHeads').click();
await page.waitForSelector('.toss-coin.tails:not(.flipping)');
assert.equal(await page.locator('.toss-coin').getAttribute('aria-label'),'TAILS');
const tailsMatrix=await page.locator('.toss-coin').evaluate(e=>getComputedStyle(e).transform);
assert(tailsMatrix.includes('-1'));if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({timeout:60000,path:'docs/qa/toss-tails.png'});
await writeFile('docs/qa/toss-feedback.json',JSON.stringify({tossMotion,tailsMatrix,headsConfirmed:true,tailsConfirmed:true,noEarlyRevealWhileAnimationPaused:true},null,2));
console.log('Bowling and both toss faces passed');
}finally{await browser.close();await server.close();}
