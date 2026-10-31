import * as THREE from 'three';

/**
 * Path-traced still image (beta) using three-gpu-pathtracer's WebGLPathTracer (MIT, Garrett Johnson).
 * Light bounces between walls, units and floor, so rooms get real indirect light and soft shadows.
 * It renders on its own off-screen WebGL canvas: the live 3D view keeps working, and the scene is
 * read once (visible meshes and lights at the moment of the call); edits made while it runs are not
 * in the image. Display only: nothing here reads or changes cut sizes or manufacturing outputs.
 */
export const PT_SAMPLES=Object.freeze([64,256,1024]);
export const PT_DEFAULT_BOUNCES=5;

/** Tiles split each sample into smaller GPU jobs so large images do not trip the driver's time limit. */
export function ptTiles(width,height){const pixels=width*height;return pixels>6e6?4:pixels>2e6?3:2}

/**
 * Renders `samples` path-traced samples of `scene` from `camera` at width × height.
 * prepare(cam) runs synchronously right before the scene is read and returns a restore function
 * (hide helpers, cut away walls, clear background for transparent images).
 * Resolves with the finished canvas; rejects with an AbortError when `signal` is aborted.
 */
export async function pathTrace({scene,camera,width,height,samples=256,bounces=PT_DEFAULT_BOUNCES,toneMapping=THREE.ACESFilmicToneMapping,exposure=1,transparent=false,prepare=()=>()=>{},onProgress=()=>{},signal}){
 const {WebGLPathTracer,GradientEquirectTexture}=await import('three-gpu-pathtracer');
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 let tracer=null,sky=null;
 try{
  renderer.setPixelRatio(1);renderer.setSize(width,height,false);
  renderer.toneMapping=toneMapping;renderer.toneMappingExposure=exposure;renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000,transparent?0:1);
  const limit=renderer.capabilities.maxTextureSize;
  if(width>limit||height>limit)throw Error(`This device's graphics can path-trace at most ${limit} px; choose a smaller size`);
  // The live view's PMREM environment cannot be read by the tracer (and its cube→equirect converter needs a
  // shader chunk three 0.187 no longer has), so it gets a soft equirect sky: bright above, warm grey below.
  sky=new GradientEquirectTexture(128);sky.topColor.set('#ffffff');sky.bottomColor.set('#77716a');sky.exponent=1.5;sky.update();
  const cam=camera.clone();cam.aspect=width/height;cam.updateProjectionMatrix();cam.updateMatrixWorld();
  tracer=new WebGLPathTracer(renderer);
  Object.assign(tracer,{renderToCanvas:true,rasterizeScene:false,minSamples:0,fadeDuration:0,renderDelay:0,dynamicLowRes:false,bounces,filterGlossyFactor:0.5,multipleImportanceSampling:true});
  tracer.tiles.set(ptTiles(width,height),ptTiles(width,height));
  // Everything the tracer reads is swapped in and restored synchronously, so the live view never shows it.
  const restore=prepare(cam),environment=scene.environment,background=scene.background;
  try{
   scene.environment=sky;if(transparent)scene.background=null;
   tracer.setScene(scene,cam);
  }finally{scene.environment=environment;scene.background=background;restore()}
  const t0=performance.now();
  while(tracer.samples<samples){
   if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
   tracer.renderSample();
   onProgress({samples:Math.min(samples,Math.floor(tracer.samples)),total:samples,elapsed:(performance.now()-t0)/1000});
   await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
  }
  // Copy out before the GL canvas is released.
  const out=document.createElement('canvas');out.width=width;out.height=height;out.getContext('2d').drawImage(canvas,0,0);
  return out;
 }finally{
  tracer?.dispose();sky?.dispose();renderer.dispose();renderer.forceContextLoss();
 }
}
