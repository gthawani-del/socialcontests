import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const {default:bundle}=await import(process.env.CHROMIUM_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5184}});await server.listen();
const browser=await chromium.launch({headless:true,args:bundle.args,executablePath:process.env.CHROMIUM_PATH});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
 if(process.env.QA_LOW_GRAPHICS)await page.addInitScript(()=>{localStorage.setItem('cricket-quality','low');Object.defineProperty(window,'devicePixelRatio',{get:()=>.5});const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>setTimeout(()=>raf(fn),100);});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/qa-bounce*',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><main id="stadiumApp"></main><script type="module" src="/src/cricket-pinball/stadium-prototype.js"></script>'}));
 await page.goto('http://127.0.0.1:5184/qa-bounce?format=ONE_OVER');
 await page.waitForFunction(()=>window.__stadiumQA?.ready);
 await page.evaluate(()=>{Math.random=()=>.1;window.__stadiumQA.manual(true);});
 const evidence=[];
 for(const type of ['SPIN_LEFT','SPIN_RIGHT']){
  await page.locator('#beginStadiumToss').click();await page.locator('#callHeads').click();await page.locator('#chooseBowl').click({timeout:15000});
  await page.locator('[data-bowler=SPINNER]').click();await page.locator('#confirmBowler').click();
  await page.waitForFunction(()=>!document.querySelector('#movementPicker').disabled);
  await page.locator('#movementPicker').click();await page.locator(`[data-type="${type}"]`).click();
  const b=await page.locator('.plunger-handle').boundingBox();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2+50,{steps:4});await page.mouse.up();
  await page.waitForFunction(()=>window.__stadiumQA.snapshot().running);
  const flight=await page.evaluate(()=>{for(let i=0;i<500;i++){window.__stadiumQA.step(1,false);const s=window.__stadiumQA.snapshot();if(s.ball.height>.09&&s.ball.z>0&&!s.ball.bounced){window.__stadiumQA.step(0);return s;}}return null;});
  assert(flight,'visible flight before pitch impact');assert.equal(flight.ball.deliveryType,type);
  if(!process.env.QA_SKIP_SCREENSHOTS)await page.screenshot({timeout:60000,path:`docs/qa/bounce-flight-${type.toLowerCase()}.png`});
  const impact=await page.evaluate(()=>{for(let i=0;i<200;i++){window.__stadiumQA.step(1,false);const s=window.__stadiumQA.snapshot();if(s.ball.bounced){window.__stadiumQA.step(0);return s;}}return null;});
  assert(impact,'pitch impact occurs');assert(impact.ball.verticalVelocity>0,'upward rebound');
  assert(type==='SPIN_LEFT'?impact.ball.velocity.x<-.5:impact.ball.velocity.x>.5,'spin turns in selected direction');
  await page.evaluate(()=>window.__stadiumQA.step(1400));
  const end=await page.evaluate(()=>window.__stadiumQA.snapshot());assert.equal(end.score.balls,1);
  evidence.push({type,flight:flight.ball,impact:impact.ball,score:end.score});
  await page.locator('#restart').click();
 }
 assert.deepEqual(errors,[]);
 await writeFile('docs/qa/bounce-spin.json',JSON.stringify({evidence,errors},null,2));console.log(JSON.stringify({evidence,errors}));
}finally{await browser.close();await server.close();}
