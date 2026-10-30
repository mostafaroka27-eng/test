/** Independent manufacturing review layer; never an approval or CNC postprocessor. */
import {cabinet,layoutSheets} from './engine.mjs';
import {validateRoom,inspectLayout} from './room.mjs';
const round=(n,d=2)=>Number(n.toFixed(d));
const escapeXml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const safeCsv=v=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,s=>'\''+s).replace(/"/g,'""')+'"';
export function reviewProject(room,units){
 validateRoom(room);
 if(!Array.isArray(units)||units.length<1||units.length>100)throw Error('Project must have 1–100 units');
 const ids=new Set(),issues=[],parts=[],materials=new Map(),sheets=[];
 for(const u of units){
  if(!u?.id||ids.has(u.id))throw Error('Duplicate or missing unit ID');ids.add(u.id);
  const model=cabinet(u.config,u.id);
  parts.push(...model.parts);
  if(u.config.doors>0&&u.config.bayDrawers?.some(n=>n>0))issues.push({severity:'BLOCKER',code:'DOOR_DRAWER_CONFLICT',unit:u.id,message:'Doors and drawer banks may intersect; verify front configuration.'});
  const nested=layoutSheets(model.parts,u.config);
  sheets.push(...nested.sheets.map(s=>({...s,unit:u.id})));
  for(const p of nested.unplaced)issues.push({severity:'BLOCKER',code:'UNPLACED_PART',unit:u.id,message:`${p.id} cannot fit a sheet using current preliminary packing settings.`});
  for(const p of model.parts){const key=`${p.material} / ${p.thickness} mm`;const entry=materials.get(key)||{material:p.material,thickness:p.thickness,count:0,areaM2:0,edgeM:0};entry.count++;entry.areaM2+=p.length*p.width/1e6;entry.edgeM+=(p.bandLength||0)/1000;materials.set(key,entry)}
 }
 for(const issue of inspectLayout(room,units))issues.push({severity:'WARNING',code:({overlap:'ROOM_OVERLAP',boundary:'ROOM_BOUNDARY',height:'ROOM_HEIGHT',floor:'ROOM_FLOOR'})[issue.type]||'ROOM_LAYOUT',unit:issue.units.join(', '),message:issue.message});
 issues.push({severity:'BLOCKER',code:'MANUFACTURING_UNVERIFIED',unit:'ALL',message:'Manufacturing rules, tolerances, panel datum, hardware, and machine configuration are not independently validated. No production approval.'});
 return {status:'NOT APPROVED FOR FABRICATION OR CNC',summary:{units:units.length,parts:parts.length,areaM2:round(parts.reduce((s,p)=>s+p.length*p.width/1e6,0)),edgeM:round(parts.reduce((s,p)=>s+(p.bandLength||0)/1000,0)),previewSheets:sheets.length,blockers:issues.filter(i=>i.severity==='BLOCKER').length,warnings:issues.filter(i=>i.severity==='WARNING').length},issues,parts,materials:[...materials.values()].map(m=>({...m,areaM2:round(m.areaM2),edgeM:round(m.edgeM)})),sheets};
}
export function projectManufacturingCsv(review){const columns=['part_id','component','length_mm','width_mm','thickness_mm','material','grain','edge_flags','edge_length_mm','status'];return ['# NOT APPROVED FOR FABRICATION OR CNC',columns.join(','),...review.parts.map(p=>[p.id,p.kind,p.length,p.width,p.thickness,p.material,p.grain,p.edges.join('|'),p.bandLength,'NOT APPROVED'].map(safeCsv).join(','))].join('\n')}
export function partDrawingSvg(p){if(!p||![p.length,p.width,p.thickness].every(n=>Number.isFinite(n)&&n>0))throw Error('Invalid part');const L=p.length,W=p.width;const scale=Math.min(700/L,440/W),w=L*scale,h=W*scale,x=170,y=150;const line=(x1,y1,x2,y2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#305669" stroke-width="1.5"/>`;return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 780" width="1100" height="780"><rect width="1100" height="780" fill="#fff"/><g font-family="Arial,sans-serif" fill="#203e50"><text x="60" y="54" font-size="28" font-weight="bold">ROKADEX · PANEL DETAIL</text><text x="60" y="85" font-size="18">${escapeXml(p.id)} · ${escapeXml(p.kind)}</text><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f4eadb" stroke="#204c60" stroke-width="3"/><text x="${x+w/2}" y="${y+h/2}" text-anchor="middle" font-size="16">${escapeXml(p.material)}</text>${line(x,y-22,x+w,y-22)}${line(x,y-31,x,y-12)}${line(x+w,y-31,x+w,y-12)}<text x="${x+w/2}" y="${y-36}" font-size="17" text-anchor="middle">${L} mm</text>${line(x-24,y,x-24,y+h)}${line(x-33,y,x-14,y)}${line(x-33,y+h,x-14,y+h)}<text x="${x-40}" y="${y+h/2}" font-size="17" text-anchor="end">${W} mm</text><text x="60" y="645" font-size="18">Thickness: ${p.thickness} mm | Grain: ${escapeXml(p.grain||'unspecified')}</text><text x="60" y="672" font-size="18">Edges (Long A / Short A / Long B / Short B): ${escapeXml((p.edges||[]).join(' / '))}</text><rect x="50" y="699" width="1000" height="55" fill="#fff1e8" stroke="#b75b3d"/><text x="65" y="731" font-size="18" font-weight="bold" fill="#aa432c">NOT FOR FABRICATION — REVIEW DIMENSIONS, EDGE ORIENTATION &amp; HARDWARE</text></g></svg>`}

/** Project-wide stock-grouped preview. Never a CNC cut sequence. */
export function projectSheetPlan(units){
 if(!Array.isArray(units)||!units.length||units.length>100)throw Error('Project must contain 1–100 units');
 const batches=new Map();const ids=new Set();
 for(const u of units){
  if(!u?.id||ids.has(u.id))throw Error('Duplicate or missing unit ID');ids.add(u.id);
  const parts=cabinet(u.config,u.id).parts;
  const c=u.config;
  const stock=[c.sheetWidth,c.sheetHeight,c.trim,c.kerf,c.stockGrainAxis??'legacy'].join('|');
  if(!batches.has(stock))batches.set(stock,{config:c,parts:[]});
  batches.get(stock).parts.push(...parts);
 }
 const sheets=[],unplaced=[];
 for(const batch of batches.values()){
  const result=layoutSheets(batch.parts,batch.config);
  sheets.push(...result.sheets);
  unplaced.push(...result.unplaced);
 }
 const placedCount=sheets.reduce((sum,s)=>sum+s.placed.length,0);
 const totalArea=sheets.reduce((sum,s)=>sum+s.width*s.height,0);
 const usedArea=sheets.reduce((sum,s)=>sum+s.usedArea,0);
 return {sheets,unplaced,placedCount,utilization:totalArea?round(usedArea/totalArea*100):0,status:'PREVIEW ONLY — NOT FOR FABRICATION OR CNC'};
}
export function projectSheetCsv(plan){
 const rows=['# NOT FOR FABRICATION OR CNC — PREVIEW ONLY','sheet,stock_group,part_id,x_mm,y_mm,length_mm,width_mm,stock_grain_axis,rotated'];
 plan.sheets.forEach((s,i)=>s.placed.forEach(p=>rows.push([i+1,s.group,p.id,p.x,p.y,p.w,p.h,s.stockGrainAxis,p.rotated].map(safeCsv).join(','))));
 plan.unplaced.forEach(p=>rows.push(['UNPLACED','',p.id,'','','','','',''].map(safeCsv).join(',')));
 return rows.join('\n');
}
export function projectSheetSvg(plan){
 const columns=3,cellW=370,cellH=430,margin=26;
 const rows=Math.max(1,Math.ceil(plan.sheets.length/columns));
 const body=plan.sheets.map((s,i)=>{
  const col=i%columns,row=Math.floor(i/columns),x=margin+col*cellW,y=75+row*cellH;
  const scale=Math.min(330/s.width,340/s.height);
  const pieces=s.placed.map(p=>`<rect x="${p.x*scale}" y="${p.y*scale}" width="${p.w*scale}" height="${p.h*scale}" fill="#d1e8dd" stroke="#3e716c" stroke-width=".7"><title>${escapeXml(p.id)}</title></rect><text x="${(p.x+4)*scale}" y="${(p.y+18)*scale}" font-size="7" fill="#174b48">${escapeXml(p.id)}</text>`).join('');
  return `<g transform="translate(${x},${y})"><text y="-12" font-family="Arial" font-size="13">Sheet ${i+1} · ${escapeXml(s.group)} · stock grain ${escapeXml(s.stockGrainAxis==='legacy'?'legacy':s.stockGrainAxis.toUpperCase())} · ${s.utilization}%</text><rect width="${s.width*scale}" height="${s.height*scale}" fill="#f7f5ef" stroke="#394e5a"/>${pieces}</g>`;
 }).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${columns*cellW+margin} ${rows*cellH+110}"><rect width="100%" height="100%" fill="#fff"/><text x="26" y="28" font-family="Arial" font-size="19" fill="#a33223">ROKADEX · PROJECT SHEET PREVIEW · NOT FOR FABRICATION OR CNC</text><text x="26" y="49" font-family="Arial" font-size="12">${plan.sheets.length} sheets · ${plan.placedCount} placed · ${plan.unplaced.length} unplaced · ${plan.utilization}% area utilization</text>${body}</svg>`;
}
