import {initReferenceLibrary} from './reference-library.mjs';
import {finishColor} from './reference-catalog.mjs';
import {setupLook,panelMaterial,handleFor,STAGES,kelvinColor,glassMaterial,photoMaterial} from './viewer-look.mjs';
import {initExtras} from './studio-extras.mjs';
import {loadLighting,saveLighting,DEFAULT_LIGHTING,QUALITY,sunPosition} from './lighting.mjs';
import {wallLength} from './room.mjs';
import {drawingSheets,drawingSetHtml,normalLayout} from './shop-drawing.mjs';
import {initDrawingUi} from './drawing-ui.mjs';
import {initRenderExport} from './render-ui.mjs';
import {buildInteriorRoom,updateCutaway} from './room-look.mjs';
import {dragPosition,otherFootprints,nudge} from './unit-drag.mjs';
import {accessoryModel,MODEL_TYPES} from './accessory-models.mjs';
import {initRoomTools} from './room-tools.mjs';
import {initAssembly} from './assembly-ui.mjs';
import {loadCompany,saveCompany,validateCompany,validateLogo,MAX_LOGO_BYTES} from './company.mjs';
import {initShowroom} from './showroom.mjs';
import {initWorkspace} from './workspace.mjs';
import {DEFAULT_COSTING} from './costing.mjs';
import {remapPartOverrides} from './topology.mjs';
import {partSize} from './geometry.mjs';
import {cabinetDrawingSvg} from './drawing.mjs';
import {applyLanguage,getLanguage,t} from './i18n.mjs';
import {parseProject,serializeProject,createHistory,saveBackup,loadBackup,MAX_PROJECT_BYTES} from './project.mjs';
import {reviewProject,projectManufacturingCsv,partDrawingSvg,projectSheetPlan,projectSheetCsv,projectSheetSvg} from './review.mjs';
import {hardwareLibraryTemplate,validateHardwareLibrary,joineryPlan,joineryCsv} from './joinery.mjs';
import {drillingPreview,drillingSvg,drillingCsv} from './machining.mjs';
import {DEFAULT_ROOM,validateRoom,inspectLayout,snapUnitToWall,roomPlanSvg} from './room.mjs';
import {DEFAULTS,MODERN_RULES,cabinet,layoutSheets,csv,applyMethod,METHODS,hardwareSchedule,dxfPanels} from './engine.mjs';
import {manufacturingCsv,labelsHtml} from './manufacturing.mjs';
import {cutListHtml} from './cutlist-doc.mjs';
import {initCncUi} from './cnc-ui.mjs';
import {issueRelease,releaseState,revisionAfterEdit,releasedProject} from './releases.mjs';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
// New units use the versioned cab-2.0 rules; opened files keep whatever rules they were saved with.
const newConfig=()=>({...DEFAULTS,...MODERN_RULES});
const newProjectId=()=>'PRJ-'+(globalThis.crypto?.randomUUID?.().slice(0,8)??Date.now().toString(16)).toUpperCase();
let projectId=newProjectId(),designRevision=1,migratedFrom=null,projectName='',clientName='',company=loadCompany(globalThis.localStorage),materials=[],drawingLayout=normalLayout(),views=[],items=[],releases=[],lighting=loadLighting(globalThis.localStorage),showSizes=false;
let workspace=null,costing=structuredClone(DEFAULT_COSTING);
const $=id=>document.getElementById(id);let units=[{id:'CAB-001',name:'Cabinet Unit',type:'cabinet',x:0,z:0,finish:'oak',config:newConfig()}],selected='CAB-001',selectedPart=null,room={...DEFAULT_ROOM},mode='design',wire=false,exploded=false;
let backupError='';
try{const backup=loadBackup(localStorage);if(backup){units=backup.units;room=backup.room;selected=units[0].id;costing=backup.costing??structuredClone(DEFAULT_COSTING);projectId=backup.projectId;designRevision=backup.designRevision;migratedFrom=backup.migratedFrom??null;projectName=backup.projectName??'';clientName=backup.clientName??'';materials=backup.materials??[];drawingLayout=normalLayout(backup.drawingLayout??{});views=backup.views??[];items=backup.items??[];releases=backup.releases??[]}}catch(error){backupError='Local backup unavailable: '+error.message}
const inputKeys=['width','height','depth','thickness','partitions','shelves','backThickness','backInset','material','construction','grain','edgeThickness','kerf','sheetWidth','sheetHeight','trim','doors','doorGap','doorOverlay','finish','stockGrainAxis','backConstruction',
 'bayMode','plinthHeight','plinthSetback','backGrooveDepth','backGrooveAllowance','shelfMode','shelfSideClearance','shelfFrontSetback','edgeDeduction',
 'drawerLayout','drawerStyle','drawerFrontHeight','drawerBoxHeight','drawerSlideMode','drawerSlideLength','drawerSlideRearClearance','doorType','doorThickness','doorEdgeThickness','glassThickness','drawerBoxThickness',
 'doorMaterial','glassMaterial','drawerBoxMaterial','drawerBottomMaterial','backMaterial',
 'coverLeft','coverRight','coverFront','topFiller','topFillerSetback','worktopThickness','worktopOverhang','worktopMaterial','glassType','glassColor','handleType','handleLength','handleFinish','lightKelvin','lightLevel'];
const textKeys=['material','construction','grain','stockGrainAxis','backConstruction','bayMode','shelfMode','edgeDeduction','drawerLayout','drawerStyle','drawerSlideMode','doorType','doorMaterial','glassMaterial','drawerBoxMaterial','drawerBottomMaterial','backMaterial','worktopMaterial','glassType','glassColor','handleType','handleFinish'];
const topologyKeys=['shelves','partitions','bayMode','drawerLayout','drawerStyle','plinthHeight'];
// 3D accents follow the page look chosen at load (Industrial = Rokadex management colours).
const SKIN3D=document.documentElement.dataset.skin==='industrial';
const scene=new THREE.Scene();scene.background=new THREE.Color('#142130');
const camera=new THREE.PerspectiveCamera(42,1,10,40000);camera.position.set(2200,1800,2800);
// A graphics failure must not prevent project editing, preservation or 2D outputs.
function createRenderer(){
 for(const antialias of [true,false]){
  const canvas=document.createElement('canvas');
  try{
   const context=canvas.getContext('webgl2',{antialias,preserveDrawingBuffer:true});
   if(context)return new THREE.WebGLRenderer({canvas,context,antialias,preserveDrawingBuffer:true});
  }catch(error){console.warn('3D initialization unavailable:',error.message)}
 }
 return null;
}
let renderer=createRenderer(),controls=null;
const renderStatus=document.createElement('p');renderStatus.id='renderStatus';renderStatus.className='render-status hidden';renderStatus.setAttribute('role','status');
const fallbackDrawing=document.createElement('div');fallbackDrawing.id='fallbackDrawing';fallbackDrawing.className='fallback-drawing hidden';
$('viewport').append(renderStatus,fallbackDrawing);
function activate2D(){
 renderStatus.textContent='3D unavailable in this session. 2D drawings are active; editing, saving and exports remain available.';
 renderStatus.classList.remove('hidden');fallbackDrawing.classList.remove('hidden');
 $('viewTag').textContent='2D DESIGN VIEW';
 document.querySelector('[data-mode="render"]').disabled=true;
 for(const id of ['wire','explode','reset','front','iso','top','present','screenshot']){
  $(id).disabled=true;$(id).title='Requires 3D graphics / يتطلب الرسومات ثلاثية الأبعاد';
 }
 applyLanguage(getLanguage());
}
if(renderer){
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.innerWidth<=740?1.5:2));renderer.shadowMap.enabled=true;
 renderer.outputColorSpace=THREE.SRGBColorSpace;setupLook(renderer,scene);
 $('viewport').appendChild(renderer.domElement);controls=new OrbitControls(camera,renderer.domElement);
 controls.target.set(0,900,0);controls.enableDamping=true;controls.zoomToCursor=true;controls.maxDistance=14000;controls.minDistance=250;
 renderer.domElement.addEventListener('webglcontextlost',event=>{
  event.preventDefault();const previous=renderer;renderer=null;controls?.dispose();controls=null;
  previous.domElement.remove();previous.dispose();
  $('presentation').classList.add('hidden');display.stage='workshop';display.open.clear();display.led.clear();activate2D();renderScene();setMode('design');
 });
}else activate2D();
const hemi=new THREE.HemisphereLight('#f4f8ff','#526879',1.2);scene.add(hemi);const sun=new THREE.DirectionalLight('#fff0dd',2.4);sun.position.set(-1800,4200,2200);sun.castShadow=true;sun.shadow.radius=5;sun.shadow.bias=-0.0002;sun.shadow.normalBias=6;sun.shadow.camera.near=100;sun.shadow.camera.far=16000;sun.shadow.mapSize.set(window.innerWidth<=740?1024:2048,window.innerWidth<=740?1024:2048);sun.shadow.camera.left=-6000;sun.shadow.camera.right=6000;sun.shadow.camera.top=6000;sun.shadow.camera.bottom=-6000;scene.add(sun);const floor=new THREE.Mesh(new THREE.PlaneGeometry(12000,12000),new THREE.MeshStandardMaterial({color:'#273746',roughness:.94}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-8;scene.add(floor);const grid=new THREE.GridHelper(12000,80,SKIN3D?'#4A4D55':'#466073',SKIN3D?'#2C2E34':'#304459');grid.position.y=-6;scene.add(grid);const objects=new THREE.Group();
scene.onBeforeRender=(_renderer,_scene,cam)=>{for(const g of roomWalls?.children??[])if(g.userData.room)updateCutaway(g,cam)};scene.add(objects);const roomWalls=new THREE.Group();scene.add(roomWalls);
// Presentation-only display state: never saved in the project or used by any output.
const display={stage:'workshop',night:false,open:new Set(),led:new Set(),openAmount:new Map()};let openables=[],woodFinishes=new Set(['oak','walnut']),needsRender=true;
// The workshop stage becomes the realistic room when that look is chosen in the Presentation panel.
const stageName=()=>display.stage==='workshop'&&lighting.roomLook==='room'?'room':display.stage;
function applyStage(){
 const stage=STAGES[stageName()],night=display.night&&display.stage==='studio';
 const charcoal=document.documentElement.dataset.skin==='industrial'&&stageName()==='workshop';scene.background=new THREE.Color(night?'#0d1620':charcoal?'#141518':stage.background);floor.material.color.set(night?'#1b2733':charcoal?'#25282E':stage.floor);grid.visible=stage.grid;floor.visible=!['studio','room'].includes(stageName());
 hemi.intensity=night?0.12:lighting.ambientStrength;sun.intensity=night?0.15:lighting.sunStrength;if(renderer)renderer.toneMappingExposure=night?1.15:stage.exposure*lighting.exposure/DEFAULT_LIGHTING.exposure;
 sun.position.set(...sunPosition(lighting));
 scene.environmentIntensity=night?0.08:display.stage==='studio'?0.6:1;renderRoom();needsRender=true;
}
function renderRoom(){if(!renderer)return;clearGroup(roomWalls);needsRender=true;const w=room.width,d=room.depth,h=room.height;
 if(stageName()==='room'){roomWalls.add(buildInteriorRoom(room,{floor:lighting.floorLook,wallColor:lighting.wallColor}));return}
 if(display.stage==='studio'){
  // Dollhouse cut-away: solid floor slab and walls cut at 1.2 m so the room reads from above.
  const night=display.night,cut=Math.min(1200,h),thick=100;
  const slab=new THREE.Mesh(new THREE.BoxGeometry(w+2*thick,40,d+2*thick),new THREE.MeshStandardMaterial({color:night?'#2a2f35':'#cdbfab',roughness:.75}));slab.position.y=-31;slab.receiveShadow=true;roomWalls.add(slab);
  const wallMat=new THREE.MeshStandardMaterial({color:night?'#3a4048':'#e4e0d8',roughness:.9});
  // Walls are built in pieces so doors leave a gap and windows below the cut show their sill.
  for(const [wallName,along,run,fixed] of [['back',true,w+2*thick,-d/2-thick/2],['left',false,d,-w/2-thick/2],['right',false,d,w/2+thick/2]]){
   const start=-run/2,offsetBase=along?-thick:0,cuts=(room.openings??[]).filter(o=>o.wall===wallName).map(o=>({a:start+(along?thick:0)+o.offset+(along?0:0),b:start+(along?thick:0)+o.offset+o.width,top:o.type==='door'?0:Math.min(cut,o.sill)})).sort((p,q)=>p.a-q.a);
   const pieces=[];let cursor=start;
   for(const c of cuts){if(c.a>cursor)pieces.push([cursor,c.a,cut]);if(c.top>0)pieces.push([c.a,c.b,c.top]);cursor=Math.max(cursor,c.b)}
   if(cursor<start+run)pieces.push([cursor,start+run,cut]);
   for(const [a,b,hgt] of pieces){if(b-a<1)continue;const len=b-a,mid=(a+b)/2,wall=new THREE.Mesh(new THREE.BoxGeometry(along?len:thick,hgt,along?thick:len),wallMat);wall.userData.wall=true;wall.position.set(along?mid:fixed,hgt/2-8,along?fixed:mid);wall.castShadow=true;wall.receiveShadow=true;roomWalls.add(wall)}
   void offsetBase;
  }
  const capMat=new THREE.MeshStandardMaterial({color:night?'#c9a45c':'#2b3a46',roughness:.6});
  for(const [sx,sz,x,z] of [[w+2*thick,thick,0,-d/2-thick/2],[thick,d,-w/2-thick/2,0],[thick,d,w/2+thick/2,0]]){const cap=new THREE.Mesh(new THREE.BoxGeometry(sx,6,sz),capMat);cap.userData.wall=true;cap.position.set(x,cut-5,z);roomWalls.add(cap)}
  return;
 }
 const wallMat=new THREE.MeshStandardMaterial({color:'#5f8c9b',transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false});
 // Doors and windows drawn as outlines on the transparent walls.
 for(const o of room.openings??[]){const along=o.wall==='back'||o.wall==='front',x0=-w/2+o.offset,z0=-d/2+o.offset,pts=along?[[x0,o.sill],[x0+o.width,o.sill],[x0+o.width,o.sill+o.height],[x0,o.sill+o.height]]:[[z0,o.sill],[z0+o.width,o.sill],[z0+o.width,o.sill+o.height],[z0,o.sill+o.height]];const fixed={back:-d/2+2,front:d/2-2,left:-w/2+2,right:w/2-2}[o.wall];const geo=new THREE.BufferGeometry().setFromPoints(pts.map(([a,y])=>along?new THREE.Vector3(a,y,fixed):new THREE.Vector3(fixed,y,a)));const line=new THREE.LineLoop(geo,new THREE.LineBasicMaterial({color:o.type==='door'?'#c9a45c':'#7fc4ef'}));roomWalls.add(line)}for(const [pw,ph,x,y,z,ry] of [[w,h,0,h/2,-d/2,0],[d,h,-w/2,h/2,0,Math.PI/2],[d,h,w/2,h/2,0,Math.PI/2]]){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(pw,ph),wallMat);mesh.position.set(x,y,z);mesh.rotation.y=ry;roomWalls.add(mesh)}const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w,h,d)),new THREE.LineBasicMaterial({color:SKIN3D?'#C85A1E':'#3f8e9b',transparent:true,opacity:.45}));outline.position.y=h/2;roomWalls.add(outline)}
function refreshRoomWarnings(){const issues=inspectLayout(room,units);$('roomWarnings').textContent=issues.length?issues.map(i=>'⚠ '+i.message).join(' · '):'✓ No rectangular footprint conflicts detected';$('roomWarnings').classList.toggle('has-issues',!!issues.length)}
function refreshRoomControls(){for(const k of ['width','depth','height'])$('room'+k[0].toUpperCase()+k.slice(1)).value=room[k];renderRoom();refreshRoomWarnings()}

const materialFor=(u,back=false)=>panelMaterial(finishColor(u.finish),{wood:woodFinishes.has(u.finish),back});
// Library materials (with photos) override the finish colour on the parts they were applied to.
function surfaceFor(u,p,size){
 if(p.kind==='door'&&p.sheetGood===false)return glassMaterial(u.config.glassType,u.config.glassColor);
 if(p.kind==='back')return materialFor(u,true);
 const link=p.kind==='worktop'?u.worktopMaterialId:['door','drawerFront'].includes(p.kind)?u.frontMaterialId??u.materialId:u.materialId;
 const lib=link&&materials.find(m=>m.id===link);
 if(lib)return photoMaterial(lib,size,{onLoad:()=>{needsRender=true}})??panelMaterial(lib.color);
 if(p.kind==='worktop')return panelMaterial('#d8d4cc');
 return materialFor(u);
}
function addPanel(group,u,p){const dims=partSize(p);
 const pos=[p.position.x,p.position.y,p.position.z];
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(...dims),surfaceFor(u,p,dims));mesh.position.set(pos[0]+(exploded?pos[0]*.18:0),pos[1]+(exploded?(p.kind==='top'?180:p.kind==='bottom'?-90:0):0),pos[2]+(exploded?(p.kind==='back'?-160:0):0));if(p.id===selectedPart&&u.id===selected){mesh.material.emissive=new THREE.Color(SKIN3D?'#C85A1E':'#20a18a');mesh.material.emissiveIntensity=.5}mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={unit:u.id,part:p.id};group.add(mesh);const edges=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:'#2c3d4c',transparent:true,opacity:display.stage==='studio'?.18:.45}));mesh.add(edges);if(wire)mesh.material.wireframe=true;return mesh;
}
const handleStyle=u=>({type:u.config.handleType??'bar',length:u.config.handleLength??0,finish:u.config.handleFinish??'black'});
const fittingLook={kitchen:'#c8ced3',wardrobe:'#a7b0b6'};
function fittingMesh(u,a){
 // Procedural model of the accessory filling its size box (red when it does not fit).
 if(MODEL_TYPES.includes(a.type)){const model=accessoryModel(a.type,a.size,{fits:a.fits});model.position.set(a.position.x,a.position.y,a.position.z);model.traverse(o=>{o.userData.unit=u.id;o.userData.visualOnly=true});return model}
 const color=!a.fits?'#d9534f':a.type==='sink'?'#9aa3a9':a.type==='hob'?'#1d1f22':fittingLook[a.group];
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(...a.size),new THREE.MeshStandardMaterial({color,metalness:a.type==='hob'?0.2:0.7,roughness:.35,transparent:a.place!=='worktop',opacity:a.place==='worktop'?1:0.55}));
 mesh.position.set(a.position.x,a.position.y,a.position.z);mesh.userData={unit:u.id,visualOnly:true};return mesh;
}
function sizeLabel(text,small){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const c=canvas.getContext('2d');
 if(c){c.fillStyle='rgba(23,43,58,.82)';c.fillRect(0,0,256,64);c.fillStyle='#ffffff';c.font='bold 30px "IBM Plex Sans Arabic",Arial';c.textAlign='center';c.textBaseline='middle';c.fillText(text,128,33)}
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));sprite.scale.set(small?220:280,small?55:70,1);sprite.renderOrder=10;return sprite;
}
let lightBudget=0;
function renderScene(){
 clearGroup(objects);openables=[];needsRender=true;lightBudget=QUALITY[lighting.quality].maxLights;
 if(renderer)for(const u of units){
  // Assembly mode shows one unit, built up to the current step.
  const vis=asm?.visibility(u);if(vis?.hidden)continue;
  const g=new THREE.Group();g.position.set(u.x,u.elevation??0,u.z);g.rotation.y=THREE.MathUtils.degToRad(u.rotation??0);g.userData.unit=u.id;
  const model=cabinet(u.config,u.id),doors=model.parts.filter(p=>p.kind==='door'),drawers=new Map();
  objects.add(g);g.updateMatrixWorld(true);
  for(const p of model.parts){
   if(vis?.show&&!vis.show.has(p.id))continue;
   const mesh=addPanel(g,u,p),size=partSize(p);
   if(vis&&(vis.current.has(p.id)||vis.focus===p.id)){mesh.material=mesh.material.clone();mesh.material.emissive=new THREE.Color(vis.focus===p.id?'#ff7a1a':SKIN3D?'#C85A1E':'#20a18a');mesh.material.emissiveIntensity=vis.focus===p.id?.8:.45}
   if(p.kind==='door'){
    // Doors hang on a pivot at the hinge edge so presentations can open them; handles follow the door.
    const index=doors.indexOf(p),hingeLeft=doors.length===1||index<doors.length/2,pivot=new THREE.Group();
    pivot.position.set(mesh.position.x+(hingeLeft?-size[0]/2:size[0]/2),0,mesh.position.z+size[2]/2);g.add(pivot);pivot.updateMatrixWorld(true);pivot.attach(mesh);
    const handle=handleFor(p,size,{hingeLeft,...handleStyle(u)});if(handle)mesh.add(handle);
    openables.push({unit:u.id,type:'door',object:pivot,angle:(hingeLeft?-1:1)*THREE.MathUtils.degToRad(100)});
   }else if(['drawerFront','drawerFace','drawerSide','drawerBack','drawerBottom'].includes(p.kind)){
    const key=`${p.bay}:${p.slot}`;if(!drawers.has(key)){const group=new THREE.Group();g.add(group);drawers.set(key,group);openables.push({unit:u.id,type:'drawer',object:group,distance:u.config.depth*0.55})}
    drawers.get(key).attach(mesh);
    if(p.kind==='drawerFront'||(p.kind==='drawerFace'&&!doors.length&&!model.parts.some(q=>q.kind==='drawerFront'&&q.bay===p.bay&&q.slot===p.slot))){const handle=handleFor(p,size,handleStyle(u));if(handle)mesh.add(handle)}
   }
  }
  const strips=vis&&!vis.accessories?[]:model.accessories.filter(a=>a.kind==='ledStrip'),lit=lighting.ledsOn||display.led.has(u.id),glow=kelvinColor(u.config.lightKelvin??3000),level=(u.config.lightLevel??70)/100;
  for(const a of strips){
   // Strip glows when lights are on; a point light follows while the quality budget allows.
   const strip=new THREE.Mesh(new THREE.BoxGeometry(a.length,6,14),new THREE.MeshStandardMaterial({color:glow,emissive:glow,emissiveIntensity:lit?0.6+2.4*level:0.05}));
   strip.position.set(a.position.x,a.position.y,a.position.z);strip.userData={unit:u.id,visualOnly:true};g.add(strip);
   if(lit&&lightBudget>0){lightBudget--;const light=new THREE.PointLight(glow,(display.night?220000:90000)*level,1400,2);light.position.set(a.position.x,a.position.y-40,a.position.z-80);g.add(light)}
  }
  if(!strips.length&&display.led.has(u.id))for(const bay of model.bays??[]){
   // Warm 3000 K strip under the top of each bay (display only) when the unit has no LED positions.
   const y=model.internal.ceilY-6,x=bay.x,z=u.config.depth/2-60,strip=new THREE.Mesh(new THREE.BoxGeometry(bay.innerWidth*0.9,6,14),new THREE.MeshStandardMaterial({color:'#ffd9a0',emissive:'#ffc27a',emissiveIntensity:2.5}));
   strip.position.set(x,y,z);strip.userData.visualOnly=true;g.add(strip);
   if(lightBudget>0){lightBudget--;const light=new THREE.PointLight('#ffc27a',display.night?220000:90000,Math.max(1600,model.internal.ceilY),2);light.position.set(x,y-40,z-80);g.add(light)}
  }
  if(!vis||vis.accessories)for(const a of model.accessories.filter(a=>a.kind==='fitting'))g.add(fittingMesh(u,a));
  if(showSizes&&display.stage!=='studio')for(const space of model.spaces){const bay=model.bays[space.bay],label=sizeLabel(`${Math.round(space.width)} × ${Math.round(space.clearHeight)}`,space.kind==='drawer');label.position.set(bay.x,model.internal.floorY+(space.bottom+space.top)/2,u.config.depth/2+40);g.add(label)}
  for(const a of model.accessories)if(a.kind==='hangingRail'&&(!vis||vis.accessories)){const rail=new THREE.Mesh(new THREE.CylinderGeometry(9,9,a.length,16),new THREE.MeshStandardMaterial({color:'#b8c2c8',metalness:.8,roughness:.3}));rail.rotation.z=Math.PI/2;rail.position.set(a.position.x,a.position.y,a.position.z);rail.userData={unit:u.id};g.add(rail)}
  if(u.id===selected&&display.stage!=='studio'&&!vis){g.updateWorldMatrix(true,true);objects.add(new THREE.BoxHelper(g,'#87d9ba'))}
 }
 if(!renderer)fallbackDrawing.innerHTML=cabinetDrawingSvg(current());
 refreshTree();refreshRoomWarnings();workspace?.refresh();extras?.refresh();
}
function current(){return units.find(u=>u.id===selected)}
function clearGroup(group){
 const geometries=new Set(),materials=new Set();
 group.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const material of (Array.isArray(object.material)?object.material:[object.material]))if(material)materials.add(material)});
 group.clear();geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
}
function refreshTree(){$('tree').innerHTML=units.map(u=>`<button data-id="${esc(u.id)}" class="${u.id===selected?'active':''}">▣ &nbsp; ${esc(u.id)} · ${esc(u.name)}</button>`).join('');$('tree').querySelectorAll('button').forEach(b=>b.onclick=()=>choose(b.dataset.id))}
function choose(id){if(selected!==id)selectedPart=null;selected=id;const u=current();if(!u)return;$('selectedName').textContent=u.id;$('previewTitle').textContent=u.name;for(const k of inputKeys){const el=$(k);if(el)el.value=k==='finish'?u.finish:u.config[k]}$('posX').value=u.x;$('posZ').value=u.z;$('rotation').value=u.rotation??0;$('elevation').value=u.elevation??0;$('warning').textContent='';renderScene();refreshOutput();refreshBayEditor();refreshDrawerEditor();refreshLevelEditors();refreshPartEditor();drawingUi?.refresh()}
function refreshOutput(){const u=current();if(!u){$('parts').innerHTML='';$('summary').textContent='';return}try{const c=cabinet(u.config,u.id);$('parts').innerHTML=c.parts.map(p=>`<tr data-part="${esc(p.id)}" class="${p.id===selectedPart?'part-selected':''}"><td>${esc(p.id)}</td><td>${esc(p.kind)}</td><td>${p.length}</td><td>${p.width}</td><td>${p.thickness}</td><td>${esc(p.material)}</td><td>${p.bandLength}</td><td>${p.sheetGood?`${p.cutLength} × ${p.cutWidth}`:'supplier'}</td></tr>`).join('');refreshModelWarnings(c);$('summary').textContent=t('partsSummary',{parts:c.parts.length,area:c.totalAreaM2,edge:c.edgeLengthM});$('parts').querySelectorAll('tr[data-part]').forEach(row=>row.onclick=()=>selectPart(row.dataset.part));if(mode==='drawings')drawShop();if(mode==='manufacturing')drawNesting()}catch(e){$('warning').textContent=e.message}}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function updateConfig(u,next,topology=false){
 const previousKey=cabinet(u.config,u.id).parts.find(part=>part.id===selectedPart)?.key;
 const config=topology?remapPartOverrides(u.config,next):next;
 const model=cabinet(config,u.id);u.config=config;
 selectedPart=previousKey?model.parts.find(part=>part.key===previousKey)?.id??null:null;
 renderScene();refreshOutput();refreshBayEditor();refreshDrawerEditor();refreshLevelEditors();refreshPartEditor();
}
for(const k of inputKeys)$(k).addEventListener('change',()=>{
 const u=current();if(!u)return;const before=structuredClone(u.config),previousFinish=u.finish;
 try{
  const next={...u.config};
  if(k==='finish')u.finish=$(k).value;
  else next[k]=textKeys.includes(k)?$(k).value:Number($(k).value);
  if(k==='partitions'){delete next.bayShelves;delete next.bayDrawers;delete next.bayShelfLevels;delete next.bayRails;delete next.bayAccessories;delete next.lightPositions}
  if(k==='shelves'){delete next.bayShelves;delete next.bayShelfLevels}
  updateConfig(u,next,topologyKeys.includes(k));$('warning').textContent='';
 }catch(error){u.config=before;u.finish=previousFinish;$(k).value=k==='finish'?previousFinish:before[k];$('warning').textContent=error.message}
});
$('rotation').addEventListener('change',()=>{const u=current();u.rotation=Number($('rotation').value);choose(u.id)});

for(const [field,prop] of [['posX','x'],['posZ','z']])$(field).addEventListener('change',()=>{const u=current(),v=Number($(field).value);if(!Number.isFinite(v)||Math.abs(v)>100000){$('warning').textContent='Position must be within ±100000 mm';$(field).value=u[prop];return}u[prop]=v;renderScene()});
function refreshBayEditor(){const u=current();if(!u)return;const n=u.config.partitions+1;const counts=u.config.bayShelves?.length===n?u.config.bayShelves:Array(n).fill(u.config.shelves);$('bayEditor').innerHTML=counts.map((v,i)=>`<label>Bay ${i+1}<input type="number" min="0" max="30" step="1" data-bay="${i}" value="${v}"></label>`).join('');$('bayEditor').querySelectorAll('[data-bay]').forEach(el=>el.onchange=()=>{const next=Number(el.value),copy=[...counts];copy[Number(el.dataset.bay)]=next;try{const cfg={...u.config,bayShelves:copy};updateConfig(u,cfg,true)}catch(err){$('warning').textContent=err.message;el.value=counts[Number(el.dataset.bay)]}})}
function refreshDrawerEditor(){const u=current();if(!u)return;const n=u.config.partitions+1;const counts=u.config.bayDrawers?.length===n?u.config.bayDrawers:Array(n).fill(0);$('drawerEditor').innerHTML=counts.map((v,i)=>`<label>Bay ${i+1}<input type="number" min="0" max="12" step="1" data-drawer="${i}" value="${v}"></label>`).join('');$('drawerEditor').querySelectorAll('[data-drawer]').forEach(el=>el.onchange=()=>{const copy=[...counts];copy[Number(el.dataset.drawer)]=Number(el.value);try{const cfg={...u.config,bayDrawers:copy};updateConfig(u,cfg,true)}catch(err){$('warning').textContent=err.message;el.value=counts[Number(el.dataset.drawer)]}})}
function refreshModelWarnings(model){
 const notes=[...model.warnings.map(w=>w.message),...model.accessories.filter(a=>a.kind==='drawerSlide'||a.kind==='hangingRail').map(a=>a.kind==='drawerSlide'?`Bay ${a.bay+1} drawer ${a.slot+1}: slide ${a.length} mm (verify with supplier)`:`Bay ${a.bay+1}: hanging rail ${a.length} mm at ${a.level} mm`)];
 $('modelWarnings').innerHTML=`<b>${esc(model.rules.version)}</b> · ${esc(model.rules.status)}`+notes.map(n=>`<br>• ${esc(n)}`).join('');
}
// Shelf levels and rails are stored per bay; levels also fix that bay's shelf count.
function refreshLevelEditors(){
 const u=current();if(!u)return;const n=u.config.partitions+1;
 const levels=u.config.bayShelfLevels?.length===n?u.config.bayShelfLevels:Array(n).fill(null);
 const rails=u.config.bayRails?.length===n?u.config.bayRails:Array(n).fill(0);
 $('levelEditor').innerHTML=levels.map((v,i)=>`<label>Bay ${i+1}<input type="text" inputmode="decimal" data-levels="${i}" value="${esc((v??[]).join(', '))}" placeholder="auto"></label>`).join('');
 $('railEditor').innerHTML=rails.map((v,i)=>`<label>Bay ${i+1}<input type="number" min="0" step="10" data-rail="${i}" value="${v}"></label>`).join('');
 $('levelEditor').querySelectorAll('[data-levels]').forEach(el=>el.onchange=()=>{
  const b=Number(el.dataset.levels),text=el.value.trim();
  try{
   const parsed=text?text.split(/[,،\s]+/).filter(Boolean).map(Number):null;
   if(parsed?.some(v=>!Number.isFinite(v)))throw Error('Shelf levels must be numbers in mm separated by commas');
   const nextLevels=[...levels];nextLevels[b]=parsed?[...parsed].sort((x,y)=>x-y):null;
   const counts=u.config.bayShelves?.length===n?[...u.config.bayShelves]:Array(n).fill(u.config.shelves);
   if(parsed)counts[b]=parsed.length;
   const next={...u.config,bayShelves:counts,bayShelfLevels:nextLevels.some(Boolean)?nextLevels:undefined};
   if(!next.bayShelfLevels)delete next.bayShelfLevels;
   updateConfig(u,next,true);$('warning').textContent='';
  }catch(error){$('warning').textContent=error.message;refreshLevelEditors()}
 });
 $('railEditor').querySelectorAll('[data-rail]').forEach(el=>el.onchange=()=>{
  const nextRails=[...rails];nextRails[Number(el.dataset.rail)]=Number(el.value);
  try{const next={...u.config,bayRails:nextRails};if(nextRails.every(v=>v===0))delete next.bayRails;updateConfig(u,next);$('warning').textContent=''}
  catch(error){$('warning').textContent=error.message;refreshLevelEditors()}
 });
}
function selectPart(id){selectedPart=id;renderScene();refreshOutput();refreshPartEditor()}
function refreshPartEditor(){const u=current();if(!u)return;extras?.refresh();const part=cabinet(u.config,u.id).parts.find(p=>p.id===selectedPart);$('partLabel').textContent=part?`${part.id} · ${part.kind} · ${part.length} × ${part.width} × ${part.thickness} mm`:'Select a panel in the 3D scene or cutting list';$('partEditor').querySelectorAll('[data-edge]').forEach(el=>{el.disabled=!part;el.checked=!!part?.edges[Number(el.dataset.edge)]});$('resetPartEdges').disabled=!part}
$('partEditor').querySelectorAll('[data-edge]').forEach(el=>el.onchange=()=>{const u=current(),part=cabinet(u.config,u.id).parts.find(p=>p.id===selectedPart);if(!part)return;const edges=[...part.edges];edges[Number(el.dataset.edge)]=el.checked?1:0;const cfg={...u.config,partOverrides:{...u.config.partOverrides,[part.overrideKey]:{edges}}};try{cabinet(cfg,u.id);u.config=cfg;renderScene();refreshOutput();refreshPartEditor()}catch(err){$('warning').textContent=err.message;refreshPartEditor()}});
$('resetPartEdges').onclick=()=>{const u=current(),part=cabinet(u.config,u.id).parts.find(p=>p.id===selectedPart);if(!part)return;const overrides={...u.config.partOverrides};delete overrides[part.overrideKey];u.config={...u.config,partOverrides:overrides};renderScene();refreshOutput();refreshPartEditor()};
function drillSelection(){const u=current();if(!u||!selectedPart)throw Error('Select a panel in the model or cut list first');const part=cabinet(u.config,u.id).parts.find(p=>p.id===selectedPart);if(!part)throw Error('Selected panel is unavailable');const settings={pitch:Number($('drillPitch').value),offset:Number($('drillOffset').value),margin:Number($('drillMargin').value),diameter:Number($('drillDiameter').value),depth:Number($('drillDepth').value)};return drillingPreview(part,settings)}
function previewDrilling(){try{const result=drillSelection();$('drillSummary').textContent=`${result.panel.id}: ${result.holes.length} conceptual holes · ${result.status}`;$('drillDrawing').innerHTML=drillingSvg(result)}catch(e){$('drillSummary').textContent=e.message;$('drillDrawing').replaceChildren()}}
$('drillPreview').onclick=previewDrilling;
$('drillSvg').onclick=()=>{try{const r=drillSelection();download('drilling-reference-'+r.panel.id+'.svg',drillingSvg(r),'image/svg+xml')}catch(e){$('drillSummary').textContent=e.message}};
$('drillCsv').onclick=()=>{try{const r=drillSelection();download('drilling-reference-'+r.panel.id+'.csv',drillingCsv(r),'text/csv;charset=utf-8')}catch(e){$('drillSummary').textContent=e.message}};
function allParts(){return units.flatMap(u=>cabinet(u.config,u.id).parts)}
$('projectDxf').onclick=()=>download('rokadex-panel-outlines-PRELIMINARY.dxf',dxfPanels(allParts()),'application/dxf');
$('projectCsv').onclick=()=>download('rokadex-project-cutlist.csv',csv(allParts()),'text/csv;charset=utf-8');
$('mfgCsv').onclick=()=>{try{download(`${projectId}-R${designRevision}-manufacturing-PRELIMINARY.csv`,manufacturingCsv(snapshot()),'text/csv;charset=utf-8')}catch(e){$('warning').textContent=e.message}};
$('cutListPdf').onclick=()=>cutListWindow(snapshot());
$('partLabels').onclick=()=>{try{download(`${projectId}-R${designRevision}-part-labels.html`,labelsHtml(snapshot()),'text/html;charset=utf-8')}catch(e){$('warning').textContent=e.message}};
$('assemblyPrint').onclick=()=>{const u=current(),model=cabinet(u.config,u.id);const w=window.open('','_blank');if(!w){$('warning').textContent='Allow popups to print assembly report';return}const rows=model.parts.map(p=>`<tr data-part="${esc(p.id)}" class="${p.id===selectedPart?'part-selected':''}"><td>${esc(p.id)}</td><td>${esc(p.kind)}</td><td>${p.length} × ${p.width} × ${p.thickness}</td><td>${esc(p.material)}</td><td>${p.edges.join(' / ')}</td></tr>`).join('');w.document.write(`<!doctype html><html><head><title>Assembly · ${esc(u.id)}</title><style>body{font:14px Arial;margin:32px;color:#233}table{width:100%;border-collapse:collapse}td,th{padding:7px;border:1px solid #abb}h1{font-size:22px}small{color:#a43}</style></head><body><h1>ROKADEX · ASSEMBLY COMPONENT SCHEDULE</h1><p>${esc(u.id)} — ${esc(u.name)} | ${u.config.width} × ${u.config.height} × ${u.config.depth} mm</p><small>PRELIMINARY ONLY. VERIFY JOINERY, HARDWARE, BACK PANEL AND MACHINING BEFORE FABRICATION.</small><table><thead><tr><th>Part ID</th><th>Type</th><th>Dimensions (mm)</th><th>Material</th><th>Edge flags</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);w.document.close();w.focus();setTimeout(()=>w.print(),300)};
function addUnit(name,overrides={},finish='oak'){if(units.length>=100){$('warning').textContent='Maximum 100 units per project';return}const id=`CAB-${String(nextUnitNumber()).padStart(3,'0')}`;units.push({id,name,type:'cabinet',x:(units.length%4)*1250,z:Math.floor(units.length/4)*900,finish,config:{...newConfig(),...overrides}});choose(id)}
function addRecord(unit){if(units.length>=100){$('warning').textContent='Maximum 100 units per project';return}units.push(unit);choose(unit.id);checkpoint()}
$('addCab').onclick=()=>addUnit('Cabinet Unit');$('addTall').onclick=()=>addUnit('Tall Wardrobe',{width:1600,height:2400,depth:600,partitions:2,shelves:4});$('addDoor').onclick=()=>addUnit('Two-door Cabinet',{width:1000,height:2100,depth:550,partitions:1,shelves:3,doors:2});$('addBase').onclick=()=>addUnit('Base Kitchen Unit',{width:800,height:850,depth:580,partitions:0,shelves:1});$('delete').onclick=()=>{if(units.length===1){$('warning').textContent='Keep at least one unit in the project';return}units=units.filter(u=>u.id!==selected);choose(units[0].id)};
function setMode(next){
 const was=mode;mode=next;needsRender=true;if(was==='assembly'&&next!=='assembly')asm?.leave();if((was==='assembly')!==(next==='assembly')){if(next==='assembly')asm?.enter();renderScene()}document.querySelectorAll('.mode').forEach(button=>{button.classList.toggle('active',button.dataset.mode===next);button.setAttribute('aria-pressed',String(button.dataset.mode===next))});
 for(const [panel,value] of Object.entries({drawingsPanel:'drawings',assemblyPanel:'assembly',manufacturingPanel:'manufacturing',renderPanel:'render',planPanel:'plan',costingPanel:'costing',reviewPanel:'review',materialsPanel:'materials',cncPanel:'cnc'}))$(panel).classList.toggle('hidden',next!==value);
 $('viewTag').textContent=!renderer&&next==='design'?'2D DESIGN VIEW':next.toUpperCase()+' VIEW';refreshOutput();workspace?.refresh();applyLanguage(getLanguage());
}document.querySelectorAll('.mode').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
// The current unit's sheets (drawing + details when it has images), numbered within the whole set.
function drawingOptions(){return {company,project:projectMeta(),lang:getLanguage(),layout:drawingLayout}}
function unitSheets(){const all=drawingSheets(units,drawingOptions()),u=current();let i=0;const mine=[];for(const unit of units){const count=(unit.drawingImages??[]).length?2:1;if(unit===u)mine.push(...all.slice(i,i+count));i+=count}return mine}
function drawingSvg(){return unitSheets()[0]}
function drawingSet(){return drawingSetHtml(units,drawingOptions())}
function drawShop(){try{$('drawingContent').innerHTML=unitSheets().join('')}catch(e){$('drawingContent').textContent=e.message}}
function drawNesting(){const u=current(),model=cabinet(u.config,u.id),nest=layoutSheets(model.parts,u.config);$('sheetInfo').textContent=`${nest.sheets.length} sheets · ${nest.unplaced.length} unplaced · Shelf-packing preview, not a production cut plan`;const totals=new Map();for(const p of model.parts){const key=p.material+' / '+p.thickness+'mm';const v=totals.get(key)||{count:0,area:0,edge:0};v.count++;v.area+=p.length*p.width/1e6;v.edge+=p.bandLength/1000;totals.set(key,v)}$('materialSummary').textContent=[...totals].map(([k,v])=>`${k}: ${v.count} parts · ${v.area.toFixed(2)} m² · ${v.edge.toFixed(2)} m edge`).join('  |  ');$('sheetDrawings').innerHTML=nest.sheets.map((s,i)=>{const k=260/Math.max(s.width,s.height);return `<div><div style="font-size:10px;margin-bottom:5px">Sheet ${i+1} · ${esc(s.group)} · ${s.utilization}%</div><svg viewBox="0 0 ${s.width} ${s.height}" xmlns="http://www.w3.org/2000/svg"><rect width="${s.width}" height="${s.height}" fill="#f3eee5"/>${s.placed.map(p=>`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#8bbfb4" stroke="#214e57" stroke-width="5"/><text x="${p.x+12}" y="${p.y+28}" font-size="30" fill="#173f45">${esc(p.id.split('-').slice(-2).join('-'))}</text>`).join('')}</svg></div>`}).join('')+nest.unplaced.map(p=>`<p class="note">Unplaced: ${esc(p.id)} — ${esc(p.reason)}</p>`).join('')}
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('downloadSvg').onclick=()=>download(`${selected}-shop-drawing-${drawingLayout.paper}.svg`,drawingSvg(),'image/svg+xml');
$('downloadDrawingSet').onclick=()=>{try{download(`${projectId}-R${designRevision}-shop-drawings-${drawingLayout.paper}.html`,drawingSet(),'text/html;charset=utf-8')}catch(e){$('warning').textContent=e.message}};
$('printDrawingSet').onclick=()=>{const w=window.open('','_blank');if(!w){$('warning').textContent='Allow pop-ups to print the drawing set / اسمح بالنوافذ المنبثقة لطباعة اللوحات';return}try{w.document.open();w.document.write(drawingSet());w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch{}},500)}catch(e){w.close();$('warning').textContent=e.message}};$('exportCsv').onclick=()=>{const u=current();download(`${u.id}-cutlist.csv`,csv(cabinet(u.config,u.id).parts),'text/csv;charset=utf-8')};$('save').onclick=()=>{try{download('rokadex-project.json',serializeProject(snapshot()),'application/json')}catch(error){$('projectStatus').textContent=error.message}};
$('load').onclick=()=>$('file').click();
$('file').onchange=async event=>{
 try{
  const file=event.target.files?.[0];if(!file)return;
  if(file.size>MAX_PROJECT_BYTES)throw Error('Project exceeds 5 MB');
  const project=parseProject(await file.text());
  applyProject(project);checkpoint();
 }catch(error){$('projectStatus').textContent=t('openFailed',{error:error.message})}
 finally{event.target.value=''}
};

$('wire').onclick=()=>{wire=!wire;renderScene()};$('openFronts').onclick=()=>{const all=units.length&&units.every(u=>display.open.has(u.id));display.open.clear();if(!all)for(const u of units)display.open.add(u.id);$('openFronts').setAttribute('aria-pressed',String(!all));needsRender=true};$('explode').onclick=()=>{exploded=!exploded;renderScene()};$('reset').onclick=()=>{camera.position.set(2200,1800,2800);controls?.target.set(0,900,0);controls?.update()};$('front').onclick=()=>{camera.position.set(0,1200,4000);controls?.target.set(0,1100,0)};$('top').onclick=()=>{camera.position.set(0,4500,0);controls?.target.set(0,0,0)};$('iso').onclick=$('reset').onclick;
const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();let pointerStart=null;if(renderer){renderer.domElement.addEventListener('pointerdown',event=>{pointerStart={x:event.clientX,y:event.clientY,id:event.pointerId}});renderer.domElement.addEventListener('pointercancel',()=>{pointerStart=null});renderer.domElement.addEventListener('pointerup',e=>{const start=pointerStart;pointerStart=null;if(!start||start.id!==e.pointerId||Math.hypot(e.clientX-start.x,e.clientY-start.y)>4)return;const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(mouse,camera);const hits=raycaster.intersectObjects(objects.children,true);if(hits.length&&hits[0].object.userData.unit){choose(hits[0].object.userData.unit);selectPart(hits[0].object.userData.part)}});}
// Room tools (Edit room, furniture & appliances) come first so a press on an item or wall is not also a unit drag.
var roomTools=renderer?initRoomTools({renderer,camera,scene,objects,roomWalls,floor,$,getRoom:()=>room,setRoom:next=>{room=next;refreshRoomControls()},getUnits:()=>units,getItems:()=>items,setItems:next=>{items=next},
 canEdit:()=>canMoveUnits(),render:()=>{needsRender=true},warn:message=>{$('warning').textContent=message},commit:()=>checkpoint(),refresh:()=>{renderScene();refreshRoomControls();extras?.refresh()},
 target:()=>controls?.target??{x:0,z:0},setOrbit:on=>{if(controls)controls.enabled=on},translate:()=>applyLanguage(getLanguage())}):null;
// Move the selected unit by dragging it on the floor (design and presentation tabs). Alt = no snapping.
const canMoveUnits=()=>['design','render'].includes(mode)&&!document.body.classList.contains('worker-mode')&&$('presentation').classList.contains('hidden');
let drag=null;
if(renderer){
 const el=renderer.domElement,floorHit=new THREE.Vector3();
 const rayAt=e=>{const r=el.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(mouse,camera)};
 // Capture phase runs before OrbitControls, so a drag on the selected unit does not also orbit the camera.
 el.addEventListener('pointerdown',e=>{
  if(e.button!==0||!canMoveUnits())return;
  rayAt(e);const hit=raycaster.intersectObjects(objects.children,true).find(h=>h.object.userData.unit);
  if(!hit||hit.object.userData.unit!==selected)return;
  const u=current(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-hit.point.y);
  drag={id:e.pointerId,unit:u,plane,dx:u.x-hit.point.x,dz:u.z-hit.point.z,start:{x:u.x,z:u.z},others:otherFootprints(units,u.id),group:objects.children.find(g=>g.userData.unit===u.id),moved:false};
  if(controls)controls.enabled=false;el.setPointerCapture(e.pointerId);el.style.cursor='grabbing';
 },{capture:true});
 el.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id){if(!drag&&canMoveUnits()&&e.buttons===0){rayAt(e);const h=raycaster.intersectObjects(objects.children,true).find(h=>h.object.userData.unit);el.style.cursor=h?.object.userData.unit===selected?'grab':''}return}
  rayAt(e);if(!raycaster.ray.intersectPlane(drag.plane,floorHit))return;
  try{
   const p=dragPosition({room,unit:drag.unit,x:floorHit.x+drag.dx,z:floorHit.z+drag.dz,others:drag.others,free:e.altKey});
   if(p.x===drag.unit.x&&p.z===drag.unit.z)return;
   drag.unit.x=p.x;drag.unit.z=p.z;drag.moved=true;
   drag.group?.position.set(p.x,drag.unit.elevation??0,p.z);needsRender=true;
   $('posX').value=p.x;$('posZ').value=p.z;
   $('warning').textContent=p.snapped.length?tr2('Snapped to ','ملزوقة في ')+p.snapped.map(s=>s.replace('wall:',tr2('wall ','حيطة ')).replace('unit:','')).join(' + '):'';
  }catch(err){$('warning').textContent=err.message}
 });
 const endDrag=e=>{
  if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=null;
  if(controls)controls.enabled=true;el.style.cursor='';try{el.releasePointerCapture(e.pointerId)}catch{}
  if(d.moved){renderScene();refreshRoomControls?.();checkpoint()}
 };
 el.addEventListener('pointerup',endDrag);el.addEventListener('pointercancel',e=>{if(drag&&e.pointerId===drag.id){drag.unit.x=drag.start.x;drag.unit.z=drag.start.z;drag.moved=false;$('posX').value=drag.start.x;$('posZ').value=drag.start.z;endDrag(e);renderScene()}});
}
function tr2(en,ar){return document.documentElement.lang==='ar'?ar:en}
function screenshot(){if(!renderer)return;renderer.render(scene,camera);renderer.domElement.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='rokadex-preview.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)})}$('screenshot').onclick=screenshot;
function openPresentation(){if(!renderer)return;$('presentation').classList.remove('hidden');$('presentationCanvas').appendChild(renderer.domElement);resize();showroom.enter();applyLanguage(getLanguage())}
$('present').onclick=openPresentation;$('openShowroom').onclick=openPresentation;
$('closePresentation').onclick=()=>{if(!renderer)return;$('presentation').classList.add('hidden');$('viewport').appendChild(renderer.domElement);showroom.leave();resize()};$('lang').onclick=()=>{applyLanguage(getLanguage()==='ar'?'en':'ar');extras?.refresh();refreshReleases();roomTools?.refresh();cncUi?.refresh();applyLanguage(getLanguage());try{localStorage.setItem('rokadex.language',getLanguage())}catch{}};
function resize(){if(!renderer)return;const el=renderer.domElement.parentElement;const w=el.clientWidth,h=el.clientHeight;if(w>0&&h>0){camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);needsRender=true}}window.addEventListener('resize',resize);new ResizeObserver(resize).observe($('viewport'));new ResizeObserver(resize).observe($('presentationCanvas'));// Render on demand: only after a scene change, camera motion, a flight or an opening animation.
function tick(now){if(!renderer)return;requestAnimationFrame(tick);const flying=showroom.flying;showroom.update(now??performance.now());animateOpen();const moved=controls.update();if((moved||flying||needsRender)&&!document.hidden&&(['design','render','assembly'].includes(mode)||!$('presentation').classList.contains('hidden'))){renderer.render(scene,camera);needsRender=false}}for(const k of ['width','depth','height']){const field=$('room'+k[0].toUpperCase()+k.slice(1));field.addEventListener('change',()=>{const next={...room,[k]:Number(field.value)};try{validateRoom(next);room=next;refreshRoomControls()}catch(e){$('warning').textContent=e.message;field.value=room[k]}})}
$('snapWall').onclick=()=>{try{const pos=snapUnitToWall(room,current(),$('wallSide').value);current().x=pos.x;current().z=pos.z;choose(selected)}catch(e){$('warning').textContent=e.message}};
$('roomPlan').onclick=()=>download('rokadex-room-plan-PRELIMINARY.svg',roomPlanSvg(room,units),'image/svg+xml');
function setOpenAmount(unitId,value){display.openAmount.set(unitId,value);needsRender=true;for(const o of openables)if(o.unit===unitId){if(o.type==='door')o.object.rotation.y=o.angle*value;else o.object.position.z=o.distance*value}}
function animateOpen(){for(const u of units){const target=display.open.has(u.id)?1:0,currentValue=display.openAmount.get(u.id)??0;if(currentValue!==target||openables.some(o=>o.unit===u.id&&(o.type==='door'?o.object.rotation.y!==o.angle*target:o.object.position.z!==o.distance*target)))setOpenAmount(u.id,Math.abs(target-currentValue)<0.01?target:currentValue+(target-currentValue)*0.14)}}
const finishName=value=>[...document.querySelectorAll('#finish option')].find(option=>option.value===value)?.textContent||value;
const showroom=initShowroom({camera,controls,display,applyStage,renderScene,getUnits:()=>units,getSelected:()=>selected,select:choose,getCompany:()=>company,getProject:()=>projectMeta(),getRenderer:()=>renderer,getRoom:()=>room,scene,setWalls:visible=>roomWalls.traverse(object=>{if(object.userData.wall)object.visible=visible}),finishName,setOpenAmount,
 hasFronts:id=>openables.some(o=>o.unit===id),onError:message=>{$('projectStatus').textContent=message}});

// Settings: project identity is saved with the project; company identity stays in this browser.
let pendingLogo=company.logo;
function logoPreview(){$('companyLogoPreview').innerHTML=pendingLogo?`<img src="${esc(pendingLogo)}" alt="">`:'<span>—</span>'}
$('openSettings').onclick=()=>{
 $('projectName').value=projectName;$('clientName').value=clientName;
 for(const [id,key] of [['companyName','name'],['companyNameAr','nameAr'],['companyPhone','phone'],['companyEmail','email'],['companyWebsite','website'],['companyTagline','tagline'],['companyAddress','address']])$(id).value=company[key];
 pendingLogo=company.logo;logoPreview();$('settingsError').textContent='';$('settingsDialog').showModal();
};
$('companyLogo').onchange=()=>{const file=$('companyLogo').files[0];$('companyLogo').value='';if(!file)return;
 if(file.size>MAX_LOGO_BYTES){$('settingsError').textContent=`Logo must be at most ${MAX_LOGO_BYTES/1024} KB`;return}
 const reader=new FileReader();reader.onload=()=>{try{pendingLogo=validateLogo(String(reader.result));logoPreview();$('settingsError').textContent=''}catch(e){$('settingsError').textContent=e.message}};reader.readAsDataURL(file)};
$('companyLogoRemove').onclick=()=>{pendingLogo='';logoPreview()};
$('settingsSave').onclick=event=>{
 event.preventDefault();
 try{
  const next=validateCompany({name:$('companyName').value,nameAr:$('companyNameAr').value,phone:$('companyPhone').value,email:$('companyEmail').value,website:$('companyWebsite').value,tagline:$('companyTagline').value,address:$('companyAddress').value,logo:pendingLogo});
  const name=$('projectName').value.trim(),client=$('clientName').value.trim();
  parseProject({...snapshot(),projectName:name,clientName:client});
  try{company=saveCompany(localStorage,next)}catch(e){company=next;$('projectStatus').textContent='Company settings apply to this session only: '+e.message}
  const projectChanged=name!==projectName||client!==clientName;projectName=name;clientName=client;
  $('settingsDialog').close();if(projectChanged)checkpoint();refreshOutput();showroom.refresh();
 }catch(e){$('settingsError').textContent=e.message}
};
refreshRoomControls();choose(selected);resize();tick();

// Alpha 0.4 manufacturing method templates and hardware estimate (no CNC coordinates).
const methodSelect=document.getElementById('manufacturingMethod');
if(methodSelect){methodSelect.innerHTML='<option value="">Select construction method…</option>'+Object.entries(METHODS).map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('');
 document.getElementById('applyManufacturingMethod').onclick=()=>{try{if(!methodSelect.value)return;current().config=applyMethod(current().config,methodSelect.value);choose(selected)}catch(err){document.getElementById('warning').textContent=err.message}};
 document.getElementById('hardwareReport').onclick=()=>{const h=hardwareSchedule(current().config,current().id);document.getElementById('hardwareResults').textContent=h.status+'\n'+h.rows.map(r=>`${r.item}: ${r.qty??'TBD'} ${r.unit} — ${r.notes}`).join('\n')};
}

// User-controlled verified hardware library; never execute or trust imported JSON as code.
let verifiedHardware={items:[]};
const hardwareFileInput=document.getElementById('hardwareFile');
const hardwareItemSelect=document.getElementById('hardwareItem');
const hardwareStatus=document.getElementById('hardwareStatus');
document.getElementById('hardwareTemplate').onclick=()=>download('rokadex-hardware-template.json',JSON.stringify(hardwareLibraryTemplate(),null,2),'application/json');
hardwareFileInput.onchange=async()=>{try{const f=hardwareFileInput.files?.[0];if(!f)return;if(f.size>1024*1024)throw Error('Library exceeds 1 MB');const data=JSON.parse(await f.text());validateHardwareLibrary(data);verifiedHardware=data;hardwareItemSelect.replaceChildren(new Option('Select verified hardware…',''),...data.items.map(i=>new Option(`${i.manufacturer} — ${i.model||i.id}`,i.id)));hardwareStatus.textContent=`Imported ${data.items.length} verified items. Review documentation and datum before use.`}catch(e){verifiedHardware={items:[]};hardwareItemSelect.replaceChildren(new Option('Import a verified library…',''));hardwareStatus.textContent='Import rejected: '+e.message}};
function currentHardwarePlan(){const u=current();if(!u||!selectedPart)throw Error('Select a panel first');const p=cabinet(u.config,u.id).parts.find(x=>x.id===selectedPart);if(!p)throw Error('Panel no longer exists');if(!hardwareItemSelect.value)throw Error('Select verified hardware');return joineryPlan(p,verifiedHardware,hardwareItemSelect.value)}
document.getElementById('hardwarePreview').onclick=()=>{try{const r=currentHardwarePlan();hardwareStatus.textContent=`${r.panel.id}: ${r.holes.length} reference holes. ${r.status}. Confirm origin/face/rotation manually.`}catch(e){hardwareStatus.textContent=e.message}};
document.getElementById('hardwareCsv').onclick=()=>{try{const r=currentHardwarePlan();download('hardware-reference-'+r.panel.id+'.csv',joineryCsv(r),'text/csv;charset=utf-8')}catch(e){hardwareStatus.textContent=e.message}};

// Standalone engineering review workspace — does not connect to Rokadex SaaS.
const reviewStatus=document.getElementById('reviewStatus');
function latestReview(){return reviewProject(room,units)}
function showReview(){try{const r=latestReview();reviewStatus.textContent=`${r.status} · ${r.summary.units} units · ${r.summary.parts} parts · ${r.summary.blockers} blockers · ${r.summary.warnings} warnings`;
 const rows=r.issues.map(i=>`<tr><td>${esc(i.severity)}</td><td>${esc(i.code)}</td><td>${esc(i.unit)}</td><td>${esc(i.message)}</td></tr>`).join('');
 const materials=r.materials.map(m=>`<tr><td>${esc(m.material)}</td><td>${m.thickness}</td><td>${m.count}</td><td>${m.areaM2}</td><td>${m.edgeM}</td></tr>`).join('');
 document.getElementById('reviewOutput').innerHTML=`<p class="note">PRELIMINARY REVIEW ONLY · ${r.summary.areaM2} m² panels · ${r.summary.edgeM} m edges · ${r.summary.previewSheets} preview sheets</p><h4>Review issues</h4><div class="review-scroll"><table><thead><tr><th>Severity</th><th>Code</th><th>Unit</th><th>Finding</th></tr></thead><tbody>${rows}</tbody></table></div><h4>Material rollup</h4><div class="review-scroll"><table><thead><tr><th>Material</th><th>mm</th><th>Parts</th><th>m²</th><th>Edge m</th></tr></thead><tbody>${materials}</tbody></table></div>`;
 }catch(e){reviewStatus.textContent='Review failed: '+e.message;document.getElementById('reviewOutput').textContent=e.message}}
document.getElementById('runReview').onclick=showReview;
document.getElementById('reviewCsv').onclick=()=>{try{download('rokadex-project-REVIEW-ONLY.csv',projectManufacturingCsv(latestReview()),'text/csv;charset=utf-8')}catch(e){reviewStatus.textContent=e.message}};
document.getElementById('panelDetail').onclick=()=>{try{if(!selectedPart)throw Error('Select a panel in the 3D view or parts list');const p=cabinet(current().config,current().id).parts.find(p=>p.id===selectedPart);if(!p)throw Error('Selected panel is unavailable');download(p.id+'-PANEL-REVIEW.svg',partDrawingSvg(p),'image/svg+xml')}catch(e){reviewStatus.textContent=e.message}};
showReview();

// Combined sheet preview across all cabinets, grouped by stock dimensions/material/grain.
const sheetPlanStatus=document.getElementById('projectSheetStatus');
function showProjectSheets(){try{const plan=projectSheetPlan(units);sheetPlanStatus.textContent=`${plan.sheets.length} sheets · ${plan.placedCount} placed · ${plan.unplaced.length} unplaced · ${plan.utilization}% area utilization · REVIEW ONLY`;document.getElementById('projectSheetPreview').innerHTML=projectSheetSvg(plan)}catch(e){sheetPlanStatus.textContent=e.message;document.getElementById('projectSheetPreview').replaceChildren()}}
document.getElementById('projectSheetRun').onclick=showProjectSheets;
document.getElementById('projectSheetSvg').onclick=()=>{try{download('rokadex-project-sheet-PREVIEW.svg',projectSheetSvg(projectSheetPlan(units)),'image/svg+xml')}catch(e){sheetPlanStatus.textContent=e.message}};
document.getElementById('projectSheetCsv').onclick=()=>{try{download('rokadex-project-sheet-PREVIEW.csv',projectSheetCsv(projectSheetPlan(units)),'text/csv;charset=utf-8')}catch(e){sheetPlanStatus.textContent=e.message}};
showProjectSheets();

// Project history stores validated, detached model snapshots; view-only changes are excluded.
function snapshot(){return {format:'rokadex-standalone',version:3,projectId,designRevision,lengthUnit:'mm',...(migratedFrom?{migratedFrom}:{}),...(projectName?{projectName}:{}),...(clientName?{clientName}:{}),...(materials.length?{materials}:{}),drawingLayout,...(views.length?{views}:{}),...(items.length?{items}:{}),...(releases.length?{releases}:{}),units,room,costing}}
const projectMeta=()=>({id:projectId,name:projectName,client:clientName,revision:designRevision});
function refreshIdentity(){refreshReleases();$('projectIdLabel').textContent=projectId;$('designRevision').value=designRevision}
$('designRevision').addEventListener('change',()=>{const v=Number($('designRevision').value);if(!Number.isInteger(v)||v<1||v>9999){$('designRevision').value=designRevision;$('projectStatus').textContent='Design revision must be a whole number 1–9999';return}designRevision=v;checkpoint()});
function nextUnitNumber(){let number=1;while(units.some(unit=>unit.id===`CAB-${String(number).padStart(3,'0')}`))number++;return number}
function applyProject(project){
 units=project.units;room=project.room;costing=project.costing??structuredClone(DEFAULT_COSTING);selectedPart=null;
 projectId=project.projectId??newProjectId();designRevision=project.designRevision??1;migratedFrom=project.migratedFrom??null;projectName=project.projectName??'';clientName=project.clientName??'';materials=project.materials??[];drawingLayout=normalLayout(project.drawingLayout??{});views=project.views??[];items=project.items??[];releases=project.releases??[];roomTools?.refresh();renderExport?.refresh();refreshIdentity();drawingUi?.refresh();
 refreshRoomControls();choose(units.some(unit=>unit.id===selected)?selected:units[0].id);
 showReview();showProjectSheets();workspace?.refresh();applyLanguage(getLanguage());
}
refreshIdentity();
const history=createHistory(snapshot(),{limit:30});
function refreshHistory(){$('undo').disabled=!history.canUndo;$('redo').disabled=!history.canRedo}
function persist(){
 try{saveBackup(localStorage,snapshot());$('projectStatus').textContent='Saved locally · export JSON for a portable copy'}
 catch(error){$('projectStatus').textContent='Local backup failed: '+error.message+' · export JSON to keep your work'}
}
function checkpoint(){
 try{
  // After an issue, the first real change moves the working design to the next revision number (a new draft).
  if(releases.length){const next=revisionAfterEdit(parseProject(snapshot()));if(next!==designRevision){designRevision=next;refreshIdentity()}}
  if(history.push(snapshot())){persist();showReview();showProjectSheets();workspace?.refresh()}}
 catch(error){applyProject(history.current());$('projectStatus').textContent='Change rejected: '+error.message}
 refreshHistory();refreshReleases();
}
function travel(direction){const project=history[direction]();if(project){
 // Issued revisions are append-only: undo/redo never removes an issue; the design returns as a draft of the next number.
 if(releases.length>(project.releases?.length??0)){project.releases=releases;const last=releases.at(-1).revision;if(project.designRevision<=last){project.designRevision=last;try{project.designRevision=revisionAfterEdit(parseProject(project))}catch{project.designRevision=last+1}}}
 applyProject(project);persist()}refreshHistory()}
// ---------- Approve & issue (numbered, frozen revisions in the project file) ----------
function cutListWindow(project){const w=window.open('','_blank');if(!w){$('warning').textContent=tr2('Allow pop-ups to print the cut list','اسمح بالنوافذ المنبثقة لطباعة قائمة التقطيع');return}try{w.document.open();w.document.write(cutListHtml(project,{lang:getLanguage(),company}));w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch{}},500)}catch(e){w.close();$('warning').textContent=e.message}}
function printHtml(html){const w=window.open('','_blank');if(!w){$('warning').textContent=tr2('Allow pop-ups to print','اسمح بالنوافذ المنبثقة للطباعة');return}try{w.document.open();w.document.write(html);w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch{}},500)}catch(e){w.close();$('warning').textContent=e.message}}
{const look=$('studioLook');if(look){look.value=document.documentElement.dataset.skin==='industrial'?'industrial':'light';look.onchange=()=>{const v=look.value==='light'?'light':'industrial';try{localStorage.setItem('rokadex.studio.look',v)}catch{}if(v==='industrial')document.documentElement.dataset.skin='industrial';else delete document.documentElement.dataset.skin;applyStage();needsRender=true}}}
var cncUi=initCncUi({getProject:()=>parseProject(snapshot()),download,printHtml,tr2,lang:getLanguage});
function refreshReleases(){
 const list=$('releaseList'),badge=$('releaseBadge');if(!list||!badge)return;
 let state;try{state=releases.length?releaseState(parseProject(snapshot())):{status:'never',revision:designRevision,latest:null}}catch{state={status:'never',revision:designRevision,latest:releases.at(-1)??null}}
 const latest=state.latest;
 badge.textContent=state.status==='issued'?tr2(`Issued R${latest.revision}`,`معتمد R${latest.revision}`):state.status==='never'?tr2(`Draft R${designRevision} · not issued`,`مسودة R${designRevision} · غير معتمدة`):state.status==='unchanged'?tr2(`Draft R${designRevision} · same as R${latest.revision}`,`مسودة R${designRevision} · زي R${latest.revision}`):tr2(`Draft R${designRevision} · changed since R${latest.revision}`,`مسودة R${designRevision} · اتعدلت بعد R${latest.revision}`);
 badge.dataset.state=state.status;
 $('issueRelease').disabled=state.status==='issued'||state.status==='unchanged';
 $('issueRelease').textContent=tr2(`Approve & issue R${designRevision}`,`اعتماد وإصدار R${designRevision}`);
 const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 list.innerHTML=releases.length?releases.slice().reverse().map(r=>`<div class="release-row"><div><b>R${r.revision}</b> <small>${esc(new Date(r.issuedAt).toLocaleString(getLanguage()==='ar'?'ar-EG':'en-GB'))}</small>${r.note?`<div class="note">${esc(r.note)}</div>`:''}</div><div class="release-actions"><button data-release-pdf="${r.revision}">${tr2('Cut list PDF','قائمة التقطيع PDF')}</button><button data-release-csv="${r.revision}">${tr2('Manufacturing CSV','CSV التصنيع')}</button><button data-release-json="${r.revision}">${tr2('Project file','ملف المشروع')}</button><button data-release-restore="${r.revision}">${tr2('Restore as draft','رجّعها مسودة')}</button></div></div>`).join(''):`<p class="note">${tr2('No issued revisions yet.','لسه مفيش نسخ معتمدة.')}</p>`;
}
$('issueRelease').onclick=()=>{
 try{
  const current=parseProject(snapshot());
  if(!confirm(tr2(`Issue R${designRevision}? It will be frozen in the project file and cannot be edited. Later changes start R${designRevision+1}.`,`اعتماد وإصدار R${designRevision}؟ هتتقفل جوه ملف المشروع ومش هتتعدل، وأي تعديل بعد كده يبدأ R${designRevision+1}.`)))return;
  releases=issueRelease(current,{note:$('releaseNote').value});$('releaseNote').value='';
  checkpoint();refreshReleases();$('projectStatus').textContent=tr2(`R${designRevision} issued · saved in this browser · export the project file to keep a copy`,`تم إصدار R${designRevision} · محفوظة في المتصفح ده · صدّر ملف المشروع عشان تحتفظ بنسخة`);
 }catch(e){$('warning').textContent=e.message;$('projectStatus').textContent=e.message}
};
$('releaseList').addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;
 try{
  const n=Number(b.dataset.releasePdf??b.dataset.releaseCsv??b.dataset.releaseJson??b.dataset.releaseRestore),frozen=releasedProject(snapshot(),n);
  if(b.dataset.releasePdf)cutListWindow(frozen);
  else if(b.dataset.releaseCsv)download(`${projectId}-R${n}-manufacturing-ISSUED.csv`,manufacturingCsv(frozen),'text/csv;charset=utf-8');
  else if(b.dataset.releaseJson)download(`${projectId}-R${n}-issued.rokadex.json`,serializeProject(frozen),'application/json');
  else if(b.dataset.releaseRestore){
   if(!confirm(tr2(`Replace the working design with R${n}? Undo is available.`,`استبدال التصميم الحالي بـ R${n}؟ تقدر تتراجع.`)))return;
   const keep={projectId,designRevision,releases};applyProject({...frozen,...keep});checkpoint();
  }
 }catch(e){$('warning').textContent=e.message}
});
$('undo').onclick=()=>travel('undo');$('redo').onclick=()=>travel('redo');
$('newProject').onclick=()=>{
 if(!confirm('Create a new project? Export JSON first if you need a portable copy. / إنشاء مشروع جديد؟ صدّر ملف JSON للاحتفاظ بنسخة مستقلة.'))return;
 applyProject({projectId:newProjectId(),designRevision:1,room:{...DEFAULT_ROOM},costing:structuredClone(DEFAULT_COSTING),units:[{id:'CAB-001',name:'Cabinet Unit',type:'cabinet',x:0,z:0,finish:'oak',config:newConfig()}]});
 checkpoint();
};
$('duplicate').onclick=()=>{
 if(units.length>=100){$('projectStatus').textContent='Maximum 100 units per project';return}
 const copy=structuredClone(current());copy.id=`CAB-${String(nextUnitNumber()).padStart(3,'0')}`;
 copy.name=copy.name.slice(0,180)+' (copy)';copy.x=Math.min(100000,copy.x+100);
 units.push(copy);choose(copy.id);checkpoint();
};
document.addEventListener('change',event=>{if(event.composedPath().some(node=>node.matches?.('.inspector,.sidebar'))&&event.target.id!=='hardwareFile')checkpoint()});
document.addEventListener('click',event=>{
 const button=event.target.closest('button');
 if(button&&(['addCab','addBase','addTall','addDoor','delete','resetPartEdges','snapWall','applyManufacturingMethod'].includes(button.id)||button?.dataset.template))checkpoint();
});
document.addEventListener('keydown',event=>{
 if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();travel(event.shiftKey?'redo':'undo');return}
 if(event.ctrlKey||event.metaKey||event.altKey||!canMoveUnits()||!current())return;
 const step=nudge(event.key,event.shiftKey);
 if(step){event.preventDefault();const u=current();u.x=Math.max(-100000,Math.min(100000,u.x+step[0]));u.z=Math.max(-100000,Math.min(100000,u.z+step[1]));$('posX').value=u.x;$('posZ').value=u.z;renderScene();checkpoint();return}
 if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();$('delete').click();return}
 if(event.key==='r'||event.key==='R'){const sel=$('rotation');sel.value=String(((Number(sel.value)||0)+90)%360);sel.dispatchEvent(new Event('change',{bubbles:true}))}
});
refreshHistory();
if(backupError)$('projectStatus').textContent=backupError+' · export JSON to keep your work';

let preferredLanguage=navigator.language.startsWith('ar')?'ar':'en';
try{const savedLanguage=localStorage.getItem('rokadex.language');if(['ar','en'].includes(savedLanguage))preferredLanguage=savedLanguage}catch{}
applyLanguage(preferredLanguage);
document.addEventListener('click',()=>applyLanguage(getLanguage()));
document.addEventListener('change',()=>applyLanguage(getLanguage()));

workspace=initWorkspace({
 getProject:snapshot,getSelectedId:()=>selected,select:choose,download,
 commit:project=>{const validated=parseProject(project);applyProject(validated);checkpoint()},
 onError:message=>{$('projectStatus').textContent=message}
});

// 1.6 editors and the view-only lighting panel.
var extras=null;
extras=initExtras({current,getUnits:()=>units,getRoom:()=>room,setRoom:next=>{room=next;refreshRoomControls();renderScene()},getMaterials:()=>materials,setMaterials:next=>{materials=next},
 update:updateConfig,commit:checkpoint,choose,render:renderScene,addRecord,nextId:()=>`CAB-${String(nextUnitNumber()).padStart(3,'0')}`,selectedPart:()=>selectedPart,
 warn:message=>{$('warning').textContent=message},download,company:()=>company,projectMeta,captureRoom:()=>showroom.captureRoom()});
// Camera aimed at one unit (assembly, booklet pictures).
function focusUnit(u){if(!u||!renderer)return;const H=u.config.height,W=u.config.width,el=u.elevation??0,a=THREE.MathUtils.degToRad(u.rotation??0),dist=Math.max(W,H)*1.7+600;controls.target.set(u.x,el+H/2,u.z);camera.position.set(u.x+Math.sin(a)*dist+Math.cos(a)*dist*0.45,el+H*0.75,u.z+Math.cos(a)*dist-Math.sin(a)*dist*0.45);controls.update();needsRender=true}
var asm=initAssembly({getUnits:()=>units,current,active:()=>mode==='assembly',render:renderScene,focusUnit,setMode,resize,projectId:()=>projectId,projectMeta,warn:message=>{$('warning').textContent=message},
 capture:async u=>{if(!renderer)return null;renderScene();focusUnit(u);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/jpeg',0.82)}});
var renderExport=initRenderExport({getRenderer:()=>renderer,scene,camera,getControls:()=>controls,objects,hideWhenTransparent:()=>[floor,grid,roomWalls],getViews:()=>views,setViews:next=>{views=next},commit:checkpoint,projectId:()=>projectId,render:()=>{needsRender=true},warn:message=>{$('warning').textContent=message}});
var drawingUi=initDrawingUi({current,getLayout:()=>drawingLayout,setLayout:next=>{drawingLayout=next},commit:checkpoint,redraw:()=>{if(mode==='drawings')drawShop()},warn:message=>{$('warning').textContent=message}});
function applyLighting(){
 const q=QUALITY[lighting.quality];
 if(renderer){renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,q.pixelRatio,window.innerWidth<=740?1.5:3));resize()}
 const size=window.innerWidth<=740?Math.min(1024,q.shadowMap):q.shadowMap;
 if(sun.shadow.mapSize.x!==size){sun.shadow.mapSize.set(size,size);sun.shadow.map?.dispose();sun.shadow.map=null}
 sun.shadow.radius=q.shadowRadius;
 for(const [id,key] of [['renderQuality','quality'],['sunAzimuth','sunAzimuth'],['sunElevation','sunElevation'],['sunStrength','sunStrength'],['ambientStrength','ambientStrength'],['exposure','exposure'],['roomLook','roomLook'],['floorLook','floorLook'],['wallColor','wallColor']])$(id).value=lighting[key];
 $('ledsOn').checked=lighting.ledsOn;applyStage();renderScene();
}
for(const [id,key] of [['renderQuality','quality'],['sunAzimuth','sunAzimuth'],['sunElevation','sunElevation'],['sunStrength','sunStrength'],['ambientStrength','ambientStrength'],['exposure','exposure'],['ledsOn','ledsOn'],['roomLook','roomLook'],['floorLook','floorLook'],['wallColor','wallColor']])$(id).addEventListener('input',()=>{lighting=saveLighting(localStorage,{...lighting,[key]:id==='ledsOn'?$(id).checked:['renderQuality','roomLook','floorLook','wallColor'].includes(id)?$(id).value:Number($(id).value)});applyLighting()});
$('lightingReset').onclick=()=>{lighting=saveLighting(localStorage,DEFAULT_LIGHTING);applyLighting()};
$('insideSizes').onclick=()=>{showSizes=!showSizes;$('insideSizes').setAttribute('aria-pressed',String(showSizes));renderScene()};
applyLighting();
const catalog=initReferenceLibrary({getProject:snapshot,addUnit,commit:project=>{applyProject(parseProject(project));checkpoint()},onError:message=>{$('projectStatus').textContent=message}});
const finishNames=new Map([...document.querySelectorAll('#finish option')].map(option=>[option.value,option.textContent]));
for(const group of catalog?.finishes??[])for(const entry of group.finishes)if(entry.wood)woodFinishes.add(entry.color);
renderScene();

// View-only layout state never enters project history or manufacturing data.
const focusWorkspace=$('focusWorkspace');
function setWorkspaceFocus(focused){
 document.body.classList.toggle('workspace-focused',focused);
 focusWorkspace.setAttribute('aria-pressed',String(focused));
 focusWorkspace.textContent=focused?'Restore panels':'Focus workspace';
 applyLanguage(getLanguage());
}
focusWorkspace.onclick=()=>setWorkspaceFocus(!document.body.classList.contains('workspace-focused'));
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&document.body.classList.contains('workspace-focused')){
  setWorkspaceFocus(false);focusWorkspace.focus();
 }
});
