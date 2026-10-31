import * as THREE from 'three';
import {nearestWall,alongWall,openingAt,moveWall,moveOpening} from './room-edit.mjs';
import {ROOM_ITEMS,ROOM_ITEM_TYPES,MAX_ITEMS,itemFootprint,itemModel,nextItemId} from './room-items.mjs';
import {dragPosition} from './unit-drag.mjs';
import {unitFootprint} from './room.mjs';

/**
 * SketchUp-style room tools in the 3D view (display/layout only, never cutting or costing):
 *  - "Edit room": drag a wall (or the floor edge) to resize the room; drag a door/window along its wall.
 *  - Room furniture and appliances: add, select, drag (with wall/unit snapping), rotate (R), nudge (arrows), delete.
 * Must be initialised before the unit-drag listeners so that a press on an item does not also move a unit.
 */
export function initRoomTools(ctx){
 const {renderer,camera,scene,objects,roomWalls,floor,$}=ctx;
 const tr=(en,ar)=>document.documentElement.lang==='ar'?ar:en;
 const group=new THREE.Group();group.name='room-items';scene.add(group);
 let selectedItem=null,editing=false,drag=null,outline=null;
 const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2(),hitPoint=new THREE.Vector3();
 const items=()=>ctx.getItems();

 // ---------- rendering ----------
 function render(){
  for(const child of [...group.children]){group.remove(child);child.traverse(o=>{if(o.isMesh)o.geometry.dispose()})}
  outline=null;
  for(const item of items()){
   const g=itemModel(item.type);g.userData.item=item.id;g.traverse(o=>{o.userData.item=item.id});
   g.position.set(item.x,0,item.z);g.rotation.y=-(item.rotation??0)*Math.PI/180;group.add(g);
   if(item.id===selectedItem){const s=ROOM_ITEMS[item.type];outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(s.w+20,s.h+20,s.d+20)),new THREE.LineBasicMaterial({color:'#f2a33a'}));outline.position.set(0,s.h/2,0);outline.userData.item=item.id;outline.raycast=()=>{};g.add(outline)}
  }
  ctx.render();list();
 }
 function place(item,g=group.children.find(c=>c.userData.item===item.id)){if(g){g.position.set(item.x,0,item.z);g.rotation.y=-(item.rotation??0)*Math.PI/180}ctx.render()}

 // ---------- sidebar ----------
 const typeSelect=$('itemType');
 typeSelect.innerHTML=ROOM_ITEM_TYPES.map(t=>`<option value="${t}">${ROOM_ITEMS[t].en}</option>`).join('');
 function list(){
  $('itemList').innerHTML=items().map(i=>`<div class="accessory-row${i.id===selectedItem?' selected':''}"><button class="link-button" data-select-item="${i.id}">${ROOM_ITEMS[i.type].en}</button><span data-i18n-skip>${i.id}</span><button data-remove-item="${i.id}" aria-label="Remove">✕</button></div>`).join('');
  $('itemList').querySelectorAll('[data-select-item]').forEach(b=>b.onclick=()=>select(b.dataset.selectItem));
  $('itemList').querySelectorAll('[data-remove-item]').forEach(b=>b.onclick=()=>remove(b.dataset.removeItem));
  ctx.translate();
 }
 $('addItem').onclick=()=>{
  if(items().length>=MAX_ITEMS){ctx.warn(tr(`At most ${MAX_ITEMS} room items`,`أقصى عدد ${MAX_ITEMS} قطعة`));return}
  const type=typeSelect.value,room=ctx.getRoom(),s=ROOM_ITEMS[type];
  // Start where the camera is looking, kept inside the room, then let the user drag it.
  const t=ctx.target(),x=Math.max(-room.width/2+s.w/2,Math.min(room.width/2-s.w/2,Math.round(t.x/10)*10)),z=Math.max(-room.depth/2+s.d/2,Math.min(room.depth/2-s.d/2,Math.round(t.z/10)*10));
  const spot=freeSpot(type,Number.isFinite(x)?x:0,Number.isFinite(z)?z:0);
  const item={id:nextItemId(items()),type,x:spot.x,z:spot.z,rotation:0};
  ctx.setItems([...items(),item]);selectedItem=item.id;render();ctx.commit();
  ctx.warn(tr('Drag it in the 3D view · R rotates · Delete removes','اسحبها في العرض ثلاثي الأبعاد · R للف · Delete للحذف'));
 };
 // Nearest floor spot (100 mm search grid) where the new item overlaps no unit or item, so it is easy to grab.
 function freeSpot(type,x0,z0){
  const room=ctx.getRoom(),boxes=[...ctx.getUnits().map(u=>{try{return unitFootprint(u)}catch{return null}}).filter(Boolean),...items().map(itemFootprint)];
  const fits=(x,z)=>{const b=itemFootprint({type,x,z,rotation:0});if(b.left<-room.width/2||b.right>room.width/2||b.back<-room.depth/2||b.front>room.depth/2)return false;return !boxes.some(o=>b.left<o.right&&b.right>o.left&&b.back<o.front&&b.front>o.back)};
  for(let r=0;r<=60;r++)for(let i=-r;i<=r;i++)for(const [dx,dz] of [[i,-r],[i,r],[-r,i],[r,i]]){const x=x0+dx*100,z=z0+dz*100;if(fits(x,z))return {x,z}}
  return {x:x0,z:z0};
 }
 function select(id){selectedItem=id;render()}
 function remove(id){ctx.setItems(items().filter(i=>i.id!==id));if(selectedItem===id)selectedItem=null;render();ctx.commit()}
 function rotate(id){const item=items().find(i=>i.id===id);if(!item)return;item.rotation=((item.rotation??0)+90)%360;render();ctx.commit()}

 // ---------- edit-room toggle ----------
 const toggle=$('editRoom');
 toggle.onclick=()=>{editing=!editing;toggle.setAttribute('aria-pressed',String(editing));ctx.warn(editing?tr('Drag a wall or the floor edge to resize the room; drag a door or window to slide it. Click Edit room again to finish.','اسحب أي حيطة أو طرف الأرضية لتغيير مقاس الغرفة، واسحب الباب أو الشباك لتحريكه. دوس "تعديل الغرفة" تاني للإنهاء.'):'')};

 // ---------- pointer ----------
 const el=renderer.domElement;
 const rayAt=e=>{const r=el.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(mouse,camera)};
 const shown=o=>{for(let n=o;n;n=n.parent)if(n.visible===false)return false;const m=o.material;return !(m&&m.transparent&&m.opacity<0.05)};
 const firstHit=()=>raycaster.intersectObjects([...objects.children,group,roomWalls,...(floor?.visible?[floor]:[])],true).find(h=>shown(h.object)&&!h.object.isLine);
 // A wall grab: any visible room surface within reach of one of the four walls (incl. the floor edge).
 function wallGrab(hit){
  if(!hit||(!roomWalls.getObjectById(hit.object.id)&&hit.object!==floor))return null;
  const room=ctx.getRoom(),p=hit.point,wall=nearestWall(room,p);
  const dist={back:Math.abs(p.z+room.depth/2),front:Math.abs(p.z-room.depth/2),left:Math.abs(p.x+room.width/2),right:Math.abs(p.x-room.width/2)}[wall];
  if(dist>Math.max(250,Math.min(room.width,room.depth)*.08))return null;
  return {wall,point:p.clone(),opening:p.y>5?openingAt(room,wall,p):-1};
 }
 function shiftAll(shift,startUnits,startItems){
  const us=ctx.getUnits();for(const u of us){const s=startUnits.get(u.id);if(s){u.x=s.x+shift.x;u.z=s.z+shift.z}}
  for(const g of objects.children){const u=us.find(v=>v.id===g.userData.unit);if(u)g.position.set(u.x,u.elevation??0,u.z)}
  for(const i of items()){const s=startItems.get(i.id);if(s){i.x=s.x+shift.x;i.z=s.z+shift.z;place(i)}}
 }
 el.addEventListener('pointerdown',e=>{
  if(e.button!==0||!ctx.canEdit())return;
  rayAt(e);const hit=firstHit();
  if(hit?.object.userData.item){
   const item=items().find(i=>i.id===hit.object.userData.item);if(!item)return;
   if(selectedItem!==item.id){selectedItem=item.id;render()}
   const others=[...ctx.getUnits().map(u=>{try{return {id:u.id,...unitFootprint(u)}}catch{return null}}).filter(Boolean),...items().filter(i=>i.id!==item.id).map(i=>({id:i.id,label:`item:${i.id}`,...itemFootprint(i)}))];
   drag={kind:'item',id:e.pointerId,item,plane:new THREE.Plane(new THREE.Vector3(0,1,0),-hit.point.y),dx:item.x-hit.point.x,dz:item.z-hit.point.z,start:{x:item.x,z:item.z},others,moved:false};
  }else{
   if(selectedItem){selectedItem=null;render()}
   const grab=editing?wallGrab(hit):null;if(!grab)return;
   const room=ctx.getRoom();
   if(grab.opening>=0){
    const o=room.openings[grab.opening],n={back:[0,0,1],front:[0,0,-1],left:[1,0,0],right:[-1,0,0]}[grab.wall],c={back:room.depth/2,front:room.depth/2,left:room.width/2,right:room.width/2}[grab.wall];
    drag={kind:'opening',id:e.pointerId,index:grab.opening,wall:grab.wall,startRoom:structuredClone(room),plane:new THREE.Plane(new THREE.Vector3(...n),c),grab:alongWall(room,grab.wall,grab.point)-o.offset,moved:false};
   }else{
    const across=grab.wall==='left'||grab.wall==='right'?'x':'z',edge={left:-room.width/2,right:room.width/2,back:-room.depth/2,front:room.depth/2}[grab.wall];
    drag={kind:'wall',id:e.pointerId,wall:grab.wall,across,startRoom:structuredClone(room),plane:new THREE.Plane(new THREE.Vector3(0,1,0),-Math.max(0,grab.point.y)),grab:edge-grab.point[across],startUnits:new Map(ctx.getUnits().map(u=>[u.id,{x:u.x,z:u.z}])),startItems:new Map(items().map(i=>[i.id,{x:i.x,z:i.z}])),moved:false};
   }
  }
  e.stopImmediatePropagation();ctx.setOrbit(false);el.setPointerCapture(e.pointerId);el.style.cursor='grabbing';
 },{capture:true});
 el.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id){
   // Hover cursor: items and (in Edit room) walls/doors/windows; otherwise leave it to the unit hover.
   if(!drag&&e.buttons===0&&ctx.canEdit()){rayAt(e);const hit=firstHit(),g=hit?.object.userData.item?null:editing?wallGrab(hit):null;
    const cursor=hit?.object.userData.item?'grab':g?(g.opening>=0?'move':(g.wall==='left'||g.wall==='right'?'ew-resize':'ns-resize')):null;
    if(cursor){el.style.cursor=cursor;e.stopImmediatePropagation()}else if(['move','ew-resize','ns-resize'].includes(el.style.cursor)||(el.style.cursor==='grab'&&!hit?.object.userData.unit))el.style.cursor=''}
   return;
  }
  rayAt(e);if(!raycaster.ray.intersectPlane(drag.plane,hitPoint))return;
  e.stopImmediatePropagation();
  try{
   if(drag.kind==='item'){
    const p=dragPosition({room:ctx.getRoom(),unit:drag.item,x:hitPoint.x+drag.dx,z:hitPoint.z+drag.dz,others:drag.others,free:e.altKey,footprint:itemFootprint});
    if(p.x===drag.item.x&&p.z===drag.item.z)return;
    drag.item.x=p.x;drag.item.z=p.z;drag.moved=true;place(drag.item);
    ctx.warn(p.snapped.length?tr('Snapped to ','ملزوقة في ')+p.snapped.map(s=>s.replace('wall:',tr('wall ','حيطة ')).replace(/^(unit|item):/,'')).join(' + '):'');
   }else if(drag.kind==='wall'){
    const out=moveWall(drag.startRoom,drag.wall,hitPoint[drag.across]+drag.grab);
    const now=ctx.getRoom();if(out.room.width===now.width&&out.room.depth===now.depth)return;
    ctx.setRoom(out.room);shiftAll(out.shift,drag.startUnits,drag.startItems);drag.moved=true;
    ctx.warn(`${tr('Room','الغرفة')} ${out.room.width} × ${out.room.depth} ${tr('mm','مم')} (${out.delta>=0?'+':''}${out.delta})`);
   }else{
    const next=moveOpening(drag.startRoom,drag.index,alongWall(drag.startRoom,drag.wall,hitPoint)-drag.grab),o=next.openings[drag.index];
    if(o.offset===ctx.getRoom().openings?.[drag.index]?.offset)return;
    ctx.setRoom(next);drag.moved=true;
    ctx.warn(`${o.type==='door'?tr('Door','باب'):tr('Window','شباك')}: ${o.offset} ${tr('mm from the wall start','مم من أول الحيطة')} · ${tr('free after it','الباقي بعده')} ${Math.round(({back:next.width,front:next.width,left:next.depth,right:next.depth}[o.wall])-o.offset-o.width)} ${tr('mm','مم')}`);
   }
  }catch(err){ctx.warn(err.message)}
 },{capture:true});
 const end=(e,cancel)=>{
  if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=null;
  ctx.setOrbit(true);el.style.cursor='';try{el.releasePointerCapture(e.pointerId)}catch{}
  e.stopImmediatePropagation();
  if(cancel&&d.moved){
   if(d.kind==='item'){d.item.x=d.start.x;d.item.z=d.start.z;place(d.item)}
   else{ctx.setRoom(d.startRoom);if(d.kind==='wall')shiftAll({x:0,z:0},d.startUnits,d.startItems)}
   ctx.refresh();return;
  }
  if(d.moved){ctx.refresh();ctx.commit()}
 };
 el.addEventListener('pointerup',e=>end(e,false),{capture:true});el.addEventListener('pointercancel',e=>end(e,true),{capture:true});

 // ---------- keyboard (only while an item is selected) ----------
 document.addEventListener('keydown',e=>{
  if(!selectedItem||e.target.closest?.('input,textarea,select,[contenteditable="true"]')||e.ctrlKey||e.metaKey||e.altKey||!ctx.canEdit())return;
  const item=items().find(i=>i.id===selectedItem);if(!item){selectedItem=null;return}
  const step={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(step){e.preventDefault();e.stopImmediatePropagation();const k=e.shiftKey?100:10;item.x=Math.max(-100000,Math.min(100000,item.x+step[0]*k));item.z=Math.max(-100000,Math.min(100000,item.z+step[1]*k));place(item);ctx.commit();return}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopImmediatePropagation();remove(item.id);return}
  if(e.key==='r'||e.key==='R'){e.preventDefault();e.stopImmediatePropagation();rotate(item.id);return}
  if(e.key==='Escape'){selectedItem=null;render()}
 },{capture:true});

 render();
 return {
  refresh(){if(selectedItem&&!items().some(i=>i.id===selectedItem))selectedItem=null;render()},
  deselect(){if(selectedItem){selectedItem=null;render()}},
  get selectedItem(){return selectedItem},
  get editing(){return editing},
 };
}
