import {preview} from 'vite';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const {default:bundle}=await import(process.env.CHROMIUM_MODULE);
const server=process.env.QA_BASE?null:await preview({preview:{host:'127.0.0.1',port:5185}});
const browser=await chromium.launch({headless:true,args:bundle.args,executablePath:process.env.CHROMIUM_PATH,...(process.env.QA_BASE?{proxy:{server:process.env.HTTPS_PROXY}}:{})});
try{
 const results=[];
 const page=await browser.newPage({viewport:{width:390,height:700},hasTouch:true,ignoreHTTPSErrors:true});
 for(const path of ['/','/cricket-pinball/']){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.QA_BASE||'http://127.0.0.1:5185')+path);
  const root=path==='/',consent=root?'#demoConsent':'#c',next=root?'#continueDemo':'#n',form=root?'#loginStep':'#l',fill=root?'#demoFill':'#fillDemo';
  await page.locator(consent).waitFor();assert(await page.locator(next).isDisabled());
  const layouts=[];
  for(const [w,h] of [[320,568],[390,700],[844,390],[390,320]]){
   await page.setViewportSize({width:w,height:h});
   const check=async()=>page.locator('.demo-gate').evaluate(g=>({overflow:g.scrollWidth>g.clientWidth,panelRight:g.querySelector('.demo-gate-panel').getBoundingClientRect().right,width:innerWidth}));
   const disclaimer=await check();assert(!disclaimer.overflow&&disclaimer.panelRight<=w);
   await page.locator(consent).check();await page.locator(next).click();
   const login=await check();assert(!login.overflow&&login.panelRight<=w);
   assert.equal(await page.locator(form+' input[type=password]').evaluate(e=>getComputedStyle(e).fontSize),'16px');
   await page.locator(fill).click();assert(await page.locator(form+' input[type=password]').inputValue());assert(await page.locator(form+' input:not([type=password])').inputValue());
   assert(await page.locator(form).isVisible(),'autofill must not submit');
   await page.locator(form+' button[type=submit], '+form+' .demo-primary').click();
   await page.waitForFunction(()=>sessionStorage.getItem('infinite-pinball-demo-access')==='granted');
   layouts.push({w,h,disclaimer,login});
   await page.evaluate(()=>sessionStorage.clear());await page.reload();await page.locator(consent).waitFor();
  }
  await page.setViewportSize({width:390,height:700});
  await page.screenshot({path:`docs/qa/access-${root?'home':'cricket'}-disclaimer.png`});
  await page.locator(consent).check();await page.locator(next).click();
  await page.screenshot({path:`docs/qa/access-${root?'home':'cricket'}-login.png`});
  assert.deepEqual(errors,[]);results.push({path,layouts,errors});
 }
 await writeFile('docs/qa/access-mobile.json',JSON.stringify(results,null,2));console.log('Both access gates passed: mobile, landscape, reduced viewport and autofill.');
}finally{await browser.close();if(server)await new Promise(r=>server.httpServer.close(r));}
