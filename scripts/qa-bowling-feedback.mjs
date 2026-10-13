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
await page.locator('#beginStadiumToss').tap();
const tossLayouts=[];
const measureToss=()=>page.locator('#matchPanel').evaluate(panel=>({
 panel:panel.getBoundingClientRect().toJSON(),
 coinSize:document.querySelector('.toss-lift').offsetWidth,
 faces:[...panel.querySelectorAll('.coin-face')].map(face=>({width:face.offsetWidth,height:face.offsetHeight,labelSize:getComputedStyle(face.querySelector('strong')).fontSize})),
 actions:[...panel.querySelectorAll('.toss-actions button')].map(b=>b.getBoundingClientRect().toJSON()),
 footerHidden:getComputedStyle(document.querySelector('.controls')).display==='none',
 overflow:panel.scrollHeight>panel.clientHeight || panel.scrollWidth>panel.clientWidth
}));
for(const [name,w,h] of [['mobile',390,700],['small',320,568],['landscape',844,390],['desktop',1365,900]]){
 await page.setViewportSize({width:w,height:h});
 const layout=await measureToss();
 assert.equal(layout.coinSize,h<=500?96:128);assert.deepEqual(layout.faces[0],layout.faces[1]);
 assert(layout.footerHidden);assert(!layout.overflow,`${name}: toss overflow`);
 assert(layout.panel.y>=0 && layout.panel.bottom<=h && layout.panel.right<=w);
 assert(layout.actions.every(b=>b.height>=48));assert.equal(layout.actions[0].width,layout.actions[1].width);
 tossLayouts.push({phase:'call',name,...layout});
 if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({timeout:60000,path:`docs/qa/toss-call-${name}.png`});
}
await page.setViewportSize({width:390,height:700});
const callLayout=await measureToss();
// Pause on animation creation, before a slow software renderer can finish it.
await page.evaluate(()=>{const pause=e=>{if(!e.target.matches('.toss-lift,.toss-coin'))return;e.target.getAnimations().forEach(a=>a.pause());};window.__pauseToss=pause;document.addEventListener('animationstart',pause);});
await page.locator('#callHeads').tap();
await page.waitForSelector('.toss-coin.flipping');
assert.deepEqual((await measureToss()).panel,callLayout.panel,'call to flight must not move the panel');
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
assert.deepEqual((await measureToss()).panel,callLayout.panel,'flight to result must not move the panel');
await page.locator('#chooseBowl').waitFor({timeout:15000});
assert.deepEqual((await measureToss()).panel,callLayout.panel,'revealing choices must not move the panel');
assert.equal(await page.locator('.toss-heading h2').innerText(),'You won the toss');
assert.equal(await page.locator('.toss-heading p').innerText(),'Result: Heads');
if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({timeout:60000,path:'docs/qa/toss-heads.png'});
await page.locator('#chooseBowl').click({timeout:15000});
await page.locator('#confirmBowler').click();
assert.equal(await page.locator('#score').isVisible(),true,'show score for innings');
await page.waitForFunction(()=>!document.querySelector('#movementPicker').disabled);
await page.locator('#movementPicker').click();await page.locator('#lengthPicker').click();await page.locator('[data-zone-line="LEFT"][data-zone-length="GOOD"]').click();await page.locator('#closeLength').click();await page.locator('#movementPicker').click();await page.locator('[data-type="SWING_RIGHT"]').click();
assert.equal(await page.locator('.compact-bowling-dock>button:visible').count(),2,'balanced delivery and field controls');
await page.locator('#movementPicker').click();await page.locator('[data-type="PACE"]').click();
assert.equal((await page.evaluate(()=>window.__stadiumQA.snapshot())).bowling.type,'PACE');
const aimPoint=await page.evaluate(()=>window.__stadiumQA.project(.09,1.88));
await page.mouse.click(aimPoint.x,aimPoint.y);
const aimed=await page.evaluate(()=>window.__stadiumQA.snapshot().bowling);
assert.equal(aimed.line,'RIGHT','canvas tap selects actual right line');assert.equal(aimed.length,'FULL','canvas tap selects actual full length');
const defaultField=await page.evaluate(()=>window.__stadiumQA.snapshot().fielders);
async function openField(){await page.locator('#editField').click();await page.locator('#fieldEditor').waitFor();}
await openField();await page.locator('[data-fielder-id="cover"]').click();await page.locator('#fieldPosition').selectOption('deep-cover');
const customField=await page.evaluate(()=>window.__stadiumQA.snapshot().fielders);
assert.equal(customField.find(f=>f.id==='cover').slotId,'deep-cover','field selection changes engine geometry');
await page.locator('#defaultField').click();
assert.deepEqual((await page.evaluate(()=>window.__stadiumQA.snapshot().fielders)).map(f=>[f.id,f.x,f.z]),defaultField.map(f=>[f.id,f.x,f.z]),'reset restores exact field');
await page.locator('[data-fielder-id="cover"]').click();await page.locator('#fieldPosition').selectOption('deep-cover');await page.locator('#closeField').click();
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
 {
   await openField();await page.locator('[data-fielder-id="cover"]').click();
   assert.equal(await page.locator('#fieldPosition option[value="midwicket"]').evaluate(e=>e.disabled),true,'occupied slot is unavailable');
   const fieldBoxes=await page.locator('[data-fielder-id]').evaluateAll(buttons=>buttons.map(b=>({id:b.dataset.fielderId,...b.getBoundingClientRect().toJSON()})));
   assert(fieldBoxes.every(b=>b.x>=0&&b.y>=0&&b.right<=w&&b.bottom<=h),'field targets remain in viewport');
   for(let i=0;i<fieldBoxes.length;i++)for(let j=i+1;j<fieldBoxes.length;j++){const a=fieldBoxes[i],b=fieldBoxes[j];assert(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,`field targets ${a.id}/${b.id} must not overlap at ${name}`);}
   assert(fieldBoxes.every(b=>b.height>=44),'field targets preserve44px touch size');
   if((name==='mobile'||name==='small')&&(!process.env.QA_SKIP_SCREENSHOTS||process.env.QA_CAPTURE))await page.screenshot({timeout:60000,path:`docs/qa/field-edit-${name}.png`});
   await page.locator('#closeField').click();
 }
 assert.equal(await page.locator('#movementPicker').getAttribute('aria-expanded'),'false');
 if(process.env.QA_CAPTURE)await page.screenshot({timeout:60000,path:`docs/qa/cricket-integrated-lever-${name}.png`});
 layouts.push({name,...layout});if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({timeout:60000,path:`docs/qa/bowling-feedback-${name}.png`});
}
await page.setViewportSize({width:390,height:700});await page.waitForFunction(()=>document.querySelector("#pinballPlunger").getBoundingClientRect().right<=innerWidth && document.querySelector("#pinballPlunger").getBoundingClientRect().bottom<=innerHeight && Math.abs(document.querySelector("#viewport canvas").width-document.querySelector("#viewport").clientWidth*Math.min(devicePixelRatio,2))<2);
const cdp=await page.context().newCDPSession(page);const box=await page.locator('.plunger-handle').boundingBox();const x=box.x+box.width/2,y=box.y+box.height/2;
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+30,id:1}]});
await page.waitForTimeout(60);const held=await page.evaluate(()=>window.__stadiumQA.snapshot().plunger);assert(held.dragging&&held.pull>.25&&held.glow>0);
await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await page.evaluate(()=>window.__stadiumQA.snapshot().running),false);
await page.locator('#score').click();assert(await page.evaluate(()=>window.__stadiumQA.snapshot().paused));assert.equal(await page.locator('#fieldEditor').isVisible(),false);assert.equal(await page.locator('#editField').isDisabled(),true,'paused field controls locked');await page.locator('#closeMatchDetails').click();await page.waitForFunction(()=>!window.__stadiumQA.snapshot().paused);
const resetBox=await page.locator('.plunger-handle').boundingBox(),px=resetBox.x+resetBox.width/2,py=resetBox.y+resetBox.height/2;
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:px,y:py,id:1}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:px,y:py+50,id:1}]});
assert.equal(await page.evaluate(()=>window.__stadiumQA.snapshot().running),false,'holding does not bowl');
assert.equal(await page.locator('#bowlingPower').innerText(),'60%');
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await page.waitForFunction(()=>window.__stadiumQA.snapshot().running);
assert.equal(await page.locator('#editField').isDisabled(),true,'field changes locked on launch');assert.equal(await page.locator('#fieldEditor').isVisible(),false);
await page.waitForFunction(()=>window.__stadiumQA.snapshot().plunger.glow===0);const live=await page.evaluate(()=>window.__stadiumQA.snapshot());assert.equal(live.plunger.glow,0);
await page.evaluate(()=>window.__stadiumQA.step(1600));
assert.equal((await page.evaluate(()=>window.__stadiumQA.snapshot())).score.balls,1);
assert.deepEqual(await page.evaluate(()=>window.__stadiumQA.snapshot().fielders),customField,'field arrangement survives counted delivery');
assert.equal(await page.locator('#matchCommentary').innerText()==='',false);
await page.locator('#score').click();assert.equal(await page.locator('.ball-results span').count(),1);assert.equal(await page.locator('.commentary-list li').count(),1);
assert.deepEqual(errors,[]);await writeFile('docs/qa/bowling-feedback.json',JSON.stringify({layouts,held,live,aimed,defaultField,customField,fieldPersists:true,fieldLaunchLocked:true,errors,cancelDoesNotLaunch:true,oneReleaseOneDelivery:true},null,2));await page.locator('#closeMatchDetails').click();await page.locator('#restart').click();assert.equal(await page.locator('#score').isVisible(),false,'restart hides score');
await page.locator('#beginStadiumToss').tap();await page.waitForSelector('#callHeads');
await page.evaluate(()=>{Math.random=()=>.9;});await page.locator('#callTails').tap();
await page.waitForSelector('.toss-coin.tails:not(.flipping)');
assert.equal(await page.locator('.toss-coin').getAttribute('aria-label'),'TAILS');
const tailsMatrix=await page.locator('.toss-coin').evaluate(e=>getComputedStyle(e).transform);
assert(tailsMatrix.includes('-1'));
await page.locator('#chooseBowl').waitFor({timeout:15000});
for(const [name,w,h] of [['mobile',390,700],['small',320,568],['landscape',844,390],['desktop',1365,900]]){
 await page.setViewportSize({width:w,height:h});const layout=await measureToss();
 assert.deepEqual(layout.panel,tossLayouts.find(l=>l.name===name).panel,`${name}: call and result stay fixed`);
 assert(layout.footerHidden);assert.deepEqual(layout.faces[0],layout.faces[1]);assert(!layout.overflow);
 assert.equal(layout.actions[0].width,layout.actions[1].width);assert(layout.actions.every(b=>b.height>=48));
 tossLayouts.push({phase:'result',name,...layout});
 if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({timeout:60000,path:`docs/qa/toss-result-${name}.png`});
}
await page.setViewportSize({width:390,height:700});
if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({timeout:60000,path:'docs/qa/toss-tails.png'});
await writeFile('docs/qa/toss-feedback.json',JSON.stringify({tossLayouts,tossMotion,tailsMatrix,stablePanel:true,matchingFaces:true,staleFooterHidden:true,headsConfirmed:true,tailsConfirmed:true,noEarlyRevealWhileAnimationPaused:true},null,2));
console.log('Bowling and both toss faces passed');
}finally{await browser.close();await server.close();}
