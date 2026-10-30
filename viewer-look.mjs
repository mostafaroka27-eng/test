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

const handleMaterial=new THREE.MeshStandardMaterial({color:'#2b2e31',metalness:.85,roughness:.32});
/** Visual bar handle for a door (vertical, on the opening edge) or drawer front (horizontal, centred). */
export function handleFor(part,size,{hingeLeft=true}={}){
 const [sx,sy,sz]=size,bar=Math.min(320,Math.max(96,(part.kind==='door'?sy:sx)*0.4));
 const geometry=new THREE.CylinderGeometry(6,6,bar,14),mesh=new THREE.Mesh(geometry,handleMaterial);
 mesh.castShadow=true;mesh.userData.visualOnly=true;
 // Door handles sit near 1050 mm above the floor when the door allows it; drawer handles are centred.
 if(part.kind==='door')mesh.position.set((hingeLeft?1:-1)*(sx/2-45),Math.max(-sy/2+bar/2+40,Math.min(0,1050-part.position.y)),sz/2+22);
 else{mesh.rotation.z=Math.PI/2;mesh.position.set(0,0,sz/2+22)}
 // Posts run along the bar's local Y axis in both orientations.
 for(const s of [-1,1]){const post=new THREE.Mesh(new THREE.CylinderGeometry(4,4,22,10),handleMaterial);post.rotation.x=Math.PI/2;post.position.set(0,s*bar*0.42,-11);mesh.add(post)}
 return mesh;
}

/** Light stage for client presentations vs the darker engineering workspace. */
export const STAGES={
 workshop:{background:'#142130',floor:'#273746',grid:true,walls:true,exposure:1.05},
 studio:{background:'#dfe5ea',floor:'#e8ebee',grid:false,walls:false,exposure:0.85},
};
