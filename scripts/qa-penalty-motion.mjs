import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=await createServer({server:{host:'127.0.0.1',port:5199,hmr:false},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{sessionStorage.setItem('infinite-pinball-demo-access','granted');localStorage.setItem('penalty-duel-settings',JSON.stringify({format:'fixed',total:3,sound:false}));});
 await page.goto('http://127.0.0.1:5199/football-pinball/?mode=penalty&qa');await page.waitForFunction(()=>window.__penalty?.assets.ball);
 await page.click('#pd-continue');await page.click('[data-call=heads]');await page.waitForFunction(()=>['choice','countdown','aim'].includes(window.__penalty.snapshot().phase));if(await page.locator('[data-first=cpu]').isVisible())await page.click('[data-first=cpu]');
 const deadline=Date.now()+70000;let first,shots=0;const modes=[];
 while(Date.now()<deadline){const s=await page.evaluate(()=>window.__penalty.snapshot());if(s.phase==='ended')break;if(s.phase==='aim'||s.phase==='flight'){first??=s.turn;assert.equal(s.turn,first);}
 if(s.phase==='aim'&&s.turn==='you'){await page.keyboard.down('ArrowLeft');await page.waitForTimeout(315);await page.keyboard.up('ArrowLeft');}
 if(s.phase==='aim'&&s.turn==='cpu'&&s.history.cpu.length===shots){
 const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.27);await page.mouse.down();await page.mouse.move(box.x+box.width*.63,box.y+box.height*.27,{steps:12});await page.mouse.up();await page.waitForTimeout(300);assert((await page.evaluate(()=>window.__penalty.snapshot().keeper.x))>.2);
 await page.click('[aria-label="Dive top left"]');
 for(const [name,delay] of [['push-off',60],['airborne',260],['landing',800]]){await page.waitForTimeout(delay);modes.push((await page.evaluate(()=>window.__penalty.snapshot())).keeper.mode);await page.screenshot({path:`docs/football-pinball/penalty-duel/motion-${name}.png`});}shots++;}
 await page.waitForTimeout(40);}
 const s=await page.evaluate(()=>window.__penalty.snapshot());assert.equal(s.phase,'ended');assert.equal(s.format,'fixed');assert(s.winner);assert.deepEqual(errors,[]);
 await writeFile('docs/football-pinball/penalty-duel/fixed-match.json',JSON.stringify({stateMutation:false,accelerated:false,first,history:s.history,winner:s.winner,modes,errors},null,2));console.log('Fixed round passed',s.history,modes);
}finally{await browser.close();await server.close();}
