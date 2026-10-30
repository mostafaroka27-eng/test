/** Opt-in sustained browser exercise. Run after npm run build. Never contacts remote sites. */
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir,writeFile,mkdtemp,cp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as pause} from 'node:timers/promises';

const seconds=Number(process.env.ENDURANCE_SECONDS??180);
assert.ok(Number.isFinite(seconds)&&seconds>=30&&seconds<=7200,'ENDURANCE_SECONDS must be 30–7200');
const directory=process.env.ENDURANCE_OUTPUT??'test-results/endurance';await mkdir(directory,{recursive:true});
const frozen=await mkdtemp(join(tmpdir(),'rokadex-endurance-'));await cp('dist',frozen,{recursive:true});
const assets=await readdir(join(frozen,'assets'));
const port=String(Number(process.env.ENDURANCE_PORT??4273));
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',port,'--strictPort','--outDir',frozen],{stdio:'ignore'});
let browser;
let interrupted=false;process.once('SIGINT',()=>{interrupted=true});process.once('SIGTERM',()=>{interrupted=true});
const samples=[],errors=[];let cycles=0;const started=Date.now();
async function result(status){
 await writeFile(directory+'/result.json',JSON.stringify({status,assets,started:new Date(started).toISOString(),elapsedSeconds:(Date.now()-started)/1000,cycles,errors,samples},null,2));
}
try{
 for(let i=0;i<50;i++){
  try{const response=await fetch('http://127.0.0.1:'+port+'/');if(response.ok)break}catch{}
  if(i===49)throw Error('Endurance preview did not start');await pause(100);
 }
 browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
 await page.goto('http://127.0.0.1:'+port+'/');await page.locator('#viewport canvas').waitFor();
 const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
 while(!interrupted&&Date.now()-started<seconds*1000){
  const actionStart=Date.now();
  await page.locator('[data-mode="design"]').click();
  await page.locator('#width').fill(String(800+(cycles%7)*50));await page.locator('#width').press('Tab');
  await page.locator('#shelves').fill(String(1+cycles%4));await page.locator('#shelves').press('Tab');
  await page.locator('#rotation').selectOption(String((cycles%4)*90));
  await page.locator('#undo').click();await page.locator('#redo').click();
  if(cycles%4===0){await page.locator('#lang').click()}
  await page.locator('[data-mode="plan"]').click();
  assert.equal(await page.locator('#planDrawing [data-unit]').count(),1);
  await page.locator('[data-mode="costing"]').click();
  assert.equal(await page.locator('[data-material-rate]').count(),2);
  await page.locator('[data-mode="review"]').click();
  await page.locator('[data-mode="drawings"]').click();
  assert.equal(await page.locator('#drawingContent svg').count(),1);
  await page.locator('[data-mode="design"]').click();
  cycles++;
  if(cycles%10===0){
   await cdp.send('HeapProfiler.collectGarbage');
   const metrics=await cdp.send('Performance.getMetrics'),dom=await cdp.send('Memory.getDOMCounters');
   const heap=metrics.metrics.find(metric=>metric.name==='JSHeapUsedSize')?.value;
   const sample={cycles,elapsedSeconds:(Date.now()-started)/1000,actionMilliseconds:Date.now()-actionStart,heapBytes:heap,documents:dom.documents,nodes:dom.nodes,eventListeners:dom.jsEventListeners};samples.push(sample);
   await result('running');console.log(JSON.stringify(sample));
  }
  if(cycles%50===0){await page.reload();await page.locator('#viewport canvas').waitFor()}
  if(errors.length)throw Error('Browser errors: '+errors.join('; '));
  // Pace repeated edits while the rendered scene remains active between actions.
  await pause(1500);
 }
 await page.screenshot({path:directory+'/final.png',fullPage:true});
 assert.equal(errors.length,0);await result(interrupted?'interrupted':'passed');console.log(`Endurance ${interrupted?'interrupted':'passed'}: ${cycles} cycles, ${((Date.now()-started)/1000).toFixed(1)} seconds`);
}catch(error){errors.push(error.message);await result('failed');throw error}
finally{await browser?.close();server.kill('SIGTERM');await rm(frozen,{recursive:true,force:true})}
