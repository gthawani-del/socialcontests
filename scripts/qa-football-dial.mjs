import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5215,hmr:false},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const dir='docs/football-pinball/evidence-visual',checks=[];
try {
 const page=await browser.newPage({viewport:{width:430,height:932},hasTouch:true,isMobile:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>sessionStorage.setItem('infinite-pinball-demo-access','granted'));
 await page.goto('http://127.0.0.1:5215/football-pinball/');
 assert.equal(await page.locator('.fp-mode-card').count(),4);
 await page.screenshot({path:`${dir}/dial-01-game-selection.png`});
 await page.goto('http://127.0.0.1:5215/football-pinball/?mode=pvp&qa');
 assert(await page.locator('.fp-preflight').isVisible());assert.equal(await page.locator('#fp-arena').isVisible(),false);
 await page.selectOption('[name=format]','classic');await page.waitForFunction(()=>window.__football);
 await page.evaluate(()=>window.__football.view.setQuality('high'));
 async function capture(name){await page.evaluate(()=>{window.__savedDraw=window.__football.view.draw;window.__football.view.draw=()=>{};window.__savedDraw(window.__football.snapshot());});await page.screenshot({path:`${dir}/${name}.png`,timeout:120000});await page.evaluate(()=>{window.__football.view.draw=window.__savedDraw;});}
 await capture('dial-02-match-setup');console.log('setup captured');
 await page.click('#fp-enter-board');await page.waitForFunction(()=>document.querySelector('#footballApp').dataset.matchState==='ready');
 assert.equal(await page.locator('.fp-actions').count(),0);assert.equal(await page.locator('#footballApp>.fp-how').count(),0);assert.equal(await page.locator('#footballApp>.fp-table-guide').count(),0);
 await capture('dial-03-start-overlay');
 await page.click('#fp-serve');await page.waitForFunction(()=>['countdown','active'].includes(window.__football.snapshot().state)||(!document.querySelector('#fp-toss-choices').hidden&&!document.querySelector('#fp-toss').hidden));
 if(await page.locator('#fp-toss-choices').isVisible())await page.click('[data-choice=kickoff]');
 await page.waitForFunction(()=>window.__football.snapshot().state==='active');assert.equal(await page.locator('#fp-serve').isVisible(),false);
 const box=await page.locator('[data-boot=blue-left]').boundingBox();const cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});
 assert.equal(await page.locator('[data-boot=blue-left]').getAttribute('aria-pressed'),'true');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.equal(await page.locator('[data-boot=blue-left]').getAttribute('aria-pressed'),'false');
 await capture('dial-04-gameplay');console.log('gameplay captured');
 await page.click('#fp-settings-open');assert(await page.evaluate(()=>window.__football.engine.paused));
 await capture('dial-05-open-menu');
 const sound=await page.locator('#fp-audio').textContent();await page.click('#fp-audio');assert.notEqual(await page.locator('#fp-audio').textContent(),sound);
 await page.click('#fp-help');assert(await page.locator('#fp-settings-dialog').isVisible());assert(await page.evaluate(()=>window.__football.engine.paused));
 assert(await page.locator('.fp-table-guide').isVisible());await capture('dial-06-help');await page.keyboard.press('Escape');await page.waitForFunction(()=>!window.__football.engine.paused);
 await page.click('#fp-settings-open');await page.click('#fp-reset');assert(await page.locator('.fp-confirm').isVisible());await page.click('#fp-confirm-cancel');assert.notEqual(await page.evaluate(()=>window.__football.engine.state),'ready');
 await page.click('#fp-settings-open');await page.click('#fp-exit');await page.click('#fp-confirm-cancel');assert(page.url().includes('mode=pvp'));
 await page.click('#fp-settings-open');await page.click('#fp-pause');await page.waitForFunction(()=>!window.__football.engine.paused);assert.equal(await page.locator('#fp-control-dial').isVisible(),false);
 for(const width of [390,1440]){await page.setViewportSize({width,height:width===390?844:1000});await page.evaluate(()=>window.__football.engine.setPaused(true));await capture(`dial-gameplay-${width}`);const layout=await page.locator('[data-boot]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;}));assert(layout.every(Boolean));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.click('#fp-settings-open');await page.click('#fp-reset');await page.click('#fp-confirm-yes');await page.waitForFunction(()=>window.__football.engine.state==='ready');assert(await page.locator('#fp-serve').isVisible());
 assert.equal(errors.length,0);checks.push('separate four-mode selector and pre-match setup','start overlay disappears during play','no horizontal controls or guide below board','real touch press/release','dial pauses local match; closing/help returns to play','sound toggle','restart and exit cancellations preserve match','confirmed restart returns to ready','390/430/1440 layouts and controls fit','no runtime errors');
 await writeFile(`${dir}/dial-results.json`,JSON.stringify({checks,errors,scope:'Local PvP in Chromium with software rendering. Demo access fixture; online server and physical device performance not tested.'},null,2));console.log(checks);
}finally{await browser.close();await server.close();}
