import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Display-only look of the 3D view: image-based lighting, soft shadows, wood grain, handles and a
 * light "studio" stage for client presentations. Nothing here enters the model, cut list or files.
 */
export function setupLook(renderer,scene){
 renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 const pmrem=new THREE.PMREMGenerator(renderer);
 scene.environment=pmrem.fromScene(new RoomEnvironment(),0.04).texture;
 pmrem.dispose();
}

const woodCache=new Map();
/** Procedural straight-grain texture tinted to the finish colour (grain runs along texture V). */
export function woodTexture(hex){
 if(woodCache.has(hex))return woodCache.get(hex);
 if(typeof document==='undefined')return null;
 const size=512,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 const base=new THREE.Color(hex);ctx.fillStyle=`#${base.getHexString()}`;ctx.fillRect(0,0,size,size);
 // Deterministic pseudo-random so the same finish always looks the same.
 let seed=parseInt(hex.slice(1),16)||1;const rand=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let i=0;i<150;i++){
  const x=rand()*size,width=0.6+rand()*2.6,dark=rand()<0.6,alpha=0.05+rand()*0.12;
  const shade=base.clone().offsetHSL(0,dark?0.02:-0.02,dark?-0.12-rand()*0.1:0.06+rand()*0.06);
  ctx.strokeStyle=`rgba(${Math.round(shade.r*255)},${Math.round(shade.g*255)},${Math.round(shade.b*255)},${alpha})`;ctx.lineWidth=width;
  ctx.beginPath();const amp=2+rand()*7,freq=0.004+rand()*0.012,phase=rand()*6.28;
  for(let y=0;y<=size;y+=8){const dx=Math.sin(y*freq+phase)*amp;y?ctx.lineTo(x+dx,y):ctx.moveTo(x+dx,y)}
  ctx.stroke();
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
 woodCache.set(hex,texture);return texture;
}

/** Panel material: wood finishes get grain, plain finishes a satin melamine look. */
export function panelMaterial(hex,{wood=false,back=false}={}){
 if(back)return new THREE.MeshStandardMaterial({color:new THREE.Color(hex).lerp(new THREE.Color('#e9e6df'),0.55),roughness:.85,metalness:0,envMapIntensity:.5});
 const map=wood?woodTexture(hex):null;
 return new THREE.MeshStandardMaterial({color:map?'#ffffff':hex,map,roughness:wood?.62:.48,metalness:0,envMapIntensity:.75});
}

const HANDLE_COLORS={black:['#2b2e31',.85,.32],steel:['#b9bfc4',.9,.28],gold:['#c9a45c',.95,.25],white:['#eeeeea',.1,.4]};
const handleMaterials=new Map();
const handleMaterial=finish=>{if(!handleMaterials.has(finish)){const [color,metalness,roughness]=HANDLE_COLORS[finish]??HANDLE_COLORS.black;handleMaterials.set(finish,new THREE.MeshStandardMaterial({color,metalness,roughness}))}return handleMaterials.get(finish)};
/** Visual handle for a door (opening edge) or drawer front (centred): bar, knob, edge profile or none. */
export function handleFor(part,size,{hingeLeft=true,type='bar',length=0,finish='black'}={}){
 if(type==='none')return null;
 const [sx,sy,sz]=size,door=part.kind==='door',material=handleMaterial(finish),group=new THREE.Group();group.userData.visualOnly=true;
 // Door handles sit near 1050 mm above the floor when the door allows it; drawer handles are centred.
 const doorX=(hingeLeft?1:-1)*(sx/2-45),doorY=bar=>Math.max(-sy/2+bar/2+40,Math.min(0,1050-part.position.y));
 if(type==='knob'){
  const knob=new THREE.Mesh(new THREE.CylinderGeometry(14,10,26,20),material);knob.rotation.x=Math.PI/2;knob.castShadow=true;
  knob.position.set(door?doorX:0,door?doorY(30):0,sz/2+13);group.add(knob);return group;
 }
 if(type==='profile'){
  // Edge profile along the top of a drawer front or the opening edge of a door.
  const along=door?sy:sx,geo=new THREE.BoxGeometry(door?14:along,door?along:14,22),mesh=new THREE.Mesh(geo,material);
  mesh.position.set(door?(hingeLeft?1:-1)*(sx/2-7):0,door?0:sy/2-7,sz/2+4);group.add(mesh);return group;
 }
 const bar=length>0?Math.min(length,(door?sy:sx)-40):Math.min(320,Math.max(96,(door?sy:sx)*0.4));
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(6,6,bar,14),material);mesh.castShadow=true;
 if(door)mesh.position.set(doorX,doorY(bar),sz/2+22);
 else{mesh.rotation.z=Math.PI/2;mesh.position.set(0,0,sz/2+22)}
 // Posts run along the bar's local Y axis in both orientations.
 for(const s of [-1,1]){const post=new THREE.Mesh(new THREE.CylinderGeometry(4,4,22,10),material);post.rotation.x=Math.PI/2;post.position.set(0,s*bar*0.42,-11);mesh.add(post)}
 group.add(mesh);return group;
}

/** Approximate RGB of a white LED at a colour temperature (Kelvin), for display only. */
export function kelvinColor(kelvin){
 const t=kelvin/100,clamp=v=>Math.max(0,Math.min(255,v));
 const r=t<=66?255:clamp(329.698727446*Math.pow(t-60,-0.1332047592));
 const g=t<=66?clamp(99.4708025861*Math.log(t)-161.1195681661):clamp(288.1221695283*Math.pow(t-60,-0.0755148492));
 const b=t>=66?255:t<=19?0:clamp(138.5177312231*Math.log(t-10)-305.0447927307);
 return new THREE.Color(r/255,g/255,b/255);
}
const GLASS_LOOK={clear:{opacity:.28,roughness:.04,metalness:.05},frosted:{opacity:.62,roughness:.75,metalness:0},tinted:{opacity:.55,roughness:.08,metalness:.1},reflective:{opacity:.8,roughness:.02,metalness:.85},fluted:{opacity:.5,roughness:.4,metalness:.05}};
export function glassMaterial(type,color){const look=GLASS_LOOK[type]??GLASS_LOOK.clear;return new THREE.MeshStandardMaterial({color,transparent:true,...look,envMapIntensity:1.2})}

const photoCache=new Map();
/** Library material photo as a repeating texture; each panel gets its own repeat for real-world size. */
export function photoMaterial(material,size,{onLoad}={}){
 if(!material.texture)return null;
 let base=photoCache.get(material.id+material.texture.length);
 if(!base){base=new THREE.TextureLoader().load(material.texture,()=>onLoad?.());base.colorSpace=THREE.SRGBColorSpace;base.wrapS=base.wrapT=THREE.RepeatWrapping;base.anisotropy=4;photoCache.set(material.id+material.texture.length,base)}
 const map=base.clone();map.needsUpdate=true;
 // Repeat over the two largest panel dimensions; grain follows the panel length.
 const dims=[...size].sort((a,b)=>b-a),k=material.textureSize||1000;
 map.repeat.set(Math.max(dims[1]/k,0.05),Math.max(dims[0]/k,0.05));
 if(material.grain==='horizontal')map.rotation=Math.PI/2;
 return new THREE.MeshStandardMaterial({color:'#ffffff',map,roughness:.6,metalness:0,envMapIntensity:.75});
}

/** Light stage for client presentations vs the darker engineering workspace. */
export const STAGES={
 workshop:{background:'#142130',floor:'#273746',grid:true,walls:true,exposure:1.05},
 studio:{background:'#dfe5ea',floor:'#e8ebee',grid:false,walls:false,exposure:0.85},
 // Realistic room: solid walls, floor and ceiling from the room plan (room-look.mjs).
 room:{background:'#d6dee5',floor:'#cfc9bf',grid:false,walls:false,exposure:1},
};
