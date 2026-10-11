import {createServer} from 'vite';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const server=await createServer({server:{host:'127.0.0.1',port:5216,hmr:false,watch:{ignored:['**/*']}},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const dir='docs/football-pinball/evidence-feedback';await mkdir(dir,{recursive:true});const results=[],errors=[];
try{
const page=await browser.newPage({viewport:{width:430,height:932},hasTouch:true,isMobile:true,deviceScaleFactor:1});page.setDefaultTimeout(60000);
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.addInitScript(()=>{sessionStorage.setItem('infinite-pinball-demo-access','granted');localStorage.setItem('football-audio','off');});
for(const mode of ['pvp','crash','penalty','arcade-rush']){
 await page.goto(`http://127.0.0.1:5216/football-pinball/?mode=${mode}&qa`);await page.waitForFunction(()=>window.__football);
 await page.evaluate(()=>{window.__render=window.__football.view.draw;window.__football.view.draw=()=>{};window.__football.view.setQuality('high');});
 if(mode==='pvp'){await page.selectOption('[name=format]','golden');await page.click('#fp-enter-board');await page.click('#fp-settings-open');}
 await page.click('#fp-audio');if(mode==='pvp')await page.click('#fp-dial-close');
 await page.click('#fp-serve');
 if(mode==='pvp'){
  await page.waitForFunction(()=>['countdown','active'].includes(window.__football.snapshot().state)||(!document.querySelector('#fp-toss-choices').hidden&&!document.querySelector('#fp-toss').hidden));
  if(await page.locator('#fp-toss-choices').isVisible())await page.click('[data-choice=kickoff]');
 }
 await page.waitForFunction(()=>window.__football.snapshot().state==='active');
 if(mode==='pvp'||mode==='crash'||mode==='arcade-rush'){
  const feedback=await page.evaluate(()=>{
   const {engine:e,view,audio}=window.__football,t=e.targets.find(t=>t.type===(e.mode==='pvp'?'skill':e.mode==='arcade-rush'?'multiball':'bumper'))||e.targets[0],b=e.balls[0];
   window.__render(e.snapshot());const before=view.metrics().effects.triggered;
   b.body.setTranslation({x:t.x-t.radius-e.ballRadius-.025,y:e.ballRadius+.01,z:-t.y},true);b.body.setLinvel({x:3,y:0,z:0},true);
   for(let i=0;i<12;i++)e.step();
   window.__render(e.snapshot());audio.update(e.snapshot().events);
   const once=view.metrics().effects.triggered;window.__render(e.snapshot());
   return {before,once,twice:view.metrics().effects.triggered,effects:view.metrics().effects,audio:audio.metrics()};
  });
  assert(feedback.once>feedback.before,`${mode} target effect`);assert.equal(feedback.once,feedback.twice);assert(feedback.audio.played>0);assert(feedback.audio.activeVoices<=20);
  results.push({mode,feedback});
  await page.waitForTimeout(100);await page.evaluate(()=>window.__render(window.__football.snapshot()));
  await page.locator('#fp-arena').screenshot({path:`${dir}/${mode}-target.png`,timeout:120000});
 }
 if(mode==='pvp'){
  await page.evaluate(()=>{const e=window.__football.engine,b=e.balls[0];b.body.setTranslation({x:.7,y:.65,z:-4.95},true);b.body.setLinvel({x:0,y:0,z:-5},true);for(let i=0;i<15;i++)e.step();window.__render(e.snapshot());});
 }else if(mode==='crash'){await page.click('#fp-bank');}
 else if(mode==='penalty'){
  await page.evaluate(()=>{const e=window.__football.engine;for(let n=0;n<5;n++){while(e.state==='relaunch')e.step();const b=e.balls[0];b.body.setTranslation({x:.8,y:.95,z:-4.94},true);b.body.setLinvel({x:0,y:0,z:-4},true);for(let i=0;i<12;i++)e.step();}window.__render(e.snapshot());});
 }else{
  // Run every remaining physics tick, retaining the real timer and drain/relaunch rules.
  await page.evaluate(()=>{const e=window.__football.engine;for(let i=0;i<24000&&e.state!=='ended';i++){for(const b of e.boots)e.setInput(b.id,i%60<12);e.step();}window.__render(e.snapshot());});
 }
 await page.waitForFunction(()=>window.__football.snapshot().state==='ended');await page.locator('#fp-results').waitFor({state:'visible'});
 const state=await page.evaluate(()=>({snapshot:window.__football.snapshot().state,result:window.__football.snapshot().result,effects:window.__football.view.metrics().effects,audio:window.__football.audio.metrics()}));
 results.push({mode,terminal:state});assert.equal(state.snapshot,'ended');
 await page.locator('#footballApp').screenshot({path:`${dir}/${mode}-result.png`,timeout:120000});
 if(mode==='pvp'){
  assert.equal(await page.locator('#fp-results h2').textContent(),'India wins');
  await page.click('#fp-settings-open');await page.click('#fp-audio');assert.equal(await page.evaluate(()=>window.__football.audio.metrics().muted),true);
  assert.equal(await page.evaluate(()=>window.__football.audio.metrics().activeVoices),0);await page.click('#fp-reset');await page.click('#fp-confirm-yes');
 }else await page.click('#fp-reset');
 await page.waitForFunction(()=>window.__football.snapshot().state==='ready');
 await page.evaluate(()=>{window.__football.view.setQuality('low');window.__render(window.__football.snapshot());});
 assert.equal(await page.evaluate(()=>window.__football.view.metrics().effects.reduced),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 results.push({mode,restart:true,reducedGraphics:true});
}
assert.deepEqual(errors,[]);
await writeFile(`${dir}/results.json`,JSON.stringify({method:'Mobile Chromium. Target and goal placement fixtures test actual physics. Arcade timer runs every tick. WebGL rendered for proof; continuous render disabled for software GPU. Audio graph verified, subjective listening not performed.',results,errors},null,2));console.log('All four modes: event effects, sound graph, terminal UI, restart and reduced graphics passed.');
}finally{await browser.close();await server.close();}
