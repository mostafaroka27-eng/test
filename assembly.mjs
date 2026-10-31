/**
 * Assembly sequence, part location and part lookup, all derived from cabinet().
 * Each step names the same part IDs that are printed on the cutting list and on the QR labels,
 * so a worker who scans a label sees where that part goes and in which step.
 * Methods are RokaDex starting instructions (order inspired by common frameless practice,
 * including a dry fit before fixing); they do not replace the workshop's own joinery standard.
 */
import {cabinet} from './engine.mjs';
import {hingesForDoor} from './hardware.mjs';
import {accessoryName} from './accessories.mjs';
import {parseLabelPayload,LABEL_PAYLOAD_VERSION} from './manufacturing.mjs';

const K={
 en:{side:'Side',top:'Top',bottom:'Bottom',back:'Back',shelf:'Adjustable shelf',fixedShelf:'Fixed shelf',partition:'Partition',door:'Door',drawerFront:'Drawer front',drawerFace:'Drawer box front',drawerSide:'Drawer side',drawerBack:'Drawer back',drawerBottom:'Drawer bottom',plinth:'Plinth',endPanel:'Cover panel',topFiller:'Top filler',worktop:'Worktop'},
 ar:{side:'جانب',top:'سقف',bottom:'أرضية',back:'ظهر',shelf:'رف متحرك',fixedShelf:'رف ثابت',partition:'قاطع',door:'باب',drawerFront:'وش درج',drawerFace:'وش صندوق الدرج',drawerSide:'جانب درج',drawerBack:'ظهر درج',drawerBottom:'قاع درج',plinth:'وزرة',endPanel:'جنب تغطية',topFiller:'سكرتنج علوي',worktop:'رخامة'},
};
const S={
 en:{
  check:['Check the parts','Lay out every part of this unit by its label. Check the count, sizes and edge banding against the cutting list before you start.'],
  carcass:c=>[c.bayMode==='separate'?'Build the boxes':'Build the carcass',
   `${c.construction==='over'?'Top and bottom sit over the sides.':'Top and bottom sit between the sides.'} Dry-fit first without glue, check it is square (equal diagonals), then fix with your joinery method.${c.bayMode==='separate'?' Each bay is its own box; join the boxes side to side after they are square.':''}`],
  carcassGroove:'Leave the top off for now: the back slides into its groove before the top closes the box.',
  back:c=>['Fit the back',c.backConstruction==='groove'?'Slide the back into the grooves in the sides and bottom, then fit the top and fix the carcass.':'Measure both diagonals; when they are equal the carcass is square. Then fix the back.'],
  top:['Close the top','Fit the top over the back groove and fix it. Re-check the diagonals.'],
  plinth:['Fit the plinth','Fix the plinth under the bottom at its setback. Level the unit on site before fixing it to the wall.'],
  covers:['Cover panels and filler','Fix the cover panels to the outside of the sides and the top filler between them. Fix from inside so no screw heads show.'],
  drawers:['Assemble the drawers','Build each drawer box (sides, back, front, bottom), check it is square, then mount the slides on the box and in the carcass.'],
  shelves:['Fit the shelves','Push 4 shelf pins per adjustable shelf into the holes at the shown level, then place the shelf.'],
  inside:['Rails, lights and fittings','Fit the hanging rails, LED strips and interior fittings at the levels on the drawing.'],
  doors:['Hang the doors','Fit the hinge cups, hang the doors and adjust them to an even gap all round.'],
  handles:['Fit the handles','Mark and drill the handle holes with a template, then fit the handles.'],
  worktop:['Worktop','Place the worktop with its front overhang and fix it from below. Cut-outs for sink or hob follow the appliance template.'],
  wall:['Hang the wall unit','Fix the hanging brackets, check the wall and fixings, hang the unit level at its mounting height.'],
  fasteners:'Fixings per your joinery method (not calculated)',hinge:'Concealed hinge',slide:'Drawer slide pair',pin:'Shelf pin',bracket:'Wall bracket',handle:'Handle',
  bay:'bay',slotN:'drawer',from:'from floor',left:'left',right:'right',front:'front',rear:'rear',at:'at',mm:'mm',
 },
 ar:{
  check:['راجع القطع','افرد كل قطع الوحدة بأرقام الملصقات. راجع العدد والمقاسات والشريط مع قائمة القص قبل ما تبدأ.'],
  carcass:c=>[c.bayMode==='separate'?'جمّع الصناديق':'جمّع الهيكل',
   `${c.construction==='over'?'السقف والأرضية فوق الجوانب.':'السقف والأرضية بين الجوانب.'} ركّب على الناشف الأول من غير غراء، اتأكد إنه مظبوط (الوترين متساويين)، وبعدين ثبّت بطريقة التجميع بتاعتك.${c.bayMode==='separate'?' كل حجرة صندوق لوحدها؛ اربط الصناديق جنب بعض بعد ما تظبطها.':''}`],
  carcassGroove:'سيب السقف دلوقتي: الظهر بيدخل في المجرى قبل ما السقف يقفل الصندوق.',
  back:c=>['ركّب الظهر',c.backConstruction==='groove'?'دخّل الظهر في مجرى الجوانب والأرضية، وبعدين ركّب السقف وثبّت الهيكل.':'قيس الوترين؛ لما يتساووا يبقى الهيكل مظبوط. بعدين ثبّت الظهر.'],
  top:['اقفل السقف','ركّب السقف على مجرى الظهر وثبّته، وراجع الوترين تاني.'],
  plinth:['ركّب الوزرة','ثبّت الوزرة تحت الأرضية بالرجوع المحدد. اظبط ميزان الوحدة في الموقع قبل التثبيت في الحيطة.'],
  covers:['جوانب التغطية والسكرتنج','ثبّت جوانب التغطية على الجوانب من بره، والسكرتنج العلوي بينهم. التثبيت من جوه عشان المسامير ماتبانش.'],
  drawers:['جمّع الأدراج','جمّع كل صندوق درج (جوانب، ظهر، وش، قاع) واتأكد إنه مظبوط، وبعدين ركّب المجاري على الصندوق وفي الهيكل.'],
  shelves:['ركّب الرفوف','دخّل 4 بنز لكل رف متحرك في الثقوب على المنسوب المرسوم، وحط الرف.'],
  inside:['المواسير والإضاءة والإكسسوارات','ركّب مواسير التعليق وشرائط LED والإكسسوارات الداخلية على المناسيب اللي في الرسم.'],
  doors:['علّق الأبواب','ركّب كاسات المفصلات، علّق الأبواب واظبطها بفاصل متساوي من كل ناحية.'],
  handles:['ركّب المقابض','علّم واخرم ثقوب المقابض بالشابلونة، وركّب المقابض.'],
  worktop:['الرخامة','حط الرخامة ببروزها من قدام وثبّتها من تحت. فتحات الحوض والبوتاجاز حسب شابلونة الجهاز.'],
  wall:['علّق الوحدة العلوية','ثبّت العلاقات، راجع الحيطة والخوابير، وعلّق الوحدة بميزان على ارتفاع التعليق.'],
  fasteners:'مسامير التجميع حسب طريقتك (غير محسوبة)',hinge:'مفصلة مخفية',slide:'زوج مجاري درج',pin:'بنز رف',bracket:'علاقة دولاب علوي',handle:'مقبض',
  bay:'حجرة',slotN:'درج',from:'من الأرض',left:'شمال',right:'يمين',front:'قدام',rear:'ورا',at:'على',mm:'مم',
 },
};
const T=lang=>S[lang]??S.en;
export const partName=(kind,lang='en')=>(K[lang]??K.en)[kind]??kind;

/** Ordered assembly steps for one unit. Every part of the model appears in exactly one step. */
export function assemblySteps(unit,lang='en'){
 const t=T(lang),model=cabinet(unit.config,unit.id),c={...unit.config,...(model.config??{})},parts=model.parts;
 const of=(...kinds)=>parts.filter(p=>kinds.includes(p.kind));
 const groove=c.backConstruction==='groove';
 const steps=[];
 const add=(key,[title,method],list,hardware=[])=>{if(list.length||key==='check')steps.push({key,title,method,parts:list.map(p=>p.id),hardware:hardware.filter(h=>h.qty===null||h.qty>0)})};
 add('check',t.check,[]);steps[0].count=parts.length;
 const box=of('side','bottom','partition','fixedShelf',...(groove?[]:['top']));
 const [ct,cm]=t.carcass(c);add('carcass',[ct,groove?`${cm} ${t.carcassGroove}`:cm],box,[{item:t.fasteners,qty:null}]);
 add('back',t.back(c),of('back'));
 if(groove)add('top',t.top,of('top'));
 add('plinth',t.plinth,of('plinth'));
 add('covers',t.covers,of('endPanel','topFiller'));
 const drawerParts=of('drawerSide','drawerBack','drawerFace','drawerBottom','drawerFront');
 const drawerCount=new Set(drawerParts.map(p=>`${p.bay}:${p.slot}`)).size;
 add('drawers',t.drawers,drawerParts,[{item:t.slide,qty:drawerCount}]);
 const shelves=of('shelf');add('shelves',t.shelves,shelves,c.shelfMode==='adjustable'?[{item:t.pin,qty:shelves.length*4}]:[]);
 const fittings=model.accessories.filter(a=>['hangingRail','ledStrip','fitting'].includes(a.kind));
 if(fittings.length)steps.push({key:'inside',title:t.inside[0],method:t.inside[1],parts:[],hardware:[],fittings:fittings.map(a=>a.kind==='fitting'?accessoryName(a.type,lang):a.kind==='ledStrip'?`LED ${a.length} ${t.mm}`:`${lang==='ar'?'ماسورة':'Rail'} ${a.length} ${t.mm}`)});
 const doors=of('door');add('doors',t.doors,doors,[{item:t.hinge,qty:doors.reduce((n,d)=>n+hingesForDoor(d.length),0)}]);
 const fronts=[...doors,...of('drawerFront')];
 if(fronts.length&&(c.handleType??'bar')!=='none')steps.push({key:'handles',title:t.handles[0],method:t.handles[1],parts:[],hardware:[{item:t.handle,qty:fronts.length}]});
 add('worktop',t.worktop,of('worktop'));
 if(unit.elevation>0)steps.push({key:'wall',title:t.wall[0],method:t.wall[1],parts:[],hardware:[{item:t.bracket,qty:2}]});
 return steps.map((s,i)=>({n:i+1,...s}));
}

/** Plain-language location of a part inside its unit, from the model position. */
export function partLocation(unit,part,lang='en'){
 const t=T(lang);
 const bottom=Math.round(part.position.y-(['side','partition','door','endPanel','back'].includes(part.kind)?part.length/2:part.kind==='plinth'||part.kind==='topFiller'||part.kind==='drawerSide'||part.kind==='drawerBack'||part.kind==='drawerFace'||part.kind==='drawerFront'?part.width/2:part.thickness/2));
 const bits=[];
 if(part.bay!==null&&part.bay!==undefined)bits.push(`${t.bay} ${part.bay+1}`);
 if(part.slot!==null&&part.slot!==undefined&&part.kind.startsWith('drawer'))bits.push(`${t.slotN} ${part.slot+1}`);
 if(['side','endPanel','door'].includes(part.kind)||part.kind==='drawerSide')bits.push(part.position.x<0?t.left:t.right);
 if(['shelf','fixedShelf','bottom','top','drawerBottom','worktop'].includes(part.kind)||part.kind==='drawerSide')bits.push(`${t.at} ${Math.max(0,bottom)} ${t.mm} ${t.from}`);
 if(part.kind==='plinth')bits.push(t.front);
 if(part.kind==='back')bits.push(t.rear);
 return `${unit.id} · ${partName(part.kind,lang)}${bits.length?' · '+bits.join(' · '):''}`;
}

/**
 * Finds a part from what a scanner or a person typed: a RokaDex label QR payload,
 * a printed part ID (CAB-001-SIDE-001) or a part uid (CAB-001/side:0). Case and spaces are ignored for IDs.
 */
export function findPart(units,code,lang='en',projectId){
 const text=String(code??'').trim();
 if(!text)throw Error(lang==='ar'?'اكتب أو امسح كود القطعة':'Scan or type a part code');
 let uid=null,label=null;
 if(text.startsWith(LABEL_PAYLOAD_VERSION+'?')){label=parseLabelPayload(text);uid=label.uid;if(projectId&&label.projectId!==projectId)throw Error(lang==='ar'?`الملصق تبع مشروع تاني (${label.projectId})`:`Label belongs to another project (${label.projectId})`)}
 const wanted=(uid??text).toUpperCase().replace(/\s+/g,'');
 for(const unit of units){
  const model=cabinet(unit.config,unit.id);
  const part=model.parts.find(p=>p.uid.toUpperCase()===wanted||p.id.toUpperCase()===wanted);
  if(!part)continue;
  const steps=assemblySteps(unit,lang),step=steps.find(s=>s.parts.includes(part.id));
  const stale=label&&(Math.abs(label.finishLength-part.length)>0.01||Math.abs(label.finishWidth-part.width)>0.01);
  return {unit,part,step,steps,location:partLocation(unit,part,lang),label,stale};
 }
 throw Error(lang==='ar'?`مفيش قطعة بالكود ${text.slice(0,60)} في المشروع ده`:`No part ${text.slice(0,60)} in this project`);
}
