import * as THREE from 'three';

/**
 * Realistic room for presentation and renders: solid walls with real door and window openings,
 * a textured floor, skirting, ceiling, glass and closed door leaves. Display only — the room plan,
 * openings and units stay the single source of truth and nothing here enters any output.
 */
export const ROOM_LOOKS=Object.freeze(['grid','room']);
export const FLOOR_LOOKS=Object.freeze(['oak','walnut','tile','concrete']);
export const WALL_THICKNESS=120;
const SKIRTING=80;

/**
 * Solid pieces of one wall of length `length` (mm) and height `height` around its openings.
 * `openings` are {offset,width,sill,height,type} measured from the wall start; returns [a,b,y0,y1] boxes.
 */
export function wallPieces(length,height,openings=[]){
 const cuts=openings.map(o=>({a:Math.max(0,o.offset),b:Math.min(length,o.offset+o.width),y0:o.type==='door'?0:Math.max(0,o.sill),y1:Math.min(height,(o.type==='door'?0:o.sill)+o.height)})).filter(c=>c.b>c.a).sort((p,q)=>p.a-q.a);
 const pieces=[];let cursor=0;
 for(const c of cuts){
  if(c.a>cursor)pieces.push([cursor,c.a,0,height]);
  const a=Math.max(c.a,cursor);
  if(c.b>a){if(c.y0>0)pieces.push([a,c.b,0,c.y0]);if(c.y1<height)pieces.push([a,c.b,c.y1,height])}
  cursor=Math.max(cursor,c.b);
 }
 if(cursor<length)pieces.push([cursor,length,0,height]);
 return pieces.filter(([a,b,y0,y1])=>b-a>=1&&y1-y0>=1);
}

const floorCache=new Map();
/** Procedural floor texture covering 2 × 2 m: plank parquet, 600 mm tiles or polished concrete. */
function floorTexture(look){
 if(floorCache.has(look))return floorCache.get(look);
 if(typeof document==='undefined')return null;
 const size=1024,canvas=document.createElement('canvas');canvas.width=canvas.height=size;const c=canvas.getContext('2d');if(!c)return null;
 let seed=look.length*7919;const rand=()=>(seed=(seed*16807)%2147483647)/2147483647;
 if(look==='oak'||look==='walnut'){
  const base=look==='oak'?[196,160,112]:[110,76,52],plank=size*180/2000,len=size*1200/2000;
  for(let x=0,col=0;x<size;x+=plank,col++){
   for(let y=-rand()*len;y<size;y+=len){
    const k=0.86+rand()*0.22;c.fillStyle=`rgb(${base.map(v=>Math.round(v*k)).join(',')})`;c.fillRect(x,y,plank,len);
    for(let i=0;i<14;i++){c.strokeStyle=`rgba(60,35,15,${0.04+rand()*0.08})`;c.lineWidth=0.6+rand()*1.6;const gx=x+rand()*plank;c.beginPath();c.moveTo(gx,y);c.bezierCurveTo(gx+rand()*6-3,y+len/3,gx+rand()*6-3,y+2*len/3,gx+rand()*4-2,y+len);c.stroke()}
    c.fillStyle='rgba(40,25,10,.35)';c.fillRect(x,y,plank,1.5);
   }
   c.fillStyle='rgba(40,25,10,.4)';c.fillRect(x,0,1.5,size);
  }
 }else if(look==='tile'){
  const tile=size*600/2000;c.fillStyle='#a8a299';c.fillRect(0,0,size,size);
  for(let x=0;x<size;x+=tile)for(let y=0;y<size;y+=tile){const k=0.95+rand()*0.06;c.fillStyle=`rgb(${[200,194,184].map(v=>Math.round(v*k)).join(',')})`;c.fillRect(x+2,y+2,tile-4,tile-4)}
  c.fillStyle='#8f897f';for(let p=0;p<size;p+=tile){c.fillRect(p-1,0,3,size);c.fillRect(0,p-1,size,3)}
 }else{
  c.fillStyle='#a9a7a2';c.fillRect(0,0,size,size);
  for(let i=0;i<5000;i++){const v=150+rand()*40;c.fillStyle=`rgba(${v},${v},${v-4},${0.05+rand()*0.08})`;c.beginPath();c.arc(rand()*size,rand()*size,1+rand()*14,0,Math.PI*2);c.fill()}
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;
 floorCache.set(look,texture);return texture;
}

/** Builds the room as a group; walls carry userData.side so the camera-facing ones can be cut away. */
export function buildInteriorRoom(room,{floor='oak',wallColor='#ece8e1'}={}){
 const group=new THREE.Group(),w=room.width,d=room.depth,h=room.height,t=WALL_THICKNESS;
 const map=floorTexture(FLOOR_LOOKS.includes(floor)?floor:'oak'),floorMap=map?.clone();
 if(floorMap){floorMap.needsUpdate=true;floorMap.repeat.set((w+2*t)/2000,(d+2*t)/2000)}
 const floorMat=new THREE.MeshStandardMaterial({color:floorMap?'#ffffff':'#c4a070',map:floorMap??null,roughness:floor==='concrete'?0.55:floor==='tile'?0.35:0.5,metalness:0,envMapIntensity:.8});
 const slab=new THREE.Mesh(new THREE.BoxGeometry(w+2*t,40,d+2*t),floorMat);slab.position.y=-20.5;slab.receiveShadow=true;slab.userData.side='floor';group.add(slab);
 const wallMat=new THREE.MeshStandardMaterial({color:wallColor,roughness:.92,metalness:0,envMapIntensity:.6});
 const skirtMat=new THREE.MeshStandardMaterial({color:'#f4f2ee',roughness:.6});
 const glassMat=new THREE.MeshPhysicalMaterial({color:'#dfeaf0',transparent:true,opacity:.18,roughness:.03,metalness:0,transmission:0,depthWrite:false});
 const frameMat=new THREE.MeshStandardMaterial({color:'#e8e8e6',roughness:.5});
 const doorMat=new THREE.MeshStandardMaterial({color:'#d8c4a4',roughness:.55});
 // Wall runs: back/front span the outer corners, left/right fit between them. `inward` points into the room.
 const walls=[
  {side:'back',length:w+2*t,origin:[-w/2-t,-d/2-t/2],dir:[1,0],shift:t,inward:[0,1]},
  {side:'front',length:w+2*t,origin:[-w/2-t,d/2+t/2],dir:[1,0],shift:t,inward:[0,-1]},
  {side:'left',length:d,origin:[-w/2-t/2,-d/2],dir:[0,1],shift:0,inward:[1,0]},
  {side:'right',length:d,origin:[w/2+t/2,-d/2],dir:[0,1],shift:0,inward:[-1,0]},
 ];
 for(const wall of walls){
  const along=wall.dir[0]===1,openings=(room.openings??[]).filter(o=>o.wall===wall.side).map(o=>({...o,offset:o.offset+wall.shift}));
  const at=(s,inset=0)=>[wall.origin[0]+wall.dir[0]*s+wall.inward[0]*inset,wall.origin[1]+wall.dir[1]*s+wall.inward[1]*inset];
  const box=(len,hgt,depth,s,y,inset,mat,side=wall.side)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(along?len:depth,hgt,along?depth:len),mat);const [x,z]=at(s,inset);m.position.set(x,y,z);m.castShadow=mat!==glassMat;m.receiveShadow=true;m.userData.side=side;group.add(m);return m};
  for(const [a,b,y0,y1] of wallPieces(wall.length,h,openings)){
   box(b-a,y1-y0,t,(a+b)/2,(y0+y1)/2,0,wallMat);
   // Skirting on the room side of every piece that reaches the floor (not across door openings).
   if(y0===0){const a2=Math.max(a,wall.shift),b2=Math.min(b,wall.length-wall.shift);if(b2-a2>1)box(b2-a2,SKIRTING,12,(a2+b2)/2,SKIRTING/2,t/2+6,skirtMat)}
  }
  for(const o of openings){
   const mid=o.offset+o.width/2;
   if(o.type==='window'){
    box(o.width,o.height,6,mid,o.sill+o.height/2,0,glassMat);
    for(const [len,hgt,s,y] of [[o.width,40,mid,o.sill+20],[o.width,40,mid,o.sill+o.height-20],[40,o.height,o.offset+20,o.sill+o.height/2],[40,o.height,o.offset+o.width-20,o.sill+o.height/2]])box(len,hgt,60,s,y,0,frameMat);
    box(o.width+40,25,t/2+30,mid,o.sill-12,t/4+15,skirtMat);
   }else{
    box(o.width-20,o.height-10,40,mid,(o.height-10)/2,0,doorMat);
    for(const [len,hgt,s,y] of [[o.width+80,50,mid,o.height+25],[40,o.height,o.offset-20,o.height/2],[40,o.height,o.offset+o.width+20,o.height/2]])box(len,hgt,t+20,s,y,0,frameMat);
   }
  }
 }
 const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshStandardMaterial({color:'#f7f6f3',roughness:.95}));
 ceiling.rotation.x=Math.PI/2;ceiling.position.y=h;ceiling.userData.side='ceiling';group.add(ceiling);
 group.userData.room={w,d,h};
 return group;
}

/**
 * Dollhouse cut-away: walls (with their windows, doors and skirting) between an outside camera and the
 * room are hidden; from inside the room every wall and the ceiling are shown.
 */
export function updateCutaway(group,camera){
 const r=group.userData.room;if(!r)return;
 const p=camera.position,inside=Math.abs(p.x)<r.w/2&&Math.abs(p.z)<r.d/2&&p.y<r.h&&p.y>0;
 const hide={back:!inside&&p.z<-r.d/2,front:!inside&&p.z>r.d/2,left:!inside&&p.x<-r.w/2,right:!inside&&p.x>r.w/2,ceiling:!inside,floor:false};
 for(const m of group.children)if(m.userData.side in hide)m.visible=!hide[m.userData.side];
}
