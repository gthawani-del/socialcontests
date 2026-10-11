import { createServer } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const vite=await createServer({server:{port:5264,host:'127.0.0.1',hmr:false},logLevel:'error'});
await vite.listen();
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const failures=[];
try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.on('pageerror',error=>failures.push(error.message));
  await page.addInitScript(()=>sessionStorage.setItem('infinite-pinball-demo-access','granted'));
  await page.goto('http://127.0.0.1:5264/football-pinball/?mode=crash&qa');
  await page.waitForFunction(()=>window.__crash?.ready);
  await page.locator('#fc-enter').click();
  await page.waitForFunction(()=>window.__crash?.view);
  for(const file of ['Game-start.mp3','Soccer-kick.mp3']){
    const res=await page.request.get('http://127.0.0.1:5264/football-pinball/audio/'+file);
    assert.equal(res.status(),200,file+' must exist');
    assert.match(res.headers()['content-type']||'',/audio|mpeg|octet-stream/i);
  }
  await page.waitForFunction(()=>__crash.audio.metrics().crashClipsLoaded.length===2,{timeout:15000});
  await page.evaluate(()=>__crash.setNextPracticeCrash(100));
  await page.locator('#fc-start').click();
  await page.waitForFunction(()=>__crash.snapshot()?.status==='active',{timeout:8000});
  await page.waitForFunction(()=>__crash.audio.metrics().played>=1,{timeout:5000});
  // Exercise real mobile pointer taps independently; holding both keys hides timing faults.
  const touch=async selector=>{
    const b=await page.locator(selector).boundingBox();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
    await page.mouse.down();
    await page.waitForTimeout(170);
    await page.mouse.up();
  };
  let hitStart=await page.evaluate(()=>__crash.view.metrics().physics.bootHits);
  for(let i=0;i<160;i++){
    const state=await page.evaluate(()=>__crash.view.metrics().physics);
    if(state.z>2.4&&state.z<4.6){
      await touch(state.x<0?'#fc-left-boot':'#fc-right-boot');
    }else await page.waitForTimeout(120);
    const current=await page.evaluate(()=>__crash.view.metrics().physics.bootHits);
    if(current>hitStart)break;
  }
  await page.waitForFunction(()=>__crash.view.metrics().physics.bootHits>0,{timeout:5000});
  const stats=await page.evaluate(()=>({physics:__crash.view.metrics().physics,audio:__crash.audio.metrics(),scroll:document.documentElement.scrollWidth,width:innerWidth}));
  assert.ok(stats.physics.bootHits>0,'physical ball contact from held flippers');
  assert.ok(stats.audio.played>=2,'start and collision audio events played');
  assert.ok(stats.scroll<=stats.width,'mobile layout should not overflow horizontally');
  assert.deepEqual(failures,[]);
  console.log('PASS',JSON.stringify({bootHits:stats.physics.bootHits,score:stats.physics.score,audioPlayed:stats.audio.played,clips:stats.audio.crashClipsLoaded,mobileOverflow:false}));
}finally{await browser.close();await vite.close();}
