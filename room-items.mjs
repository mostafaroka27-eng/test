import * as THREE from 'three';

/**
 * Furniture and appliances placed in the room for presentation (display only). They are saved in the
 * project file as optional `items` but never enter cutting lists, costing, drawings or manufacturing.
 * Sizes are common starting values (mm), not a product's datasheet.
 */
export const ROOM_ITEMS=Object.freeze({
 fridge:{w:700,h:1850,d:680,group:'appliance',en:'Fridge',ar:'تلاجة'},
 cooker:{w:600,h:900,d:600,group:'appliance',en:'Freestanding cooker',ar:'بوتاجاز بفرن'},
 dishwasher:{w:600,h:820,d:570,group:'appliance',en:'Dishwasher',ar:'غسالة أطباق'},
 washer:{w:600,h:850,d:600,group:'appliance',en:'Washing machine',ar:'غسالة هدوم'},
 sofa:{w:2100,h:850,d:900,group:'living',en:'Sofa (3 seats)',ar:'كنبة 3 مقاعد'},
 armchair:{w:850,h:850,d:850,group:'living',en:'Armchair',ar:'فوتيه'},
 coffeeTable:{w:1100,h:420,d:600,group:'living',en:'Coffee table',ar:'ترابيزة صالون'},
 tv:{w:1450,h:900,d:250,group:'living',en:'TV on stand',ar:'تلفزيون على حامل'},
 bed:{w:1700,h:1000,d:2100,group:'bedroom',en:'Double bed 160',ar:'سرير مزدوج 160'},
 singleBed:{w:1000,h:900,d:2050,group:'bedroom',en:'Single bed 90',ar:'سرير فردي 90'},
 diningTable:{w:1600,h:750,d:900,group:'dining',en:'Dining table',ar:'ترابيزة سفرة'},
 chair:{w:450,h:900,d:500,group:'dining',en:'Chair',ar:'كرسي'},
 desk:{w:1200,h:750,d:600,group:'office',en:'Desk',ar:'مكتب'},
 plant:{w:450,h:1300,d:450,group:'decor',en:'Plant',ar:'زرع'},
 rug:{w:2000,h:10,d:1400,group:'decor',en:'Rug',ar:'سجادة'},
 floorLamp:{w:400,h:1700,d:400,group:'decor',en:'Floor lamp',ar:'أباجورة أرضية'},
});
export const ROOM_ITEM_TYPES=Object.freeze(Object.keys(ROOM_ITEMS));
export const MAX_ITEMS=200;

/** Validated copy of the project's room items. */
export function validateItems(list){
 if(!Array.isArray(list))throw Error('Room items must be a list');
 if(list.length>MAX_ITEMS)throw Error(`At most ${MAX_ITEMS} room items`);
 const ids=new Set();
 return list.map(item=>{
  if(!item||typeof item!=='object')throw Error('Invalid room item');
  const id=typeof item.id==='string'?item.id.trim():'';
  if(!/^[A-Za-z0-9_-]{1,40}$/.test(id)||ids.has(id))throw Error('Room items need unique ids');ids.add(id);
  if(!ROOM_ITEM_TYPES.includes(item.type))throw Error('Unknown room item');
  for(const k of ['x','z'])if(typeof item[k]!=='number'||!Number.isFinite(item[k])||Math.abs(item[k])>100000)throw Error('Invalid room item position');
  const rotation=item.rotation??0;if(![0,90,180,270].includes(rotation))throw Error('Room item rotation must be 0, 90, 180 or 270');
  return {id,type:item.type,x:Math.round(item.x*10)/10,z:Math.round(item.z*10)/10,rotation};
 });
}

/** Floor footprint of an item (same shape as room.mjs unitFootprint) for snapping and layout checks. */
export function itemFootprint(item){
 const s=ROOM_ITEMS[item.type];if(!s)throw Error('Unknown room item');
 const turned=item.rotation===90||item.rotation===270,w=turned?s.d:s.w,d=turned?s.w:s.d;
 return {left:item.x-w/2,right:item.x+w/2,back:item.z-d/2,front:item.z+d/2,width:w,depth:d,height:s.h,bottom:0,rotation:item.rotation??0};
}

export function nextItemId(items){
 let n=1;const ids=new Set(items.map(i=>i.id));while(ids.has(`ITM-${String(n).padStart(3,'0')}`))n++;
 return `ITM-${String(n).padStart(3,'0')}`;
}

const cache=new Map();
const M=(key,spec)=>{if(!cache.has(key))cache.set(key,new THREE.MeshStandardMaterial(spec));return cache.get(key)};
const look={
 white:()=>M('white',{color:'#eef0f1',roughness:.35,metalness:.05}),
 steel:()=>M('steel',{color:'#b9c0c5',roughness:.3,metalness:.8}),
 black:()=>M('black',{color:'#1d2023',roughness:.25,metalness:.2}),
 fabric:()=>M('fabric',{color:'#7d8a8f',roughness:.95}),
 cushion:()=>M('cushion',{color:'#8f9ba0',roughness:.95}),
 linen:()=>M('linen',{color:'#f1ede6',roughness:.9}),
 blanket:()=>M('blanket',{color:'#b7a58c',roughness:.95}),
 wood:()=>M('wood',{color:'#9b7350',roughness:.55}),
 lightWood:()=>M('lightWood',{color:'#c9a97f',roughness:.55}),
 leaf:()=>M('leaf',{color:'#4f7d45',roughness:.8}),
 pot:()=>M('pot',{color:'#c8b8a4',roughness:.7}),
 rug:()=>M('rug',{color:'#a99a86',roughness:1}),
 shade:()=>M('shade',{color:'#f5ecd8',roughness:.9,emissive:'#3a3020'}),
 screen:()=>M('screen',{color:'#0b0d10',roughness:.1,metalness:.3}),
};

/** Procedural model of a room item, base on the floor (y = 0), front facing +Z before rotation. */
export function itemModel(type){
 const s=ROOM_ITEMS[type],g=new THREE.Group();if(!s)return g;
 const {w,h,d}=s;
 const box=(bw,bh,bd,x,y,z,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd),m());o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o};
 const cyl=(rt,rb,ch,x,y,z,m,seg=24)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,ch,seg),m());o.position.set(x,y,z);o.castShadow=true;g.add(o);return o};
 const legs=(lw,ld,lh,r,m)=>{for(const x of [-lw/2,lw/2])for(const z of [-ld/2,ld/2])cyl(r,r,lh,x,lh/2,z,m,10)};
 switch(type){
  case 'fridge':box(w,h,d-40,0,h/2,-20,look.white);box(w-10,h*.62,40,0,h*.38+h*.31,d/2-20,look.white);box(w-10,h*.36,40,0,h*.18,d/2-20,look.white);for(const y of [h*.5,h*.3])box(20,280,25,w/2-50,y,d/2+12,look.steel);break;
  case 'cooker':box(w,h-20,d,0,(h-20)/2,0,look.steel);box(w,20,d,0,h-10,0,look.black);box(w-80,h*.45,10,0,h*.35,d/2+5,look.black);for(const [x,z] of [[-140,-140],[140,-140],[-140,120],[140,120]])cyl(55,55,12,x,h+6,z,look.black);for(let i=0;i<5;i++)cyl(16,16,25,-w/2+80+i*110,h*.75,d/2+12,look.steel).rotation.x=Math.PI/2;break;
  case 'dishwasher':box(w,h,d,0,h/2,0,look.white);box(w-10,h-120,20,0,(h-120)/2+100,d/2+10,look.steel);box(w-40,60,20,0,h-40,d/2+10,look.black);break;
  case 'washer':box(w,h,d,0,h/2,0,look.white);{const ring=new THREE.Mesh(new THREE.TorusGeometry(180,30,12,40),look.steel());ring.position.set(0,h*.45,d/2+10);g.add(ring);cyl(160,160,10,0,h*.45,d/2+5,look.black).rotation.x=Math.PI/2}box(w-40,80,10,0,h-60,d/2+5,look.black);break;
  case 'sofa':box(w,420,d,0,250,0,look.fabric);box(w,h-420,220,0,420+(h-420)/2,-d/2+110,look.fabric);for(const x of [-w/2+100,w/2-100])box(200,620,d,x,310,0,look.fabric);for(let i=0;i<3;i++)box((w-400)/3-10,140,d-260,-w/2+200+(w-400)/6+i*(w-400)/3,530,40,look.cushion);legs(w-100,d-100,40,15,look.wood);break;
  case 'armchair':box(w,420,d,0,250,0,look.fabric);box(w,h-420,200,0,420+(h-420)/2,-d/2+100,look.fabric);for(const x of [-w/2+80,w/2-80])box(160,620,d,x,310,0,look.fabric);box(w-320,140,d-250,0,530,40,look.cushion);legs(w-100,d-100,40,15,look.wood);break;
  case 'coffeeTable':box(w,40,d,0,h-20,0,look.lightWood);legs(w-80,d-80,h-40,20,look.lightWood);break;
  case 'tv':box(w,30,d,0,15,0,look.black);box(80,h*.4,40,0,h*.2,0,look.black);box(w,h*.6,40,0,h*.7,0,look.black);box(w-30,h*.6-30,5,0,h*.7,22,look.screen);break;
  case 'bed':case 'singleBed':box(w,300,d,0,150,0,look.wood);box(w-40,220,d-60,0,410,30,look.linen);box(w,h,80,0,h/2,-d/2+40,look.wood);for(const x of type==='bed'?[-w/4,w/4]:[0])box(type==='bed'?w/2-120:w-200,120,400,x,580,-d/2+300,look.linen);box(w-20,40,d*.55,0,540,d*.2,look.blanket);break;
  case 'diningTable':case 'desk':box(w,40,d,0,h-20,0,type==='desk'?look.white:look.wood);legs(w-100,d-100,h-40,25,type==='desk'?look.steel:look.wood);break;
  case 'chair':box(w,40,d-40,0,450,0,look.wood);box(w,h-470,30,0,470+(h-470)/2,-d/2+35,look.wood);legs(w-60,d-80,430,15,look.wood);break;
  case 'plant':cyl(180,140,380,0,190,0,look.pot);for(let i=0;i<7;i++){const leaf=new THREE.Mesh(new THREE.SphereGeometry(140+(i%3)*40,12,10),look.leaf());const a=i/7*Math.PI*2;leaf.position.set(Math.cos(a)*110,600+(i%4)*170,Math.sin(a)*110);leaf.castShadow=true;g.add(leaf)}break;
  case 'rug':box(w,h,d,0,h/2,0,look.rug);break;
  case 'floorLamp':cyl(160,160,25,0,12,0,look.black);cyl(12,12,h-300,0,(h-300)/2,0,look.black);cyl(130,200,300,0,h-150,0,look.shade);break;
 }
 return g;
}
