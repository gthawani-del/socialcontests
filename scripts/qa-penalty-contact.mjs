import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=await createServer({server:{host:'127.0.0.1',port:5194,hmr:false},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const dir='docs/football-pinball/penalty-contact';await mkdir(dir,{recursive:true});const results=[];
try{
 for(const [name,width,height,format] of [['mobile',390,844,'standard'],['small',360,640,'fixed'],['landscape',844,390,'fixed']]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(format=>{sessionStorage.setItem('infinite-pinball-demo-access','granted');localStorage.setItem('penalty-duel-settings',JSON.stringify({total:3,format,sound:false}));},format);
  await page.goto('http://127.0.0.1:5194/football-pinball/?mode=penalty&qa');await page.waitForFunction(()=>window.__penalty?.assets.ball);
  await page.click('#pd-continue');await page.click('[data-call=heads]');const session=await page.context().newCDPSession(page);
  await page.evaluate(()=>{window.samples=[];window.sampleTimer=setInterval(()=>{const s=window.__penalty.snapshot();window.samples.push({phase:s.phase,ball:s.ball,boots:s.boots,cue:s.cue,charge:s.charge,turn:s.turn});},16);});
  const deadline=Date.now()+105000;let kicked=-1,dived=-1,shotCount=0;const contacts=[];
  while(Date.now()<deadline){const s=await page.evaluate(()=>window.__penalty.snapshot());
   for(const e of s.events)if(e.type==='BOOT_CONTACT'&&!contacts.some(x=>x.id===e.id))contacts.push(e);
   if(s.phase==='choice')await page.click(`[data-first=${name==='landscape'?'cpu':'you'}]`);
   if(s.phase==='ended')break;
   if(s.phase==='aim'&&s.turn==='you'&&!s.swing&&kicked!==s.history.you.length){
    kicked=s.history.you.length;const side=shotCount++%2?'left':'right';
    if(name==='mobile'&&shotCount===1){ // Real cancellation must not fire a shot.
     const b=await page.locator(`[data-boot=${side}]`).boundingBox();await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});await page.waitForTimeout(80);await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal(await page.evaluate(()=>window.__penalty.snapshot().flight),null);
    }
    await page.click(`[data-height="${shotCount%2?'.72':'.22'}"]`);
    const b=await page.locator(`[data-boot=${side}]`).boundingBox();assert(b.y+b.height<=height+1);
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});
    await page.waitForTimeout(420);const before=await page.evaluate(()=>window.__penalty.snapshot());assert(before.charge?.power>0);assert.equal(before.flight,null);
    await page.screenshot({path:`${dir}/${name}-charge.png`});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(()=>window.__penalty.snapshot().boots.left>0||window.__penalty.snapshot().boots.right>0);
    await page.waitForTimeout(160);await page.screenshot({path:`${dir}/${name}-contact.png`});
   }
   if(s.turn==='cpu'&&s.phase==='aim'&&s.cue&&dived!==s.history.cpu.length){
    dived=s.history.cpu.length;await page.screenshot({path:`${dir}/${name}-cue.png`});
    await page.keyboard.down('ArrowLeft');await page.waitForTimeout(100);await page.keyboard.up('ArrowLeft');await page.click('[aria-label="Dive top left"]');
   }
   await page.waitForTimeout(20);
  }
  const final=await page.evaluate(()=>window.__penalty.snapshot());assert.equal(final.phase,'ended');assert(final.winner);assert(contacts.length>0);assert(contacts.every(c=>c.distance<=.065001&&c.surfaceSpeed>0));assert.equal(await page.locator('#pd-timing').count(),0);
  const samples=await page.evaluate(()=>{clearInterval(window.sampleTimer);return window.samples;});assert(samples.every(s=>s.ball.y<=.795001));assert(samples.some(s=>s.boots.left>0||s.boots.right>0));assert.deepEqual(errors,[]);
  await page.click('#pd-rematch');assert.equal(await page.evaluate(()=>window.__penalty.snapshot().history.you.length),0);
  results.push({name,format,normalSpeed:true,stateMutation:false,winner:final.winner,history:final.history,contacts:contacts.map(c=>({side:c.side,power:c.power,stroke:c.stroke,distance:c.distance})),cpuCue:samples.some(s=>s.cue),errors});await page.close();
 }
 await writeFile(`${dir}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await server.close();}
