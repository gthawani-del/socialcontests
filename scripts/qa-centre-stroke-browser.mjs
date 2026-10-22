import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const {default:bundle}=await import(process.env.CHROMIUM_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5192}});await server.listen();
const browser=await chromium.launch({headless:true,args:bundle.args,executablePath:process.env.CHROMIUM_PATH});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),rows=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{Math.random=()=>.5;localStorage.setItem('cricket-quality','low');localStorage.setItem('cricket-pinball-coaching-v1',JSON.stringify({bat:true,bowl:true}));Object.defineProperty(window,'devicePixelRatio',{get:()=>.5});const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=f=>setTimeout(()=>raf(f),100);});
 await page.route('**/qa-stroke*',r=>r.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><main id="stadiumApp"></main><script type="module">
import {StadiumEngine} from '/src/cricket-pinball/game/stadium-engine.js';
window.rampReleases=[];
const release=StadiumEngine.prototype.releaseCompletedRamp;
StadiumEngine.prototype.releaseCompletedRamp=function(id){
 const didRelease=release.call(this,id);
 if(didRelease)window.rampReleases.push({id,position:{...this.ball.position},frozen:this.frozen,balls:window.__stadiumQA.snapshot().score.balls});
 return didRelease;
};
await import('/src/cricket-pinball/stadium-prototype.js');
</script>`}));
 for(const sides of [['left'],['right'],['left','right']]){
  await page.goto('http://127.0.0.1:5192/qa-stroke?practice=bat&difficulty=EASY&format=ONE_OVER');
  await page.waitForFunction(()=>window.__stadiumQA?.ready,null,{timeout:60000});
  await page.evaluate(()=>window.__stadiumQA.manual(true));
  await page.waitForFunction(()=>window.__stadiumQA.snapshot().running);
  await page.evaluate(()=>{for(let i=0;i<600;i++){const q=window.__stadiumQA,s=q.snapshot();if(s.lastBounce)break;q.step(1,false);}window.__stadiumQA.step(0);});
  const boxes=await Promise.all(sides.map(side=>page.locator('#'+side+'Bat').boundingBox())),touch=await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:boxes.map((b,i)=>({x:b.x+b.width/2,y:b.y+b.height/2,id:i+1}))});
  const result=await page.evaluate(()=>{const q=window.__stadiumQA;let furthestZ=Infinity;for(let i=0;i<1200;i++){q.step(1,false);const s=q.snapshot();if(s.contactCount)furthestZ=Math.min(furthestZ,s.ball.z);if(!s.running)break;}q.step(0);return {...q.snapshot(),furthestZ,rampReleases:window.rampReleases};});
  assert(result.contactCount>0,'actual input creates physical contact');assert(result.furthestZ<1,'shot travels upfield');assert.equal(result.score.wickets,0);assert.equal(result.score.balls,1);
  if(sides.length===1&&sides[0]==='left'){assert.equal(result.rampReleases.length,1);assert.equal(result.rampReleases[0].balls,0);assert.equal(result.rampReleases[0].frozen,false);assert.notDeepEqual({x:result.ball.x,z:result.ball.z},result.rampReleases[0].position);}
  await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  rows.push({sides,contacts:result.contactCount,furthestZ:result.furthestZ,score:result.score,rampReleases:result.rampReleases});console.log(JSON.stringify(rows.at(-1)));
 }
 assert.deepEqual(errors,[]);await writeFile('docs/qa/centre-stroke-browser.json',JSON.stringify({fixture:'Seeded .5 centre delivery, actual Chromium touch, manual 120Hz physics, three input choices; not a win-rate test',rows,errors},null,2)+'\n');
}finally{await browser.close();await server.close();}
