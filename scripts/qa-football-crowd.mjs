import {createServer} from 'vite';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const server=await createServer({server:{port:5250,host:'127.0.0.1',hmr:false,watch:{ignored:['**/*']}},logLevel:'error'});await server.listen();
const b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});const errors=[];let downloads=0;
try{
 const p=await b.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().endsWith('crowd-cheering.mp3'))downloads++;});
 await p.goto('http://127.0.0.1:5250/');
 await p.setContent('<main id="fixture"><div class="fp-actions"></div><button id="start">Start match</button></main>');
 await p.evaluate(async()=>{
  const original=AudioNode.prototype.connect;window.__meters=[];
  AudioNode.prototype.connect=function(destination,...args){const result=original.call(this,destination,...args);if(destination instanceof AudioDestinationNode){const meter=this.context.createAnalyser();meter.fftSize=2048;original.call(this,meter);window.__meters.push(meter);}return result;};
  const {createAudio}=await import('/src/football-pinball/ui/audio.js');localStorage.removeItem('football-audio');window.audio=createAudio(document.querySelector('#fixture'));document.querySelector('#start').onclick=()=>audio.update([],{state:'active',paused:false});
 });
 assert.equal(await p.evaluate(()=>audio.metrics().crowdStatus),'idle');await p.click('#start');await p.waitForFunction(()=>audio.metrics().crowd,{},{timeout:20000});
 await p.waitForFunction(()=>__meters.some(m=>{const d=new Float32Array(m.fftSize);m.getFloatTimeDomainData(d);return d.some(v=>Math.abs(v)>.0001);}));
 const initial=await p.evaluate(()=>audio.metrics());assert(initial.crowdDuration>39&&initial.crowdDuration<40);assert.equal(initial.crowdStarts,1);
 await p.evaluate(()=>{for(let i=0;i<100;i++)audio.update([],{state:'active',paused:false});});assert.equal(await p.evaluate(()=>audio.metrics().crowdStarts),1);
 // Run beyond a complete real-time loop, checking that a second source is not created.
 console.log('Recording decoded and producing audio; checking one full loop.');
 await p.waitForTimeout(40000);assert.equal(await p.evaluate(()=>audio.metrics().crowdStarts),1);
 await p.waitForFunction(()=>__meters.some(m=>{const d=new Float32Array(m.fftSize);m.getFloatTimeDomainData(d);return d.some(v=>Math.abs(v)>.0001);}));
 await p.evaluate(()=>audio.update([],{state:'active',paused:true}));assert.equal(await p.evaluate(()=>audio.metrics().crowd),false);
 await p.evaluate(()=>audio.update([],{state:'active',paused:false}));assert.equal(await p.evaluate(()=>audio.metrics().crowd),true);
 await p.click('#fp-audio');assert.equal(await p.evaluate(()=>audio.metrics().crowd),false);assert.equal(await p.evaluate(()=>audio.metrics().muted),true);await p.click('#fp-audio');await p.waitForFunction(()=>audio.metrics().crowd);
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await p.evaluate(()=>audio.metrics().crowd),false);
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await p.waitForFunction(()=>audio.metrics().crowd);
 await p.evaluate(()=>audio.reset());assert.equal(await p.evaluate(()=>audio.metrics().crowd),false);await p.click('#start');await p.waitForFunction(()=>audio.metrics().crowd);
 await p.evaluate(()=>audio.update([],{state:'ended',paused:false}));assert.equal(await p.evaluate(()=>audio.metrics().crowd),false);
 await p.evaluate(()=>audio.dispose());assert.equal(await p.evaluate(()=>audio.metrics().crowd),false);assert.equal(downloads,1);assert.deepEqual(errors,[]);
 const result={initial,checks:['gesture unlock','decoded uploaded MP3','nonzero audio output','full real-time loop with no duplicate source','pause/resume','mute/unmute','simulated visibility event','restart','round end','dispose','one download per match UI'],errors,limits:'Chromium Web Audio checks with a shared-audio fixture; visibility is simulated. Does not establish physical-phone speaker comfort or Safari behavior.'};await mkdir('docs/football-pinball/evidence-audio',{recursive:true});await writeFile('docs/football-pinball/evidence-audio/browser.json',JSON.stringify(result,null,2));console.log(result);
}finally{await b.close();await server.close();}
