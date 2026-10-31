// Assembly mode: step-by-step build of a unit in 3D, part lookup by label scan or typed ID,
// a printable booklet and a read-only workers' view (?worker in the address).
import {assemblySteps,findPart,partName} from './assembly.mjs';
import {cabinet} from './engine.mjs';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lang=()=>document.documentElement.lang==='ar'?'ar':'en';
const tr=(en,ar)=>lang()==='ar'?ar:en;

export function initAssembly(ctx){
 const state={unit:null,step:1,focus:null};
 const unit=()=>ctx.getUnits().find(u=>u.id===state.unit)??ctx.current();
 const steps=()=>{const u=unit();return u?assemblySteps(u,lang()):[]};

 /** What the 3D view shows for a unit while assembling: parts up to the current step, current step highlighted. */
 function visibility(u){
  if(!ctx.active()||!unit()||u.id!==unit().id)return ctx.active()?{hidden:true}:null;
  const list=steps(),n=Math.min(state.step,list.length);
  if(n<=1)return {show:null,current:new Set(),focus:state.focus,accessories:true};
  const show=new Set(list.slice(0,n).flatMap(s=>s.parts)),current=new Set(list[n-1].parts);
  const inside=list.findIndex(s=>s.key==='inside');
  return {show,current,focus:state.focus,accessories:inside<0||n-1>=inside};
 }

 function render(){
  const u=unit();
  $('asmUnit').innerHTML=ctx.getUnits().map(x=>`<option value="${esc(x.id)}"${x.id===u?.id?' selected':''}>${esc(x.id)} · ${esc(x.name)}</option>`).join('');
  if(!u){$('asmStep').innerHTML='';return}
  const list=steps();state.step=Math.min(Math.max(1,state.step),list.length);
  const s=list[state.step-1];
  $('asmStepLabel').textContent=`${tr('Step','خطوة')} ${s.n} / ${list.length}`;
  $('asmPrev').disabled=state.step<=1;$('asmNext').disabled=state.step>=list.length;
  const model=cabinet(u.config,u.id),byId=new Map(model.parts.map(p=>[p.id,p]));
  const parts=s.parts.map(id=>{const p=byId.get(id);return `<li><button class="part-chip${state.focus===id?' active':''}" data-asm-part="${esc(id)}"><b>${esc(id)}</b> ${esc(partName(p.kind,lang()))} · ${p.length} × ${p.width} × ${p.thickness}</button></li>`}).join('');
  const hardware=s.hardware.map(h=>`<li>${esc(h.item)}${h.qty===null?'':` × ${h.qty}`}</li>`).join('');
  const fittings=(s.fittings??[]).map(f=>`<li>${esc(f)}</li>`).join('');
  $('asmStep').innerHTML=`<h3>${s.n}. ${esc(s.title)}</h3><p>${esc(s.method)}</p>${s.count?`<p class="note">${tr(`${s.count} parts in this unit.`,`${s.count} قطعة في الوحدة دي.`)}</p>`:''}${parts?`<h4>${tr('Parts','القطع')}</h4><ul class="asm-parts">${parts}</ul>`:''}${hardware||fittings?`<h4>${tr('Hardware & fittings','الخردوات والإكسسوارات')}</h4><ul>${hardware}${fittings}</ul>`:''}`;
  $('asmStep').querySelectorAll('[data-asm-part]').forEach(b=>b.onclick=()=>{state.focus=state.focus===b.dataset.asmPart?null:b.dataset.asmPart;ctx.render();render()});
 }
 function go(step){state.step=step;state.focus=null;ctx.render();render()}
 $('asmPrev').onclick=()=>go(state.step-1);
 $('asmNext').onclick=()=>go(state.step+1);
 $('asmUnit').onchange=()=>{state.unit=$('asmUnit').value;state.step=1;state.focus=null;ctx.focusUnit(unit());ctx.render();render()};

 function find(code){
  try{
   const r=findPart(ctx.getUnits(),code,lang(),ctx.projectId());
   state.unit=r.unit.id;state.step=r.step?.n??1;state.focus=r.part.id;
   $('scanResult').className='scan-result ok';
   $('scanResult').innerHTML=`<b>${esc(r.part.id)}</b><span>${esc(r.location)}</span><span>${tr('Step','خطوة')} ${r.step?.n??'—'}: ${esc(r.step?.title??'')}</span><span>${r.part.length} × ${r.part.width} × ${r.part.thickness} mm · ${esc(r.part.material)}</span>${r.stale?`<span class="warn">⚠ ${tr('Label sizes differ from the current design — reprint the label.','مقاسات الملصق مختلفة عن التصميم الحالي — اطبع الملصق تاني.')}</span>`:''}`;
   ctx.focusUnit(r.unit);ctx.render();render();
  }catch(e){$('scanResult').className='scan-result bad';$('scanResult').textContent=e.message}
 }
 $('scanGo').onclick=()=>find($('scanInput').value);
 // USB / Bluetooth barcode scanners type the code and press Enter.
 $('scanInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();find($('scanInput').value)}});

 // Camera scanning: the browser's BarcodeDetector when present, otherwise jsQR on video frames.
 let stream=null,timer=null;
 async function stopCamera(){clearInterval(timer);timer=null;stream?.getTracks().forEach(t=>t.stop());stream=null;$('scanVideo').hidden=true;$('scanCamera').textContent=tr('📷 Camera','📷 الكاميرا')}
 $('scanCamera').onclick=async()=>{
  if(stream)return stopCamera();
  if(!navigator.mediaDevices?.getUserMedia){$('scanResult').className='scan-result bad';$('scanResult').textContent=tr('Camera is not available in this browser. Type the part ID or use a barcode scanner.','الكاميرا مش متاحة في المتصفح ده. اكتب كود القطعة أو استخدم قارئ باركود.');return}
  try{
   stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
   const video=$('scanVideo');video.srcObject=stream;video.hidden=false;await video.play();$('scanCamera').textContent=tr('■ Stop camera','■ إيقاف الكاميرا');
   const detector='BarcodeDetector' in globalThis?new globalThis.BarcodeDetector({formats:['qr_code','code_128']}):null;
   const jsQR=detector?null:(await import('jsqr')).default;
   const canvas=document.createElement('canvas'),g=canvas.getContext('2d',{willReadFrequently:true});
   timer=setInterval(async()=>{
    if(!video.videoWidth)return;
    let text=null;
    if(detector){const codes=await detector.detect(video).catch(()=>[]);text=codes[0]?.rawValue??null}
    else{canvas.width=video.videoWidth;canvas.height=video.videoHeight;g.drawImage(video,0,0);const img=g.getImageData(0,0,canvas.width,canvas.height);text=jsQR(img.data,img.width,img.height)?.data??null}
    if(text){$('scanInput').value=text.startsWith('RDX-PART')?'':text;await stopCamera();find(text)}
   },300);
  }catch(e){await stopCamera();$('scanResult').className='scan-result bad';$('scanResult').textContent=tr(`Camera could not start: ${e.message}`,`الكاميرا ماشتغلتش: ${e.message}`)}
 };

 // Printable booklet: every unit, every step, with a 3D picture of the step when 3D is available.
 $('asmBooklet').onclick=async()=>{
  const w=window.open('','_blank');if(!w){ctx.warn(tr('Allow pop-ups to print the booklet','اسمح بالنوافذ المنبثقة لطباعة الكتيب'));return}
  w.document.write(`<p style="font:14px sans-serif;padding:20px">${tr('Preparing the booklet…','جاري تجهيز الكتيب…')}</p>`);
  const saved={...state},pages=[];
  try{
   for(const u of ctx.getUnits()){
    state.unit=u.id;const list=assemblySteps(u,lang()),model=cabinet(u.config,u.id),byId=new Map(model.parts.map(p=>[p.id,p]));
    const items=[];
    for(const s of list){
     state.step=s.n;state.focus=null;
     const image=await ctx.capture(u);
     items.push(`<section class="step"><div class="text"><h3>${s.n}. ${esc(s.title)}</h3><p>${esc(s.method)}</p>${s.parts.length?`<table><tr><th>${tr('Part','القطعة')}</th><th>${tr('Name','الاسم')}</th><th>${tr('Size','المقاس')}</th></tr>${s.parts.map(id=>{const p=byId.get(id);return `<tr><td>${esc(id)}</td><td>${esc(partName(p.kind,lang()))}</td><td>${p.length} × ${p.width} × ${p.thickness}</td></tr>`}).join('')}</table>`:''}${s.hardware.length||s.fittings?.length?`<p><b>${tr('Hardware','الخردوات')}:</b> ${[...s.hardware.map(h=>`${esc(h.item)}${h.qty===null?'':` × ${h.qty}`}`),...(s.fittings??[]).map(esc)].join(' · ')}</p>`:''}</div>${image?`<img src="${image}" alt="">`:''}</section>`);
    }
    pages.push(`<article><h2>${esc(u.id)} · ${esc(u.name)}</h2>${items.join('')}</article>`);
   }
  }finally{Object.assign(state,saved);ctx.render();render()}
  const meta=ctx.projectMeta();
  w.document.open();w.document.write(`<!doctype html><html lang="${lang()}" dir="${lang()==='ar'?'rtl':'ltr'}"><head><meta charset="utf-8"><title>${tr('Assembly booklet','كتيب التجميع')} · ${esc(meta.name||meta.id)}</title><style>
@page{size:A4;margin:12mm}body{font:12px "IBM Plex Sans Arabic",Arial,sans-serif;color:#263746;margin:0}h1{font-size:20px;color:#172B3A}h2{font-size:16px;color:#0B7375;border-bottom:2px solid #0B7375;padding-bottom:4px}article{break-after:page}
.step{display:grid;grid-template-columns:1fr 70mm;gap:10px;border-bottom:1px solid #D2DAE2;padding:8px 0;break-inside:avoid}.step img{width:70mm;border:1px solid #D2DAE2;border-radius:4px}h3{font-size:13px;margin:0 0 4px}
table{border-collapse:collapse;width:100%;font-size:11px}td,th{border:1px solid #D2DAE2;padding:3px 5px;text-align:start}th{background:#eef2f5}.note{color:#6B7785}</style></head><body>
<h1>${tr('Assembly booklet','كتيب التجميع')} · ${esc(meta.name||meta.id)}</h1><p class="note">${tr('Generated from the design. Part IDs match the cutting list and the QR labels. Starting instructions — follow your workshop standard for joinery and fixings.','متولد من التصميم. أرقام القطع نفس أرقام قائمة القص والملصقات. تعليمات مبدئية — اتبع معيار الورشة في التجميع والتثبيت.')}</p>${pages.join('')}</body></html>`);w.document.close();
  setTimeout(()=>{try{w.focus();w.print()}catch{}},600);
 };

 // Workers' view: read-only layout with only the assembly panel, the 3D view and Open.
 function setWorker(on){
  document.body.classList.toggle('worker-mode',on);
  const url=new URL(location.href);if(on)url.searchParams.set('worker','');else url.searchParams.delete('worker');history.replaceState(null,'',url.toString().replace('worker=','worker'));
  if(on)ctx.setMode('assembly');ctx.resize();
 }
 $('asmWorkerView').onclick=()=>setWorker(true);
 $('exitWorker').onclick=()=>setWorker(false);
 if(new URLSearchParams(location.search).has('worker'))setTimeout(()=>setWorker(true),0);

 return {visibility,refresh:render,enter(){state.unit=state.unit&&ctx.getUnits().some(u=>u.id===state.unit)?state.unit:ctx.current()?.id;render();ctx.focusUnit(unit())},leave:stopCamera,state};
}
