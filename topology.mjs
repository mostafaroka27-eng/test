/** Preserve intentional edge customization when cabinet topology changes.
 * Legacy override keys remain ordinal in JSON; model keys identify bay/slot panels.
 * Call for topology edits, not when directly adding or changing edge flags.
 */
import {cabinet} from './engine.mjs';

export function remapPartOverrides(previousConfig,nextConfig){
 const previous=cabinet(previousConfig).parts;
 const candidate=structuredClone(nextConfig);
 delete candidate.partOverrides;
 const next=cabinet(candidate).parts;
 const overrides=new Map();
 for(const part of previous){
  const customized=previousConfig.partOverrides?.[part.overrideKey];
  if(customized)overrides.set(part.key,[...customized.edges]);
 }
 candidate.partOverrides={};
 for(const part of next){
  const edges=overrides.get(part.key);
  if(edges)candidate.partOverrides[part.overrideKey]={edges:[...edges]};
 }
 return candidate;
}
