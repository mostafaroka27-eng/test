/** Named local snapshots. No network or cloud storage; JSON export remains portable. */
import {parseProject} from './project.mjs';

export const REVISION_KEY='rokadex-standalone.revisions.v1';
export const MAX_REVISIONS=10;
export const MAX_REVISION_BYTES=4*1024*1024;
const bytes=value=>new TextEncoder().encode(value).byteLength;
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const metadata=entries=>entries.map(({id,label,createdAt})=>({id,label,createdAt}));
function storageKey(key){if(typeof key!=='string'||!key.trim()||key.length>200)throw Error('Invalid local revisions key');return key}
function revisionLabel(label){
 if(typeof label!=='string'||!label.trim()||label.length>120||/[\u0000-\u001f\u007f]/.test(label))throw Error('Revision label must contain 1–120 characters without control characters');
 return label.trim();
}
function readEntries(storage,key){
 storageKey(key);
 let raw;
 try{raw=storage.getItem(key)}catch{throw Error('Cannot read local revisions. Export JSON to preserve the current project.')}
 if(raw===null)return [];
 if(typeof raw!=='string'||bytes(raw)>MAX_REVISION_BYTES)throw Error('Local revisions exceed 4 MB or are invalid. Export JSON before changing stored data.');
 let data;
 try{data=JSON.parse(raw)}catch{throw Error('Local revisions are corrupt. Export JSON before changing stored data.')}
 if(!isRecord(data)||data.format!=='rokadex.revisions'||data.version!==1||!Array.isArray(data.entries)||data.entries.length>MAX_REVISIONS)throw Error('Unsupported local revisions store. Export JSON before changing stored data.');
 const ids=new Set();
 return data.entries.map(entry=>{
  if(!isRecord(entry)||typeof entry.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(entry.id)||ids.has(entry.id))throw Error('Invalid or duplicate stored revision ID');
  ids.add(entry.id);
  const label=revisionLabel(entry.label);
  if(typeof entry.createdAt!=='string'||!Number.isFinite(Date.parse(entry.createdAt))||new Date(entry.createdAt).toISOString()!==entry.createdAt)throw Error('Invalid stored revision date');
  return {id:entry.id,label,createdAt:entry.createdAt,project:parseProject(entry.project)};
 });
}
function writeEntries(storage,key,entries){
 const raw=JSON.stringify({format:'rokadex.revisions',version:1,entries});
 if(bytes(raw)>MAX_REVISION_BYTES)throw Error('Local revisions would exceed 4 MB. Export JSON or delete a revision before saving another.');
 // Web Storage setItem is atomic: quota errors leave the previous value unchanged.
 try{storage.setItem(key,raw)}catch{throw Error('Cannot save local revisions; storage is unavailable or full. Export JSON to preserve your work.')}
 return metadata(entries);
}

export function listRevisions(storage,key=REVISION_KEY){return metadata(readEntries(storage,key));}

export function saveRevision(storage,project,{label,key=REVISION_KEY}={}){
 const normalizedLabel=revisionLabel(label),snapshot=parseProject(project),entries=readEntries(storage,key);
 if(typeof globalThis.crypto?.randomUUID!=='function')throw Error('Secure revision IDs are unavailable. Export JSON to preserve your work.');
 const id=crypto.randomUUID();
 if(entries.some(entry=>entry.id===id))throw Error('Revision ID collision; try saving again.');
 const entry={id,label:normalizedLabel,createdAt:new Date().toISOString(),project:snapshot};
 return writeEntries(storage,key,[...entries,entry].slice(-MAX_REVISIONS));
}

export function loadRevision(storage,id,key=REVISION_KEY){
 const entry=readEntries(storage,key).find(candidate=>candidate.id===id);
 if(!entry)throw Error('Revision not found');
 return entry.project;
}

export function deleteRevision(storage,id,key=REVISION_KEY){
 const entries=readEntries(storage,key);
 if(!entries.some(entry=>entry.id===id))throw Error('Revision not found');
 return writeEntries(storage,key,entries.filter(entry=>entry.id!==id));
}
