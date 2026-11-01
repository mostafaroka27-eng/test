import {cncProfile,cncSheetPlan,sheetGcode,checkGcode,sheetLimits,toolpathSvg,CNC_DEFAULTS,DIALECTS} from './cnc.mjs';
import {optimizerCsv,cutSequence,verifyCutSequence,cutSequenceCsv,cutSequenceHtml} from './beamsaw.mjs';
import {projectSheetPlan} from './review.mjs';

const KEY='rokadex.cncProfile.v1';
const NUMS=['toolDiameter','feed','plungeFeed','spindle','stepDown','overcut','safeZ','tabHeight','tabWidth','partGap'];
const SELECTS=['dialect','zZero','tabs','direction','orientation'];

/** Router (G-code) and beam-saw export panel. Machine settings are kept in this browser only (not in the project). */
export function initCncUi({getProject,download,printHtml,tr2,lang}){
 const $=id=>document.getElementById(id);if(!$('cncSection'))return {refresh(){}};
 const status=$('cncStatus'),preview=$('cncPreview'),pick=$('cncSheet');
 let plan=null;
 const load=()=>{try{return {...CNC_DEFAULTS,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...CNC_DEFAULTS}}};
 const fill=p=>{for(const k of NUMS)$('cnc_'+k).value=p[k];for(const k of SELECTS)$('cnc_'+k).value=String(p[k]);$('cnc_grooves').checked=p.grooves!==false;$('cnc_header').value=p.header;$('cnc_footer').value=p.footer;$('cnc_header').placeholder=DIALECTS[p.dialect]?.header??''};
 const read=()=>{const p={};for(const k of NUMS)p[k]=Number($('cnc_'+k).value);for(const k of SELECTS)p[k]=k==='tabs'?Number($('cnc_'+k).value):$('cnc_'+k).value;p.grooves=$('cnc_grooves').checked;p.header=$('cnc_header').value;p.footer=$('cnc_footer').value;return cncProfile(p)};
 fill(load());
 const say=(text,bad=false)=>{status.textContent=text;status.dataset.bad=bad?'1':''};
 const project=()=>getProject();
 const name=s=>`${project().projectId}-R${project().designRevision}`;
 function build(){
  const prof=read();try{localStorage.setItem(KEY,JSON.stringify(prof))}catch{}
  plan=cncSheetPlan(project().units,prof);
  if(!plan.sheets.length)throw Error(tr2('No sheet parts to cut','مفيش قطع ألواح للقص'));
  const keep=pick.value;pick.replaceChildren(...plan.sheets.map((s,i)=>new Option(`${tr2('Sheet','لوح')} ${i+1} · ${s.group.split('|')[0]} · ${s.placed.length}`,String(i))));
  if(keep&&Number(keep)<plan.sheets.length)pick.value=keep;
  return prof;
 }
 function show(){
  try{
   const prof=build(),i=Number(pick.value||0),s=plan.sheets[i];
   const g=sheetGcode(s,prof,{index:i+1,projectId:project().projectId,revision:project().designRevision});
   const chk=checkGcode(g.text,{...sheetLimits(s,prof),rapid:10000});
   preview.innerHTML=toolpathSvg(s,prof,{index:i+1});
   const warn=[...g.warnings,...(plan.unplaced.length?[tr2(`${plan.unplaced.length} part(s) did not fit a sheet`,`${plan.unplaced.length} قطعة مش داخلة في لوح`)]:[])];
   say(`${plan.sheets.length} ${tr2('sheets','ألواح')} · ${tr2('check','الفحص')}: ${chk.errorCount?tr2(`${chk.errorCount} problem(s): `,`${chk.errorCount} مشكلة: `)+chk.errors[0]:tr2('no move leaves the sheet, no rapid into the board, depth ≤ board + overcut','مفيش حركة برا اللوح، ولا حركة سريعة جوه الخشب، والعمق ≤ سُمك اللوح + التخطي')} · ${tr2('cut','قص')} ${(chk.cutMm/1000).toFixed(1)} m · ≈${chk.minutes} min${warn.length?' · ⚠ '+warn.join(' · '):''} · ${tr2('UNVERIFIED: dry run in the air first','غير مُجرَّب: شغّله في الهوا الأول')}`,chk.errorCount>0);
   return {prof,i,s,g,chk};
  }catch(e){preview.replaceChildren();say(e.message,true);return null}
 }
 const gfile=(r)=>{if(r.chk.errorCount)throw Error(tr2('G-code failed the check; not downloaded','الكود فشل في الفحص؛ متحمّلش'));download(`${name()}-sheet${r.i+1}-UNVERIFIED.${r.g.extension}`,r.g.text,'text/plain')};
 $('cncPreviewBtn').onclick=show;pick.onchange=show;
 $('cncGcode').onclick=()=>{const r=show();if(r)try{gfile(r)}catch(e){say(e.message,true)}};
 $('cncGcodeAll').onclick=()=>{const r=show();if(!r)return;try{plan.sheets.forEach((s,i)=>{const g=sheetGcode(s,r.prof,{index:i+1,projectId:project().projectId,revision:project().designRevision});const chk=checkGcode(g.text,{...sheetLimits(s,r.prof),rapid:10000});gfile({i,g,chk})})}catch(e){say(e.message,true)}};
 $('cncSvg').onclick=()=>{const r=show();if(r)download(`${name()}-sheet${r.i+1}-toolpath.svg`,toolpathSvg(r.s,r.prof,{index:r.i+1}),'image/svg+xml')};
 $('cncReset').onclick=()=>{if(!confirm(tr2('Reset the machine settings to the starting values?','ترجّع إعدادات الماكينة للقيم الأولية؟')))return;try{localStorage.removeItem(KEY)}catch{}fill({...CNC_DEFAULTS});say(tr2('Machine settings reset','اترجّعت الإعدادات'))};
 $('cnc_dialect').onchange=()=>{$('cnc_header').placeholder=DIALECTS[$('cnc_dialect').value]?.header??''};
 const saw=fn=>{try{fn()}catch(e){say(e.message,true)}};
 $('sawCsvComma').onclick=()=>saw(()=>download(`${name()}-optimizer-parts.csv`,optimizerCsv(project(),{style:'comma'}),'text/csv;charset=utf-8'));
 $('sawCsvSemi').onclick=()=>saw(()=>download(`${name()}-optimizer-parts-semicolon.csv`,optimizerCsv(project(),{style:'semicolon'}),'text/csv;charset=utf-8'));
 const seq=()=>{const p=project(),pl=projectSheetPlan(p.units),c=p.units[0].config,s=cutSequence(pl,{trim:c.trim,kerf:c.kerf}),bad=verifyCutSequence(pl,s);if(bad.length)throw Error(bad[0]);if(pl.unplaced.length)say(tr2(`${pl.unplaced.length} part(s) did not fit a sheet and are not in the plan`,`${pl.unplaced.length} قطعة مش داخلة في الخطة`),true);return {pl,s,p}};
 $('sawPlan').onclick=()=>saw(()=>{const {pl,s,p}=seq();printHtml(cutSequenceHtml(pl,s,{projectName:p.projectName??'',projectId:p.projectId,revision:p.designRevision,lang:lang()}))});
 $('sawSeqCsv').onclick=()=>saw(()=>{const {s}=seq();download(`${name()}-saw-cut-sequence.csv`,cutSequenceCsv(s),'text/csv;charset=utf-8')});
 return {refresh(){if(preview.childElementCount)show()}};
}
