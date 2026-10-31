import * as THREE from 'three';

/**
 * Simple procedural 3D models for interior accessories (display only). Each model fills the accessory's
 * size box [width, height, depth] in mm, centred on the origin, so placement and fit checks stay those of
 * engine.mjs. Shapes are generic illustrations, not a supplier's product.
 */
const mats=new Map();
function mat(key){
 if(mats.has(key))return mats.get(key);
 const spec={
  chrome:{color:'#c9d0d5',metalness:.9,roughness:.25},
  steel:{color:'#a9b1b7',metalness:.85,roughness:.35},
  dark:{color:'#2b2f33',metalness:.3,roughness:.5},
  glass:{color:'#111417',metalness:.2,roughness:.08},
  burner:{color:'#3c4146',metalness:.6,roughness:.4},
  plastic:{color:'#e9ecee',metalness:0,roughness:.6},
  bin:{color:'#6f7a83',metalness:.1,roughness:.55},
  mirror:{color:'#dfe9ee',metalness:1,roughness:.04},
  wood:{color:'#c49a6c',metalness:0,roughness:.6},
  plate:{color:'#f4f4f2',metalness:0,roughness:.3},
  bad:{color:'#d9534f',metalness:.2,roughness:.5,transparent:true,opacity:.6},
 }[key];
 const m=new THREE.MeshStandardMaterial(spec);mats.set(key,m);return m;
}

export const MODEL_TYPES=Object.freeze(['trouserRack','shoeRack','basket','tieRack','mirror','pullDownRail','jewelleryTray','cutleryTray','plateRack','bottlePullout','wasteBin','dishRack','cargoPullout','cornerCarousel','sink','hob']);

/** Group for one accessory; `fits:false` tints it red so a misfit stays visible. */
export function accessoryModel(type,size,{fits=true}={}){
 const [W,H,D]=size.map(v=>Math.max(1,Number(v)||1)),g=new THREE.Group();
 const metal=fits?'chrome':'bad';
 const box=(w,h,d,x,y,z,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(Math.max(1,w),Math.max(1,h),Math.max(1,d)),mat(fits?m:'bad'));o.position.set(x,y,z);o.castShadow=true;g.add(o);return o};
 const rod=(len,axis,x,y,z,r=4,m=metal)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,Math.max(1,len),10),mat(fits?m:'bad'));if(axis==='x')o.rotation.z=Math.PI/2;else if(axis==='z')o.rotation.x=Math.PI/2;o.position.set(x,y,z);g.add(o);return o};
 const disc=(r,h,x,y,z,m)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,Math.max(1,h),40),mat(fits?m:'bad'));o.position.set(x,y,z);o.castShadow=true;g.add(o);return o};
 const ring=(r,tube,x,y,z,m)=>{const o=new THREE.Mesh(new THREE.TorusGeometry(r,tube,8,32),mat(fits?m:'bad'));o.rotation.x=Math.PI/2;o.position.set(x,y,z);g.add(o);return o};
 // Wire tray: rim rods all round plus bottom rods front to back.
 const wireTray=(w,h,d,y)=>{
  for(const z of [-d/2,d/2])rod(w,'x',0,y+h/2,z);for(const x of [-w/2,w/2])rod(d,'z',x,y+h/2,0);
  for(const z of [-d/2,d/2])rod(w,'x',0,y-h/2,z,3);
  const n=Math.max(3,Math.round(w/40));for(let i=0;i<=n;i++)rod(d,'z',-w/2+w*i/n,y-h/2,0,2.5);
  for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])rod(h,'y',x,y,z,3);
 };
 const runners=(w,d,y)=>{for(const x of [-w/2,w/2])box(12,30,d,x,y,0,'steel')};
 switch(type){
  case 'basket':runners(W,D,-H/2+15);wireTray(W-30,H-20,D-20,0);break;
  case 'shoeRack':runners(W,D,-H/2+15);for(const [y,z] of [[-H/4,-D/4],[H/6,D/6]])for(const dz of [-40,40])rod(W-30,'x',0,y,z+dz);break;
  case 'trouserRack':{runners(W,D,0);rod(D,'z',-W/2+20,0,0,6);const n=Math.max(4,Math.round(D/60));for(let i=0;i<n;i++)rod(W-40,'x',0,0,-D/2+30+i*(D-60)/(n-1),5);break}
  case 'tieRack':{box(20,H,20,0,0,-D/2+10,'steel');for(let i=0;i<8;i++){const y=-H/2+40+i*(H-80)/7;rod(Math.min(D,300),'z',0,y,-D/2+Math.min(D,300)/2,3)}break}
  case 'mirror':box(W,H,20,0,0,0,'steel');box(W-20,H-20,4,0,0,11,'mirror');break;
  case 'pullDownRail':{for(const x of [-W/2+15,W/2-15]){rod(H,'y',x,0,-D/4,7);rod(D/2,'z',x,H/2-10,0,7)}rod(W-30,'x',0,-H/2+20,0,10);break}
  case 'jewelleryTray':case 'cutleryTray':{box(W,8,D,0,-H/2+4,0,type==='cutleryTray'?'plastic':'wood');const cols=type==='cutleryTray'?4:5,rows=type==='cutleryTray'?1:3;for(let i=1;i<cols;i++)box(6,H,D,-W/2+W*i/cols,0,0,type==='cutleryTray'?'plastic':'wood');for(let j=1;j<=rows;j++)box(W,H,6,0,0,-D/2+D*j/(rows+1),type==='cutleryTray'?'plastic':'wood');for(const x of [-W/2,W/2])box(6,H,D,x,0,0,type==='cutleryTray'?'plastic':'wood');break}
  case 'plateRack':{box(W,8,D,0,-H/2+4,0,'wood');for(let i=0;i<5;i++)for(let j=0;j<4;j++)rod(H,'y',-W/2+W*(i+.5)/5,0,-D/2+D*(j+.5)/4,6,'wood');break}
  case 'bottlePullout':{runners(W,D,-H/2+15);box(W-20,H,12,0,0,D/2-6,'steel');for(const y of [-H/2+40,0,H/2-40])wireTray(W-30,60,D-30,y);break}
  case 'cargoPullout':{runners(W,D,-H/2+15);box(W-20,H,12,0,0,D/2-6,'steel');rod(H,'y',-W/2+20,0,-D/2+20,6);const n=Math.max(3,Math.round(H/300));for(let i=0;i<n;i++)wireTray(W-30,80,D-30,-H/2+80+i*(H-160)/Math.max(1,n-1));break}
  case 'wasteBin':{runners(W,D,-H/2+15);const n=W>=450?2:1;for(let i=0;i<n;i++){const x=-W/2+W*(i+.5)/n,bw=W/n-30;box(bw,H-20,D-40,x,0,0,'bin');box(bw+6,10,D-34,x,H/2-15,0,'dark')}break}
  case 'dishRack':{wireTray(W-20,40,D-20,-H/2+30);for(let i=0;i<8;i++){const p=new THREE.Mesh(new THREE.CylinderGeometry(Math.min(110,H/2-10),Math.min(110,H/2-10),8,32),mat(fits?'plate':'bad'));p.rotation.z=Math.PI/2;p.position.set(-W/2+60+i*Math.min(45,(W-120)/7),0,-D/8);g.add(p)}wireTray(W-20,30,D-20,H/2-30);break}
  case 'cornerCarousel':{const r=Math.min(W,D)/2-15;rod(H,'y',0,0,0,12,'steel');for(const y of [-H/2+20,H/2-60]){disc(r,8,0,y,0,'plastic');ring(r,5,0,y+20,0,'chrome')}break}
  case 'sink':{
   // Steel bowl sunk in the worktop cut-out, rim on top, with a tap behind.
   const t=10;box(W,4,D,0,H/2-2,0,'steel');
   const bw=W-60,bd=D-70,bh=H-10;box(bw,t,bd,0,H/2-bh,0,'steel');for(const x of [-bw/2,bw/2])box(t,bh,bd,x,H/2-bh/2,0,'steel');for(const z of [-bd/2,bd/2])box(bw,bh,t,0,H/2-bh/2,z,'steel');
   disc(20,10,0,H/2-bh+t,0,'dark');rod(220,'y',0,H/2+110,-D/2+25,12);const spout=rod(160,'z',0,H/2+215,-D/2+100,9);void spout;break}
  case 'hob':{box(W,8,D,0,H/2-4,0,'glass');for(const [x,z,r] of [[-W/4,-D/4,55],[W/4,-D/4,45],[-W/4,D/4,45],[W/4,D/4,65]]){ring(r,6,x,H/2+4,z,'burner');disc(r*.45,8,x,H/2+4,z,'burner')}for(let i=0;i<4;i++)disc(14,16,-W/2+60+i*40,H/2+4,D/2-25,'steel');break}
  default:box(W,H,D,0,0,0,'steel');
 }
 g.userData.visualOnly=true;
 return g;
}
