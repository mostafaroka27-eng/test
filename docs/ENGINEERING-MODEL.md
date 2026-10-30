# النموذج الهندسي الموحد — Alpha 1.4.0 (قواعد cab-2.0)

هذا الملف يصف العقد الذي تعتمد عليه كل المخرجات: العرض ثلاثي الأبعاد، الرسومات، قائمة القص، CSV التصنيع، الملصقات، توزيع الألواح والتكلفة. كلها تقرأ ناتج دالة واحدة: `cabinet(config, unitId)` في `engine.mjs`.

## 1. الهرمية

```
Project (projectId, designRevision, lengthUnit = mm, migratedFrom?)
 └─ Room (width, depth, height — mm، مركز الغرفة هو الأصل)
     └─ Unit / Assembly (id, x, z, rotation 0/90/180/270, finish = لون العرض فقط, config)
         ├─ Parts (ألواح تُقص) → operations (مجاري الظهر حاليًا)
         └─ Accessories (مجاري أدراج، قضبان تعليق — ليست قطع قص)
```

لم تُضف طبقة كائنات جديدة: الهرمية موجودة في الملف v3 وفي ناتج `cabinet()`. هذا يكفي حاليًا ويمنع ازدواج مصادر البيانات.

## 2. الإحداثيات والوحدات

- كل الأطوال داخليًا بالمليمتر. أي وحدة مصدر تُحوّل مرة واحدة عبر `importLength(value, unit)` في `reference-data.mjs`، والقيمة المحوّلة تحمل `sourceUnit` فلا تُحوّل مرة ثانية.
- الغرفة: الأصل في مركز الأرضية، X لليمين، Y لأعلى، Z نحو المشاهد (الأمام). الدوران حول +Y بزوايا ربع دورة فقط.
- الوحدة: الأصل في منتصف العرض والعمق وعلى الأرض. واجهة الخزانة عند `z = +depth/2`.
- محاور القطعة المحلية: `length` و`width` و`thickness`، وتحويلها إلى X/Y/Z في `geometry.partSize()` حسب نوع القطعة. الرسومات والمشهد وحدود الغرفة تستخدم الدالة نفسها.
- وجه التشغيل: لم يُعرّف بعد إلا لعمليات المجرى (`face: 'inner'`). لا توجد نقطة أصل ماكينة.

## 3. حقول القطعة

| الحقل | المعنى |
| --- | --- |
| `uid` | معرف دلالي ثابت `UNIT/kind:bay:slot` — لا يتغير إذا أُضيفت رفوف في حجرة أخرى. هذا ما يُطبع في الملصق. |
| `id` | رقم عرض وتصدير قديم يتبع ترتيب التوليد وقد يتغير. محفوظ للتوافق فقط. |
| `key`, `overrideKey` | مفاتيح التوافق وتخصيص الحواف من 1.3. |
| `length`, `width` | المقاس النهائي بعد اللبنيج. |
| `cutLength`, `cutWidth` | مقاس القص. يساوي النهائي إذا كان `edgeDeduction = off`. إذا كان `on`: `cutLength = L − et×(W1+W2)` و`cutWidth = W − et×(L1+L2)`. |
| `edges` | `[L1, W1, L2, W2]`. تحقّقنا من الترتيب مقابل NCD (`bands.L1/L2/W1/W2`) ومقابل حساب `bandLength` في المحرك القديم: الفهارس الزوجية حواف على طول القطعة. |
| `edgeThickness` | لكل قطعة؛ الأبواب وواجهات الأدراج تستخدم `doorEdgeThickness` عند تحديده. |
| `material`, `thickness` | الخامة الفعلية. لون العرض في `unit.finish` منفصل تمامًا. |
| `grain`, `canRotate` | `vertical` = العرق على الطول، `horizontal` = على العرض، `none` = يسمح بالتدوير. |
| `sheetGood` | `false` للزجاج: لا يدخل توزيع الألواح ولا DXF ولا لبنيج. |
| `operations` | عمليات صريحة. حاليًا: مجرى الظهر فقط، بحالة `unverified-tooling`. |
| `source`, `verification` | مصدر القاعدة (`cab-2.0` أو `rokadex-alpha-1.3.2`) وحالة التحقق `software-convention-unverified`. |

## 4. قواعد cab-2.0 (كلها قابلة للتعديل لكل وحدة)

| القاعدة | الحقول | ملاحظات |
| --- | --- | --- |
| تركيب الحجرات | `bayMode: shared / separate` | مشترك: `(W − 2t − n_part×t)/bays`. منفصل: `W/bays − 2t`، لكل صندوق جانبان وسقف وقاعدة وظهر. |
| القاعدة السفلية | `plinthHeight`, `plinthSetback` | الجوانب تصل للأرض، القاعدة ترتفع، لوح الوزرة بعرض الداخل. غير مدعومة مع «السقف والقاعدة فوق الجوانب» — رسالة خطأ صريحة. |
| الظهر | `backConstruction: legacy / inset / overlay / groove`، `backThickness`، `backInset`، `backGrooveDepth`، `backGrooveAllowance` | المجرى: الظهر = الداخل + 2×عمق المجرى − السماحية، وتُسجل عملية مجرى على الجانبين والسقف والقاعدة. سماكة الظهر تُقرأ من النموذج ولا تُوحّد. |
| الرفوف | `shelfMode: fixed / adjustable`، `shelfSideClearance` (لكل جانب)، `shelfFrontSetback`، `bayShelfLevels` | المنسوب = ارتفاع سطح الرف فوق أرضية الحجرة. المناسيب المتداخلة أو فوق السقف تُرفض ولا تُنقل. |
| قضيب التعليق | `bayRails`، `railShelfClearance` | إكسسوار بطول العرض الداخلي (قبل خصم القواعد المعدنية). يُرفض إن اقترب من الرف أعلاه. |
| الأدراج | `drawerLayout: legacy / bottom`، `drawerStyle: external / internal`، `drawerFrontHeight`، `drawerBoxHeight`، `drawerBoxHeightClearance`، `internalDrawerSetback` | `bottom`: الأدراج أسفل الحجرة، فوقها رف ثابت `fixedShelf`، ثم الرفوف/التعليق. الواجهات الخارجية مع أبواب كاملة الارتفاع خطأ صريح. |
| المجاري | `drawerSlideMode: legacy / auto / fixed`، `drawerSlideLength`، `drawerSlideRearClearance` | `auto` يختار أطول طول من `DRAWER_SLIDE_LENGTHS` (من مرجع NCD، غير معتمد من مورد) يقل عن العمق المتاح. إن لم يناسب أي طول: خطأ يذكر العمق المتاح، دون رجوع إلى 250. |
| الأبواب | `doorType: panel / glass`، `doorThickness`، `doorEdgeThickness`، `glassThickness`، `glassMaterial`، `doorMaterial` | الزجاج قطعة حقيقية بخامة وسماكة الزجاج، خارج الألواح، مع تحذير توريد. |
| الخامات | `doorMaterial`، `drawerBoxMaterial`، `drawerBottomMaterial`، `backMaterial`، `drawerBoxThickness` | `inherit` = خامة الهيكل (أو الظهر لقاع الدرج). |
| اللبنيج | `edgeDeduction: on / off` | يؤثر على مقاس القص والتوزيع فقط. |

**التوافق:** القيم الافتراضية في `DEFAULTS` تحافظ على هندسة 1.3.2. الملفات القديمة تبقى `rulesVersion: legacy` ولا تكتسب قواعد cab-2.0 بصمت. الوحدات الجديدة فقط تأخذ `MODERN_RULES`. اختبار `engine-v2.test.mjs` يقارن 73 تركيبة قديمة حرفيًا بلقطة محفوظة من محرك 1.3.2.

## 5. صيغة الملف v3 والترحيل

- `version: 3`، `projectId`، `designRevision` (1–9999)، `lengthUnit: "mm"`، و`migratedFrom` عند فتح ملف 1 أو 2.
- v1/v2 → v3: لا تتغير أي قيمة هندسية. الحقول الجديدة تأخذ القيم القديمة. معرّف المشروع للملف القديم مشتق بشكل ثابت من محتواه (نفس الملف → نفس المعرّف) إلى أن يُحفظ كـ v3.
- ملف تالف أو بإصدار غير معروف يُرفض قبل أي تغيير للمشروع المفتوح (الاختبار القديم ما زال قائمًا).
- لا يُكتب v2 بعد الآن. النسخ القديمة من التطبيق لن تفتح ملفات v3 — احتفظ بنسخة v2 إذا احتجت الرجوع.

## 6. المخرجات المشتقة

- `manufacturing.mjs` → `partRecords()`، `manufacturingCsv()`، `labelPayload()/parseLabelPayload()`، `labelsHtml()`، `verifySheetLayout()`.
- حمولة QR: `RDX-PART-1?prj=…&rev=…&uid=…&k=…&m=…&t=…&fl=…&fw=…&cl=…&cw=…&e=1010&c=<checksum>`. المقاسات بدقة 0.01 مم (بخلاف NCD الذي يخزن مليمترات صحيحة). أي اقتطاع أو تعديل يكسر المجموع الاختباري فيُرفض. الحد 700 حرف.
- التوزيع: يستخدم مقاس القص، ويستبعد غير الألواح، ولا يدوّر قطعة مقيدة بالعرق. الاستغلال = مساحة القطع الموضوعة ÷ مساحة الألواح الكاملة. الهالك = 100 − الاستغلال (يشمل التشذيب والمنشار).
