/**
 * Studio manufacturing package: one JSON file that carries an ISSUED revision to the Rokadex management app.
 * Only issued (approved, frozen) revisions can be packaged, so production never works from a draft.
 *
 * Shape (format 'rokadex-studio-package', version 1):
 *  { format, version, createdAt, studio,
 *    project: {projectId, name, client, revision, issuedAt, note, hash, rulesVersions[]},
 *    summary: {units[], parts, sheetParts, materials[], edgeBandM, sheets, unplaced},
 *    steps:   suggested production steps [{key, title_en, title_ar, qty, unit}] (the management app may create tasks from them),
 *    files:   [{name, mime, purpose, text, bytes}]   (cut list CSV, optimizer CSVs, saw cutting sequence, printable cut list),
 *    design:  the frozen project file of that revision, carrying that one issued revision (re-opens in Studio; its fingerprint is checked),
 *    checksum: hash of everything above (detects edits/corruption in transit; not a security signature) }
 * G-code is not included: it depends on each machine's settings and is still unverified.
 */
import {releasedProject,contentHash} from './releases.mjs';
import {serializeProject,parseProject} from './project.mjs';
import {manufacturingCsv,partRecords} from './manufacturing.mjs';
import {cutListGroups,cutListTotals,cutListHtml} from './cutlist-doc.mjs';
import {optimizerCsv,cutSequence,verifyCutSequence,cutSequenceCsv} from './beamsaw.mjs';
import {projectSheetPlan} from './review.mjs';

export const PACKAGE_FORMAT='rokadex-studio-package';
export const PACKAGE_VERSION=1;
export const MAX_PACKAGE_BYTES=4*1024*1024;

const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function canonical(v){
 if(Array.isArray(v))return `[${v.map(canonical).join(',')}]`;
 if(isRecord(v))return `{${Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
 return JSON.stringify(v);
}
function fnv(text,seed){let h=seed>>>0;for(const b of new TextEncoder().encode(text)){h^=b;h=Math.imul(h,0x01000193)>>>0}return h.toString(16).padStart(8,'0')}
export function packageChecksum(pkg){const {checksum,...rest}=pkg;const t=canonical(rest);return fnv(t,0x811c9dc5)+fnv(t,0x01000193)}
const bytes=t=>new TextEncoder().encode(t).length;

/** Builds the package for issued revision `revision` of `project`. */
export function buildPackage(project,revision,{studio='',now=new Date(),lang='en',company={}}={}){
 const r=(project.releases??[]).find(x=>x.revision===revision);
 if(!r)throw Error(`R${revision} is not issued; issue it first (Engineering review → Approve & issue)`);
 const frozen=parseProject(releasedProject(project,revision));
 const groups=cutListGroups(frozen),records=partRecords(frozen),totals=cutListTotals(groups);
 const sheetRecords=records.filter(x=>x.sheetGood!==false);
 let plan=null,seq=null,planNote='';
 try{plan=projectSheetPlan(frozen.units);seq=cutSequence(plan,{trim:frozen.units[0].config.trim,kerf:frozen.units[0].config.kerf});const bad=verifyCutSequence(plan,seq);if(bad.length)throw Error(bad[0])}catch(e){planNote=e.message;plan=null;seq=null}
 const id=frozen.projectId,tag=`${id}-R${revision}`;
 const files=[
  {name:`${tag}-manufacturing.csv`,mime:'text/csv',purpose:'cut_list',text:manufacturingCsv(frozen)},
  {name:`${tag}-optimizer-parts.csv`,mime:'text/csv',purpose:'saw_optimizer',text:optimizerCsv(frozen,{style:'comma'})},
  {name:`${tag}-optimizer-parts-semicolon.csv`,mime:'text/csv',purpose:'saw_optimizer',text:optimizerCsv(frozen,{style:'semicolon'})},
  ...(seq?[{name:`${tag}-saw-cut-sequence.csv`,mime:'text/csv',purpose:'saw_sequence',text:cutSequenceCsv(seq)}]:[]),
  {name:`${tag}-cut-list.html`,mime:'text/html',purpose:'cut_list_print',text:cutListHtml(frozen,{lang,company,date:now})},
 ].map(f=>({...f,bytes:bytes(f.text)}));
 const banded=groups.reduce((s,g)=>s+g.bandLength,0);
 const grooved=records.filter(x=>x.operations?.some(o=>o.type==='groove')).length;
 const steps=[
  {key:'cutting',title_en:'Cut panels',title_ar:'تقطيع الألواح',qty:sheetRecords.length,unit:'parts'},
  ...(banded>0?[{key:'edging',title_en:'Edge banding',title_ar:'تركيب الشريط (الحرف)',qty:Math.round(banded/10)/100,unit:'m'}]:[]),
  ...(grooved>0?[{key:'machining',title_en:'Grooves / CNC machining',title_ar:'تفريز المجاري / CNC',qty:grooved,unit:'parts'}]:[]),
  {key:'assembly',title_en:'Assemble units',title_ar:'تجميع الوحدات',qty:frozen.units.length,unit:'units'},
 ];
 const pkg={format:PACKAGE_FORMAT,version:PACKAGE_VERSION,createdAt:now.toISOString(),studio:String(studio),
  project:{projectId:id,name:frozen.projectName??'',client:frozen.clientName??'',revision,issuedAt:r.issuedAt,...(r.note?{note:r.note}:{}),hash:r.hash,rulesVersions:[...new Set(records.map(x=>x.rulesVersion))]},
  summary:{units:frozen.units.map(u=>({id:u.id,name:u.name,type:u.type,width:u.config.width,height:u.config.height,depth:u.config.depth})),
   parts:records.length,sheetParts:sheetRecords.length,materials:totals.map(t=>({material:t.material,thickness:t.thickness,parts:t.parts,areaM2:t.areaM2,bandM:t.bandM})),
   edgeBandM:Math.round(banded/10)/100,sheets:plan?plan.sheets.length:null,unplaced:plan?plan.unplaced.length:null,...(planNote?{sheetPlanNote:planNote}:{})},
  steps,files,design:{...JSON.parse(serializeProject(frozen)),releases:[structuredClone(r)]}};
 pkg.checksum=packageChecksum(pkg);
 const size=bytes(JSON.stringify(pkg));
 if(size>MAX_PACKAGE_BYTES)throw Error(`Package is ${(size/1048576).toFixed(1)} MB; the limit is 4 MB (remove large material photos and issue again)`);
 return pkg;
}

/**
 * Reads and checks a package (used by Studio tests and mirrored by the management app's importer).
 * Refuses: wrong format/version, bad checksum, a design whose issued copy does not match the stated revision hash.
 */
export function readPackage(text){
 if(typeof text!=='string'||bytes(text)>MAX_PACKAGE_BYTES)throw Error('Package file is missing or larger than 4 MB');
 let pkg;try{pkg=JSON.parse(text)}catch{throw Error('Package is not valid JSON')}
 if(!isRecord(pkg)||pkg.format!==PACKAGE_FORMAT)throw Error('Not a Rokadex Studio package');
 if(pkg.version!==PACKAGE_VERSION)throw Error(`Unsupported package version ${pkg.version}`);
 if(pkg.checksum!==packageChecksum(pkg))throw Error('Package was changed or damaged after it was made');
 const design=parseProject(pkg.design);
 const r=(design.releases??[]).find(x=>x.revision===pkg.project?.revision);
 if(!r||r.hash!==pkg.project.hash)throw Error('Package revision does not match an issued revision in its design');
 if(contentHash(releasedProject(design,r.revision))!==r.hash||contentHash(design)!==r.hash)throw Error('Issued design does not match its fingerprint');
 if(!Array.isArray(pkg.files)||pkg.files.some(f=>!isRecord(f)||typeof f.name!=='string'||typeof f.text!=='string'))throw Error('Package files are incomplete');
 return pkg;
}
