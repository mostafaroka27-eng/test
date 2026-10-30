import {partSize} from './geometry.mjs';
/** Model-derived rectangular elevations; conceptual review only, never shop approval. */
import {cabinet} from './engine.mjs';

const xml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
function dimensions(part){const [x,y,z]=partSize(part);return {x,y,z}}

export function cabinetDrawingSvg(unit){
 if(!unit||typeof unit.id!=='string'||!unit.id||typeof unit.name!=='string'||!unit.config)throw Error('A cabinet with ID, name and configuration is required');
 const model=cabinet(unit.config,unit.id),{width:W,height:H,depth:D}=model.dimensions;
 const scale=Math.min(380/W,390/H,250/D);
 const panels=model.parts.map(part=>{
  const size=dimensions(part),position=part.position;
  if(!position||![...Object.values(size),position.x,position.y,position.z].every(Number.isFinite))throw Error('Invalid drawing panel coordinates');
  return {part,size,position};
 });
 // Back panels go behind the contents. Transparent fronts expose the internal layout.
 const ordered=[...panels.filter(p=>p.part.kind==='back'),...panels.filter(p=>!['back','door','drawerFront'].includes(p.part.kind)),...panels.filter(p=>['door','drawerFront'].includes(p.part.kind))];
 const elevation=view=>ordered.map(({part,size,position})=>{
  const front=view==='front',x=front?position.x-size.x/2:position.z+D/2-size.z/2,y=H-position.y-size.y/2;
  const w=front?size.x:size.z,h=size.y;
  const face=['door','drawerFront'].includes(part.kind),back=part.kind==='back';
  return `<rect data-part="${xml(part.id)}" data-kind="${xml(part.kind)}" data-bay="${part.bay??''}" x="${x}" y="${y}" width="${w}" height="${h}" fill="${back?'#eef2f3':face?'#9ebbad':'#d3b995'}" fill-opacity="${back?0.4:face?0.16:0.24}" stroke="${face?'#397261':'#264858'}" stroke-width="1.2" vector-effect="non-scaling-stroke"${face?' stroke-dasharray="5 3"':''}><title>${xml(part.id)} · ${xml(part.kind)} · ${xml(part.material)} · ${part.length} × ${part.width} × ${part.thickness} mm</title></rect>`;
 }).join('');
 const frontX=180,sideX=700,top=130,sw=W*scale,sh=H*scale,sd=D*scale;
 const dimension=(x1,y1,x2,y2,label,tx,ty)=>`<path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="#456272" stroke-width="1"/><text x="${tx}" y="${ty}" text-anchor="middle" font-size="15">${xml(label)}</text>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="760" viewBox="0 0 1100 760" role="img" aria-labelledby="drawing-title drawing-description"><title id="drawing-title">${xml(unit.name)} — front and side elevations</title><desc id="drawing-description">Model-derived cabinet panel silhouettes. Dimensions in millimetres. Transparent doors and drawer fronts show internal panels. Preliminary drawing, not for fabrication or CNC.</desc><rect width="1100" height="760" fill="#fff"/><g font-family="Arial,sans-serif" fill="#203e50"><text x="55" y="42" font-size="25" font-weight="bold">ROKADEX · GENERAL ARRANGEMENT</text><text x="55" y="69" font-size="16">${xml(unit.id)} — ${xml(unit.name.slice(0,100))}</text><text x="55" y="91" font-size="12">PRELIMINARY · NOT FOR FABRICATION OR CNC</text><text x="${frontX}" y="116" font-size="15" font-weight="bold">FRONT ELEVATION</text><text x="${sideX}" y="116" font-size="15" font-weight="bold">SIDE ELEVATION</text><g data-view="front" transform="translate(${frontX+sw/2} ${top}) scale(${scale})">${elevation('front')}</g><g data-view="side" transform="translate(${sideX} ${top}) scale(${scale})">${elevation('side')}</g>${dimension(frontX,top+sh+25,frontX+sw,top+sh+25,`${W} mm`,frontX+sw/2,top+sh+48)}${dimension(sideX,top+sh+25,sideX+sd,top+sh+25,`${D} mm`,sideX+sd/2,top+sh+48)}${dimension(frontX-25,top,frontX-25,top+sh,`${H} mm`,frontX-70,top+sh/2)}<text x="55" y="615" font-size="13">Material: ${xml(unit.config.material.slice(0,100))}</text><text x="55" y="637" font-size="12">${model.parts.length} panels · Rectangular projections · Transparent fronts expose internal panels</text><path d="M 55 658 H 1045" stroke="#b9c9d0"/><text x="55" y="683" font-size="13">DRAWING GA-001 · REV 0 · UNIT mm · SCALE: FIT TO PAGE, DO NOT MEASURE FROM PRINT</text><text x="55" y="708" font-size="12" fill="#a24c2c">VERIFY DIMENSIONS, JOINERY, HARDWARE AND MACHINING WITH A QUALIFIED ENGINEER.</text><text x="55" y="729" font-size="12" fill="#a24c2c">Preliminary silhouettes do not define drilling, tolerances, sections, assembly sequence or manufacturing approval.</text></g></svg>`;
}
