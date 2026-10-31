/**
 * High-resolution image export and camera views for presentations.
 * Display only: nothing here reads or changes cut sizes, materials or any manufacturing output.
 */
export const RESOLUTIONS=Object.freeze({screen:null,fhd:[1920,1080],'2k':[2560,1440],'4k':[3840,2160]});
export const FORMATS=Object.freeze({
 png:{mime:'image/png',ext:'png',alpha:true},
 jpeg:{mime:'image/jpeg',ext:'jpg',alpha:false,quality:0.92},
 webp:{mime:'image/webp',ext:'webp',alpha:true,quality:0.95},
});
export const DEFAULT_EXPORT=Object.freeze({resolution:'fhd',format:'png',transparent:false,ao:true});

export function normalExport(input={}){
 const o={...DEFAULT_EXPORT,...(input&&typeof input==='object'?input:{})};
 if(!Object.hasOwn(RESOLUTIONS,o.resolution))throw Error('Unknown image size');
 if(!Object.hasOwn(FORMATS,o.format))throw Error('Unknown image format');
 // JPEG has no alpha channel, so a transparent background is only offered for PNG and WebP.
 const transparent=o.transparent===true&&FORMATS[o.format].alpha;
 // Ambient occlusion is composited over an opaque frame; it is skipped for transparent images.
 return {resolution:o.resolution,format:o.format,transparent,ao:o.ao===true&&!transparent};
}

/** Pixel size of the export; "screen" keeps the viewport size. Throws when the GPU cannot hold the frame. */
export function exportSize(resolution,screen=[1280,720],maxSize=Infinity){
 const size=RESOLUTIONS[resolution]??screen.map(v=>Math.max(1,Math.round(v)));
 if(size[0]>maxSize||size[1]>maxSize)throw Error(`This device's graphics can render at most ${maxSize} px; choose a smaller size`);
 return size;
}

const slug=value=>String(value??'').normalize('NFKD').replace(/[^\w-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,40);
export function exportFileName(projectId,view,options){
 const o=normalExport(options),[w,h]=RESOLUTIONS[o.resolution]??['screen',''];
 return [slug(projectId)||'rokadex',slug(view)||'view',h?`${w}x${h}`:'screen'].join('-')+'.'+FORMATS[o.format].ext;
}

export const CAMERA_PRESETS=Object.freeze(['front','side','top','iso','eye']);
const DIRECTIONS={front:[0,0,1],side:[1,0,0],top:[0,1,0.0001],iso:[1,0.8,1]};

/**
 * Camera position and target that fit a bounding box (mm) for a preset view.
 * front = +Z (as the Front button), side = +X, top = from above, iso = front-right-above,
 * eye = standing in front at eye height looking at the middle of the units.
 */
export function framePreset(preset,box,{fov=42,aspect=16/9,eyeHeight=1600,margin=1.12}={}){
 if(!CAMERA_PRESETS.includes(preset))throw Error('Unknown camera view');
 const min=box.min,max=box.max;
 if(![...min,...max].every(Number.isFinite)||max.some((v,i)=>v<min[i]))throw Error('Nothing to frame');
 const center=min.map((v,i)=>(v+max[i])/2),size=max.map((v,i)=>v-min[i]);
 const radius=Math.max(Math.hypot(...size)/2,300);
 const vfov=fov*Math.PI/180,hfov=2*Math.atan(Math.tan(vfov/2)*aspect);
 const distance=radius*margin/Math.sin(Math.min(vfov,hfov)/2);
 if(preset==='eye'){
  const halfWidth=Math.max(size[0],size[2])/2,flat=Math.max(halfWidth*margin/Math.tan(hfov/2),size[1]*margin/2/Math.tan(vfov/2))+max[2]-center[2];
  return {position:[center[0],eyeHeight,center[2]+flat],target:[center[0],Math.min(center[1],eyeHeight),center[2]]};
 }
 const d=DIRECTIONS[preset],len=Math.hypot(...d);
 return {position:center.map((v,i)=>v+d[i]/len*distance),target:center};
}

export const MAX_VIEWS=12;
const finite=(v,limit=200000)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=limit;
const point=(v,what)=>{if(!Array.isArray(v)||v.length!==3||!v.every(n=>finite(n)))throw Error(`Invalid camera ${what}`);return v.map(n=>Math.round(n*10)/10)};

/** Saved camera views kept in the project file: name, position, target and lens angle. */
export function validateViews(list){
 if(!Array.isArray(list))throw Error('Saved views must be a list');
 if(list.length>MAX_VIEWS)throw Error(`At most ${MAX_VIEWS} saved views`);
 const names=new Set();
 return list.map(v=>{
  if(!v||typeof v!=='object')throw Error('Invalid saved view');
  const name=typeof v.name==='string'?v.name.trim():'';
  if(!name||name.length>60)throw Error('A saved view needs a name of 1–60 characters');
  if(names.has(name))throw Error(`Two saved views are called "${name}"`);names.add(name);
  const fov=v.fov??42;if(!finite(fov)||fov<15||fov>90)throw Error('Camera angle must be 15–90°');
  return {name,position:point(v.position,'position'),target:point(v.target,'target'),fov};
 });
}
