/**
 * Interior and kitchen accessory catalogue. Sizes are RokaDex starting values for fit checks,
 * not supplier data: confirm every item against the chosen manufacturer before ordering.
 * place: space = sits in a bay space at a level; drawer = insert in the top drawer of the bay;
 * worktop = cut into the worktop above the bay; bay = fitted to the whole bay.
 */
export const ACCESSORIES=Object.freeze({
 trouserRack:{group:'wardrobe',place:'space',minWidth:450,minDepth:450,height:120,en:'Pull-out trouser rack',ar:'شماعة بناطيل منزلقة'},
 shoeRack:{group:'wardrobe',place:'space',minWidth:400,minDepth:300,height:180,en:'Pull-out shoe rack',ar:'رف أحذية منزلق'},
 basket:{group:'wardrobe',place:'space',minWidth:400,minDepth:400,height:200,en:'Wire basket',ar:'سلة سلك منزلقة'},
 tieRack:{group:'wardrobe',place:'space',minWidth:100,minDepth:450,height:400,en:'Tie & belt rack',ar:'حامل كرافتات وأحزمة'},
 mirror:{group:'wardrobe',place:'space',minWidth:150,minDepth:450,height:1000,en:'Pull-out mirror',ar:'مرآة منزلقة'},
 pullDownRail:{group:'wardrobe',place:'bay',minWidth:450,maxWidth:1150,minDepth:450,minHeight:1600,height:900,en:'Pull-down hanging rail',ar:'شماعة نازلة (بانتوجراف)'},
 jewelleryTray:{group:'wardrobe',place:'drawer',minWidth:300,minDepth:300,height:40,en:'Jewellery tray',ar:'تقسيمة مجوهرات للدرج'},
 cutleryTray:{group:'kitchen',place:'drawer',minWidth:250,minDepth:350,height:50,en:'Cutlery tray',ar:'تقسيمة معالق'},
 plateRack:{group:'kitchen',place:'drawer',minWidth:400,minDepth:400,height:80,en:'Plate organiser',ar:'منظم أطباق للدرج'},
 bottlePullout:{group:'kitchen',place:'bay',minWidth:120,maxWidth:300,minDepth:450,minHeight:450,height:500,en:'Bottle pull-out',ar:'منزلق زجاجات'},
 wasteBin:{group:'kitchen',place:'space',minWidth:350,minDepth:400,height:400,en:'Waste bin pull-out',ar:'سلة مهملات منزلقة'},
 dishRack:{group:'kitchen',place:'space',minWidth:500,minDepth:250,height:250,en:'Dish drainer rack',ar:'مصفاة أطباق'},
 cargoPullout:{group:'kitchen',place:'bay',minWidth:150,maxWidth:450,minDepth:450,minHeight:1200,height:1600,en:'Tall cargo pull-out',ar:'كارجو طويل منزلق'},
 cornerCarousel:{group:'kitchen',place:'space',minWidth:700,minDepth:450,height:500,en:'Corner carousel',ar:'دوّار ركنة'},
 sink:{group:'kitchen',place:'worktop',minWidth:500,minDepth:450,height:200,en:'Sink (worktop cut-out)',ar:'حوض (فتحة في الرخامة)'},
 hob:{group:'kitchen',place:'worktop',minWidth:560,minDepth:480,height:60,en:'Hob (worktop cut-out)',ar:'مسطح بوتاجاز (فتحة في الرخامة)'},
});
export const ACCESSORY_KEYS=Object.freeze(Object.keys(ACCESSORIES));
export const accessoryName=(key,lang='en')=>ACCESSORIES[key]?.[lang==='ar'?'ar':'en']??key;

/** What usually fits a clear space. Guidance only, not a standard: confirm with the client's items. */
export function spaceUse(space){
 const h=space.clearHeight,d=space.depth,uses=[];
 if(space.kind==='drawer'){
  if(h>=180)uses.push('folded');else if(h>=90)uses.push('small');else uses.push('flat');
  return uses;
 }
 if(space.rail){
  if(h>=1500)uses.push('longHanging');else if(h>=950)uses.push('shortHanging');else uses.push('tooLowForHanging');
  return uses;
 }
 if(h>=350&&d>=350)uses.push('boxes');
 if(h>=250&&d>=300)uses.push('foldedStacks');
 if(h>=150&&h<350&&d>=300)uses.push('shoes');
 if(h>=1500&&d>=500)uses.push('canHang');
 if(!uses.length)uses.push('smallItems');
 return uses;
}
export const SPACE_USES={
 en:{folded:'folded clothes',small:'socks, underwear, accessories',flat:'flat items',longHanging:'long coats and dresses',shortHanging:'shirts and jackets',tooLowForHanging:'too low for hanging',boxes:'boxes and bags',foldedStacks:'folded stacks',shoes:'shoes',canHang:'room for a hanging rail',smallItems:'small items'},
 ar:{folded:'ملابس مطوية',small:'شرابات وملابس داخلية وإكسسوارات',flat:'أغراض مسطحة',longHanging:'بالطوهات وفساتين طويلة',shortHanging:'قمصان وجواكت',tooLowForHanging:'منخفض على التعليق',boxes:'صناديق وشنط',foldedStacks:'ملابس مطوية رصّ',shoes:'أحذية',canHang:'ينفع شماعة تعليق',smallItems:'أغراض صغيرة'},
};
