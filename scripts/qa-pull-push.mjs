import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const {default:bundle}=await import(process.env.CHROMIUM_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5189}});await server.listen();
const browser=await chromium.launch({headless:true,args:bundle.args,executablePath:process.env.CHROMIUM_PATH});
try {
 const page=await browser.newPage({viewport:{width:390,height:700},hasTouch:true});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('cricket-quality','low');localStorage.setItem('cricket-pinball-coaching-v1',JSON.stringify({bowl:true,bat:true}));const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>setTimeout(()=>raf(fn),120);});
 await page.route('**/qa-pull-push*',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><main id="stadiumApp"></main><script type="module" src="/src/cricket-pinball/stadium-prototype.js"></script>'}));
 await page.goto('http://127.0.0.1:5189/qa-pull-push?practice=bowl&format=ONE_OVER');
 await page.waitForFunction(()=>window.__stadiumQA?.ready,null,{timeout:60000});await page.evaluate(()=>window.__stadiumQA.manual(true));await page.locator('#confirmBowler').click();
 const touch=await page.context().newCDPSession(page),rows=[];
 const send=(type,p)=>touch.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{...p,id:1}]:[]});
 const snap=()=>page.evaluate(()=>{window.__stadiumQA.step(0);return window.__stadiumQA.snapshot();});
 const knob=async()=>{const b=await page.locator('.plunger-handle').boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2};};
 for(const [name,width,height]of [['mobile',390,700],['small',320,568],['landscape',844,390],['desktop',1365,900]]){
  await page.setViewportSize({width,height});await page.waitForFunction(()=>Math.abs(document.querySelector('#viewport canvas').height-document.querySelector('#viewport').clientHeight)<2);await snap();
  const before=await snap(),p=await knob(),stroke=Math.min(100,Math.max(32,height-p.y-12));
  await send('touchStart',p);await send('touchMove',{x:p.x,y:p.y+stroke});await send('touchEnd');
  const held=await snap();assert.equal(held.plunger.power,1);assert.equal(held.running,false);assert.equal(held.aim.color,'ffffff');
  assert(held.plunger.springLength<before.plunger.springLength*.35,'spring compresses against fixed stop');
  assert(held.plunger.knobZ>before.plunger.knobZ,'knob pulls backwards');
  const next=await knob();await send('touchStart',next);await send('touchMove',{x:next.x,y:next.y-8});await send('touchCancel');
  assert.equal((await snap()).running,false,'small push/cancel never bowls');assert.equal((await snap()).plunger.power,1);
  if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({path:`docs/qa/pull-push-${name}.png`,timeout:60000});
  await page.locator('#resetCharge').click();assert.equal((await snap()).plunger.power,0);assert.equal(await page.locator('#bowlingPower').innerText(),'0%');
  rows.push({name,stroke,before:before.plunger,held:held.plunger});console.log(name,'full touch pull, hold, push cancellation, clear and physical compression pass');
 }
 await page.setViewportSize({width:390,height:700});await page.waitForFunction(()=>document.querySelector('#pinballPlunger').getBoundingClientRect().right<=innerWidth);await snap();
 let p=await knob();await send('touchStart',p);await send('touchMove',{x:p.x,y:p.y+50});await send('touchEnd');
 await page.locator('#score').click();await page.locator('#closeMatchDetails').click();assert.equal((await snap()).plunger.power,0,'pause clears stored charge');
 p=await knob();await send('touchStart',p);await send('touchMove',{x:p.x,y:p.y+50});await send('touchEnd');
 assert.equal((await snap()).running,false);assert.equal(await page.locator('#bowlingPower').innerText(),'60%');
 p=await knob();await send('touchStart',p);await send('touchMove',{x:p.x,y:p.y-18});await send('touchEnd');
 await page.waitForFunction(()=>window.__stadiumQA.snapshot().running);
 assert.match(await page.locator('#bowlingSummary').innerText(),/60%/,'forward push uses stored charge');
 assert.equal((await snap()).plunger.power,0);await page.evaluate(()=>window.__stadiumQA.step(1600));assert.equal((await snap()).score.balls,1);
 await page.locator('#pitchTarget').waitFor();
 await page.clock.install({time:new Date('2030-01-01T00:00:00Z')});await page.clock.pauseAt(new Date('2030-01-01T00:00:10Z'));
 await page.locator('.plunger-handle').focus();for(let i=0;i<5;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 assert((await snap()).plunger.recoiling);assert.equal((await snap()).running,false,'launch waits for rod recoil');
 await page.locator('#restart').click({force:true});await page.clock.runFor(1000);
 assert.equal((await snap()).running,false,'restart cancels pending release');assert.equal((await snap()).plunger.power,0);
 assert.deepEqual(errors,[]);await writeFile('docs/qa/pull-push.json',JSON.stringify({fixture:'Real Chromium touch input; four emulated viewports; manual engine stepping for counted delivery; not physical iPhone.',rows,pauseClears:true,restartCancelsRecoil:true,onePushOneDelivery:true,errors},null,2)+'\n');
 console.log('Stored-charge delivery, pause/reset and exactly one counted ball passed');
}finally{await browser.close();await server.close();}
