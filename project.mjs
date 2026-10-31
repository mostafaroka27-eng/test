import {validateViews} from './render-export.mjs';
import {isFinish} from './reference-catalog.mjs';
/** Project-file boundary and local edit history. Dimensions are millimetres. */
import {DEFAULTS,cabinet,validate} from './engine.mjs';
import {DEFAULT_ROOM,validateRoom,normalRoom} from './room.mjs';
import {validateCosting} from './costing.mjs';
import {validateMaterials,MATERIAL_LINKS} from './materials.mjs';
import {normalLayout,isDefaultLayout,validateDrawingImages} from './shop-drawing.mjs';

export const MAX_PROJECT_BYTES=5*1024*1024;
export const BACKUP_KEY='rokadex-standalone.autosave.v2';
export const PROJECT_VERSION=3;
// FNV-1a: a reopened legacy file always receives the same project ID until it is saved as v3.
const stableId=source=>{let h=0x811c9dc5;for(const byte of new TextEncoder().encode(source)){h^=byte;h=Math.imul(h,0x01000193)>>>0}return 'PRJ-'+h.toString(16).toUpperCase().padStart(8,'0')};
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value,name,max=200)=>{
 if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw Error(`Invalid ${name}`);
 return value;
};
const bounded=(value,name,max)=>{
 if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>max)throw Error(`Invalid ${name}; maximum ${max} mm`);
 return value;
};

export function parseProject(input){
 const source=typeof input==='string'?input:JSON.stringify(input);
 if(typeof source!=='string')throw Error('Unsupported project file');
 if(new TextEncoder().encode(source).byteLength>MAX_PROJECT_BYTES)throw Error('Project exceeds 5 MB');
 const data=JSON.parse(source);
 if(!isRecord(data)||data.format!=='rokadex-standalone'||![1,2,3].includes(data.version))throw Error('Unsupported project file');
 if(data.version===3&&(typeof data.projectId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(data.projectId)))throw Error('Invalid project ID');
 if(data.version===3&&(!Number.isInteger(data.designRevision)||data.designRevision<1||data.designRevision>9999))throw Error('Invalid design revision');
 if(!Array.isArray(data.units)||data.units.length<1||data.units.length>100)throw Error('Project must have 1–100 units');
 const room=data.version===1?{...DEFAULT_ROOM}:data.room;
 validateRoom(room);
 const materials=Object.hasOwn(data,'materials')?validateMaterials(data.materials):[];
 const materialIds=new Set(materials.map(m=>m.id));
 const ids=new Set();let totalParts=0;
 const units=data.units.map(unit=>{
  if(!isRecord(unit)||typeof unit.id!=='string'||! /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(unit.id)||ids.has(unit.id))throw Error('Invalid or duplicate component ID');
  ids.add(unit.id);
  const name=text(unit.name,'component name');
  const type=unit.type===undefined?'cabinet':text(unit.type,'component type',64);
  const x=bounded(unit.x,'X position',100000),z=bounded(unit.z,'Z position',100000);
  if(!isFinish(unit.finish))throw Error('Invalid component finish');
  if(!isRecord(unit.config))throw Error('Invalid component configuration');
  // Only supported settings enter the model; inherited/prototype fields are discarded.
  const config={...DEFAULTS};
  for(const key of Object.keys(DEFAULTS))if(Object.hasOwn(unit.config,key))config[key]=unit.config[key];
  for(const [key,value] of Object.entries(config)){
   if(typeof DEFAULTS[key]==='number')bounded(value,key,10000);
   else text(value,key);
  }
  for(const key of ['bayShelfLevels','bayRails'])if(Object.hasOwn(unit.config,key)){
   if(!Array.isArray(unit.config[key]))throw Error(`Invalid ${key}`);
   config[key]=unit.config[key].map(v=>Array.isArray(v)?[...v]:v);
  }
  if(Object.hasOwn(unit.config,'lightPositions')){
   if(!Array.isArray(unit.config.lightPositions))throw Error('Invalid lightPositions');
   config.lightPositions=[...unit.config.lightPositions];
  }
  if(Object.hasOwn(unit.config,'bayAccessories')){
   if(!Array.isArray(unit.config.bayAccessories)||unit.config.bayAccessories.some(list=>!Array.isArray(list)))throw Error('Invalid bayAccessories');
   config.bayAccessories=unit.config.bayAccessories.map(list=>list.map(item=>{if(!isRecord(item))throw Error('Invalid accessory');return {type:item.type,...(item.level!==undefined?{level:item.level}:{})}}));
  }
  for(const key of ['bayShelves','bayDrawers'])if(Object.hasOwn(unit.config,key)){
   if(!Array.isArray(unit.config[key]))throw Error(`Invalid ${key}`);
   config[key]=[...unit.config[key]];
  }
  if(Object.hasOwn(unit.config,'partOverrides')){
   if(!isRecord(unit.config.partOverrides))throw Error('Invalid part overrides');
   config.partOverrides={};
   for(const [key,value] of Object.entries(unit.config.partOverrides)){
    if(!/^[a-zA-Z]+:\d+$/.test(key)||!isRecord(value)||!Array.isArray(value.edges))throw Error('Invalid edge override');
    config.partOverrides[key]={edges:[...value.edges]};
   }
  }
  validate(config);
  // Topology inputs are bounded (30 bays/shelves, 12 drawers), so generating before counting is safe.
  const model=cabinet(config,unit.id);
  const partCount=model.parts.length;
  totalParts+=partCount;
  if(partCount>2000||totalParts>5000)throw Error('Project exceeds preview limits: 2000 parts per unit / 5000 parts per project');
  if(model.parts.some(part=>![part.length,part.width,part.thickness].every(n=>Number.isFinite(n)&&n>0&&n<=10000)))throw Error('Invalid generated panel dimensions');
  if(Object.hasOwn(unit,'rotation')&&![0,90,180,270].includes(unit.rotation))throw Error('Invalid component rotation');
  const extra={};
  // Mounting height for wall units; absent means standing on the floor.
  if(Object.hasOwn(unit,'elevation')&&unit.elevation!==0){bounded(unit.elevation,'mounting height',5000);if(unit.elevation<0)throw Error('Invalid mounting height');extra.elevation=unit.elevation}
  if(Object.hasOwn(unit,'drawingImages')){const images=validateDrawingImages(unit.drawingImages);if(images.length)extra.drawingImages=images}
  for(const key of MATERIAL_LINKS)if(Object.hasOwn(unit,key)&&unit[key]!==''){if(!materialIds.has(unit[key]))throw Error(`Unknown material ${String(unit[key]).slice(0,40)}`);extra[key]=unit[key]}
  return {id:unit.id,name,type,x,z,finish:unit.finish,config,...(Object.hasOwn(unit,'rotation')?{rotation:unit.rotation}:{}),...extra};
 });
 // v1/v2 files are migrated explicitly: geometry fields they lack keep legacy defaults, never modern rules.
 const project={format:'rokadex-standalone',version:PROJECT_VERSION,projectId:data.version===3?data.projectId:stableId(source),designRevision:data.version===3?data.designRevision:1,lengthUnit:'mm',room:normalRoom(room),units};
 if(materials.length)project.materials=materials;
 if(data.version<3)project.migratedFrom=data.version;
 else if(Object.hasOwn(data,'migratedFrom')&&[1,2].includes(data.migratedFrom))project.migratedFrom=data.migratedFrom;
 // Optional presentation identity (v3): free text shown on drawings and client presentations, never used by geometry.
 for(const key of ['projectName','clientName'])if(Object.hasOwn(data,key)&&data[key]!==''){project[key]=text(data[key],key==='projectName'?'project name':'client name',120)}
 if(Object.hasOwn(data,'costing'))project.costing=validateCosting(data.costing);
 // Optional shop-drawing layout; the default layout is not written.
 if(Object.hasOwn(data,'drawingLayout')){const layout=normalLayout(data.drawingLayout);if(!isDefaultLayout(layout))project.drawingLayout=layout}
 // Optional saved camera views for presentations; never used by geometry or outputs.
 if(Object.hasOwn(data,'views')){const views=validateViews(data.views);if(views.length)project.views=views}
 return project;
}

export function serializeProject(project){return JSON.stringify(parseProject(project),null,2);}

export function createHistory(initial,{limit=50}={}){
 if(!Number.isInteger(limit)||limit<1||limit>200)throw Error('History limit must be 1–200 snapshots');
 let states=[serializeProject(initial)],index=0;
 const current=()=>JSON.parse(states[index]);
 return {
  current,
  get canUndo(){return index>0;},
  get canRedo(){return index<states.length-1;},
  push(project){
   const next=serializeProject(project);
   if(next===states[index])return false;
   states=states.slice(0,index+1);states.push(next);
   if(states.length>limit)states.shift();
   index=states.length-1;return true;
  },
  undo(){if(index===0)return null;index--;return current();},
  redo(){if(index===states.length-1)return null;index++;return current();}
 };
}

export function saveBackup(storage,project,key=BACKUP_KEY){storage.setItem(key,serializeProject(project));}
export function loadBackup(storage,key=BACKUP_KEY){const saved=storage.getItem(key);return saved===null?null:parseProject(saved);}
