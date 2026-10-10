import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE),{default:bundle}=await import(process.env.CHROMIUM_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5188}});await server.listen();
const browser=await chromium.launch({headless:true,args:bundle.args,executablePath:process.env.CHROMIUM_PATH});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
 await page.addInitScript(()=>localStorage.setItem('cricket-quality','low'));
 await page.route('**/qa-bat-layout*',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><main id="stadiumApp"></main><script type="module" src="/src/cricket-pinball/stadium-prototype.js"></script>'}));
 await page.goto('http://127.0.0.1:5188/qa-bat-layout?practice=bat');await page.waitForFunction(()=>window.__stadiumQA?.ready);
 await page.waitForFunction(()=>!document.querySelector('#leftBat').disabled);await page.evaluate(()=>window.__stadiumQA.manual(true));
 const layouts=[];
 for(const [width,height] of [[390,844],[320,568],[844,390],[1365,900]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(350);
  const before=await page.locator('#leftBat').boundingBox();
  for(const side of ['left','right']){const b=await page.locator('#'+side+'Bat').boundingBox();assert(b.height>=48&&b.width>=48);assert(b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height);}
  if(await page.locator('#stadiumCoach').isVisible())await page.locator('#stadiumCoach button').click();
  const after=await page.locator('#leftBat').boundingBox();assert(Math.abs(after.y-before.y)<1,'dismissing guide must not move the bat row');
  assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
  layouts.push({width,height,before,after});
  await page.screenshot({path:`docs/qa/batting-controls-${width}.png`,timeout:60000});
 }
 await writeFile('docs/qa/batting-controls-layout.json',JSON.stringify(layouts,null,2));console.log('Four batting layouts and stable thumb row passed');
}finally{await browser.close();await server.close();}
