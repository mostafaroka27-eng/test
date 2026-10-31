import * as THREE from 'three';
import {RESOLUTIONS,FORMATS,normalExport,exportSize,exportFileName,framePreset,validateViews,MAX_VIEWS} from './render-export.mjs';
const $=id=>document.getElementById(id);
const tr=(en,ar)=>document.documentElement.lang==='ar'?ar:en;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);

/**
 * Presentation image export and camera views.
 * ctx: {getRenderer, scene, camera, getControls, objects, hideWhenTransparent:()=>[objects], getViews, setViews, commit, projectId, render, warn}
 */
export function initRenderExport(ctx){
 let busy=false,viewLabel='view',abort=null;
 const engine=()=>$('imgEngine').value==='path'?'path':'raster';
 const options=()=>normalExport({resolution:$('imgSize').value,format:$('imgFormat').value,transparent:$('imgTransparent').checked,ao:$('imgAo').checked});
 const sync=()=>{const o=options();$('imgTransparent').disabled=!FORMATS[o.format].alpha;if($('imgTransparent').disabled)$('imgTransparent').checked=false;$('imgAo').disabled=o.transparent||engine()==='path';if(o.transparent)$('imgAo').checked=false;$('ptSamples').disabled=engine()!=='path'};
 $('imgFormat').onchange=sync;$('imgEngine').onchange=sync;$('imgTransparent').onchange=sync;

 function sceneBox(){
  const box=new THREE.Box3();
  ctx.objects.traverse(o=>{if(o.isMesh&&o.visible&&!o.userData.visualOnly)box.expandByObject(o)});
  if(box.isEmpty())throw Error(tr('Add a unit before choosing a camera view','ضيف وحدة الأول قبل ما تختار زاوية الكاميرا'));
  return {min:box.min.toArray(),max:box.max.toArray()};
 }
 function place({position,target,fov}){
  const c=ctx.camera,controls=ctx.getControls();
  c.position.fromArray(position);if(fov){c.fov=fov;c.updateProjectionMatrix()}
  if(controls){controls.target.fromArray(target);controls.update()}else c.lookAt(...target);
  ctx.render();
 }
 for(const b of document.querySelectorAll('[data-cam]'))b.onclick=()=>{
  try{const c=ctx.camera,[w,h]=RESOLUTIONS[$('imgSize').value]??[c.aspect,1];viewLabel=b.dataset.cam;place({...framePreset(b.dataset.cam,sceneBox(),{fov:c.fov,aspect:w/h}),fov:c.fov})}
  catch(e){ctx.warn(e.message)}
 };

 function listViews(){
  const views=ctx.getViews();
  $('viewList').innerHTML=views.length?views.map((v,i)=>`<div class="accessory-row view-row"><button data-view-go="${i}">${esc(v.name)}</button><button data-view-del="${i}" aria-label="${esc(tr('Delete view','احذف الزاوية'))}">✕</button></div>`).join(''):`<p class="note">${tr('No saved views yet.','مفيش زوايا محفوظة لسه.')}</p>`;
  for(const b of $('viewList').querySelectorAll('[data-view-go]'))b.onclick=()=>{const v=ctx.getViews()[+b.dataset.viewGo];viewLabel=v.name;place(v)};
  for(const b of $('viewList').querySelectorAll('[data-view-del]'))b.onclick=()=>{const next=ctx.getViews().filter((_,i)=>i!==+b.dataset.viewDel);ctx.setViews(next);ctx.commit();listViews()};
 }
 $('saveView').onclick=()=>{
  try{
   const views=ctx.getViews();if(views.length>=MAX_VIEWS)throw Error(tr(`At most ${MAX_VIEWS} saved views`,`أقصى عدد ${MAX_VIEWS} زوايا محفوظة`));
   const name=$('viewName').value.trim()||`${tr('View','زاوية')} ${views.length+1}`,controls=ctx.getControls();
   const target=controls?controls.target.toArray():ctx.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1000).add(ctx.camera.position).toArray();
   const next=validateViews([...views.filter(v=>v.name!==name),{name,position:ctx.camera.position.toArray(),target,fov:ctx.camera.fov}]);
   ctx.setViews(next);ctx.commit();viewLabel=name;$('viewName').value='';listViews();
  }catch(e){ctx.warn(e.message)}
 };

 /** Hides editing aids (and floor/walls for transparent images) and returns a function that shows them again. */
 function hideForExport(o){
  const helpers=[];ctx.objects.traverse(obj=>{if(obj.visible&&(obj.type==='BoxHelper'||obj.isSprite))helpers.push(obj)});
  const hidden=[...helpers,...(o.transparent?ctx.hideWhenTransparent().filter(obj=>obj?.visible):[])];
  hidden.forEach(obj=>obj.visible=false);
  return ()=>hidden.forEach(obj=>obj.visible=true);
 }

 /** Path-traced image on its own off-screen canvas; the live view keeps running. */
 async function tracePath(o,onProgress,signal){
  const r=ctx.getRenderer();if(!r)throw Error(tr('3D is not available in this browser','الـ3D مش متاح في المتصفح ده'));
  const prevSize=r.getSize(new THREE.Vector2()),[w,h]=exportSize(o.resolution,[prevSize.x,prevSize.y]);
  const samples=Number($('ptSamples').value)||256;
  const {pathTrace}=await import('./pathtrace.mjs');
  const out=await pathTrace({scene:ctx.scene,camera:ctx.camera,width:w,height:h,samples,toneMapping:r.toneMapping,exposure:r.toneMappingExposure,transparent:o.transparent,signal,onProgress,
   prepare:cam=>{const show=hideForExport(o);ctx.scene.onBeforeRender?.(r,ctx.scene,cam);return ()=>{show();ctx.render()}}});
  return {canvas:out,width:w,height:h};
 }
 async function encode(out,o){
  const f=FORMATS[o.format];
  const blob=await new Promise(resolve=>out.toBlob(resolve,f.mime,f.quality));
  if(!blob||blob.type!==f.mime)throw Error(tr(`This browser cannot save ${o.format.toUpperCase()}; choose PNG`,`المتصفح ده مش بيحفظ ${o.format.toUpperCase()}؛ اختار PNG`));
  return blob;
 }

 /** Renders one frame at the export size into a 2D canvas, then restores the live view before the browser paints. */
 async function capture(o){
  const r=ctx.getRenderer();if(!r)throw Error(tr('3D is not available in this browser','الـ3D مش متاح في المتصفح ده'));
  const gl=r.getContext(),limit=Math.min(r.capabilities.maxTextureSize,gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
  const prevSize=r.getSize(new THREE.Vector2()),[w,h]=exportSize(o.resolution,[prevSize.x,prevSize.y],limit);
  const c=ctx.camera,prev={ratio:r.getPixelRatio(),aspect:c.aspect,background:ctx.scene.background,clear:r.getClearColor(new THREE.Color()),alpha:r.getClearAlpha()};
  // Editing aids (selection box, size labels) never appear in exported images.
  let show=()=>{},composer=null,target=null;
  const out=document.createElement('canvas');out.width=w;out.height=h;
  try{
   if(o.ao){
    const [{EffectComposer},{RenderPass},{GTAOPass},{OutputPass}]=await Promise.all([import('three/examples/jsm/postprocessing/EffectComposer.js'),import('three/examples/jsm/postprocessing/RenderPass.js'),import('three/examples/jsm/postprocessing/GTAOPass.js'),import('three/examples/jsm/postprocessing/OutputPass.js')]);
    target=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType,samples:4});
    composer=new EffectComposer(r,target);composer.setPixelRatio(1);composer.setSize(w,h);
    composer.addPass(new RenderPass(ctx.scene,c));
    // Scene units are millimetres: a ~30 cm radius gives contact shading in corners and under shelves.
    const ao=new GTAOPass(ctx.scene,c,w,h,undefined,{radius:320,distanceExponent:1.5,thickness:140,scale:1.6,samples:16});ao.blendIntensity=1;composer.addPass(ao);
    composer.addPass(new OutputPass());
   }
   // Everything from here to the restore is synchronous, so the resized canvas is never shown.
   r.setPixelRatio(1);r.setSize(w,h,false);c.aspect=w/h;c.updateProjectionMatrix();
   if(o.transparent){ctx.scene.background=null;r.setClearColor(0x000000,0);}
   show=hideForExport(o);
   if(composer)composer.render();else r.render(ctx.scene,c);
   out.getContext('2d').drawImage(r.domElement,0,0,w,h);
  }finally{
   show();ctx.scene.background=prev.background;r.setClearColor(prev.clear,prev.alpha);
   r.setPixelRatio(prev.ratio);r.setSize(prevSize.x,prevSize.y,false);c.aspect=prev.aspect;c.updateProjectionMatrix();
   composer?.dispose();target?.dispose();ctx.render();
  }
  // Browsers without a WebP encoder silently return PNG; encode() reports that instead of saving a wrong extension.
  return {blob:await encode(out,o),width:w,height:h};
 }

 $('exportImage').onclick=async()=>{
  if(busy)return;busy=true;$('exportImage').disabled=true;$('imgStatus').textContent=tr('Rendering…','جاري التصوير…');
  try{
   const o=options(),t0=performance.now();let blob,width,height;
   if(engine()==='path'){
    abort=new AbortController();$('ptCancel').hidden=false;
    const res=await tracePath(o,({samples,total,elapsed})=>{const eta=samples?elapsed/samples*(total-samples):0;$('imgStatus').textContent=tr(`Path tracing… ${samples} / ${total} samples · ${elapsed.toFixed(0)} s`,`جاري الـ path tracing… ${samples} / ${total} عينة · ${elapsed.toFixed(0)} ث`)+(samples>2?tr(` · about ${Math.ceil(eta)} s left`,` · فاضل حوالي ${Math.ceil(eta)} ث`):'')},abort.signal);
    ({width,height}=res);blob=await encode(res.canvas,o);
   }else ({blob,width,height}=await capture(o));
   const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=exportFileName(ctx.projectId(),$('viewName').value.trim()||viewLabel,o);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   $('imgStatus').textContent=`${engine()==='path'?'Path traced'+' · ':''}${width} × ${height} · ${o.format.toUpperCase()} · ${(blob.size/1048576).toFixed(1)} MB · ${((performance.now()-t0)/1000).toFixed(1)} s`;
  }catch(e){$('imgStatus').textContent=e.name==='AbortError'?tr('Path tracing cancelled','اتلغى الـ path tracing'):e.message}
  finally{busy=false;abort=null;$('ptCancel').hidden=true;$('exportImage').disabled=false}
 };
 $('ptCancel').onclick=()=>abort?.abort();
 sync();listViews();
 return {refresh:listViews,capture,frame:(preset)=>place({...framePreset(preset,sceneBox(),{fov:ctx.camera.fov,aspect:ctx.camera.aspect}),fov:ctx.camera.fov})};
}
