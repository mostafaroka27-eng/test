/** Manufacturing records derived from the single cabinet model: cut list CSV, part labels/QR and packing checks.
 * Every output reads the same generated parts, so the 3D view, drawings, CSV and labels cannot disagree.
 * Status: preliminary workshop documents — not approved for CNC, procurement or fabrication.
 */
import qrcode from 'qrcode-generator';
import {cabinet} from './engine.mjs';

export const LABEL_PAYLOAD_VERSION='RDX-PART-1';
export const MAX_LABEL_PAYLOAD=700;
const EDGE_NAMES=['L1','W1','L2','W2'];

const cell=value=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'};
const xml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const num=n=>String(Math.round(n*100)/100);

export function projectMeta(project){
 return {projectId:project.projectId??'UNSAVED',revision:project.designRevision??1,projectName:project.name??''};
}

/** One flat record per generated part. Dimensions in millimetres; edges named L1/W1/L2/W2. */
export function partRecords(project){
 const meta=projectMeta(project);
 return project.units.flatMap(unit=>{
  const model=cabinet(unit.config,unit.id);
  return model.parts.map(p=>({
   projectId:meta.projectId,revision:meta.revision,rulesVersion:model.rules.version,unitId:unit.id,unitName:unit.name,
   uid:p.uid,displayId:p.id,key:p.key,kind:p.kind,material:p.material,thickness:p.thickness,
   finishLength:p.length,finishWidth:p.width,cutLength:p.cutLength,cutWidth:p.cutWidth,
   grain:p.grain,canRotate:p.canRotate,edges:Object.fromEntries(EDGE_NAMES.map((name,i)=>[name,p.edges[i]])),
   edgeType:p.edgeType,edgeThickness:p.edgeThickness,bandLength:p.bandLength,sheetGood:p.sheetGood,
   operations:p.operations,verification:p.verification
  }));
 });
}

export function accessoryRecords(project){
 return project.units.flatMap(unit=>cabinet(unit.config,unit.id).accessories.map(a=>({unitId:unit.id,...a})));
}

export function manufacturingCsv(project){
 const meta=projectMeta(project),records=partRecords(project);
 const columns=['project_id','design_revision','rules_version','unit_id','part_uid','display_id','component','material','thickness_mm','finish_length_mm','finish_width_mm','cut_length_mm','cut_width_mm','grain','rotation_allowed','edge_L1','edge_W1','edge_L2','edge_W2','edge_thickness_mm','edge_type','band_length_mm','sheet_good','operations','verification'];
 const rows=records.map(r=>[r.projectId,r.revision,r.rulesVersion,r.unitId,r.uid,r.displayId,r.kind,r.material,r.thickness,r.finishLength,r.finishWidth,r.cutLength,r.cutWidth,r.grain,r.canRotate?'yes':'no',r.edges.L1,r.edges.W1,r.edges.L2,r.edges.W2,r.edgeThickness,r.edgeType,r.bandLength,r.sheetGood?'yes':'no',r.operations.map(o=>`${o.type}:${o.edge}:${o.width}x${o.depth}@${o.offsetFromRear}`).join(' '),r.verification]);
 return [`# RokaDex manufacturing cut list · project ${meta.projectId} · revision ${meta.revision} · PRELIMINARY — NOT APPROVED FOR CNC OR FABRICATION`,
  '# finish = designed size after edge banding; cut = saw size before banding when edge deduction is on',
  columns.join(','),...rows.map(row=>row.map(cell).join(','))].join('\r\n');
}

// FNV-1a 32-bit checksum: detects truncated or altered label payloads (not a security signature).
function checksum(text){let h=0x811c9dc5;for(const byte of new TextEncoder().encode(text)){h^=byte;h=Math.imul(h,0x01000193)>>>0}return h.toString(16).padStart(8,'0')}

/** Full-precision, versioned label payload. Unlike the NCD compact QR it never rounds dimensions to whole millimetres. */
export function labelPayload(record){
 const fields=[['prj',record.projectId],['rev',record.revision],['uid',record.uid],['k',record.kind],['m',record.material],['t',num(record.thickness)],['fl',num(record.finishLength)],['fw',num(record.finishWidth)],['cl',num(record.cutLength)],['cw',num(record.cutWidth)],['e',EDGE_NAMES.map(n=>record.edges[n]).join('')]];
 const body=fields.map(([k,v])=>`${k}=${encodeURIComponent(String(v))}`).join('&');
 const payload=`${LABEL_PAYLOAD_VERSION}?${body}&c=${checksum(body)}`;
 if(payload.length>MAX_LABEL_PAYLOAD)throw Error(`Label payload for ${record.uid} exceeds ${MAX_LABEL_PAYLOAD} characters`);
 return payload;
}

export function parseLabelPayload(text){
 if(typeof text!=='string'||text.length>MAX_LABEL_PAYLOAD)throw Error('Label payload missing or too long');
 const prefix=`${LABEL_PAYLOAD_VERSION}?`;
 if(!text.startsWith(prefix))throw Error('Unsupported label payload version');
 const rest=text.slice(prefix.length),split=rest.lastIndexOf('&c=');
 if(split<0)throw Error('Label payload is truncated (no checksum)');
 const body=rest.slice(0,split);
 if(checksum(body)!==rest.slice(split+3))throw Error('Label payload checksum mismatch (truncated or altered)');
 const values=new Map();
 for(const pair of body.split('&')){const [k,v]=pair.split('=');if(!k||v===undefined||values.has(k))throw Error('Malformed label payload');values.set(k,decodeURIComponent(v))}
 for(const k of ['prj','rev','uid','k','m','t','fl','fw','cl','cw','e'])if(!values.has(k))throw Error(`Label payload missing ${k}`);
 const number=k=>{const n=Number(values.get(k));if(!Number.isFinite(n)||n<=0||n>10000)throw Error(`Invalid ${k} in label payload`);return n};
 const edges=values.get('e');if(!/^[01]{4}$/.test(edges))throw Error('Invalid edge flags in label payload');
 return {projectId:values.get('prj'),revision:Number(values.get('rev')),uid:values.get('uid'),kind:values.get('k'),material:values.get('m'),thickness:number('t'),finishLength:number('fl'),finishWidth:number('fw'),cutLength:number('cl'),cutWidth:number('cw'),edges:Object.fromEntries(EDGE_NAMES.map((n,i)=>[n,Number(edges[i])]))};
}

/** QR module matrix (true = dark), error correction level M, byte mode. */
export function qrMatrix(payload){
 const qr=qrcode(0,'M');qr.addData(payload,'Byte');qr.make();
 const size=qr.getModuleCount();
 return Array.from({length:size},(_,r)=>Array.from({length:size},(_,c)=>qr.isDark(r,c)));
}

function qrSvg(payload,x,y,size){
 const m=qrMatrix(payload),n=m.length+8,cellSize=size/n;let path='';
 for(let r=0;r<m.length;r++)for(let c=0;c<m.length;c++)if(m[r][c])path+=`M${num(x+(c+4)*cellSize)} ${num(y+(r+4)*cellSize)}h${num(cellSize)}v${num(cellSize)}h-${num(cellSize)}z`;
 return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000" shape-rendering="crispEdges"/>`;
}

export function labelSvg(record){
 const payload=labelPayload(record),edges=EDGE_NAMES.filter(n=>record.edges[n]).join(' ')||'none';
 const lines=[[`${record.unitId} · ${record.kind}`,15,'700'],[record.uid,11,'400'],[`Finish ${num(record.finishLength)} × ${num(record.finishWidth)} × ${num(record.thickness)} mm`,13,'700'],[`Cut ${num(record.cutLength)} × ${num(record.cutWidth)} mm`,13,'400'],[record.material,12,'400'],[`Edges ${edges} · grain ${record.grain}${record.canRotate?' · may rotate':''}`,11,'400'],[`Project ${record.projectId} · Rev ${record.revision} · ${record.rulesVersion}`,10,'400'],['PRELIMINARY — NOT FOR CNC',10,'700']];
 const text=lines.map(([value,size,weight],i)=>`<text x="10" y="${22+i*19}" font-size="${size}" font-weight="${weight}">${xml(value)}</text>`).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="180" viewBox="0 0 460 180" font-family="Arial,sans-serif" data-uid="${xml(record.uid)}"><rect width="460" height="180" fill="#fff" stroke="#000"/>${text}${qrSvg(payload,300,10,150)}</svg>`;
}

export function labelsHtml(project){
 const meta=projectMeta(project),records=partRecords(project);
 const body=records.map(r=>`<div class="label">${labelSvg(r)}</div>`).join('');
 return `<!doctype html><html><head><meta charset="utf-8"><title>RokaDex part labels · ${xml(meta.projectId)} · Rev ${xml(meta.revision)}</title><style>body{font-family:Arial,sans-serif;margin:8mm}.label{display:inline-block;margin:2mm;break-inside:avoid}h1{font-size:14px}@media print{h1{display:none}}</style></head><body><h1>${records.length} part labels · project ${xml(meta.projectId)} · revision ${xml(meta.revision)} · preliminary, verify before production</h1>${body}</body></html>`;
}

/** Independent check of a packing result: every sheet part placed once or reported, inside trim, no overlap, grain respected. */
export function verifySheetLayout(parts,layout,c){
 const issues=[],seen=new Map();
 const sheetParts=parts.filter(p=>p.sheetGood!==false);
 for(const sheet of layout.sheets){
  const usable={x0:c.trim,y0:c.trim,x1:c.sheetWidth-c.trim,y1:c.sheetHeight-c.trim};
  for(const [i,a] of sheet.placed.entries()){
   seen.set(a.id,(seen.get(a.id)||0)+1);
   if(a.x<usable.x0-1e-6||a.y<usable.y0-1e-6||a.x+a.w>usable.x1+1e-6||a.y+a.h>usable.y1+1e-6)issues.push(`${a.id} outside usable sheet area`);
   for(const b of sheet.placed.slice(i+1)){const apart=a.x+a.w+c.kerf<=b.x+1e-6||b.x+b.w+c.kerf<=a.x+1e-6||a.y+a.h+c.kerf<=b.y+1e-6||b.y+b.h+c.kerf<=a.y+1e-6;if(!apart)issues.push(`${a.id} overlaps ${b.id} (including kerf)`)}
   const part=sheetParts.find(p=>p.id===a.id);
   if(!part){issues.push(`${a.id} is not a sheet part`);continue}
   const L=part.cutLength??part.length,W=part.cutWidth??part.width;
   if(!((Math.abs(a.w-L)<1e-6&&Math.abs(a.h-W)<1e-6)||(Math.abs(a.w-W)<1e-6&&Math.abs(a.h-L)<1e-6)))issues.push(`${a.id} placed with wrong size`);
   const axis=c.stockGrainAxis??'legacy';
   if(part.grain!=='none'&&axis!=='legacy'){
    // Grain runs along the length for 'vertical' parts and along the width for 'horizontal' parts.
    const grainAlongSheetY=(part.grain==='vertical')===(Math.abs(a.h-L)<1e-6&&Math.abs(a.w-W)<1e-6);
    if(grainAlongSheetY!==(axis==='y')&&L!==W)issues.push(`${a.id} rotated against the stock grain`);
   }
  }
 }
 for(const u of layout.unplaced)seen.set(u.id,(seen.get(u.id)||0)+1);
 for(const p of sheetParts){const count=seen.get(p.id)||0;if(count!==1)issues.push(`${p.id} accounted ${count} times`)}
 for(const e of layout.excluded??[])if(sheetParts.some(p=>p.id===e.id))issues.push(`${e.id} excluded although it is sheet stock`);
 return {ok:issues.length===0,issues};
}
