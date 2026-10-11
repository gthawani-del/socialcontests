import {createServer} from 'vite';
import {chromium} from '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const server=await createServer({server:{host:'127.0.0.1',port:5211,hmr:false,watch:{ignored:['**/*']}},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:'/tmp/cricket-browser/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{const page=await browser.newPage({viewport:{width:430,height:932},deviceScaleFactor:1});page.setDefaultTimeout(60000);page.on('pageerror',e=>console.log(e.message));await page.addInitScript(()=>sessionStorage.setItem('infinite-pinball-demo-access','granted'));await page.goto('http://127.0.0.1:5211/football-pinball/?mode=pvp&qa');await page.waitForFunction(()=>window.__football);await page.evaluate(()=>{window.__football.view.setQuality('high');window.__savedDraw=window.__football.view.draw;window.__football.view.draw=()=>{};});

await page.selectOption('#fp-team-type','club');
await page.selectOption('#fp-blue-team','FC Barcelona');
await page.selectOption('#fp-red-team','AC Milan');
if(await page.locator('.fp-blue .fp-team-name small').textContent()!=='FC Barcelona')throw Error('Club selection failed');
await page.selectOption('#fp-team-type','country');
await page.selectOption('#fp-blue-team','India');
await page.selectOption('#fp-red-team','Brazil');
await page.locator('#footballApp').screenshot({path:'docs/football-pinball/evidence-visual/team-selection-430.png'});
await page.selectOption('[name=format]','classic');await page.click('#fp-enter-board');await page.click('#fp-serve');
await page.waitForFunction(()=>['countdown','active'].includes(window.__football.snapshot().state)||(!document.querySelector('#fp-toss-choices').hidden&&!document.querySelector('#fp-toss').hidden));
if(await page.locator('#fp-toss-choices').isVisible())await page.click('[data-choice=kickoff]');
await page.waitForFunction(()=>window.__football.snapshot().state==='active');

await page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));window.__football.engine.setPaused(true);window.__savedDraw(window.__football.snapshot());});
await page.locator('#footballApp').screenshot({path:'docs/football-pinball/evidence-visual/ball-team-selection-430.png',timeout:120000});
if(await page.locator('.fp-red .fp-team-name small').textContent()!=='Brazil')throw Error('Selected opponent lost');
console.log(await page.evaluate(()=>({viewport:innerHeight,arena:document.querySelector('#fp-arena').getBoundingClientRect().toJSON(),pageHeight:document.documentElement.scrollHeight})));
}finally{await browser.close();await server.close();}
