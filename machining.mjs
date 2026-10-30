// Machine-independent drilling reference; coordinates in mm relative to panel's lower-left corner.
// This is NOT an approved machining program or an automatic joint design.
const finite=(value,name,min)=>{if(!Number.isFinite(value)||value<min)throw Error(`${name} must be >= ${min}`);return value};
export function drillingPreview(panel,settings={}){
 const {pitch=32,offset=37,margin=64,diameter=5,depth=10}=settings;
 for(const [name,value,min] of [['pitch',pitch,1],['offset',offset,0],['margin',margin,0],['diameter',diameter,0.1],['depth',depth,0.1]])finite(value,name,min);
 for(const key of ['length','width','thickness'])finite(panel[key],key,0.1);
 if(depth>=panel.thickness)throw Error('Drilling depth must be less than panel thickness');
 if(diameter>panel.width||diameter>panel.length)throw Error('Drilling diameter exceeds panel dimensions');
 const holes=[];
 if(offset+diameter/2<=panel.width && margin+diameter/2<=panel.length/2){
  const ys=[offset,panel.width-offset].filter((v,i,a)=>v-diameter/2>=0&&v+diameter/2<=panel.width&&a.findIndex(q=>Math.abs(q-v)<diameter)===i);
  const start=margin+diameter/2,end=panel.length-margin-diameter/2;
  for(let x=start;x<=end+1e-8;x+=pitch){for(const y of ys)holes.push({x:Math.round(x*100)/100,y:Math.round(y*100)/100,diameter,depth})}
 }
 return {panel:{id:panel.id,kind:panel.kind,length:panel.length,width:panel.width,thickness:panel.thickness},settings:{pitch,offset,margin,diameter,depth},holes,status:'REFERENCE ONLY — NOT CNC READY',notes:['Reference 32 mm system grid, not a verified hinge/connector pattern','Confirm datum, face, edge, grain, bit, hold-down, and hardware specifications before drilling']};
}
const csvCell=value=>{let text=String(value??'');if(typeof value==='string'&&/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'};
export function drillingCsv(result){return ['# REFERENCE ONLY - NOT CNC READY','part_id,x_mm,y_mm,diameter_mm,depth_mm',...result.holes.map(h=>[result.panel.id,h.x,h.y,h.diameter,h.depth].map(csvCell).join(','))].join('\n')}
const escapeXml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function drillingSvg(result){const {length,width,id}=result.panel;const circles=result.holes.map(h=>`<circle cx="${h.x}" cy="${width-h.y}" r="${h.diameter/2}" fill="none" stroke="#eab308" stroke-width="1"/>`).join('');return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -60 ${length+60} ${width+90}" width="1200"><rect width="${length}" height="${width}" fill="#f4eee2" stroke="#18212b" stroke-width="2"/>${circles}<text x="0" y="-20" font-size="18">${escapeXml(id)} — DRILLING REFERENCE ONLY</text><text x="0" y="${width+25}" font-size="15">NOT FOR CNC / VERIFY MANUFACTURER HARDWARE AND DATUM</text></svg>`}
