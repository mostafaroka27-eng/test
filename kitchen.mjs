/**
 * Kitchen unit templates. Heights: 720 mm carcass on a 150 mm plinth, 38 mm worktop, wall units
 * hung at 1450 mm. These are RokaDex starting values to edit per job, not a kitchen standard.
 */
import {DEFAULTS,MODERN_RULES,cabinet} from './engine.mjs';

const BASE={height:870,depth:560,plinthHeight:150,plinthSetback:50,partitions:0,worktopThickness:38,worktopOverhang:20,worktopMaterial:'Worktop 38 mm'};
const WALL={height:720,depth:320,plinthHeight:0,partitions:0};
const TALL={height:2170,depth:560,plinthHeight:150,plinthSetback:50,partitions:0};
const T=(id,en,ar,group,config,{elevation=0,accessories}={})=>({id,en,ar,group,elevation,config:{...config,...(accessories?{bayAccessories:accessories}:{})}});

export const KITCHEN_TEMPLATES=Object.freeze([
 T('base600','Base unit 600','وحدة أرضية 600','base',{...BASE,width:600,doors:1,shelves:1}),
 T('base600drawers','Drawer base 600','وحدة أدراج 600','base',{...BASE,width:600,doors:0,shelves:0,bayDrawers:[3],drawerStyle:'external',drawerFrontHeight:224},{accessories:[[{type:'cutleryTray'}]]}),
 T('sink800','Sink base 800','وحدة حوض 800','base',{...BASE,width:800,doors:2,shelves:0},{accessories:[[{type:'sink'},{type:'wasteBin'}]]}),
 T('hob600','Hob base 600 with drawers','وحدة بوتاجاز 600 بأدراج','base',{...BASE,width:600,doors:0,shelves:0,bayDrawers:[3],drawerStyle:'external',drawerFrontHeight:224},{accessories:[[{type:'hob'},{type:'plateRack'}]]}),
 T('bottle300','Bottle base 300','وحدة زجاجات 300','base',{...BASE,width:300,doors:1,shelves:0},{accessories:[[{type:'bottlePullout'}]]}),
 T('corner900','Base 900 with corner carousel','وحدة ركنة 900 بدوّار','base',{...BASE,width:900,doors:1,shelves:0},{accessories:[[{type:'cornerCarousel'}]]}),
 T('wall600','Wall unit 600','وحدة علوية 600','wall',{...WALL,width:600,doors:1,shelves:2},{elevation:1450}),
 T('wall800dish','Wall unit 800 with dish rack','وحدة علوية 800 بمصفاة','wall',{...WALL,width:800,doors:2,shelves:0},{elevation:1450,accessories:[[{type:'dishRack'}]]}),
 T('tall600','Tall larder 600','دولاب طويل (مخزن) 600','tall',{...TALL,width:600,doors:1,shelves:5}),
 T('tall300cargo','Tall cargo 300','كارجو طويل 300','tall',{...TALL,width:300,doors:1,shelves:0},{accessories:[[{type:'cargoPullout'}]]}),
 T('tallOven600','Tall oven housing 600 (open niches)','وحدة فرن طويلة 600 (فتحات مفتوحة)','tall',{...TALL,width:600,doors:0,bayDrawers:[2],drawerStyle:'external',drawerFrontHeight:280,shelves:2,bayShelves:[2],bayShelfLevels:[[1205,1623]]}),
]);

/** Full unit record for a template, with the cab-2.0 rules every new unit uses. */
export function kitchenUnit(templateId,id){
 const template=KITCHEN_TEMPLATES.find(t=>t.id===templateId);
 if(!template)throw Error('Unknown kitchen template');
 const config={...DEFAULTS,...MODERN_RULES,...structuredClone(template.config)};
 cabinet(config,id);
 return {name:template.en,config,elevation:template.elevation,template};
}
