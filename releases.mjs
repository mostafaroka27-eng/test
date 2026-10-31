/**
 * Issued revisions: "Approve & issue" freezes a numbered copy of the design (R1, R2 …) inside the project file.
 * An issued copy is never edited: its content hash is stored and checked every time the file is opened.
 * The first change after an issue moves the working design to the next revision number (a new draft).
 * Stored in the project file (and this browser's autosave) only — no server or cloud copy.
 */
export const MAX_RELEASES=30;
export const CONTENT_KEYS=Object.freeze(['projectName','clientName','units','room','materials','costing','drawingLayout','views','items']);
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);

/** JSON with object keys sorted, so equal designs always hash the same. */
function canonical(value){
 if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
 if(isRecord(value))return `{${Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
 return JSON.stringify(value);
}
// FNV-1a 32-bit ×2 (two seeds): detects accidental or casual edits, not a security signature.
function fnv(text,seed){let h=seed>>>0;for(const byte of new TextEncoder().encode(text)){h^=byte;h=Math.imul(h,0x01000193)>>>0}return h.toString(16).padStart(8,'0')}

/** The design part of a project (what an issue freezes); identity, history and releases are left out. */
export function releaseContent(project){
 const out={};for(const k of CONTENT_KEYS)if(project[k]!==undefined)out[k]=structuredClone(project[k]);
 return out;
}
export function contentHash(project){const text=canonical(releaseContent(project));return fnv(text,0x811c9dc5)+fnv(text,0x01000193)}

/** Validates the issued list read from a file. `parse` is project.mjs parseProject (checks each frozen design). */
export function validateReleases(list,{projectId,designRevision,parse}){
 if(!Array.isArray(list)||list.length>MAX_RELEASES)throw Error(`A project keeps at most ${MAX_RELEASES} issued revisions`);
 let last=0;
 return list.map(r=>{
  if(!isRecord(r)||!Number.isInteger(r.revision)||r.revision<1||r.revision>9999||r.revision<=last)throw Error('Issued revisions must be numbered upwards');
  last=r.revision;
  if(typeof r.issuedAt!=='string'||!Number.isFinite(Date.parse(r.issuedAt))||new Date(r.issuedAt).toISOString()!==r.issuedAt)throw Error(`Invalid issue date for R${r.revision}`);
  const note=r.note??'';if(typeof note!=='string'||note.length>300||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(note))throw Error(`Invalid note for R${r.revision}`);
  if(typeof r.hash!=='string'||!/^[0-9a-f]{16}$/.test(r.hash)||!isRecord(r.content))throw Error(`Issued revision R${r.revision} is incomplete`);
  for(const k of Object.keys(r.content))if(!CONTENT_KEYS.includes(k))throw Error(`Issued revision R${r.revision} has unknown data`);
  const frozen=parse({format:'rokadex-standalone',version:3,projectId,designRevision:r.revision,lengthUnit:'mm',...r.content});
  const content=releaseContent(frozen);
  if(contentHash(frozen)!==r.hash)throw Error(`Issued revision R${r.revision} was changed after it was issued`);
  return {revision:r.revision,issuedAt:r.issuedAt,...(note?{note}:{}),hash:r.hash,content};
 }).map((r,i,all)=>{if(i===all.length-1&&r.revision>designRevision)throw Error('Design revision is lower than the last issued revision');return r});
}

/** Freezes the current design as revision `project.designRevision`. Returns the new releases list. */
export function issueRelease(project,{note='',now=new Date()}={}){
 const releases=project.releases??[],latest=releases.at(-1),hash=contentHash(project);
 if(releases.length>=MAX_RELEASES)throw Error(`A project keeps at most ${MAX_RELEASES} issued revisions; export the project and start a new file`);
 if(latest&&latest.hash===hash)throw Error(`Nothing changed since R${latest.revision} was issued`);
 if(latest&&project.designRevision<=latest.revision)throw Error(`R${project.designRevision} is already issued; change the design first`);
 const text=String(note).trim();if(text.length>300)throw Error('Issue note must be at most 300 characters');
 return [...releases,{revision:project.designRevision,issuedAt:now.toISOString(),...(text?{note:text}:{}),hash,content:releaseContent(project)}];
}

/** Where the working design stands relative to the last issue. */
export function releaseState(project){
 const latest=(project.releases??[]).at(-1);
 if(!latest)return {status:'never',revision:project.designRevision,latest:null};
 const same=contentHash(project)===latest.hash;
 if(same&&project.designRevision===latest.revision)return {status:'issued',revision:latest.revision,latest};
 return {status:same?'unchanged':'draft',revision:project.designRevision,latest};
}

/** Revision number the working design should carry after an edit: next number once the issued design changes. */
export function revisionAfterEdit(project){
 const latest=(project.releases??[]).at(-1);
 return latest&&project.designRevision===latest.revision&&contentHash(project)!==latest.hash?latest.revision+1:project.designRevision;
}

/** The complete project as it was issued (for re-printing, exporting or restoring). */
export function releasedProject(project,revision){
 const r=(project.releases??[]).find(x=>x.revision===revision);if(!r)throw Error(`R${revision} was not issued`);
 return {format:'rokadex-standalone',version:3,projectId:project.projectId,designRevision:r.revision,lengthUnit:'mm',...structuredClone(r.content)};
}
