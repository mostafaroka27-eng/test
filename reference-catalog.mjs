import {DEFAULTS,MODERN_RULES,cabinet} from './engine.mjs';
import {referenceRoomPresets} from './reference-data.mjs';

/**
 * Builds usable library content from the extracted reference JSON (analysis/*.json):
 * cabinet templates, finish colours and room templates. Values copied from a source are
 * listed per template in `fromSource`; interior fills that the sources do not define are
 * RokaDex starting values listed in `rokadexDefaults`. Prices are never read here.
 */
export const LEGACY_FINISHES=Object.freeze({oak:'#c7a47b',walnut:'#77513a',white:'#eceae4',charcoal:'#444f59'});
const HEX=/^#[0-9a-f]{6}$/i;
export const isFinish=value=>Object.hasOwn(LEGACY_FINISHES,value)||(typeof value==='string'&&HEX.test(value));
export const finishColor=value=>LEGACY_FINISHES[value]||(typeof value==='string'&&HEX.test(value)?value:LEGACY_FINISHES.oak);

const declarations=ncd=>{
 if(!Array.isArray(ncd?.declarations))throw Error('NCD reference declarations missing');
 return Object.fromEntries(ncd.declarations.map(entry=>[entry.name,entry.data]));
};
const num=(value,name)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error(`NCD reference ${name} missing`);return value};

/** Column types whose interior the current engine can represent (one rail per bay). */
const FILLS={
 hang:{shelfLevels:[1900],rail:1840},
 shelves:{shelves:5},
 drawHang:{drawers:3,shelfLevels:[1900],rail:1840},
 drawShelf:{drawers:3,shelves:3},
};
const UNSUPPORTED={hang2:'Double hanging needs two rails in one bay; the engine supports one rail per bay.'};
const EN={hang:'Long hanging',shelves:'Shelves',drawHang:'Drawers + hanging',drawShelf:'Drawers + shelves',combo:'Hanging + shelves (2 bays)',open:'Open shelves',glass:'Glass-door display',hang2:'Double hanging'};

/** NCD wardrobe column templates (CAT) as RokaDex unit configurations. */
export function ncdTemplates(ncd){
 const g=declarations(ncd),cat=g.CAT,def=g.defaults,std=g.DEF_STD,preset=g.PRESETS;
 if(!Array.isArray(cat)||!def||!std)throw Error('NCD template tables missing');
 const height=num(def.H,'H'),depth=num(def.D,'D'),t=num(def.t,'t'),plinth=num(def.plinth,'plinth');
 const [sheetL,sheetW]=String(def.sheet).split('x').map(Number);
 const base={...DEFAULTS,...MODERN_RULES,height,depth,thickness:t,plinthHeight:plinth,
  backConstruction:def.back==='nail'?'overlay':MODERN_RULES.backConstruction,backThickness:num(def.backT,'backT'),
  shelfMode:def.shelfType==='adj'?'adjustable':'fixed',shelfFrontSetback:num(def.setback,'setback'),doorGap:num(def.gap,'gap'),
  edgeThickness:num(def.cBand,'cBand'),doorEdgeThickness:num(def.dBand,'dBand'),drawerFrontHeight:num(def.drH,'drH'),
  kerf:num(def.kerf,'kerf'),sheetHeight:sheetL,sheetWidth:sheetW,edgeDeduction:def.deduct?'on':'off',bayMode:def.mode==='boxes'?'separate':'shared'};
 const column=Math.max(...std.W.filter(w=>w<=600));
 const finish=preset?.[def.bodyPreset]?.c;
 const templates=[],skipped=[];
 for(const item of cat){
  const blocked=item.cols.find(col=>!FILLS[col]);
  if(blocked){skipped.push({key:item.k,name:item.n,nameEn:EN[item.k]||item.k,reason:UNSUPPORTED[blocked]||`Column type ${blocked} has no RokaDex mapping`});continue}
  const bays=item.cols.length,width=Math.max(column*bays,item.minW||0),doors=item.doors?bays:0,fills=item.cols.map(col=>FILLS[col]);
  const config={...base,width,partitions:bays-1,doors,doorType:item.glass?'glass':'panel',
   // Full-height doors cover the drawers, so drawers behind doors are internal.
   drawerStyle:doors?'internal':'external',shelves:0};
  if(fills.some(f=>f.drawers))config.bayDrawers=fills.map(f=>f.drawers||0);
  config.bayShelves=fills.map(f=>f.shelfLevels?f.shelfLevels.length:f.shelves||0);
  if(fills.some(f=>f.shelfLevels))config.bayShelfLevels=fills.map(f=>f.shelfLevels?[...f.shelfLevels]:null);
  if(fills.some(f=>f.rail))config.bayRails=fills.map(f=>f.rail||0);
  templates.push({id:`ncd-${item.k}`,key:item.k,name:item.n,nameEn:EN[item.k]||item.k,finish:HEX.test(finish||'')?finish.toLowerCase():'oak',config,
   fromSource:['CAT.cols','CAT.doors',...(item.glass?['CAT.glass']:[]),...(item.minW?['CAT.minW']:[]),'defaults.H/D/t/plinth/back/backT/shelfType/setback/gap/cBand/dBand/drH/kerf/sheet/deduct/mode','DEF_STD.W'],
   rokadexDefaults:['shelf levels','rail height','drawer count','internal drawers behind doors']});
 }
 for(const template of templates)cabinet(template.config,template.id);
 return {templates,skipped};
}

/** Finish colours from NCD (PRESETS, COLORS) and the room planner (COLORS), de-duplicated by colour. */
export function referenceFinishes(ncd,planner){
 const g=declarations(ncd),groups=[],seen=new Set(Object.values(LEGACY_FINISHES).map(c=>c.toLowerCase()));
 const take=(label,entries)=>{const list=[];for(const [name,color,wood] of entries){if(!HEX.test(color||'')||typeof name!=='string')continue;const key=color.toLowerCase();if(seen.has(key))continue;seen.add(key);list.push({name,color:key,wood:Boolean(wood)})}if(list.length)groups.push({label,finishes:list})};
 take('NCD finishes',Object.entries(g.PRESETS||{}).filter(([key])=>key!=='custom').map(([,v])=>[v.n,v.c,v.wood]));
 take('NCD colours',(g.COLORS||[]).map(v=>[v.n,v.c,v.wood]));
 take('Room planner colours',(planner?.tables?.COLORS?.value||[]).map(([color,name])=>[name,color]));
 return groups;
}

/** Everything the app derives from the references, built once at start-up. */
export function referenceCatalog({ncd,planner}){
 return {...ncdTemplates(ncd),finishes:referenceFinishes(ncd,planner),rooms:referenceRoomPresets(planner)};
}
