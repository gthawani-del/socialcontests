import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const {default:bundle}=await import(process.env.CHROMIUM_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5190}});await server.listen();
const browser=await chromium.launch({headless:true,args:bundle.args,executablePath:process.env.CHROMIUM_PATH});
try {
 const rows=[],errors=[];
 for(const [name,width,height] of [['mobile',390,844],['small',320,568],['landscape',844,390],['desktop',1365,900]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Math.random=()=>.5;localStorage.setItem('cricket-quality','low');localStorage.setItem('cricket-pinball-coaching-v1',JSON.stringify({bat:true,bowl:true}));const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>setTimeout(()=>raf(f),100);});
  await page.route('**/qa-fairness*',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><main id="stadiumApp"></main><script type="module" src="/src/cricket-pinball/stadium-prototype.js"></script>'}));
  await page.goto('http://127.0.0.1:5190/qa-fairness?practice=bat&difficulty=EASY&format=ONE_OVER');
  await page.waitForFunction(()=>window.__stadiumQA?.ready,null,{timeout:60000});
  await page.evaluate(()=>window.__stadiumQA.manual(true));
  await page.waitForFunction(()=>window.__stadiumQA.snapshot().running);
  const snapshot=()=>page.evaluate(()=>{window.__stadiumQA.step(0);return window.__stadiumQA.snapshot();});
  const before=await snapshot();assert.equal(before.score.balls,0);
  const boxes=await Promise.all(['left','right'].map(side=>page.locator('#'+side+'Bat').boundingBox()));
  const touch=await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:boxes.map((b,i)=>({x:b.x+b.width/2,y:b.y+b.height/2,id:i+1}))});
  await page.evaluate(()=>window.__stadiumQA.step(40));const guard=await snapshot();
  assert(guard.flippers.every(b=>b.pressed));assert(Math.abs(guard.flippers[0].angle-6*Math.PI/180)<.001);
  assert(Math.abs(guard.flippers[1].angle-174*Math.PI/180)<.001);assert(guard.alignment.every(error=>error<.001),'visible bats match physical guard');
  if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({path:`docs/qa/fairness-guard-${name}.png`,timeout:60000});
  await page.evaluate(()=>window.__stadiumQA.step(1600));const defended=await snapshot();
  assert(defended.contactCount>0,'actual touch-held bat contact');assert.equal(defended.score.balls,1);assert.equal(defended.score.wickets,0,'straight ball survives early defence');
  await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await page.evaluate(()=>window.__stadiumQA.step(30));const cancelled=await snapshot();
  assert(cancelled.flippers.every(b=>!b.pressed));assert(Math.abs(cancelled.flippers[0].angle+14.32*Math.PI/180)<.001);
  rows.push({name,guard:guard.flippers,alignment:guard.alignment,score:defended.score,contacts:defended.contactCount,cancelled:cancelled.flippers});
  await page.close();console.log(name,'touch-held defence, visible alignment, one counted ball and cancellation passed');
 }
 assert.deepEqual(errors,[]);
 await writeFile('docs/qa/cricket-fairness-browser.json',JSON.stringify({fixture:'Chromium touch, four emulated viewports, seeded centre delivery, manual physics stepping; not physical iPhone testing',rows,errors},null,2)+'\n');
}finally{await browser.close();await server.close();}
