/**
 * Project material library: workshop-entered boards, fronts, worktops and glass with their
 * specification, stock size, thickness and an optional photo used as the 3D texture.
 * Values are whatever the workshop types in; nothing here is supplier-verified.
 */
export const MATERIAL_CATEGORIES=Object.freeze(['board','front','worktop','glass','other']);
export const MAX_MATERIALS=60;
export const MAX_TEXTURE_BYTES=350*1024;
const TEXTURE=/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const HEX=/^#[0-9a-fA-F]{6}$/;
const textBytes=url=>{const payload=url.slice(url.indexOf(',')+1);return Math.floor(payload.length*3/4)-(payload.endsWith('==')?2:payload.endsWith('=')?1:0)};
const str=(value,name,max,required=true)=>{
 if(value===undefined||value===null||value==='')if(required)throw Error(`Material ${name} is required`);else return '';
 if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f<>]/.test(value))throw Error(`Invalid material ${name}`);
 const text=value.trim();if(required&&!text)throw Error(`Material ${name} is required`);return text;
};
const num=(value,name,min,max)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(`Material ${name} must be ${min}–${max}`);return value};

export function validateMaterial(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid material');
 if(typeof input.id!=='string'||!/^MAT-[A-Z0-9]{1,16}$/.test(input.id))throw Error('Invalid material ID');
 const category=input.category??'board';if(!MATERIAL_CATEGORIES.includes(category))throw Error('Invalid material category');
 const out={id:input.id,name:str(input.name,'name',120),category,spec:str(input.spec,'specification',240,false),
  thickness:num(input.thickness,'thickness',0.1,200),
  sheetLength:input.sheetLength==null?null:num(input.sheetLength,'sheet length',100,10000),
  sheetWidth:input.sheetWidth==null?null:num(input.sheetWidth,'sheet width',100,10000),
  color:input.color??'#c7a47b',grain:input.grain??'vertical',textureSize:input.textureSize??1000,texture:input.texture??''};
 if(!HEX.test(out.color))throw Error('Material colour must be #rrggbb');out.color=out.color.toLowerCase();
 if(!['vertical','horizontal','none'].includes(out.grain))throw Error('Invalid material grain');
 num(out.textureSize,'photo size',50,5000);
 if(out.texture){if(typeof out.texture!=='string'||!TEXTURE.test(out.texture))throw Error('Material photo must be PNG, JPEG or WebP');if(textBytes(out.texture)>MAX_TEXTURE_BYTES)throw Error(`Material photo must be at most ${MAX_TEXTURE_BYTES/1024} KB`)}
 if((out.sheetLength===null)!==(out.sheetWidth===null))throw Error('Enter both sheet length and width, or neither');
 return out;
}
export function validateMaterials(list){
 if(!Array.isArray(list)||list.length>MAX_MATERIALS)throw Error(`Material library takes at most ${MAX_MATERIALS} materials`);
 const ids=new Set();
 return list.map(item=>{const m=validateMaterial(item);if(ids.has(m.id))throw Error('Duplicate material ID');ids.add(m.id);return m});
}
export const newMaterialId=existing=>{let n=1;while(existing.some(m=>m.id===`MAT-${n}`))n++;return `MAT-${n}`};
/** Name that appears in cut lists: name plus thickness, so stock groups stay distinct. */
export const stockName=m=>`${m.name} ${m.thickness} mm`;

/** Applies a library material to one unit. Targets change the cut-list material and the 3D surface. */
export function applyMaterial(unit,material,target){
 const m=validateMaterial(material),config={...unit.config},next={...unit,config};
 if(target==='carcass'){
  config.material=stockName(m);config.thickness=m.thickness;
  if(m.sheetLength){config.sheetHeight=m.sheetLength;config.sheetWidth=m.sheetWidth}
  config.grain=m.grain;next.materialId=m.id;
 }else if(target==='fronts'){
  config.doorMaterial=stockName(m);config.doorThickness=m.thickness;next.frontMaterialId=m.id;
 }else if(target==='worktop'){
  config.worktopMaterial=stockName(m);config.worktopThickness=m.thickness;next.worktopMaterialId=m.id;
 }else if(target==='glass'){
  config.glassMaterial=stockName(m);config.glassThickness=m.thickness;config.glassColor=m.color;next.glassMaterialId=m.id;
 }else throw Error('Unknown material target');
 return next;
}
export const MATERIAL_LINKS=Object.freeze(['materialId','frontMaterialId','worktopMaterialId','glassMaterialId']);
