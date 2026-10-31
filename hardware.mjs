/**
 * Project hardware and accessory schedule, counted from the generated models.
 * Quantities follow RokaDex counting rules (below); brands, part numbers and load ratings are not
 * specified. Confirm every line with the supplier before ordering.
 */
import {cabinet} from './engine.mjs';
import {ACCESSORIES} from './accessories.mjs';

// Concealed hinges per door by door height: a common starting rule, not a manufacturer chart.
export const hingesForDoor=height=>height<=900?2:height<=1600?3:height<=2200?4:5;
const L={
 hinge:['Concealed hinge + plate','مفصلة مخفية + قاعدة'],glassHinge:['Glass door hinge','مفصلة باب زجاج'],
 slide:['Drawer slide pair','زوج مجاري درج'],handle:['Handle','مقبض'],knob:['Knob','مقبض زرار'],profile:['Handle profile','بروفيل مقبض'],
 shelfPin:['Shelf support pin','حامل رف (بنز)'],rail:['Hanging rail','ماسورة تعليق'],railSupport:['Rail end support','كرسي ماسورة'],
 led:['LED strip','شريط LED'],ledProfile:['LED aluminium profile','بروفيل ألومنيوم للإضاءة'],driver:['LED driver','محول LED'],sensor:['Door / hand sensor switch','حساس فتح باب أو يد'],
 wallBracket:['Wall-unit hanging bracket','علّاقة دولاب علوي'],worktop:['Worktop','رخامة / سطح'],glass:['Glass panel','لوح زجاج'],
 fasteners:['Assembly fasteners','مسامير وكامات التجميع'],
};
const FINISH={black:['black','أسود'],steel:['brushed steel','ستانلس'],gold:['gold','دهبي'],white:['white','أبيض']};
const GLASS={clear:['clear','شفاف'],frosted:['frosted','مط (سانداست)'],tinted:['tinted','فاميه'],reflective:['reflective','عاكس'],fluted:['fluted','مضلّع']};

export function projectHardware(units,lang='en'){
 const ar=lang==='ar',pick=pair=>pair[ar?1:0],rows=new Map();
 const add=(key,item,spec,qty,unit,unitId,basis)=>{
  const id=`${key}|${spec}|${unit}`,row=rows.get(id)||{key,item,spec,qty:0,unit,units:new Set(),basis};
  row.qty=Math.round((row.qty+qty)*1000)/1000;row.units.add(unitId);rows.set(id,row);
 };
 for(const u of units){
  const c=u.config,model=cabinet(c,u.id),doors=model.parts.filter(p=>p.kind==='door');
  const finish=pick(FINISH[c.handleFinish??'black']??FINISH.black);
  for(const d of doors){
   const glass=d.sheetGood===false;
   add(glass?'glassHinge':'hinge',pick(L[glass?'glassHinge':'hinge']),ar?`باب ارتفاع ${d.length} مم`:`door height ${d.length} mm`,hingesForDoor(d.length),ar?'قطعة':'pcs',u.id,ar?'2 حتى 900، 3 حتى 1600، 4 حتى 2200، 5 أكثر':'2 up to 900, 3 up to 1600, 4 up to 2200, 5 above');
   if(glass)add('glass',pick(L.glass),`${pick(GLASS[c.glassType??'clear']??GLASS.clear)} ${c.glassThickness} mm · ${d.length} × ${d.width} · ${c.glassColor}`,1,ar?'قطعة':'pcs',u.id,ar?'مقاس الباب بالظبط':'door size');
  }
  const fronts=[...doors,...model.parts.filter(p=>p.kind==='drawerFront')];
  const type=c.handleType??'bar';
  if(fronts.length&&type!=='none'){
   if(type==='profile')add('profile',pick(L.profile),finish,Math.round(fronts.reduce((s,p)=>s+(p.kind==='door'?p.width:p.width),0))/1000,ar?'متر':'m',u.id,ar?'بعرض كل وش':'width of each front');
   else if(type==='knob')add('knob',pick(L.knob),finish,fronts.length,ar?'قطعة':'pcs',u.id,ar?'واحد لكل باب ووش درج':'one per door and drawer front');
   else add('handle',pick(L.handle),`${c.handleLength?`${c.handleLength} mm`:(ar?'طول تلقائي':'auto length')} · ${finish}`,fronts.length,ar?'قطعة':'pcs',u.id,ar?'واحد لكل باب ووش درج':'one per door and drawer front');
  }
  for(const a of model.accessories){
   if(a.kind==='drawerSlide')add('slide',pick(L.slide),`${a.length} mm`,1,ar?'زوج':'pair',u.id,ar?'زوج لكل درج، الطول من عمق الوحدة':'one pair per drawer; length from cabinet depth');
   else if(a.kind==='hangingRail'){add('rail',pick(L.rail),`${a.length} mm`,1,ar?'قطعة':'pcs',u.id,ar?'بعرض الخانة من جوه':'bay inner width');add('railSupport',pick(L.railSupport),'',2,ar?'قطعة':'pcs',u.id,ar?'2 لكل ماسورة':'2 per rail')}
   else if(a.kind==='ledStrip'){add('led',pick(L.led),`${a.kelvin} K`,a.length/1000,ar?'متر':'m',u.id,ar?'عرض الخانة ناقص 20 مم':'bay inner width less 20 mm');add('ledProfile',pick(L.ledProfile),'',a.length/1000,ar?'متر':'m',u.id,ar?'نفس طول الشريط':'same as strip')}
   else if(a.kind==='fitting'){const spec=ACCESSORIES[a.type];add('fitting:'+a.type,ar?spec.ar:spec.en,a.fits?(ar?`خانة ${a.bay+1}`:`bay ${a.bay+1}`):(ar?`خانة ${a.bay+1} · لا يناسب`:`bay ${a.bay+1} · does not fit`),1,ar?'قطعة':'pcs',u.id,ar?'من اختيار الإكسسوارات':'chosen accessory')}
  }
  if(model.accessories.some(a=>a.kind==='ledStrip')){add('driver',pick(L.driver),ar?'القدرة حسب المورد':'size per supplier',1,ar?'قطعة':'pcs',u.id,ar?'واحد لكل وحدة فيها إضاءة':'one per lit unit');add('sensor',pick(L.sensor),'',1,ar?'قطعة':'pcs',u.id,ar?'واحد لكل وحدة فيها إضاءة':'one per lit unit')}
  const pins=model.parts.filter(p=>p.kind==='shelf').length;
  if(c.shelfMode==='adjustable'&&pins)add('shelfPin',pick(L.shelfPin),'',pins*4,ar?'قطعة':'pcs',u.id,ar?'4 لكل رف متحرك':'4 per adjustable shelf');
  if((u.elevation??0)>0)add('wallBracket',pick(L.wallBracket),'',2,ar?'قطعة':'pcs',u.id,ar?'2 لكل وحدة علوية':'2 per wall unit');
  for(const w of model.parts.filter(p=>p.kind==='worktop'))add('worktop',pick(L.worktop),`${w.material} · ${w.length} × ${w.width} × ${w.thickness}`,1,ar?'قطعة':'pcs',u.id,ar?'قطعة لكل وحدة؛ الوصلات حسب الموقع':'one piece per unit; joints decided on site');
  add('fasteners',pick(L.fasteners),ar?'حسب طريقة التجميع':'per joinery method',0,ar?'يحدد':'TBD',u.id,ar?'لم تُحسب':'not calculated');
 }
 const order=['hinge','glassHinge','glass','handle','knob','profile','slide','shelfPin','rail','railSupport','led','ledProfile','driver','sensor','wallBracket','worktop'];
 const rank=key=>{const i=order.indexOf(key);return i<0?(key.startsWith('fitting:')?order.length:order.length+1):i};
 return [...rows.values()].map(r=>({...r,units:[...r.units]})).sort((a,b)=>rank(a.key)-rank(b.key)||a.spec.localeCompare(b.spec,undefined,{numeric:true}));
}
const cell=v=>{let t=String(v??'');if(/^[\s]*[=+@-]/.test(t))t="'"+t;return '"'+t.replaceAll('"','""')+'"'};
export function hardwareCsv(rows){
 return [['# HARDWARE & ACCESSORIES — COUNTED BY ROKADEX RULES, CONFIRM WITH SUPPLIER'],['item','specification','quantity','unit','units','rule'],...rows.map(r=>[r.item,r.spec,r.unit==='TBD'||r.unit==='يحدد'?'':r.qty,r.unit,r.units.join(' '),r.basis])].map(r=>r.map(cell).join(',')).join('\r\n');
}
