/**
 * Beam / panel saw outputs.
 *  1. Optimizer parts list (CSV) for the saw shop's own optimizing software: one row per identical part, length
 *     given ALONG THE GRAIN, cut sizes (before edge banding), edges per side. Column names are plain English; map them
 *     once in the optimizer's import screen. Comma or semicolon (decimal comma) variants for Excel/regional settings.
 *  2. A guillotine cutting sequence derived from the preview sheet layout (first-fit shelf packing): rip strips across
 *     the sheet, cross-cut the strip into pieces, then trim a piece that is narrower than its strip. Every cut runs
 *     straight through, so a beam saw can make it. The layout is NOT optimized; the shop optimizer usually does better.
 */
import {cutListGroups} from './cutlist-doc.mjs';

const EDGE=['L1','W1','L2','W2'];
const cell=(v,sep)=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s)&&typeof v==='string')s="'"+s;return /["\r\n]/.test(s)||s.includes(sep)?`"${s.replaceAll('"','""')}"`:s};

/** Rows for the optimizer list. Length = along grain (grain 'horizontal' swaps the sides and the edges with them). */
export function optimizerRows(project){
 return cutListGroups(project).filter(g=>g.sheetGood!==false).map((g,i)=>{
  const swap=g.grain==='horizontal';
  const [len,wid]=swap?[g.cutWidth,g.cutLength]:[g.cutLength,g.cutWidth];
  const [fl,fw]=swap?[g.finishWidth,g.finishLength]:[g.finishLength,g.finishWidth];
  const e=g.edges;// [L1,W1,L2,W2]: L edges run along the length
  const [l1,w1,l2,w2]=swap?[e[1],e[0],e[3],e[2]]:e;
  return {row:i+1,material:g.material,thickness:g.thickness,length:len,width:wid,qty:g.qty,grain:g.grain==='none'?'N':'Y',
   finishLength:fl,finishWidth:fw,edgeL1:l1?g.edgeThickness:0,edgeL2:l2?g.edgeThickness:0,edgeW1:w1?g.edgeThickness:0,edgeW2:w2?g.edgeThickness:0,
   unit:g.unitId,component:g.kind,partIds:g.displayIds.join(' '),grooved:g.operations?.some(o=>o.type==='groove')?'Y':''};
 });
}

/** CSV text. style 'comma' (1234.5, comma separated) or 'semicolon' (1234,5; semicolon separated — European/Arabic Excel). */
export function optimizerCsv(project,{style='comma'}={}){
 if(!['comma','semicolon'].includes(style))throw Error('Unknown CSV style');
 const sep=style==='comma'?',':';',num=v=>style==='comma'?String(v):String(v).replace('.',',');
 const head=['Row','Material','Thickness','Length','Width','Qty','Grain','Edge_L1','Edge_L2','Edge_W1','Edge_W2','Finish_Length','Finish_Width','Unit','Component','Part_IDs','Grooved'];
 const rows=optimizerRows(project).map(r=>[r.row,r.material,num(r.thickness),num(r.length),num(r.width),r.qty,r.grain,num(r.edgeL1),num(r.edgeL2),num(r.edgeW1),num(r.edgeW2),num(r.finishLength),num(r.finishWidth),r.unit,r.component,r.partIds,r.grooved]);
 // UTF-8 BOM so Excel shows Arabic material names correctly. Sizes in mm; Length runs along the grain.
 return '﻿'+[head,...rows].map(r=>r.map(v=>cell(v,sep)).join(sep)).join('\r\n')+'\r\n';
}

/**
 * Guillotine cut sequence for every sheet of a projectSheetPlan()/layoutSheets() result.
 * Sheet axes: X along sheet width, Y along sheet height (as in the sheet preview). Strips are ripped along X.
 */
export function cutSequence(plan,{trim=10,kerf=3.2}={}){
 return plan.sheets.map((s,si)=>{
  const rows=[...(s.shelves??[])].sort((a,b)=>a.y-b.y);
  if(!rows.length)throw Error(`Sheet ${si+1} has no strip data; recalculate the sheet layout`);
  const steps=[];let n=0;
  const add=o=>steps.push({step:++n,...o});
  add({stage:'trim',text:`Trim the sheet edges: ${trim} mm each side`,size:trim});
  rows.forEach((row,ri)=>{
   const pieces=s.placed.filter(p=>Math.abs(p.y-row.y)<1e-6).sort((a,b)=>a.x-b.x);
   add({stage:'rip',strip:ri+1,text:`Strip ${ri+1}: rip ${row.height} mm`,size:row.height,at:row.y+row.height});
   pieces.forEach(p=>{
    add({stage:'cross',strip:ri+1,part:p.id,text:`Strip ${ri+1}: cross-cut ${p.w} mm → ${p.id}`,size:p.w,at:p.x+p.w});
    if(p.h<row.height-1e-6)add({stage:'recut',strip:ri+1,part:p.id,text:`${p.id}: trim width to ${p.h} mm (strip ${row.height})`,size:p.h});
   });
   const used=pieces.length?pieces.at(-1).x+pieces.at(-1).w:trim,rest=s.width-trim-used;
   if(rest>kerf)add({stage:'offcut',strip:ri+1,text:`Strip ${ri+1}: offcut ${Math.round((rest-kerf)*10)/10} × ${row.height} mm`,size:rest-kerf});
  });
  const last=rows.at(-1),rest=s.height-trim-(last.y+last.height);
  if(rest>kerf)add({stage:'offcut',text:`Sheet offcut ${s.width-2*trim} × ${Math.round((rest-kerf)*10)/10} mm`,size:rest-kerf});
  return {sheet:si+1,group:s.group,width:s.width,height:s.height,steps,pieces:s.placed.length};
 });
}

/** Checks that the sequence reproduces exactly the planned pieces and that every cut is a straight through-cut. */
export function verifyCutSequence(plan,sequence){
 const problems=[];
 sequence.forEach((sq,i)=>{
  const s=plan.sheets[i],made=sq.steps.filter(t=>t.stage==='cross').map(t=>t.part).sort(),want=s.placed.map(p=>p.id).sort();
  if(JSON.stringify(made)!==JSON.stringify(want))problems.push(`Sheet ${i+1}: pieces do not match the layout`);
  for(const row of s.shelves)for(const p of s.placed.filter(q=>Math.abs(q.y-row.y)<1e-6))if(p.h>row.height+1e-6)problems.push(`${p.id} is taller than its strip`);
  // No piece may straddle a rip line (pieces in other strips must lie fully above or below).
  for(const row of s.shelves){const line=row.y+row.height;for(const p of s.placed)if(p.y<line-1e-6&&p.y+p.h>line+1e-6)problems.push(`${p.id} crosses rip line at ${line}`)}
 });
 return problems;
}

export function cutSequenceCsv(sequence){
 const rows=[['sheet','step','stage','strip','size_mm','part','instruction']];
 for(const s of sequence)for(const t of s.steps)rows.push([s.sheet,t.step,t.stage,t.strip??'',Math.round(t.size*10)/10,t.part??'',t.text]);
 return '﻿'+rows.map(r=>r.map(v=>cell(v,',')).join(',')).join('\r\n')+'\r\n';
}

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Printable saw sheet (one page per sheet): diagram with strip numbers + numbered cut list. */
export function cutSequenceHtml(plan,sequence,{projectName='',projectId='',revision='',lang='en'}={}){
 const ar=lang==='ar';
 const T=ar?{title:'خطة قص المنشار (Beam saw)',sheet:'لوح',steps:'خطوات القص',note:'مستخرجة من توزيع المعاينة — غير محسّنة. راجع المقاسات قبل القص.',strip:'شريحة'}:{title:'Beam saw cutting plan',sheet:'Sheet',steps:'Cutting steps',note:'Derived from the preview layout — not optimized. Check sizes before cutting.',strip:'Strip'};
 const pages=sequence.map((sq,i)=>{
  const s=plan.sheets[i],sc=Math.min(520/s.width,700/s.height);
  const rects=s.placed.map(p=>`<rect x="${p.x*sc}" y="${(s.height-p.y-p.h)*sc}" width="${p.w*sc}" height="${p.h*sc}" fill="#e3efe9" stroke="#3e716c"/><text x="${p.x*sc+3}" y="${(s.height-p.y-p.h)*sc+11}" font-size="9">${esc(p.id)}</text><text x="${(p.x+p.w/2)*sc}" y="${(s.height-p.y-p.h/2)*sc+4}" font-size="10" text-anchor="middle">${p.w}×${p.h}</text>`).join('');
  const strips=[...(s.shelves??[])].sort((a,b)=>a.y-b.y).map((r,ri)=>`<text x="${s.width*sc+6}" y="${(s.height-r.y-r.height/2)*sc+4}" font-size="11" fill="#a33223">${ri+1}</text>`).join('');
  const list=sq.steps.map(t=>`<tr><td>${t.step}</td><td>${esc(t.text)}</td></tr>`).join('');
  return `<section><h2>${T.sheet} ${sq.sheet} · ${esc(s.group.split('|')[0])} · <bdi dir="ltr">${s.width} × ${s.height}</bdi></h2><div class="row"><svg width="${s.width*sc+24}" height="${s.height*sc+2}" viewBox="0 0 ${s.width*sc+24} ${s.height*sc+2}"><rect width="${s.width*sc}" height="${s.height*sc}" fill="#f7f5ef" stroke="#394e5a"/>${rects}${strips}</svg><table><thead><tr><th>#</th><th>${T.steps}</th></tr></thead><tbody dir="ltr">${list}</tbody></table></div></section>`;
 }).join('');
 return `<!doctype html><html lang="${ar?'ar':'en'}" dir="${ar?'rtl':'ltr'}"><head><meta charset="utf-8"><title>${T.title}</title><style>body{font-family:Arial,'IBM Plex Sans Arabic',sans-serif;margin:18px;color:#18212b}h1{font-size:18px;margin:0}h2{font-size:14px}.note{color:#a33223;font-size:12px}.row{display:flex;gap:18px;align-items:flex-start}table{border-collapse:collapse;font-size:11px}td,th{border:1px solid #c9ced3;padding:3px 6px;text-align:left}section{page-break-after:always}@page{size:A4 portrait;margin:10mm}</style></head><body><h1>${T.title} · ${esc(projectName)} <bdi dir="ltr">${esc(projectId)} R${esc(revision)}</bdi></h1><p class="note">${T.note}</p>${pages}</body></html>`;
}
