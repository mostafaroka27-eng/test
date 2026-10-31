// Shop-drawing layout controls and per-unit clarification images. The layout is saved in the project.
import {normalLayout,DEFAULT_LAYOUT,VIEWS,MAX_DRAWING_IMAGES,validateDrawingImages} from './shop-drawing.mjs';

const $=id=>document.getElementById(id);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tr=(en,ar)=>document.documentElement.lang==='ar'?ar:en;

/** Reads a photo or sketch and shrinks it to at most 1600 px JPEG so it fits the project file limit. */
export function shrinkImage(file,maxSide=1600,quality=0.82){
 return new Promise((resolve,reject)=>{
  if(!/^image\/(png|jpeg|webp)$/.test(file.type))return reject(Error('Use a PNG, JPEG or WebP image'));
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{URL.revokeObjectURL(url);let q=quality,side=maxSide;
   for(let attempt=0;attempt<6;attempt++){const k=Math.min(1,side/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*k));canvas.height=Math.max(1,Math.round(img.height*k));
    const g=canvas.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,canvas.width,canvas.height);g.drawImage(img,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',q);if(data.length<=300*1024*4/3)return resolve(data);q=Math.max(0.5,q-0.1);side=Math.round(side*0.8)}
   reject(Error('Image is too large even after reducing it'))};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Image could not be read'))};
  img.src=url;
 });
}

export function initDrawingUi(ctx){
 const fields={paper:'dlPaper',arrangement:'dlArrangement',scale:'dlScale',dims:'dlDims',side:'dlSide'};
 function read(){
  const views=VIEWS.filter(v=>$('dlView-'+v).checked);
  const scale=$('dlScale').value==='auto'?'auto':Number($('dlScale').value);
  return normalLayout({paper:$('dlPaper').value,arrangement:$('dlArrangement').value,scale,dims:$('dlDims').value,side:$('dlSide').value,views,schedule:$('dlSchedule').checked,notes:$('dlNotes').checked});
 }
 function apply(next){ctx.setLayout(next);ctx.commit();ctx.redraw();refresh()}
 function onChange(){try{apply(read())}catch(e){ctx.warn(e.message);refresh()}}
 for(const id of [...Object.values(fields),'dlSchedule','dlNotes',...VIEWS.map(v=>'dlView-'+v)])$(id).addEventListener('change',onChange);
 $('dlReset').onclick=()=>apply(normalLayout(DEFAULT_LAYOUT));

 function imageList(){
  const u=ctx.current(),images=u?.drawingImages??[];
  $('drawingImageList').innerHTML=images.length?images.map((img,i)=>`<div class="drawing-image"><img src="${esc(img.src)}" alt=""><input data-caption="${i}" maxlength="160" value="${esc(img.caption)}" placeholder="${tr('Caption, e.g. hinge side detail','وصف، مثلًا تفصيلة جهة المفصلات')}" aria-label="${tr('Caption','الوصف')} ${i+1}"><button data-remove-image="${i}" aria-label="${tr('Remove image','حذف الصورة')}">✕</button></div>`).join(''):`<p class="note">${tr('No images for this unit.','لا توجد صور لهذه الوحدة.')}</p>`;
  $('drawingImageInput').disabled=images.length>=MAX_DRAWING_IMAGES;
  $('drawingImageList').querySelectorAll('[data-caption]').forEach(el=>el.onchange=()=>setImages(list=>{list[Number(el.dataset.caption)].caption=el.value.slice(0,160)}));
  $('drawingImageList').querySelectorAll('[data-remove-image]').forEach(el=>el.onclick=()=>setImages(list=>{list.splice(Number(el.dataset.removeImage),1)}));
 }
 function setImages(mutate){
  const u=ctx.current();if(!u)return;
  const list=structuredClone(u.drawingImages??[]);mutate(list);
  try{const valid=validateDrawingImages(list);if(valid.length)u.drawingImages=valid;else delete u.drawingImages;ctx.commit();ctx.redraw()}catch(e){ctx.warn(e.message)}
  imageList();
 }
 $('drawingImageInput').addEventListener('change',async()=>{
  const files=[...$('drawingImageInput').files];$('drawingImageInput').value='';
  const room=MAX_DRAWING_IMAGES-(ctx.current()?.drawingImages?.length??0);
  if(files.length>room)ctx.warn(tr(`Only ${MAX_DRAWING_IMAGES} images per unit; extra files were skipped.`,`الحد ${MAX_DRAWING_IMAGES} صور لكل وحدة؛ تم تجاهل الباقي.`));
  const added=[];
  for(const file of files.slice(0,Math.max(0,room))){try{added.push({src:await shrinkImage(file),caption:file.name.replace(/\.[^.]+$/,'').slice(0,160)})}catch(e){ctx.warn(e.message)}}
  if(added.length)setImages(list=>list.push(...added));
 });

 function refresh(){
  const l=ctx.getLayout();
  for(const [key,id] of Object.entries(fields))$(id).value=String(l[key]);
  for(const v of VIEWS)$('dlView-'+v).checked=l.views.includes(v);
  $('dlSchedule').checked=l.schedule;$('dlNotes').checked=l.notes;
  imageList();
 }
 refresh();
 return {refresh};
}
