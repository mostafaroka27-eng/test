/**
 * Company cloud panel for Studio (shown only when Studio is served by the Rokadex management site).
 * Header button "Company cloud" → dialog: who is signed in, which company, save/open/delete cloud projects,
 * link the Studio project to a project in Rokadex management. Release rows get "Send to project in Rokadex".
 */
import {createCloud,loadCloudConfig,CloudConflict} from './cloud.mjs';
import {serializeProject} from './project.mjs';

const LINK_KEY='rokadex.studio.cloudLink';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function hash(text){let h=0x811c9dc5;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0}return h.toString(16)}
const readLink=()=>{try{return JSON.parse(localStorage.getItem(LINK_KEY)||'null')}catch{return null}};
const writeLink=v=>{try{v?localStorage.setItem(LINK_KEY,JSON.stringify(v)):localStorage.removeItem(LINK_KEY)}catch{}};

export async function initCloudUi({getProject,loadProject,status,tr2,lang}){
 const $=id=>document.getElementById(id);
 const btn=$('cloudBtn'),dlg=$('cloudDialog'),badge=$('workspaceBadge');
 if(!btn||!dlg)return null;
 const config=await loadCloudConfig();
 if(!config)return null;                                   // standalone Studio: stays local, no cloud button
 const {createClient}=await import('@supabase/supabase-js');   // loaded only when Studio runs inside Rokadex
 const client=createClient(config.supabaseUrl,config.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 const cloud=createCloud({client});
 let link=readLink(),rows=[],projects=[],busy=false,msg='',err='';
 const appUrl=config.appUrl||'../';
 btn.hidden=false;

 const currentText=()=>{try{return serializeProject(getProject())}catch{return ''}};
 const linked=()=>{const p=getProject();return link&&cloud.state.ws&&link.ws===cloud.state.ws.id&&link.studioId===p.projectId?link:null};
 function setLink(row){link=row?{ws:cloud.state.ws.id,studioId:row.studio_id,version:row.version,projectLink:row.project_id??null,hash:hash(currentText())}:null;writeLink(link)}
 function refreshBadge(){
  if(!badge)return;
  const l=linked();
  if(!l){badge.textContent=tr2('LOCAL WORKSPACE','مساحة عمل محلية');badge.dataset.cloud='';return}
  const dirty=hash(currentText())!==l.hash;
  badge.textContent=tr2(`COMPANY CLOUD · v${l.version}`,`سحابة الشركة · v${l.version}`)+(dirty?tr2(' · unsaved changes',' · تعديلات مش محفوظة'):'');
  badge.dataset.cloud=dirty?'dirty':'saved';
 }
 function stateLine(){
  const s=cloud.state;
  if(s.mode==='signed-out')return `<p>${tr2('You are not signed in to Rokadex in this browser.','إنت مش داخل على Rokadex في المتصفح ده.')}</p><p><a class="primary-link" href="${esc(appUrl)}" target="_blank" rel="noopener">${tr2('Sign in to Rokadex','ادخل على Rokadex')}</a> ${tr2('then come back and press Refresh.','وبعدين ارجع هنا ودوس تحديث.')}</p>`;
  if(s.mode==='no-company')return `<p>${tr2('This account has no company yet.','الحساب ده لسه مالوش شركة.')}</p>`;
  const role={owner:tr2('owner','المالك'),admin:tr2('admin','مسؤول'),manager:tr2('manager','مدير'),worker:tr2('worker','عامل')}[s.role]??s.role;
  const pick=s.companies.length>1?`<label>${tr2('Company','الشركة')}<select id="cloudCompany">${s.companies.map(c=>`<option value="${esc(c.id)}"${c.id===s.ws.id?' selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`:`<b data-i18n-skip>${esc(s.ws.name)}</b>`;
  const warn=!s.design?tr2('Studio cloud is part of the Design add-on, which is not enabled for this company. Studio still works on this device.','سحابة الاستوديو جزء من إضافة التصميم، ودي مش مفعّلة للشركة دي. الاستوديو لسه شغال على الجهاز ده.')
   :!s.active?tr2('The subscription has ended: cloud projects can be opened but not saved.','الاشتراك خلص: تقدر تفتح مشاريع السحابة بس مش تحفظ.')
   :!cloud.canSave()?tr2('Only managers, admins and the owner can save to the company cloud.','الحفظ على السحابة للمديرين والمسؤولين والمالك بس.'):'';
  return `<div class="cloud-who"><span>${tr2('Signed in as','داخل باسم')} <b data-i18n-skip>${esc(s.user.email??'')}</b> · ${esc(role)}</span>${pick}</div>${warn?`<p class="cloud-warn" role="note">${warn}</p>`:''}`;
 }
 function render(){
  const s=cloud.state,p=getProject(),l=linked();
  const fmt=d=>{try{return new Date(d).toLocaleString(lang()==='ar'?'ar-EG':'en-GB')}catch{return ''}};
  const saveBox=s.mode==='ready'&&s.design?`<section class="form-section"><h3>${tr2('This project','المشروع ده')}</h3>
   <p class="note"><span data-i18n-skip>${esc(p.projectName||p.projectId)}</span> · R${p.designRevision} · ${l?tr2(`in the cloud, version ${l.version}`,`على السحابة، نسخة ${l.version}`):tr2('only on this device','على الجهاز ده بس')}</p>
   <label>${tr2('Project in Rokadex management','المشروع في برنامج الإدارة')}<select id="cloudLinkProject"${cloud.canSave()?'':' disabled'}><option value="">${tr2('— not linked —','— مش مربوط —')}</option>${projects.map(x=>`<option value="${esc(x.id)}"${(l?.projectLink??null)===x.id?' selected':''} data-i18n-skip>${esc((x.legacy_code?x.legacy_code+' · ':'')+x.name+(x.client?' · '+x.client:''))}</option>`).join('')}</select></label>
   <div class="cloud-actions"><button id="cloudSave" class="primary"${cloud.canSave()&&!busy?'':' disabled'}>${busy?tr2('Saving…','جارٍ الحفظ…'):tr2('Save to company cloud','احفظ على سحابة الشركة')}</button></div></section>`:'';
  const listBox=s.mode==='ready'&&s.design?`<section class="form-section"><h3>${tr2('Company projects','مشاريع الشركة')} <small>${rows.length}</small></h3>${rows.length?`<div class="cloud-list">${rows.map(r=>`<div class="cloud-row${r.studio_id===p.projectId?' current':''}"><div><b data-i18n-skip>${esc(r.name||r.studio_id)}</b><small data-i18n-skip>${esc(r.studio_id)} · R${r.design_revision} · ${r.issued_revisions} ${tr2('issued','معتمدة')} · ${r.units} ${tr2('units','وحدة')} · v${r.version} · ${esc(fmt(r.updated_at))}</small></div><div class="cloud-row-actions"><button data-cloud-open="${esc(r.id)}">${tr2('Open','افتح')}</button>${cloud.canSave()?`<button data-cloud-del="${esc(r.id)}">${tr2('Delete','امسح')}</button>`:''}</div></div>`).join('')}</div>`:`<p class="note">${tr2('No Studio projects in the cloud yet.','لسه مفيش مشاريع استوديو على السحابة.')}</p>`}</section>`:'';
  $('cloudBody').innerHTML=`<section class="form-section">${stateLine()}</section>${err?`<p class="cloud-error" role="alert">${esc(err)}</p>`:''}${msg?`<p class="cloud-ok" role="status">${esc(msg)}</p>`:''}${saveBox}${listBox}`;
  bind();refreshBadge();
 }
 async function load(){
  err='';
  try{await cloud.init();if(cloud.canRead()){[rows,projects]=await Promise.all([cloud.list(),cloud.projects()])}else{rows=[];projects=[]}}
  catch(e){err=e.message}
  render();
 }
 async function openRow(row,{ask=true}={}){
  const cur=getProject(),l=linked();
  const unsaved=l?hash(currentText())!==l.hash:true;
  if(ask&&unsaved&&cur.projectId!==row.studio_id&&!confirm(tr2('Open this cloud project? The current project on this device will be replaced (save it first if you need it).','تفتح مشروع السحابة ده؟ المشروع الحالي على الجهاز هيتبدّل (احفظه الأول لو محتاجه).')))return false;
  const {project}=await cloud.open(row);
  loadProject(project);setLink(row);
  msg=tr2(`Opened ${row.name||row.studio_id} (version ${row.version})`,`اتفتح ${row.name||row.studio_id} (نسخة ${row.version})`);
  status(msg);return true;
 }
 async function save({asCopy=false,link:keep}={}){
  const sel=$('cloudLinkProject'),chosen=keep!==undefined?keep:sel?(sel.value||null):undefined;   // read before re-render resets the list
  busy=true;err='';msg='';render();
  try{
   let p=getProject();
   if(asCopy){p={...p,projectId:`${p.projectId}-C${Date.now().toString(36).slice(-4).toUpperCase()}`.slice(0,60)};loadProject(p)}
   const l=linked();
   const row=await cloud.save(p,{version:l?.version??null,projectLink:chosen});
   setLink(row);rows=await cloud.list();
   msg=tr2(`Saved to the company cloud · version ${row.version}`,`اتحفظ على سحابة الشركة · نسخة ${row.version}`);status(msg);
  }catch(e){
   if(e instanceof CloudConflict){
    err=e.message;
    busy=false;render();
    const theirs=e.current;
    if(theirs&&confirm(tr2(`${e.message}.\n\nOK = open their version (your changes stay only if you saved a file).\nCancel = keep yours and save it as a separate copy.`,`${e.message}.\n\nموافق = افتح نسختهم (تعديلاتك هتضيع لو ما حفظتهاش في ملف).\nإلغاء = خلّي نسختك واحفظها كنسخة منفصلة.`))){await openRow(theirs,{ask:false});rows=await cloud.list()}
    else if(confirm(tr2('Save your version as a separate copy in the cloud?','تحفظ نسختك كنسخة منفصلة على السحابة؟'))){busy=false;return save({asCopy:true,link:chosen})}
   }else err=e.message;
  }
  busy=false;render();
 }
 function bind(){
  const company=$('cloudCompany');if(company)company.onchange=async()=>{try{await cloud.useCompany(company.value);[rows,projects]=cloud.canRead()?await Promise.all([cloud.list(),cloud.projects()]):[[],[]]}catch(e){err=e.message}render()};
  const s=$('cloudSave');if(s)s.onclick=e=>{e.preventDefault();save()};
  dlg.querySelectorAll('[data-cloud-open]').forEach(b=>b.onclick=async e=>{e.preventDefault();const r=rows.find(x=>x.id===b.dataset.cloudOpen);try{if(await openRow(r))dlg.close()}catch(x){err=x.message;render()}});
  dlg.querySelectorAll('[data-cloud-del]').forEach(b=>b.onclick=async e=>{e.preventDefault();const r=rows.find(x=>x.id===b.dataset.cloudDel);if(!confirm(tr2(`Delete ${r.name||r.studio_id} from the company cloud? This cannot be undone.`,`تمسح ${r.name||r.studio_id} من سحابة الشركة؟ مش هينفع ترجّعه.`)))return;try{await cloud.remove(r);if(link?.studioId===r.studio_id)setLink(null);rows=await cloud.list();msg=tr2('Deleted','اتمسح')}catch(x){err=x.message}render()});
 }
 btn.onclick=()=>{msg='';dlg.showModal();load()};
 $('cloudRefresh').onclick=e=>{e.preventDefault();msg='';load()};

 // first check (quiet), then ?cloud=<studio id> from the management app opens that project
 await cloud.init().catch(()=>{});
 const want=new URLSearchParams(location.search).get('cloud');
 if(want&&cloud.canRead()){
  try{const row=await cloud.find(want);if(row)await openRow(row);else status(tr2(`Cloud project ${want} not found`,`مشروع السحابة ${want} مش موجود`))}
  catch(e){status(e.message)}
  try{history.replaceState(null,'',location.pathname)}catch{}
 }
 refreshBadge();

 return {
  refresh:()=>{refreshBadge();if(dlg.open)render()},
  canSend:()=>cloud.state.mode==='ready',
  /** Opens the management import page with this package (same site, new tab). */
  send(pkg){
   const l=linked();
   cloud.handOff({...pkg});
   try{const h=JSON.parse(localStorage.getItem('rokadex-studio-handoff'));h.projectLink=l?.projectLink??null;localStorage.setItem('rokadex-studio-handoff',JSON.stringify(h))}catch{}
   const url=new URL(appUrl,location.href);url.hash='studio';
   const w=window.open(url.href,'_blank');if(!w)location.href=url.href;
  }
 };
}
