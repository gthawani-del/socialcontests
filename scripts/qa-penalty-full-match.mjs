import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server=await createServer({server:{host:'127.0.0.1',port:5198,hmr:false},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>sessionStorage.setItem('infinite-pinball-demo-access','granted'));
 await page.goto('http://127.0.0.1:5198/football-pinball/?mode=penalty&qa');await page.waitForFunction(()=>window.__penalty?.assets.ball);
 await page.click('#pd-continue');await page.click('[data-call=heads]');
 // Production-default full match: no state mutation, no accelerated clock, ordinary browser input.
 const deadline=Date.now()+100000;let aimed=-1,dived=-1;
 while(Date.now()<deadline){
  const s=await page.evaluate(()=>window.__penalty.snapshot());
  if(s.phase==='choice')await page.click('[data-first=you]');
  if(s.phase==='ended')break;
  if(s.phase==='aim'&&s.turn==='you'){
   if(aimed!==s.history.you.length){const box=await page.locator('canvas').boundingBox();const aim=s.keeper.x>=.5?.09:.91;await page.touchscreen.tap(box.x+box.width*(.215+.57*aim),box.y+box.height*(.165+.135*.12));aimed=s.history.you.length;}
   await page.keyboard.down('ArrowRight');await page.waitForTimeout(315);await page.keyboard.up('ArrowRight');
  }
  if(s.phase==='flight'&&s.turn==='cpu'&&dived!==s.history.cpu.length){
   await page.click('[aria-label="Dive top left"]');dived=s.history.cpu.length;
  }
  await page.waitForTimeout(35);
 }
 const final=await page.evaluate(()=>window.__penalty.snapshot());assert.equal(final.phase,'ended');assert(final.history.you.length>=3);assert(final.events.some(e=>e.type==='BOOT_CONTACT'));assert(final.winner);
 await page.screenshot({path:'docs/football-pinball/penalty-duel/full-match-result.png'});
 await page.click('#pd-rematch');assert.equal(await page.evaluate(()=>window.__penalty.snapshot().history.you.length),0);await page.click('[data-call=tails]');
 await page.waitForFunction(()=>['choice','countdown','aim'].includes(window.__penalty.snapshot().phase));if(await page.locator('[data-first=cpu]').isVisible())await page.click('[data-first=cpu]');
 await page.click('#pd-pause');await page.click('#pd-restart');await page.locator('label').filter({has:page.locator('[name=length][value="3"]')}).click();
 await page.reload();assert(await page.locator('[name=length][value="3"]').isChecked());assert.deepEqual(errors,[]);
 await writeFile('docs/football-pinball/penalty-duel/full-match.json',JSON.stringify({productionDefaults:true,accelerated:false,stateMutation:false,history:final.history,winner:final.winner,keyboardKick:true,touchAim:true,rematchClearsScores:true,settingsPersist:true,errors},null,2));
 console.log('Full production-default match, keyboard, rematch and settings persistence passed.',final.history);
}finally{await browser.close();await server.close();}
