/** View-only lighting and render-quality settings, kept in this browser and never in the project. */
export const LIGHTING_KEY='rokadex-studio.lighting.v1';
export const QUALITY=Object.freeze({
 normal:{pixelRatio:1,shadowMap:1024,shadowRadius:3,maxLights:6},
 high:{pixelRatio:2,shadowMap:2048,shadowRadius:5,maxLights:12},
 ultra:{pixelRatio:3,shadowMap:4096,shadowRadius:8,maxLights:24},
});
export const DEFAULT_LIGHTING=Object.freeze({quality:'high',sunAzimuth:-40,sunElevation:55,sunStrength:2.4,ambientStrength:1.2,exposure:1.05,ledsOn:false});
const RANGES={sunAzimuth:[-180,180],sunElevation:[10,85],sunStrength:[0,5],ambientStrength:[0,3],exposure:[0.4,2]};
export function validateLighting(input){
 const out={...DEFAULT_LIGHTING};
 if(!input||typeof input!=='object')return out;
 if(Object.hasOwn(QUALITY,input.quality))out.quality=input.quality;
 for(const [key,[min,max]] of Object.entries(RANGES))if(typeof input[key]==='number'&&Number.isFinite(input[key]))out[key]=Math.min(max,Math.max(min,input[key]));
 if(typeof input.ledsOn==='boolean')out.ledsOn=input.ledsOn;
 return out;
}
export function loadLighting(storage){try{return validateLighting(JSON.parse(storage?.getItem(LIGHTING_KEY)??'null'))}catch{return {...DEFAULT_LIGHTING}}}
export function saveLighting(storage,settings){const valid=validateLighting(settings);try{storage?.setItem(LIGHTING_KEY,JSON.stringify(valid))}catch{}return valid}
/** Sun position on a sphere around the room centre (mm). */
export function sunPosition(settings,distance=5200){
 const az=settings.sunAzimuth*Math.PI/180,el=settings.sunElevation*Math.PI/180;
 return [Math.sin(az)*Math.cos(el)*distance,Math.sin(el)*distance,Math.cos(az)*Math.cos(el)*distance];
}
