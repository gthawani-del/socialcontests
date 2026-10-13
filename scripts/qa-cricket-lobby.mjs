import {preview} from 'vite';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const args=process.env.CHROMIUM_MODULE
  ? (await import(process.env.CHROMIUM_MODULE)).default.args
  : ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const server=await preview({preview:{host:'127.0.0.1',port:5180,strictPort:true}});
const browser=await chromium.launch({headless:true,args,executablePath:process.env.CHROMIUM_PATH});
const evidence=process.env.QA_EVIDENCE || 'docs/cricket-pinball/evidence-settings';
await mkdir(evidence,{recursive:true});
try{
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
const errors=[],models=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(r.url().endsWith('.glb'))models.push(r.url());});
const lobby=process.env.QA_URL || 'http://127.0.0.1:5180/cricket-pinball/';
await page.goto(lobby);
const gate=await readFile('src/access/demo-gate.js','utf8');
await page.locator('#c').check();await page.locator('#n').click();
await page.locator('#u').fill(gate.match(/U='([^']+)'/)[1]);
await page.locator('#p').fill(gate.match(/P='([^']+)'/)[1]);
await page.locator('#l button').click();
await page.locator('#cricketStart').waitFor();
await page.waitForFunction(()=>document.querySelector('.stadium-preview img').naturalWidth>0);
assert.equal(await page.getByLabel('Match length',{exact:true}).inputValue(),'ONE_OVER');
assert.equal(await page.getByLabel('Difficulty',{exact:true}).inputValue(),'MEDIUM');
for(const [format,balls] of [['LAST_3',3],['ONE_OVER',6],['TWO_OVER',12]]){
 await page.getByLabel('Match length',{exact:true}).selectOption(format);
 assert.equal(await page.locator('#matchBalls').innerText(),`${balls} balls`);
 assert.equal(await page.locator('#formatValue').innerText(),{LAST_3:'3 balls',ONE_OVER:'1 over',TWO_OVER:'2 overs'}[format]);
}
for(const difficulty of ['EASY','HARD','MEDIUM']){
 await page.getByLabel('Difficulty',{exact:true}).selectOption(difficulty);
 assert.equal(await page.locator('#difficultyValue').innerText(),{EASY:'Easy',MEDIUM:'Normal',HARD:'Hard'}[difficulty]);
 assert.equal(await page.locator('#difficultyHint').innerText(),{EASY:'A gentler challenge',MEDIUM:'A balanced match',HARD:'A tougher opponent'}[difficulty]);
}
const layouts=[];
for(const [name,width,height] of [['mobile',390,844],['mobile-browser',390,664],['small',320,568],['desktop',1365,900],['landscape',844,390]]){
 await page.setViewportSize({width,height});
 await page.evaluate(()=>scrollTo(0,0));
 await page.evaluate(()=>document.fonts.ready);
 const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,play:document.querySelector('#cricketStart').getBoundingClientRect().toJSON(),targets:[...document.querySelectorAll('.setting-card select,.practice-links a,#cricketStart,.worlds-link,.how-pin-trigger')].map(b=>b.getBoundingClientRect().height)}));
 assert(!result.overflow,`${name}: horizontal overflow`);assert(result.targets.every(h=>h>=44),`${name}: touch targets`);
 if(name.startsWith('mobile'))assert(result.play.bottom<=height,'Play is above the fold on the standard mobile viewport');
 // The approved artwork uses natural vertical scrolling on short viewports.
 await page.locator('#cricketStart').scrollIntoViewIfNeeded();
 assert(await page.locator('#cricketStart').isVisible());
 await page.evaluate(()=>scrollTo(0,0));
 layouts.push({name,width,height,...result});
 await page.screenshot({path:`${evidence}/${name}.png`,fullPage:true});
}
assert.equal(models.length,0,'lobby must not load a gameplay GLB');
await page.setViewportSize({width:390,height:844});
await page.locator('.how-pin-trigger').tap();await page.locator('#howPinCricketDialog').waitFor();
assert.match(await page.locator('#howPinCricketDialog').innerText(),/right-side plunger/);
await page.keyboard.press('Escape');assert(await page.locator('#howPinCricketDialog').isHidden());
assert(await page.locator('.how-pin-trigger').evaluate(el=>el===document.activeElement));
await page.getByLabel('Match length',{exact:true}).selectOption('ONE_OVER');
await page.getByLabel('Match length',{exact:true}).focus();await page.keyboard.press('ArrowDown');
assert.equal(await page.getByLabel('Match length',{exact:true}).inputValue(),'TWO_OVER');
await page.getByLabel('Difficulty',{exact:true}).selectOption('HARD');
await page.locator('#cricketStart').tap();await page.waitForURL('**/cricket-pinball/play/**');
const url=new URL(page.url());
assert.equal(url.searchParams.get('format'),'TWO_OVER');assert.equal(url.searchParams.get('difficulty'),'HARD');
assert.equal(url.searchParams.get('mode'),'CPU');
await page.locator('#beginStadiumToss').waitFor({timeout:60000});
assert.equal(await page.locator('#format').inputValue(),'TWO_OVER');
assert.equal(await page.locator('#difficulty').inputValue(),'HARD');
await page.goto(lobby);
assert.equal(await page.getByLabel('Match length',{exact:true}).inputValue(),'TWO_OVER');
assert.equal(await page.getByLabel('Difficulty',{exact:true}).inputValue(),'HARD');
for(const practice of ['bat','bowl']){
 await page.locator(`.practice-links a[href$="practice=${practice}"]`).tap();
 await page.waitForURL(`**/cricket-pinball/play/?practice=${practice}`);
 if(practice==='bat'){
  await page.waitForFunction(()=>document.querySelector('#score')?.textContent.includes('You batting'),{},{timeout:60000});
  assert(await page.locator('#leftBat').isEnabled());
  assert.match(await page.locator('#score').innerText(),/You batting/i);
 }else{
  await page.locator('#confirmBowler').waitFor({timeout:60000});
  assert.match(await page.locator('#matchPanel').innerText(),/Choose your bowler/);
 }
 await page.goto(lobby);
}
await page.route('**/cricket-settings-stadium.webp',r=>r.abort());await page.reload();
await page.locator('figcaption').waitFor();assert(await page.locator('#cricketStart').isEnabled());
assert.deepEqual(errors,[]);
await writeFile(`${evidence}/checks.json`,JSON.stringify({layouts,errors,lobbyModelRequests:0,accessGate:true,allSelections:true,dynamicSummary:true,helpAndFocusReturn:true,keyboardSelection:true,preferences:true,playRouteAndSettings:true,practiceRoutes:['bat','bowl'],previewFailureFallback:true,browser:'Headless Chromium; simulated touch viewports. No gameplay physics changed or tested.'},null,2));
console.log('Lobby checks passed: layouts, all settings, summary, help, preferences, match handoff, both practice routes and image fallback.');
}finally{await browser.close();await new Promise(r=>server.httpServer.close(r));}
