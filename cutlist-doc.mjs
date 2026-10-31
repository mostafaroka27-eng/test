/**
 * Printable cut list (browser "Save as PDF") built from the same part records as the manufacturing CSV.
 * Identical parts of one unit are grouped with a quantity; every part uid is still listed so the sheet,
 * the CSV and the labels can be cross-checked. Preliminary workshop document — not a CNC program.
 */
import {partRecords} from './manufacturing.mjs';

const KIND={en:{side:'Side',top:'Top',bottom:'Bottom',shelf:'Shelf',fixedShelf:'Fixed shelf',partition:'Partition',back:'Back',door:'Door',drawerFront:'Drawer front',drawerSide:'Drawer side',drawerBack:'Drawer back',drawerFace:'Drawer box front',endPanel:'End / cover panel',drawerBottom:'Drawer bottom',plinth:'Plinth',rail:'Rail',coverLeft:'Cover panel left',coverRight:'Cover panel right',topFiller:'Top filler',worktop:'Worktop',glassDoor:'Glass door'},
 ar:{side:'جنب',top:'سقف',bottom:'أرضية',shelf:'رف',fixedShelf:'رف ثابت',partition:'قاطوع',back:'ظهر',door:'ضلفة',drawerFront:'وش درج',drawerSide:'جنب درج',drawerBack:'ظهر درج',drawerFace:'وش صندوق الدرج',endPanel:'جنب تلبيس',drawerBottom:'قاع درج',plinth:'وزرة',rail:'عارضة',coverLeft:'جنب تلبيس شمال',coverRight:'جنب تلبيس يمين',topFiller:'حشو علوي',worktop:'رخامة/سطح',glassDoor:'ضلفة زجاج'}};
const T={
 en:{title:'Cut list',draft:'PRELIMINARY — check before cutting. Not a CNC program.',project:'Project',client:'Client',revision:'Revision',rules:'Manufacturing rules',date:'Printed',units:'Units',parts:'Parts',lines:'Lines',
  unit:'Unit',part:'Part',qty:'Qty',thk:'Thk',finish:'Finished L × W',cut:'Cut L × W',edges:'Edges L1 W1 L2 W2',grain:'Grain',notes:'Notes',ids:'Part IDs',material:'Material',area:'Cut area',band:'Edge band',sheetParts:'Sheet parts',
  grainV:'along L',grainH:'along W',grainN:'free',rotate:'may rotate',notSheet:'not cut from sheet stock',groove:'groove',
  explain:'Finished size = designed size after edge banding. Cut size = finished size minus the edge thickness on each banded edge, when edge deduction is on for that unit (otherwise cut = finished). L1/L2 are the long edges, W1/W2 the short edges; 1 = banded. No pre-milling or saw-kerf allowance is added: add your workshop allowance if your edge bander trims.',
  total:'Total',sign:'Checked by / date'},
 ar:{title:'قائمة التقطيع',draft:'مبدئية — راجعها قبل القص. ليست برنامج CNC.',project:'المشروع',client:'العميل',revision:'المراجعة',rules:'قواعد التصنيع',date:'تاريخ الطباعة',units:'الوحدات',parts:'القطع',lines:'السطور',
  unit:'الوحدة',part:'القطعة',qty:'العدد',thk:'السمك',finish:'المقاس النهائي ط × ع',cut:'مقاس القص ط × ع',edges:'الشريط L1 W1 L2 W2',grain:'العرق',notes:'ملاحظات',ids:'أرقام القطع',material:'الخامة',area:'مساحة القص',band:'طول الشريط',sheetParts:'قطع من الألواح',
  grainV:'مع الطول',grainH:'مع العرض',grainN:'حر',rotate:'ينفع تلف',notSheet:'مش من الألواح',groove:'مجرى',
  explain:'المقاس النهائي = المقاس المصمم بعد لزق الشريط. مقاس القص = المقاس النهائي ناقص سمك الشريط على كل حرف عليه شريط، لو خصم الشريط شغال في الوحدة (غير كده القص = النهائي). L1 وL2 الحرفين الطوال، وW1 وW2 القصيرين؛ 1 = عليه شريط. مفيش سماح تشذيب أو سماح منشار متضاف: ضيف سماح الورشة لو ماكينة الشريط بتقص.',
  total:'الإجمالي',sign:'راجعه / التاريخ'}};

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mm=n=>String(Math.round(Number(n)*100)/100);
const ltr=html=>`<bdi dir="ltr">${html}</bdi>`;

/** Groups identical parts of the same unit (same kind, material, thickness, sizes, edges, grain, operations). */
export function cutListGroups(project){
 const groups=new Map();
 for(const r of partRecords(project)){
  const edges=['L1','W1','L2','W2'].map(k=>r.edges[k]?1:0);
  const ops=r.operations.map(o=>`${o.type}:${o.edge}:${o.width}x${o.depth}@${o.offsetFromRear}`).join(';');
  const key=[r.unitId,r.kind,r.material,r.thickness,r.finishLength,r.finishWidth,r.cutLength,r.cutWidth,edges.join(''),r.grain,r.sheetGood,r.edgeThickness,ops].join('|');
  if(!groups.has(key))groups.set(key,{unitId:r.unitId,unitName:r.unitName,rulesVersion:r.rulesVersion,kind:r.kind,material:r.material,thickness:r.thickness,finishLength:r.finishLength,finishWidth:r.finishWidth,cutLength:r.cutLength,cutWidth:r.cutWidth,edges,edgeThickness:r.edgeThickness,grain:r.grain,canRotate:r.canRotate,sheetGood:r.sheetGood,operations:r.operations,bandLength:0,uids:[],displayIds:[],qty:0});
  const g=groups.get(key);g.qty++;g.uids.push(r.uid);g.displayIds.push(r.displayId);g.bandLength+=r.bandLength;
 }
 return [...groups.values()];
}

/** Totals per material and thickness (sheet parts only for area). */
export function cutListTotals(groups){
 const by=new Map();
 for(const g of groups){const k=`${g.material}|${g.thickness}`;if(!by.has(k))by.set(k,{material:g.material,thickness:g.thickness,parts:0,sheetParts:0,areaM2:0,bandM:0});const t=by.get(k);t.parts+=g.qty;if(g.sheetGood){t.sheetParts+=g.qty;t.areaM2+=g.qty*g.cutLength*g.cutWidth/1e6}t.bandM+=g.bandLength/1000}
 return [...by.values()].map(t=>({...t,areaM2:Math.round(t.areaM2*100)/100,bandM:Math.round(t.bandM*100)/100}));
}

export function cutListHtml(project,{lang='en',company={},date=new Date()}={}){
 const L=lang==='ar'?'ar':'en',t=T[L],k=KIND[L],groups=cutListGroups(project),totals=cutListTotals(groups);
 const parts=groups.reduce((s,g)=>s+g.qty,0),rules=[...new Set(groups.map(g=>g.rulesVersion))].join(', ');
 const grain=g=>(g.grain==='vertical'?t.grainV:g.grain==='horizontal'?t.grainH:t.grainN);
 const notes=g=>[g.canRotate&&g.sheetGood?t.rotate:'',g.sheetGood?'':t.notSheet,...g.operations.map(o=>`${t.groove} ${o.edge} ${mm(o.width)}×${mm(o.depth)}`)].filter(Boolean).join(' · ');
 const byMaterial=new Map();for(const g of groups){const key=`${g.material} · ${mm(g.thickness)} mm`;if(!byMaterial.has(key))byMaterial.set(key,[]);byMaterial.get(key).push(g)}
 const tables=[...byMaterial].map(([name,rows])=>`<h2>${esc(t.material)}: ${esc(name)}</h2><table><thead><tr><th>${t.unit}</th><th>${t.part}</th><th>${t.qty}</th><th>${t.thk}</th><th>${t.finish}</th><th>${t.cut}</th><th>${ltr(t.edges)}</th><th>${t.grain}</th><th>${t.notes}</th><th>${t.ids}</th></tr></thead><tbody>${rows.map(g=>`<tr><td>${esc(g.unitId)}<br><small>${esc(g.unitName)}</small></td><td>${esc(k[g.kind]??g.kind)}</td><td class="n"><b>${g.qty}</b></td><td class="n">${mm(g.thickness)}</td><td class="n">${ltr(`${mm(g.finishLength)} × ${mm(g.finishWidth)}`)}</td><td class="n"><b>${ltr(`${mm(g.cutLength)} × ${mm(g.cutWidth)}`)}</b></td><td class="n">${ltr(`<span class="edges">${g.edges.join(' ')}</span>`)}${g.edges.some(Boolean)?`<br><small>${ltr(`${mm(g.edgeThickness)} mm`)}</small>`:''}</td><td>${esc(grain(g))}</td><td><small>${esc(notes(g))}</small></td><td class="idcell"><small class="ids">${ltr(g.displayIds.map(esc).join(' '))}</small></td></tr>`).join('')}</tbody></table>`).join('');
 const totalRows=totals.map(x=>`<tr><td>${esc(x.material)}</td><td class="n">${mm(x.thickness)}</td><td class="n">${x.parts}</td><td class="n">${x.sheetParts}</td><td class="n">${x.areaM2} m²</td><td class="n">${x.bandM} m</td></tr>`).join('');
 const name=L==='ar'?(company.nameAr||company.name):(company.name||company.nameAr);
 const logo=/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(company.logo??'')?`<img class="logo" src="${company.logo}" alt="">`:'';
 const day=date.toISOString().slice(0,10);
 return `<!doctype html><html lang="${L}" dir="${L==='ar'?'rtl':'ltr'}"><head><meta charset="utf-8"><title>${esc(t.title)} · ${esc(project.projectId)} · R${esc(project.designRevision??1)}</title><style>
@page{size:A4 landscape;margin:10mm}body{font:10px "IBM Plex Sans Arabic",Arial,sans-serif;color:#1d2b36;margin:0}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #172B3A;padding-bottom:6px;margin-bottom:6px;gap:12px}
h1{font-size:18px;margin:0;color:#172B3A}h2{font-size:12px;margin:12px 0 4px;color:#0F6E70}.logo{max-height:38px;max-width:140px}.meta{display:grid;grid-template-columns:repeat(4,auto);gap:2px 14px;font-size:10px}.meta b{color:#172B3A}
.draft{background:#fff3df;border:1px solid #f2a33a;padding:4px 8px;font-weight:700;margin:4px 0}table{width:100%;border-collapse:collapse;margin-bottom:6px;page-break-inside:auto}tr{page-break-inside:avoid}th,td{border:1px solid #c9d3db;padding:3px 4px;text-align:start;vertical-align:top}th{background:#eef3f6;font-size:9px}
td.n{text-align:center;white-space:nowrap;font-variant-numeric:tabular-nums}.edges{letter-spacing:2px}.ids{color:#5b6b78;word-break:break-all}.idcell{max-width:240px}small{font-size:8.5px}.explain{font-size:9px;color:#33424d;border-top:1px solid #c9d3db;padding-top:4px;margin-top:8px}.sign{margin-top:14px;display:flex;gap:40px}.sign span{border-top:1px solid #1d2b36;min-width:200px;padding-top:2px}
</style></head><body><header><div><h1>${esc(t.title)}</h1>${name?`<div>${esc(name)}</div>`:''}</div><div class="meta"><span>${t.project}</span><b>${esc(project.projectName||project.projectId)}</b><span>${t.revision}</span><b>R${esc(project.designRevision??1)}</b>${project.clientName?`<span>${t.client}</span><b>${esc(project.clientName)}</b>`:''}<span>${t.rules}</span><b>${esc(rules)}</b><span>${t.units}</span><b>${project.units.length}</b><span>${t.parts}</span><b>${parts}</b><span>${t.lines}</span><b>${groups.length}</b><span>${t.date}</span><b>${day}</b></div>${logo}</header>
<div class="draft">${esc(t.draft)}</div>${tables}
<h2>${t.total}</h2><table><thead><tr><th>${t.material}</th><th>${t.thk}</th><th>${t.parts}</th><th>${t.sheetParts}</th><th>${t.area}</th><th>${t.band}</th></tr></thead><tbody>${totalRows}</tbody></table>
<p class="explain">${esc(t.explain)}</p><div class="sign"><span>${t.sign}</span></div></body></html>`;
}
