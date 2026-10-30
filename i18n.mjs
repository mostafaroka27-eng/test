// UI translations only. Project names, materials, part IDs and export data stay intact.
const labels = {
 "CABINET RULES · cab-2.0":"قواعد الخزائن · cab-2.0",
 "Editable software conventions, not a workshop standard. Confirm supplier and workshop values before production.":"اصطلاحات برمجية قابلة للتعديل وليست معيار ورشة. أكّد قيم المورد والورشة قبل الإنتاج.",
 "Bay construction":"تركيب الحجرات",
 "Shared partitions":"قواطع مشتركة",
 "Separate boxes":"وحدات منفصلة",
 "Plinth height":"ارتفاع القاعدة",
 "Plinth setback":"تراجع القاعدة",
 "Groove depth":"عمق المجرى",
 "Groove allowance":"سماحية المجرى",
 "Shelf type":"نوع الرف",
 "Fixed shelf":"رف ثابت",
 "Adjustable shelf":"رف متحرك",
 "Shelf side clearance":"خلوص الرف الجانبي",
 "Shelf front setback":"تراجع الرف الأمامي",
 "Edge deduction":"خصم اللبنيج",
 "Deduct from cut size":"يُخصم من مقاس القص",
 "Off · cut = finish":"معطّل · القص = النهائي",
 "DRAWERS · DOORS · MATERIALS":"الأدراج · الأبواب · الخامات",
 "Drawer layout":"توزيع الأدراج",
 "Bottom zone, shelves above":"أدراج أسفل ورفوف أعلى",
 "Legacy full-bay bank":"التوزيع القديم بكامل الحجرة",
 "Drawer type":"نوع الدرج",
 "External fronts":"واجهات خارجية",
 "Internal · behind doors":"داخلي · خلف الأبواب",
 "Drawer front height":"ارتفاع واجهة الدرج",
 "Drawer box height":"ارتفاع صندوق الدرج",
 "Slide selection":"اختيار المجرى",
 "Longest that fits":"أطول مجرى مناسب",
 "Fixed length":"طول محدد",
 "Legacy · depth − 35":"قديم · العمق − 35",
 "Slide length":"طول المجرى",
 "Slide rear clearance":"خلوص المجرى الخلفي",
 "Door type":"نوع الباب",
 "Panel door":"باب لوح",
 "Glass door · supplier item":"باب زجاج · من المورد",
 "Door thickness · 0 = carcass":"سماكة الباب · 0 = الهيكل",
 "Door edge · 0 = carcass":"لبنيج الباب · 0 = الهيكل",
 "Glass thickness":"سماكة الزجاج",
 "Drawer box thickness · 0 = carcass":"سماكة صندوق الدرج · 0 = الهيكل",
 "Material fields: \"inherit\" uses the carcass panel (doors, boxes) or back material (drawer bottoms).":"حقول الخامات: «inherit» تعني خامة الهيكل للأبواب والصناديق، وخامة الظهر لقيعان الأدراج.",
 "Door material":"خامة الباب",
 "Glass specification":"مواصفة الزجاج",
 "Drawer box material":"خامة صندوق الدرج",
 "Drawer bottom material":"خامة قاع الدرج",
 "Back material":"خامة الظهر",
 "SHELF LEVELS · PER BAY":"مناسيب الرفوف · لكل حجرة",
 "Heights in mm from the interior floor to each shelf top, separated by commas. Leave empty for equal spacing.":"الارتفاع بالمليمتر من أرضية الحجرة الداخلية إلى سطح كل رف، مفصولة بفواصل. اتركه فارغًا للتوزيع المتساوي.",
 "HANGING RAIL · PER BAY":"قضيب التعليق · لكل حجرة",
 "Rail height in mm above the interior floor; 0 = no rail. Rail and fittings are accessories, not cut parts.":"ارتفاع القضيب بالمليمتر فوق أرضية الحجرة؛ 0 = بدون قضيب. القضيب وتثبيتاته إكسسوارات وليست قطع قص.",
 "Drawer boxes, fronts and slide lengths follow the rules above. Slide clearances and hardware require manufacturer verification.":"صناديق الأدراج وواجهاتها وأطوال المجاري تتبع القواعد أعلاه. خلوصات المجاري والإكسسوارات تحتاج تحقق المصنّع.",
 "Grooved back · in sides, top and bottom":"ظهر داخل مجرى · في الجانبين والسقف والقاعدة",
 "↓ Manufacturing CSV":"↓ قائمة التصنيع CSV",
 "↓ Part labels · QR":"↓ ملصقات القطع · QR",
 "CUT L × W":"مقاس القص ط × ع",
 "Project identity":"هوية المشروع",
 "Design revision no.":"رقم إصدار التصميم",
 "Project ID":"معرّف المشروع",
 "Labels and the manufacturing CSV carry this project ID and revision.":"تحمل الملصقات وقائمة التصنيع معرّف المشروع ورقم الإصدار.",
 '2D DESIGN VIEW':'عرض التصميم ثنائي الأبعاد',
 '3D unavailable in this session. 2D drawings are active; editing, saving and exports remain available.':'تعذّر تشغيل العرض ثلاثي الأبعاد في هذه الجلسة. العرض ثنائي الأبعاد متاح، ويمكنك التعديل والحفظ والتصدير.',

 'REFERENCES VIEW':'عرض المراجع', 'EXTRACTED DATA · REVIEW REQUIRED':'بيانات مستخرجة · تتطلب المراجعة',
 '3D design':'التصميم ثلاثي الأبعاد', 'Shop drawings':'الرسومات الفنية',
 'Manufacturing':'التصنيع', 'Presentation':'العرض', 'Properties':'الخصائص',
 'Design library':'مكتبة التصميم', 'Focus workspace':'توسيع مساحة العمل',
 'Restore panels':'إظهار اللوحات', 'Skip to workspace':'الانتقال إلى مساحة العمل',

 'Reference library':'مكتبة البيانات المرجعية','Source file':'ملف المصدر','Search facts':'البحث في البيانات','Download reference JSON':'تنزيل بيانات المرجع JSON',
 'Data path':'مسار البيان','Source value':'القيمة في المصدر','Previous':'السابق','Next':'التالي','Room templates from supplied planner':'قوالب غرف من المخطط المرفوع','Room template':'قالب الغرفة','Apply room dimensions':'تطبيق أبعاد الغرفة',
 'Only room dimensions are converted from cm to mm. Existing ceiling height and cabinets remain.':'تُحوّل أبعاد الغرفة فقط من سم إلى مم، مع إبقاء ارتفاع السقف والوحدات الحالية.',

  'Saved design revisions':'مراجعات التصميم المحفوظة', 'Revision label':'اسم المراجعة',
  'Save revision':'حفظ مراجعة', 'Saved revision':'مراجعة محفوظة', 'Open revision':'فتح المراجعة', 'Delete revision':'حذف المراجعة',
  'Choose a saved revision…':'اختر مراجعة محفوظة…', 'Back construction':'تركيب الظهر',
  'Inset back · inside carcass':'ظهر غاطس · داخل الهيكل', 'Overlay back · total depth includes back':'ظهر خارجي · العمق الكلي يشمل الظهر',
  'Local browser snapshots, newest ten retained. JSON export remains your portable backup.':'مراجعات محلية في المتصفح، مع الاحتفاظ بأحدث عشر مراجعات. صدّر JSON للاحتفاظ بنسخة قابلة للنقل.',

  'Room plan':'مخطط الغرفة', 'Cost estimate':'تقدير التكلفة', 'Engineering review':'المراجعة الهندسية',
  'ROOM PLAN':'مخطط الغرفة', 'COST ESTIMATE':'تقدير التكلفة', 'ENGINEERING REVIEW':'المراجعة الهندسية',
  '▧ ROOM PLAN':'▧ مخطط الغرفة', '▥ ROOM PLAN':'▥ مخطط الغرفة',
  '◫ ROOM PLAN':'◫ مخطط الغرفة', '◈ ROOM PLAN':'◈ مخطط الغرفة',
  'COSTING':'التكلفة', '◇ COSTING':'◇ التكلفة', '¤ COST ESTIMATE':'¤ تقدير التكلفة',
  'REVIEW':'المراجعة', '✓ REVIEW':'✓ المراجعة', '✓ ENGINEERING REVIEW':'✓ المراجعة الهندسية',
  'PLAN VIEW':'عرض المخطط', 'COSTING VIEW':'عرض التكلفة', 'REVIEW VIEW':'عرض المراجعة',
  'Room rotation':'دوران الوحدة في الغرفة', 'Rotation':'الدوران',
  'Stock grain axis':'محور عروق اللوح الخام', 'Stock grain':'عروق اللوح الخام',
  'Legacy Alpha layout':'توزيع النسخ السابقة', 'Legacy':'النمط السابق',
  'Legacy (preserve old layouts)':'النمط السابق (الحفاظ على التوزيع القديم)',
  'Width X':'العرض X', 'Length Y':'الطول Y',
  'Along sheet width (X)':'باتجاه عرض اللوح (X)', 'Along sheet length (Y)':'باتجاه طول اللوح (Y)',
  'Sheet width (X)':'عرض اللوح (X)', 'Sheet length (Y)':'طول اللوح (Y)',
  'Kitchen layout':'تخطيط المطبخ', 'KITCHEN LAYOUT':'تخطيط المطبخ',
  'Straight':'خطي', 'L-shaped':'على شكل L', 'U-shaped':'على شكل U',
  'Straight run':'صف خطي', 'L shape':'شكل L', 'U shape':'شكل U',
  'Shape':'الشكل', 'Count':'العدد', 'Cabinet count':'عدد الوحدات', 'Unit count':'عدد الوحدات',
  'Cabinet width':'عرض الوحدة', 'Cabinet depth':'عمق الوحدة', 'Cabinet height':'ارتفاع الوحدة',
  'Unit width':'عرض الوحدة', 'Unit depth':'عمق الوحدة', 'Unit height':'ارتفاع الوحدة',
  'Gap':'الفاصل', 'Generate layout':'إنشاء التوزيع',
  'Align next to':'المحاذاة بجوار وحدة', 'Reference unit':'الوحدة المرجعية',
  'Side':'الجانب', 'Left':'اليسار', 'Right':'اليمين', 'Back':'الخلف',
  'Apply alignment':'تطبيق المحاذاة', 'Snapping grid':'شبكة المحاذاة', 'Snap to grid':'محاذاة مع الشبكة',
  'Currency':'العملة', 'Material rates':'أسعار الخامات', 'Price / m²':'السعر / م²',
  'Edge / m':'الحواف / م', 'Waste %':'الهدر %', 'Labor hours':'ساعات العمل',
  'Hourly rate':'أجر الساعة', 'Hardware total':'إجمالي مستلزمات التجميع',
  'Overhead %':'المصاريف غير المباشرة %', 'Profit margin %':'هامش الربح %',
  'Export estimate CSV':'تصدير التكلفة CSV', 'Recalculate estimate':'إعادة حساب التكلفة',
  'Estimate incomplete':'تقدير غير مكتمل', 'Unpriced materials':'خامات دون تسعير',
  'Missing prices prevent a full estimate':'أدخل الأسعار الناقصة لإكمال تقدير التكلفة',
  'Nominal area':'المساحة الاسمية', 'Billable area':'المساحة المحسوبة للتكلفة',
  'Rate':'السعر', 'Cost':'التكلفة', 'Edges':'الحواف', 'Labor':'العمل', 'Hardware':'مستلزمات التجميع',
  'Overhead':'المصاريف غير المباشرة', 'Production cost':'تكلفة الإنتاج',
  'Selling price':'سعر البيع', 'Estimated profit':'الربح التقديري',
  'Professional references':'المراجع المهنية',
  'DESIGN · ENGINEERING · MANUFACTURING':'تصميم · هندسة · تصنيع',
  'Untitled Joinery Project':'مشروع نجارة بلا عنوان',
  'LOCAL WORKSPACE':'مساحة عمل محلية',
  '↥ Open':'↥ فتح', '↧ Save project':'↧ حفظ المشروع', '▣ Present':'▣ عرض',
  'New project':'مشروع جديد', 'New':'جديد', 'Duplicate':'نسخ الوحدة',
  'Duplicate unit':'نسخ الوحدة', 'Undo':'تراجع', 'Redo':'إعادة',
  'Restore backup':'استعادة النسخة الاحتياطية',
  'Local workspace · export JSON for a portable copy':'مساحة عمل محلية · صدّر JSON للاحتفاظ بنسخة قابلة للنقل',
  'Saved locally · export JSON for a portable copy':'حُفظ محليًا · صدّر JSON للاحتفاظ بنسخة قابلة للنقل',
  'Maximum 100 units per project':'الحد الأقصى 100 وحدة لكل مشروع',
  '◈  3D DESIGN':'◈  تصميم ثلاثي الأبعاد', '▤  SHOP DRAWINGS':'▤  الرسومات الفنية',
  '▦  MANUFACTURING':'▦  التصنيع', '◉  PRESENTATION':'◉  العرض',
  'ROKADEX DESIGN SYSTEM':'نظام تصميم روكادكس', 'DESIGN LIBRARY':'مكتبة التصميم',
  'FURNITURE MODULES':'وحدات الأثاث', 'Cabinet Unit':'وحدة خزانة',
  'Parametric carcass & shelves':'هيكل ورفوف قابلة لضبط الأبعاد',
  'Tall Wardrobe':'خزانة ملابس طويلة', 'Preset cabinet dimensions':'أبعاد خزانة مسبقة',
  'Base Kitchen Unit':'وحدة مطبخ سفلية', 'Two-door Cabinet':'خزانة ببابين',
  'Door leaves & edge schedule':'ضلف الأبواب وجدول الحواف',
  'ROOM PLANNER · mm':'مخطط الغرفة · مم', 'Width':'العرض', 'Depth':'العمق', 'Height':'الارتفاع',
  'Snap selected to wall':'محاذاة الوحدة المحددة مع الجدار',
  'Back wall':'الجدار الخلفي', 'Front wall':'الجدار الأمامي',
  'Left wall':'الجدار الأيسر', 'Right wall':'الجدار الأيمن',
  'Align to wall':'محاذاة مع الجدار', 'Export room plan SVG':'تصدير مخطط الغرفة SVG',
  'PROJECT EXPLORER':'مستكشف المشروع', 'SCENE':'المشهد', 'Front':'أمامي',
  'Isometric':'متساوي القياس', 'Top':'علوي',
  'Browser-based • No account required':'يعمل في المتصفح • دون حساب',
  'Prototype — engineering review required':'نسخة تجريبية — تتطلب مراجعة هندسية',
  'PERSPECTIVE VIEW':'منظور ثلاثي الأبعاد', 'DESIGN VIEW':'عرض التصميم',
  'DRAWINGS VIEW':'عرض الرسومات', 'MANUFACTURING VIEW':'عرض التصنيع', 'RENDER VIEW':'عرض المعاينة',
  'Select a component to inspect its properties':'حدد مكوّنًا لمراجعة خصائصه',
  'Wireframe':'الهيكل السلكي', 'Explode':'عرض تفكيكي', 'Reset view':'إعادة ضبط المشهد',
  'TECHNICAL DRAWINGS':'الرسومات الفنية', 'SCHEMATIC • NOT FOR FABRICATION':'رسم تخطيطي • غير معتمد للتصنيع',
  'Download SVG':'تنزيل SVG', 'CUTTING & SHEET LAYOUT':'قوائم القص وتوزيع الألواح',
  'PRELIMINARY NESTING':'توزيع أولي', 'Apply Method':'تطبيق الطريقة',
  'Hardware Estimate':'تقدير مستلزمات التجميع', 'Select construction method…':'اختر طريقة التجميع…',
  'Frameless / European':'دون إطار / أوروبي', 'Overlay top and bottom':'العلوي والسفلي فوق الجانبين',
  'Inset door concept':'تصور باب داخلي',
  'INTERACTIVE CLIENT PRESENTATION':'عرض تفاعلي للعميل', 'LIVE 3D PREVIEW':'معاينة ثلاثية الأبعاد مباشرة',
  'Orbit and zoom the model. Change material appearance in the Properties panel. Export a preview image using the button below.':'أدر النموذج وكبّره، وعدّل مظهر الخامة من لوحة الخصائص. يمكنك تصدير صورة المعاينة من الزر أدناه.',
  'Export PNG Preview':'تصدير صورة PNG',
  'Browser raster preview — not photorealistic path tracing.':'معاينة رسومية في المتصفح — ليست تصييرًا واقعيًا بتتبع المسارات.',
  'ENGINEERING REVIEW · PROJECT-WIDE':'المراجعة الهندسية · المشروع بالكامل',
  'Standalone · NOT FOR FABRICATION':'تطبيق مستقل · غير معتمد للتصنيع',
  '↻ Audit Project':'↻ فحص المشروع', '↓ Reviewed Cut List CSV':'↓ قائمة القص المراجعة CSV',
  '↓ Selected Panel Detail SVG':'↓ تفاصيل اللوح المحدد SVG',
  'PROJECT-WIDE SHEET OPTIMIZATION · PREVIEW ONLY':'توزيع ألواح المشروع · للمعاينة فقط',
  'Combines compatible stock across all cabinets, rather than packing each unit separately. Preliminary rectangular packing; no guillotine cut sequence or CNC output.':'يجمع الألواح المتوافقة من جميع الخزائن في توزيع واحد. توزيع مستطيل أولي، دون تسلسل قطع منشار أو أوامر CNC.',
  '↻ Calculate Project Sheets':'↻ حساب ألواح المشروع', '↓ Sheet Layout SVG':'↓ توزيع الألواح SVG',
  '↓ Sheet Positions CSV':'↓ إحداثيات الألواح CSV', 'COMPONENTS & CUTTING LIST':'المكوّنات وقائمة القص',
  '↓ Unit CSV':'↓ الوحدة CSV', '↓ Project CSV':'↓ المشروع CSV', '↓ DXF Outlines':'↓ حدود الألواح DXF',
  'Print Assembly':'طباعة جدول التجميع', 'PART ID':'معرّف الجزء', 'COMPONENT':'المكوّن',
  'LENGTH':'الطول', 'WIDTH':'العرض', 'THK.':'السماكة', 'MATERIAL':'الخامة', 'EDGE (mm)':'الحواف (مم)',
  'PROPERTIES':'الخصائص', 'PARAMETRIC COMPONENT':'مكوّن قابل لضبط الأبعاد',
  'One model · Connected manufacturing outputs':'نموذج واحد · مخرجات تصنيع مترابطة',
  'PLACEMENT · ROOM COORDINATES (mm)':'الموضع · إحداثيات الغرفة (مم)',
  'X position':'الموضع X', 'Z position':'الموضع Z', 'DIMENSIONS':'الأبعاد', 'mm':'مم',
  'Panel thickness':'سماكة اللوح', 'Partitions':'الفواصل', 'Shelves / bay':'الرفوف / الحجرة',
  'CONSTRUCTION RULES':'قواعد التجميع', 'Assembly type':'طريقة التجميع',
  'Top & bottom between sides':'العلوي والسفلي بين الجانبين',
  'Top & bottom over sides':'العلوي والسفلي فوق الجانبين', 'Back thickness':'سماكة الظهر', 'Back inset':'إزاحة الظهر',
  'DOORS · PRELIMINARY':'الأبواب · تصميم أولي', 'Door leaves':'ضلف الأبواب',
  'Reveal / gap (mm)':'الفاصل / الخلوص (مم)', 'Overlay (mm)':'التراكب (مم)',
  'ENGINEERING EDITOR · INDIVIDUAL BAYS':'المحرر الهندسي · الحجرات المنفردة',
  'Set shelf count for each bay independently. Changes update the 3D model and cut list.':'اضبط عدد رفوف كل حجرة على حدة. تتحدث المعاينة ثلاثية الأبعاد وقائمة القص عند التعديل.',
  'DRAWER BANKS · PER BAY':'مجموعات الأدراج · لكل حجرة',
  'Conceptual drawer boxes and fronts. Slide clearances and hardware require manufacturer verification. Do not combine drawers with doors in the same bay.':'صناديق وواجهات أدراج تصورية. تتطلب خلوصات المجاري ومستلزمات التجميع تحققًا من المصنّع. لا تجمع الأدراج والأبواب في الحجرة نفسها.',
  'SELECTED PANEL · EDGE BANDING':'اللوح المحدد · تلبيس الحواف',
  'Click a panel in 3D or a row in the cutting list. Edge flags are a conceptual schedule; verify edge orientation before fabrication.':'حدد لوحًا من المشهد أو قائمة القص. جدول الحواف تصوري؛ تحقق من اتجاه الحواف قبل التصنيع.',
  'No panel selected':'لم يُحدد لوح', 'Select a panel in the 3D scene or cutting list':'حدد لوحًا من المشهد ثلاثي الأبعاد أو قائمة القص',
  'Long A':'الطويلة A', 'Short A':'القصيرة A', 'Long B':'الطويلة B', 'Short B':'القصيرة B',
  'Restore default edges':'استعادة الحواف الافتراضية', 'DRILLING GRID · REFERENCE ONLY':'شبكة الثقوب · مرجع فقط',
  'Select a panel in 3D or the cutting list. Coordinates are a conceptual 32 mm grid, not a hardware-specific pattern or CNC program.':'حدد لوحًا من المشهد أو قائمة القص. الإحداثيات شبكة تصورية بخطوة 32 مم، وليست نمطًا لمستلزم تجميع معيّن أو برنامج CNC.',
  'Pitch (mm)':'خطوة التكرار (مم)', 'Edge offset (mm)':'البعد عن الحافة (مم)',
  'End margin (mm)':'هامش النهاية (مم)', 'Diameter (mm)':'القطر (مم)', 'Depth (mm)':'العمق (مم)',
  'Preview drilling reference':'معاينة مرجع الثقوب', '↓ Drilling SVG':'↓ مخطط الثقوب SVG',
  '↓ Drilling CSV':'↓ إحداثيات الثقوب CSV', 'Select a panel to preview.':'حدد لوحًا للمعاينة.',
  'HARDWARE LIBRARY · USER VERIFIED':'مكتبة مستلزمات التجميع · يتحقق منها المستخدم',
  'Import your own manufacturer-confirmed drilling patterns in JSON. No proprietary libraries included. Reference coordinates only, never CNC-ready.':'استورد أنماط ثقوب بصيغة JSON معتمدة من المصنّع. لا توجد مكتبات مملوكة مرفقة. الإحداثيات مرجعية فقط وليست جاهزة لـCNC.',
  '↓ Hardware JSON Template':'↓ قالب مستلزمات التجميع JSON', 'Verified hardware':'مستلزمات تجميع موثقة',
  'Import a verified library…':'استورد مكتبة موثقة…', 'Select verified hardware…':'اختر مستلزمًا موثقًا…',
  'Check selected panel pattern':'فحص نمط اللوح المحدد', '↓ Pattern CSV':'↓ إحداثيات النمط CSV',
  'No verified hardware imported.':'لم تُستورد مكتبة موثقة.', 'MATERIAL & FINISH':'الخامة والتشطيب',
  'Panel material':'خامة اللوح', 'Wood grain':'اتجاه ألياف الخشب', 'Vertical':'رأسي', 'Horizontal':'أفقي',
  'No grain restriction':'دون قيد لاتجاه الألياف', 'MANUFACTURING':'التصنيع',
  'Edge thickness':'سماكة تلبيس الحافة', 'Kerf':'عرض القطع', 'Sheet width':'عرض اللوح الخام',
  'Sheet length':'طول اللوح الخام', 'Sheet trim':'هامش تشذيب اللوح', 'MODEL APPEARANCE':'مظهر النموذج',
  'Finish':'التشطيب', 'Natural oak':'بلوط طبيعي', 'Walnut':'جوز', 'Warm white':'أبيض دافئ',
  'Charcoal':'فحمي', 'Remove selected component':'حذف المكوّن المحدد', '✕ Exit presentation':'✕ إغلاق العرض',
  'ROKADEX STUDIO • DESIGN CONCEPT':'روكادكس ستوديو • تصور تصميمي',
  'Interactive 3D client review • Preliminary design':'مراجعة تفاعلية ثلاثية الأبعاد للعميل • تصميم أولي',
  'Review issues':'ملاحظات المراجعة', 'Material rollup':'ملخص الخامات', 'Severity':'الأهمية',
  'Code':'الرمز', 'Unit':'الوحدة', 'Finding':'الملاحظة', 'Material':'الخامة', 'Parts':'الأجزاء',
  'Edge m':'الحواف م',
  '✓ No rectangular footprint conflicts detected':'✓ لم تُكتشف تعارضات في المساقط المستطيلة',
  'Keep at least one unit in the project':'يجب إبقاء وحدة واحدة على الأقل في المشروع',
  'Position must be within ±100000 mm':'يجب أن يكون الموضع ضمن ±100000 مم',
  'Select a panel in the model or cut list first':'حدد لوحًا من النموذج أو قائمة القص أولًا',
  'Select a panel in the 3D view or parts list':'حدد لوحًا من المشهد أو قائمة الأجزاء',
  'Select a panel first':'حدد لوحًا أولًا', 'Select verified hardware':'اختر مستلزم تجميع موثقًا',
  'Selected panel is unavailable':'اللوح المحدد غير متاح', 'Panel no longer exists':'اللوح لم يعد موجودًا',
  'Allow popups to print assembly report':'اسمح بالنوافذ المنبثقة لطباعة تقرير التجميع',
  'Library exceeds 1 MB':'حجم المكتبة يتجاوز 1 ميغابايت',
};

const messages = {
  bay: ['Bay {number}', 'الحجرة {number}'],
  saved: ['Local backup saved', 'حُفظت نسخة احتياطية محلية'],
  restored: ['Local backup restored', 'استُعيدت النسخة الاحتياطية المحلية'],
  backupUnavailable: ['No local backup available', 'لا توجد نسخة احتياطية محلية'],
  backupFailed: ['Local backup failed: {error}', 'تعذر الحفظ الاحتياطي المحلي: {error}'],
  openFailed: ['Cannot open project: {error}', 'تعذر فتح المشروع: {error}'],
  newProject: ['New project', 'مشروع جديد'],
  partsSummary: ['{parts} parts · {area} m² · {edge} m edge', '{parts} جزء · {area} م² · {edge} م حواف'],
};

let language = 'en';
const translatedNodes = new WeakMap();
const normalize = value => value.replace(/\s+/g, ' ').trim();
const lookup = new Map(Object.entries(labels).flatMap(([en, ar]) => [[normalize(en), [en, ar]],[normalize(ar), [en, ar]]]));
const excluded = 'script,style,svg,textarea,[data-i18n-skip],#tree,#parts,#previewTitle,#presentationTitle,#selectedName';

export function getLanguage() { return language; }

export function t(key, values = {}, selectedLanguage = language) {
  const pair = messages[key] || lookup.get(normalize(key));
  const value = pair ? pair[selectedLanguage === 'ar' ? 1 : 0] : key;
  return value.replace(/\{(\w+)\}/g, (match, name) => String(values[name] ?? match));
}

// Exact text-node replacement preserves inputs, event handlers, icons and user-entered data.
export function applyLanguage(next, root = document) {
  if (!['ar', 'en'].includes(next)) throw new Error('Unsupported interface language');
  language = next;
  const doc = root.ownerDocument || root;
  doc.documentElement.lang = next;
  doc.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  doc.title = next === 'ar' ? 'روكادكس ستوديو — التصميم والتصنيع' : 'RokaDex Studio — Design & Manufacturing';
  const walker = doc.createTreeWalker(root.body || root, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest(excluded)) continue;
    const text = normalize(node.nodeValue);
    let record = translatedNodes.get(node);
    if (!record || text !== record.current) {
      const pair = lookup.get(text);
      const bay = text.match(/^Bay (\d+)$/);
      record = pair ? {en: pair[0], ar: pair[1]} : bay ? {en: text, ar: t('bay', {number: bay[1]}, 'ar')} : null;
    }
    if (!record) continue;
    const value = record[next];
    node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), value);
    record.current = normalize(node.nodeValue);
    translatedNodes.set(node, record);
  }
  const langButton = doc.getElementById('lang');
  if (langButton) {
    langButton.textContent = next === 'ar' ? 'English' : 'العربية';
    langButton.title = next === 'ar' ? 'التبديل إلى الإنجليزية' : 'Switch to Arabic';
  }
  doc.querySelector('.modes')?.setAttribute('aria-label', next === 'ar' ? 'عروض مساحة العمل' : 'Workspace views');
  const method = doc.getElementById('manufacturingMethod');
  if (method) method.setAttribute('aria-label', next === 'ar' ? 'طريقة التصنيع' : 'Manufacturing method');
  const review = doc.querySelector('.review-box');
  if (review) review.setAttribute('aria-label', next === 'ar' ? 'المراجعة الهندسية للتصنيع' : 'Engineering manufacturing review');
  return next;
}
