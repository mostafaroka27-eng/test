/**
 * CNC router G-code from the project's sheet layout (nested, rectangular parts).
 *
 * UNVERIFIED ON ANY MACHINE. The profile below must be filled with the shop's own machine data and the first file
 * must be run in the air (Z raised) and then on a test sheet. Nothing here is "CNC ready".
 *
 * Coordinates: millimetres, absolute (G21 G90). X/Y origin = front-left corner of the sheet as drawn in the preview
 * (X along the sheet's first side, Y along the second); orientation 'rotate90' turns the whole sheet a quarter turn
 * (never mirrors it). Z zero is either the top of the board ('top') or the spoilboard/table ('table').
 * Parts are cut from the outside with tool-radius compensation computed here (no G41/G42), in equal depth passes,
 * smallest parts first, with optional holding tabs on the last passes. Back grooves (backConstruction 'groove') are
 * machined before the profiles; grooved panels must lie with their inner (grooved) face up.
 * Not included: drilling (no verified hardware pattern in the design yet), arcs, ramps, lead-ins, tool changes.
 */
import {cabinet,layoutSheets} from './engine.mjs';

export const DIALECTS=Object.freeze({
 grbl:{name:'GRBL',ext:'nc',header:'G21 G90 G17 G94',footer:'M5\nM30'},
 mach3:{name:'Mach3 / Mach4',ext:'tap',header:'G21 G90 G17 G40 G49 G80',footer:'M5\nM30'},
 generic:{name:'Generic ISO (DSP / NcStudio — check with your file)',ext:'nc',header:'G21 G90 G17',footer:'M5\nM30'},
});
export const CNC_DEFAULTS=Object.freeze({
 dialect:'generic',toolDiameter:6,feed:5000,plungeFeed:1200,spindle:18000,stepDown:6,overcut:0.3,
 zZero:'top',safeZ:15,clearance:3,tabs:0,tabWidth:12,tabHeight:3,partGap:2,edgeMargin:10,
 direction:'conventional',orientation:'asPlan',grooves:true,header:'',footer:'',
});
const NUM={toolDiameter:[1,30],feed:[100,40000],plungeFeed:[50,20000],spindle:[0,60000],stepDown:[0.5,30],overcut:[0,3],safeZ:[2,150],clearance:[0.5,50],tabWidth:[3,100],tabHeight:[0.5,15],partGap:[0.5,50],edgeMargin:[0,100]};

/** Validated machine profile (defaults filled in). Throws with a field-specific message. */
export function cncProfile(input={}){
 const p={...CNC_DEFAULTS,...input};
 for(const [k,[min,max]] of Object.entries(NUM)){if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<min||p[k]>max)throw Error(`CNC ${k} must be between ${min} and ${max}`)}
 if(!DIALECTS[p.dialect])throw Error('Unknown CNC controller dialect');
 if(!['top','table'].includes(p.zZero))throw Error('Z zero must be top of board or table');
 if(![0,2,4].includes(p.tabs))throw Error('Tabs per part must be 0, 2 or 4');
 if(!['climb','conventional'].includes(p.direction))throw Error('Cut direction must be climb or conventional');
 if(!['asPlan','rotate90'].includes(p.orientation))throw Error('Sheet orientation must be asPlan or rotate90');
 for(const k of ['header','footer']){
  if(typeof p[k]!=='string'||p[k].length>2000)throw Error(`CNC ${k} must be text up to 2000 characters`);
  if(/[^\x20-\x7e\r\n]/.test(p[k]))throw Error(`CNC ${k} may only contain plain ASCII G-code`);
 }
 p.grooves=p.grooves!==false;
 return p;
}

/** Sheet layout for the router: the saw kerf is replaced by tool diameter + gap so cutters never meet a neighbour. */
export function cncSheetPlan(units,input={}){
 const prof=cncProfile(input);
 if(!Array.isArray(units)||!units.length||units.length>100)throw Error('Project must contain 1–100 units');
 const batches=new Map();
 for(const u of units){
  const c=u.config,parts=cabinet(c,u.id).parts;
  const cfg={...c,kerf:prof.toolDiameter+prof.partGap,trim:Math.max(c.trim,prof.edgeMargin,prof.toolDiameter+0.5)};
  const key=[c.sheetWidth,c.sheetHeight,cfg.trim,c.stockGrainAxis??'legacy'].join('|');
  if(!batches.has(key))batches.set(key,{config:cfg,parts:[]});
  batches.get(key).parts.push(...parts.map(p=>({...p,edgeDeduction:c.edgeDeduction??'off',backInset:c.backInset})));
 }
 const sheets=[],unplaced=[],excluded=[];
 for(const b of batches.values()){
  const byId=new Map(b.parts.map(p=>[p.id,p]));
  const r=layoutSheets(b.parts,b.config);
  for(const s of r.sheets)sheets.push({...s,trim:b.config.trim,spacing:b.config.kerf,placed:s.placed.map(pl=>({...pl,part:byId.get(pl.id)}))});
  unplaced.push(...r.unplaced);excluded.push(...r.excluded);
 }
 return {profile:prof,sheets,unplaced,excluded};
}

const r3=n=>Math.round(n*1000)/1000;
const fmt=n=>{const v=r3(n);return Object.is(v,-0)?'0':String(v)};
const thicknessOf=sheet=>Number(sheet.group.split('|')[1]);

/** Groove rectangles (sheet coordinates) for a placed part; warnings when the tool cannot make them. */
function grooveCuts(pl,prof,warn){
 const part=pl.part;if(!part)return [];
 const out=[];
 for(const op of part.operations??[]){
  if(op.type!=='groove')continue;
  if(op.edge!=='L2'){warn(`${pl.id}: groove on ${op.edge} not supported; machine it separately`);continue}
  if(op.width<prof.toolDiameter-0.01){warn(`${pl.id}: groove ${op.width} mm is narrower than the ${prof.toolDiameter} mm tool; not machined`);continue}
  const band=part.edgeDeduction==='on'&&part.edges?.[2]?part.edgeThickness:0;
  const off=op.offsetFromRear-band;if(off<0){warn(`${pl.id}: groove offset is inside the edge band; not machined`);continue}
  // L1 lies at the lower Y (unrotated) or lower X (rotated) side of the placed part; L2 opposite.
  if(!pl.rotated)out.push({axis:'x',from:pl.x,to:pl.x+pl.w,lo:pl.y+pl.h-off-op.width,hi:pl.y+pl.h-off,depth:op.depth,id:pl.id});
  else out.push({axis:'y',from:pl.y,to:pl.y+pl.h,lo:pl.x+pl.w-off-op.width,hi:pl.x+pl.w-off,depth:op.depth,id:pl.id});
 }
 return out;
}

/** Ordered toolpath operations for one sheet (sheet coordinates, before orientation). */
export function sheetToolpaths(sheet,input={}){
 const prof=cncProfile(input),r=prof.toolDiameter/2,warnings=[],warn=w=>warnings.push(w);
 const t=thicknessOf(sheet);if(!(t>0))throw Error('Sheet thickness unknown');
 const ops=[];
 if(prof.grooves)for(const pl of sheet.placed)for(const g of grooveCuts(pl,prof,warn)){
  const width=g.hi-g.lo,n=width<=prof.toolDiameter+0.01?1:Math.ceil((width-prof.toolDiameter)/(prof.toolDiameter*0.75))+1;
  const centres=n===1?[(g.lo+g.hi)/2]:Array.from({length:n},(_,i)=>g.lo+r+(width-prof.toolDiameter)*i/(n-1));
  const lines=centres.map(c=>g.axis==='x'?[[g.from-r,c],[g.to+r,c]]:[[c,g.from-r],[c,g.to+r]]);
  ops.push({type:'groove',id:g.id,depth:g.depth,lines});
 }
 for(const pl of [...sheet.placed].sort((a,b)=>a.w*a.h-b.w*b.h)){
  const x0=pl.x-r,y0=pl.y-r,x1=pl.x+pl.w+r,y1=pl.y+pl.h+r;
  // CW spindle: climb = clockwise around the part, conventional = counter-clockwise.
  const loop=prof.direction==='climb'?[[x0,y0],[x0,y1],[x1,y1],[x1,y0],[x0,y0]]:[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]];
  const sides=[0,1,2,3].map(i=>({i,len:Math.hypot(loop[i+1][0]-loop[i][0],loop[i+1][1]-loop[i][1])}));
  const tabSides=prof.tabs===4?sides:prof.tabs===2?[...sides].sort((a,b)=>b.len-a.len).slice(0,2):[];
  const tabs=tabSides.filter(s=>s.len>prof.tabWidth*3+prof.toolDiameter).map(s=>s.i);
  if(prof.tabs&&tabs.length<prof.tabs)warn(`${pl.id}: part too small for ${prof.tabs} tabs (${tabs.length} placed); hold it down another way`);
  ops.push({type:'profile',id:pl.id,loop,tabs,rect:[pl.x,pl.y,pl.w,pl.h]});
 }
 return {thickness:t,ops,warnings};
}

/** G-code text for one sheet. Returns {text, warnings, extension}. */
export function sheetGcode(sheet,input={},{index=1,projectId='',revision=''}={}){
 const prof=cncProfile(input),d=DIALECTS[prof.dialect];
 const {thickness:t,ops,warnings}=sheetToolpaths(sheet,prof);
 const top=prof.zZero==='top'?0:t,safe=top+prof.safeZ,near=top+prof.clearance;
 if(prof.tabs&&prof.tabHeight>=t)throw Error('Tab height must be less than the board thickness');
 const tx=prof.orientation==='rotate90'?([x,y])=>[y,sheet.width-x]:([x,y])=>[x,y];
 const L=[];const c=s=>L.push(`(${String(s).replace(/[()]/g,'').replace(/[^\x20-\x7e]/g,'?')})`);
 c(`RokaDex Studio - UNVERIFIED - dry run in the air first, then a test sheet`);
 c(`project ${projectId} R${revision} sheet ${index} - ${sheet.group.split('|')[0]} ${t} mm - ${sheet.width} x ${sheet.height}`);
 c(`origin X0 Y0 = sheet front-left corner${prof.orientation==='rotate90'?' (sheet turned 90 deg)':''}; Z0 = ${prof.zZero==='top'?'top of board':'spoilboard'}`);
 c(`tool D${prof.toolDiameter} flat end mill; feed ${prof.feed}; plunge ${prof.plungeFeed}; step ${prof.stepDown}; overcut ${prof.overcut}`);
 if(ops.some(o=>o.type==='groove'))c('grooved panels: lay the inner (grooved) face UP');
 for(const line of (prof.header||d.header).split(/\r?\n/).map(s=>s.trim()).filter(Boolean))L.push(line);
 if(!/\bM0?[34]\b/i.test(prof.header))L.push(`M3 S${prof.spindle}`);
 L.push(`G0 Z${fmt(safe)}`);
 let feedSet=null;const F=f=>{const s=feedSet===f?'':` F${f}`;feedSet=f;return s};
 const G1=(x,y,z,f)=>{const [X,Y]=tx([x,y]);L.push(`G1 X${fmt(X)} Y${fmt(Y)} Z${fmt(z)}${F(f)}`)};
 const plunge=z=>L.push(`G1 Z${fmt(z)}${F(prof.plungeFeed)}`);
 const travel=([x,y])=>{const [X,Y]=tx([x,y]);L.push(`G0 Z${fmt(safe)}`,`G0 X${fmt(X)} Y${fmt(Y)}`,`G0 Z${fmt(near)}`);feedSet=null};
 const passes=total=>{const n=Math.max(1,Math.ceil(total/prof.stepDown-1e-9));return Array.from({length:n},(_,i)=>total*(i+1)/n)};
 for(const op of ops){
  if(op.type==='groove'){
   c(`groove ${op.id} depth ${op.depth}`);
   for(const [a,b] of op.lines){travel(a);for(const dep of passes(op.depth)){plunge(top-dep);G1(...b,top-dep,prof.feed);G1(...a,top-dep,prof.feed)}}
   continue;
  }
  c(`profile ${op.id} ${fmt(op.rect[2])} x ${fmt(op.rect[3])}`);
  travel(op.loop[0]);
  const total=t+prof.overcut,tabZ=top-(t-prof.tabHeight);
  for(const dep of passes(total)){
   const z=top-dep;plunge(z);
   for(let i=0;i<4;i++){
    const [ax,ay]=op.loop[i],[bx,by]=op.loop[i+1];
    if(op.tabs.includes(i)&&z<tabZ){
     const len=Math.hypot(bx-ax,by-ay),ux=(bx-ax)/len,uy=(by-ay)/len,half=(prof.tabWidth+prof.toolDiameter)/2;
     const s=len/2-half,e=len/2+half;
     G1(ax+ux*s,ay+uy*s,z,prof.feed);plunge(tabZ);G1(ax+ux*e,ay+uy*e,tabZ,prof.feed);plunge(z);
    }
    G1(bx,by,z,prof.feed);
   }
  }
 }
 L.push(`G0 Z${fmt(safe)}`,'G0 X0 Y0');
 for(const line of (prof.footer||d.footer).split(/\r?\n/).map(s=>s.trim()).filter(Boolean))L.push(line);
 return {text:L.join('\r\n')+'\r\n',warnings,extension:d.ext};
}

/**
 * Reads G-code back (G0/G1 linear moves only) and checks it: travel limits, no rapid move below the board top,
 * no cut deeper than the overcut. Returns totals and an estimated machining time (straight-line, no acceleration).
 */
export function checkGcode(text,{xMax,yMax,top,bottom,rapid=10000}){
 const errors=[];let x=0,y=0,z=null,mode=0,feed=0,cut=0,air=0,minutes=0;
 const box={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity};
 text.split(/\r?\n/).forEach((raw,n)=>{
  const line=raw.replace(/\(.*?\)/g,'').replace(/;.*$/,'').trim().toUpperCase();if(!line)return;
  const words=Object.fromEntries([...line.matchAll(/([A-Z])\s*(-?\d*\.?\d+)/g)].map(m=>[m[1],Number(m[2])]));
  if(/\bG0?2\b|\bG0?3\b/.test(line))errors.push(`line ${n+1}: arcs are not expected`);
  if(/\bG0?0\b/.test(line))mode=0;else if(/\bG0?1\b/.test(line))mode=1;
  if(words.F!==undefined)feed=words.F;
  if(words.X===undefined&&words.Y===undefined&&words.Z===undefined)return;
  const nx=words.X??x,ny=words.Y??y,nz=words.Z??z;
  if(nz===null){errors.push(`line ${n+1}: XY move before any Z height`);return}
  const len=Math.hypot(nx-x,ny-y,nz-(z??nz));
  if(mode===0){if(Math.min(nz,z??nz)<top-1e-6&&(nx!==x||ny!==y))errors.push(`line ${n+1}: rapid move below the board top`);air+=len;minutes+=len/rapid}
  else{if(!feed)errors.push(`line ${n+1}: cutting move without a feed rate`);else minutes+=len/feed;cut+=len}
  if(nz<bottom-1e-6)errors.push(`line ${n+1}: Z ${nz} is below the allowed depth ${bottom}`);
  if(nx<-1e-6||ny<-1e-6||nx>xMax+1e-6||ny>yMax+1e-6)errors.push(`line ${n+1}: X${nx} Y${ny} is outside the sheet`);
  x=nx;y=ny;z=nz;
  box.minX=Math.min(box.minX,x);box.maxX=Math.max(box.maxX,x);box.minY=Math.min(box.minY,y);box.maxY=Math.max(box.maxY,y);box.minZ=Math.min(box.minZ,z);box.maxZ=Math.max(box.maxZ,z);
 });
 return {errors:errors.slice(0,50),errorCount:errors.length,box,cutMm:Math.round(cut),airMm:Math.round(air),minutes:Math.round(minutes*10)/10};
}

/** Machine-space limits for checkGcode on a sheet with the given profile. */
export function sheetLimits(sheet,input={}){
 const prof=cncProfile(input),t=thicknessOf(sheet),top=prof.zZero==='top'?0:t;
 const [xMax,yMax]=prof.orientation==='rotate90'?[sheet.height,sheet.width]:[sheet.width,sheet.height];
 return {xMax,yMax,top,bottom:top-t-prof.overcut};
}

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
/** SVG preview of the toolpaths for one sheet (sheet coordinates, Y up so the origin sits bottom-left). */
export function toolpathSvg(sheet,input={},{index=1}={}){
 const prof=cncProfile(input),{ops,warnings}=sheetToolpaths(sheet,prof),W=sheet.width,H=sheet.height,pad=60;
 const Y=y=>H-y;
 const parts=sheet.placed.map(p=>`<rect x="${p.x}" y="${Y(p.y+p.h)}" width="${p.w}" height="${p.h}" fill="#e3efe9" stroke="#3e716c" stroke-width="2"/><text x="${p.x+8}" y="${Y(p.y+p.h)+30}" font-size="24" fill="#174b48">${esc(p.id)}</text>`).join('');
 let order=0;
 const paths=ops.map(o=>{
  if(o.type==='groove')return o.lines.map(([a,b])=>`<line x1="${a[0]}" y1="${Y(a[1])}" x2="${b[0]}" y2="${Y(b[1])}" stroke="#b45309" stroke-width="${prof.toolDiameter}" stroke-opacity=".55"/>`).join('');
  order++;const pts=o.loop.map(([x,y])=>`${x},${Y(y)}`).join(' ');
  const tabs=o.tabs.map(i=>{const [a,b]=[o.loop[i],o.loop[i+1]];return `<circle cx="${(a[0]+b[0])/2}" cy="${Y((a[1]+b[1])/2)}" r="${prof.tabWidth/2+4}" fill="#dc2626"/>`}).join('');
  return `<polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="2"/><circle cx="${o.loop[0][0]}" cy="${Y(o.loop[0][1])}" r="9" fill="#2563eb"/><text x="${o.loop[0][0]+12}" y="${Y(o.loop[0][1])-10}" font-size="22" fill="#1e3a8a">${order}</text>${tabs}`;
 }).join('');
 const origin=`<g stroke="#111" stroke-width="4"><line x1="0" y1="${H}" x2="160" y2="${H}"/><line x1="0" y1="${H}" x2="0" y2="${H-160}"/></g><text x="170" y="${H+8}" font-size="26">X</text><text x="-10" y="${H-175}" font-size="26">Y</text><circle cx="0" cy="${H}" r="10" fill="#111"/>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad-70} ${W+2*pad} ${H+2*pad+110}"><rect x="${-pad}" y="${-pad-70}" width="${W+2*pad}" height="${H+2*pad+110}" fill="#fff"/><text x="0" y="${-pad-25}" font-size="30" font-family="Arial" fill="#a33223">Sheet ${index} · toolpath preview · UNVERIFIED — dry run first</text><text x="0" y="${-pad+10}" font-size="22" font-family="Arial">${esc(sheet.group.split('|')[0])} · ${W} × ${H} · tool Ø${prof.toolDiameter} · ${ops.filter(o=>o.type==='profile').length} parts${warnings.length?` · ${warnings.length} warning(s)`:''}</text><rect width="${W}" height="${H}" fill="#f7f5ef" stroke="#394e5a" stroke-width="3"/>${parts}${paths}${origin}<text x="0" y="${H+pad+30}" font-size="20" font-family="Arial">Blue = outside profile (number = cutting order, dot = start) · red = tab · orange = groove · origin = front-left (X0 Y0)${prof.orientation==='rotate90'?' before the 90° turn':''}</text></svg>`;
}
