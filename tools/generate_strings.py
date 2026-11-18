#!/usr/bin/env python3
# Regenerates App/Resources/{en,ar}.lproj/*.strings. Run from the repository root:
#   python3 tools/generate_strings.py
S = {
# common
"common.cancel": ("Cancel","إلغاء"), "common.close": ("Close","إغلاق"), "common.delete": ("Delete","حذف"),
"common.done": ("Done","تم"), "common.edit": ("Edit","تعديل"), "common.error": ("Error","خطأ"), "common.ok": ("OK","حسناً"),
"common.rename": ("Rename","إعادة تسمية"), "common.save": ("Save","حفظ"),
# units / values
"unit.m": ("m","م"), "unit.mm": ("mm","مم"), "unit.m2": ("m²","م²"),
"value.notDetected": ("Not detected","غير مكتشف"), "value.notDetectedShort": ("n/d","غ/م"), "value.notEntered": ("Not entered","غير مُدخل"),
# projects
"projects.title": ("Projects","المشاريع"), "projects.new": ("New project","مشروع جديد"), "projects.create": ("Create","إنشاء"),
"projects.namePlaceholder": ("Project name","اسم المشروع"), "projects.addSample": ("Add sample inspection","إضافة معاينة تجريبية"),
"projects.creatingSample": ("Creating sample…","جارٍ إنشاء المثال…"),
"projects.deleteTitle": ("Delete this project?","حذف هذا المشروع؟"),
"projects.deleteMessage": ("The plan, 3D model, measurements and video stored on this iPhone will be deleted permanently.","سيتم حذف المخطط والنموذج ثلاثي الأبعاد والقياسات والفيديو المحفوظة على هذا الآيفون نهائياً."),
"projects.empty": ("No projects yet","لا توجد مشاريع بعد"),
"projects.emptyHint": ("Tap + to create a project and scan a room, or add the sample inspection to try the app.","اضغط + لإنشاء مشروع ومسح غرفة، أو أضف المعاينة التجريبية لتجربة التطبيق."),
"projects.loadFailed": ("This project could not be opened.","تعذر فتح هذا المشروع."),
"projects.retryNeeded": ("Export needs retry","تصدير يحتاج إعادة"),
"projects.unreadable": ("%d project folder(s) could not be read. They were not deleted.","تعذرت قراءة %d من مجلدات المشاريع. لم يتم حذفها."),
# support
"support.simulator": ("Simulator: scanning needs a LiDAR iPhone. Use the sample inspection to test review, video and export.","المحاكي: المسح يحتاج آيفون فيه LiDAR. استخدم المعاينة التجريبية لتجربة المراجعة والفيديو والتصدير."),
"support.noLidar": ("This device has no LiDAR scanner, so RoomPlan scanning is not available. You can still open and export projects.","هذا الجهاز لا يحتوي على حساس LiDAR، لذلك المسح بـ RoomPlan غير متاح. يمكنك فتح المشاريع وتصديرها."),
"support.cameraDenied": ("Camera access is off. Enable it in Settings › Privacy › Camera to scan.","الوصول للكاميرا مقفول. فعّله من الإعدادات › الخصوصية › الكاميرا للمسح."),
# capture
"capture.start": ("Start Scan","ابدأ المسح"), "capture.bookmark": ("Bookmark","علامة"),
"capture.finishRoom": ("Finish Room","إنهاء الغرفة"), "capture.finishSurvey": ("Finish Survey","إنهاء المعاينة"),
"capture.nextRoom": ("Scan next room","مسح الغرفة التالية"), "capture.cancel": ("Cancel scan","إلغاء المسح"),
"capture.recording": ("REC","تسجيل"), "capture.notRecording": ("Not recording","لا يوجد تسجيل"),
"capture.bookmarkSaved": ("Bookmark saved","تم حفظ العلامة"),
"capture.bookmark.noVideo": ("Video has not started yet; bookmark not saved.","الفيديو لم يبدأ بعد؛ لم تُحفظ العلامة."),
"capture.scanningRoom": ("Scanning room %d","جارٍ مسح الغرفة %d"),
"capture.roomsDone": ("%d room(s) captured","تم التقاط %d غرفة"),
"capture.betweenRoomsHint": ("Video is still recording. Walk through the doorway to the next room or corridor, then tap Scan next room.","الفيديو لا يزال يسجل. امشِ عبر الباب إلى الغرفة أو الممر التالي، ثم اضغط مسح الغرفة التالية."),
"capture.revisit": ("Revisit %d wall(s): edges not fully seen","ارجع لـ %d جدار: الحواف لم تُرصد بالكامل"),
"capture.storageLow": ("Low storage: about %d min of video left","مساحة قليلة: باقي حوالي %d دقيقة فيديو"),
"capture.processingRoom": ("Processing room…","جارٍ معالجة الغرفة…"), "capture.finishing": ("Saving survey…","جارٍ حفظ المعاينة…"),
"capture.error.storage": ("Not enough free storage to record the walkthrough video. Free up space and try again.","لا توجد مساحة كافية لتسجيل الفيديو. وفّر مساحة وحاول مرة أخرى."),
"capture.error.room": ("Room %d could not be processed (%@). Scan it again.","تعذرت معالجة الغرفة %d (%@). امسحها مرة أخرى."),
"capture.video.failed": ("Video recording failed: %@. The scan continues.","فشل تسجيل الفيديو: %@. المسح مستمر."),
"capture.video.stopped.lowStorage": ("Video stopped: storage almost full. Footage so far is saved.","توقف الفيديو: المساحة شبه ممتلئة. الفيديو المسجل محفوظ."),
"capture.video.stopped.appBackgrounded": ("Video stopped because the app left the screen. Footage so far is saved.","توقف الفيديو لأن التطبيق خرج من الشاشة. الفيديو المسجل محفوظ."),
"capture.discard.title": ("Discard this scan?","تجاهل هذا المسح؟"), "capture.discard.confirm": ("Discard scan and video","تجاهل المسح والفيديو"),
"capture.finishedWithProblems": ("Survey saved with problems","تم حفظ المعاينة مع مشاكل"),
"finish.problem.video": ("Video: %@","الفيديو: %@"), "finish.problem.merge": ("Rooms could not be merged into one plan: %@. Each room is kept separately.","تعذر دمج الغرف في مخطط واحد: %@. كل غرفة محفوظة لوحدها."),
"finish.problem.model": ("3D model: %@","النموذج ثلاثي الأبعاد: %@"), "finish.problem.noRooms": ("No room was captured.","لم يتم التقاط أي غرفة."),
# guidance
"guidance.relocalizing": ("Tracking lost. Go back to the last scanned area and point at it slowly.","فقدان التتبع. ارجع لآخر مكان ممسوح ووجّه الكاميرا عليه ببطء."),
"guidance.trackingWeak": ("Tracking is weak. Move slowly.","التتبع ضعيف. تحرك ببطء."),
"guidance.trackingWeak.motion": ("Tracking is weak: moving too fast. Slow down.","التتبع ضعيف: الحركة سريعة. هدّي السرعة."),
"guidance.trackingWeak.features": ("Tracking is weak: not enough detail. Point at furniture or edges, add light.","التتبع ضعيف: تفاصيل قليلة. وجّه الكاميرا على أثاث أو حواف وزوّد الإضاءة."),
"guidance.trackingLost": ("Tracking unavailable.","التتبع غير متاح."),
"guidance.interrupted": ("Scan interrupted. Video paused.","المسح توقف مؤقتاً. الفيديو متوقف."),
"guidance.moveCloser": ("Move closer to the wall","اقترب من الجدار"), "guidance.moveAway": ("Move away from the wall","ابتعد عن الجدار"),
"guidance.slowDown": ("Slow down","تحرك ببطء"), "guidance.turnOnLight": ("Turn on more light","زوّد الإضاءة"),
"guidance.lowTexture": ("Surface has little texture; scan edges and corners","السطح بدون تفاصيل؛ امسح الحواف والزوايا"),
# naming
"name.room": ("Room %d","غرفة %d"), "name.roomWithLabel": ("%2$@ (Room %1$d)","%2$@ (غرفة %1$d)"),
"name.wall": ("Room %d · Wall %d","غرفة %d · جدار %d"),
"name.door": ("Door %d","باب %d"), "name.window": ("Window %d","شباك %d"), "name.opening": ("Opening %d","فتحة %d"),
"section.bedroom": ("Bedroom","غرفة نوم"), "section.bathroom": ("Bathroom","حمّام"), "section.kitchen": ("Kitchen","مطبخ"),
"section.livingRoom": ("Living room","صالة"), "section.diningRoom": ("Dining room","غرفة طعام"),
"bookmark.defaultLabel": ("Bookmark %d","علامة %d"),
# review
"tab.plan": ("2D Plan","المخطط"), "tab.model": ("3D Model","ثلاثي الأبعاد"), "tab.measurements": ("Measurements","القياسات"), "tab.video": ("Video","الفيديو"),
"review.noScan": ("No scan in this project yet","لا يوجد مسح في هذا المشروع بعد"),
"review.missingFiles": ("Missing files: %@","ملفات مفقودة: %@"),
"output.rawRoomData": ("Room data","بيانات الغرف"), "output.model3D": ("3D model","النموذج ثلاثي الأبعاد"), "output.video": ("Video","الفيديو"),
"output.pdfPlan": ("PDF plan","مخطط PDF"), "output.csvMeasurements": ("CSV","CSV"), "output.jsonReport": ("JSON report","تقرير JSON"),
"sample.badge": ("SAMPLE – synthetic data, not a real scan","تجريبي – بيانات مصطنعة وليست مسحاً حقيقياً"), "sample.short": ("SAMPLE","تجريبي"),
"plan.empty": ("No plan geometry","لا توجد هندسة للمخطط"),
"plan.legend.scan": ("Scan mm","مسح مم"), "plan.legend.verified": ("Verified","مُتحقق"), "plan.legend.partial": ("Dashed = partly seen","متقطع = مرصود جزئياً"), "plan.legend.video": ("Has video","له فيديو"),
"alignment.single": ("Single room","غرفة واحدة"), "alignment.connected": ("Rooms connected in one coordinate system","الغرف متصلة في نظام إحداثيات واحد"),
"alignment.connectedWithWarnings": ("Rooms connected – check warnings","الغرف متصلة – راجع التحذيرات"),
"alignment.notConnected": ("Some rooms could not be aligned reliably","بعض الغرف لم يمكن محاذاتها بشكل موثوق"),
"alignment.issue.sessionReset": ("tracking was lost before this room; position not reliable","فُقد التتبع قبل هذه الغرفة؛ موقعها غير موثوق"),
"alignment.issue.overlapsOtherRoom": ("overlaps another room","تتداخل مع غرفة أخرى"),
"alignment.issue.isolated": ("not next to any other room","ليست بجوار أي غرفة أخرى"),
"alignment.issue.structureMergeFailed": ("RoomPlan could not merge the rooms","RoomPlan لم يستطع دمج الغرف"),
"alignment.issue.longTrackingLoss": ("tracking was weak for a long time","التتبع كان ضعيفاً لفترة طويلة"),
"roomAlignment.single": ("Single room","غرفة واحدة"), "roomAlignment.aligned": ("Aligned","متحاذية"), "roomAlignment.suspect": ("Check alignment","راجع المحاذاة"), "roomAlignment.notAligned": ("Not aligned","غير متحاذية"),
"room.alignment": ("Alignment","المحاذاة"),
# dims
"dim.width": ("Width","العرض"), "dim.height": ("Height","الارتفاع"), "dim.length": ("Length","الطول"), "dim.wallHeight": ("Wall height","ارتفاع الجدار"),
"dim.sill": ("Sill height (scan)","ارتفاع الجلسة (مسح)"), "dim.area": ("Floor area (scan)","مساحة الأرضية (مسح)"),
"dim.maxWallHeight": ("Wall height, max (scan)","أقصى ارتفاع جدار (مسح)"),
"dim.ceilingVerified": ("Ceiling height (verified)","ارتفاع السقف (مُتحقق)"),
"dim.ceilingNote": ("RoomPlan does not capture ceilings. Wall height is not a ceiling height; enter the measured ceiling height here.","RoomPlan لا يلتقط الأسقف. ارتفاع الجدار ليس ارتفاع السقف؛ أدخل ارتفاع السقف المقاس هنا."),
"dim.delta": ("Verified − scan","المُتحقق − المسح"),
"source.roomPlan": ("Scan (RoomPlan)","مسح (RoomPlan)"), "source.derivedFromRoomPlan": ("Derived from scan","مشتق من المسح"),
"source.manualVerified": ("Site-verified","مُتحقق في الموقع"), "source.manufacturing": ("Manufacturing","للتصنيع"),
"confidence.high": ("High confidence","ثقة عالية"), "confidence.medium": ("Medium confidence","ثقة متوسطة"), "confidence.low": ("Low confidence","ثقة منخفضة"), "confidence.unknown": ("Confidence unknown","الثقة غير معروفة"),
"scan.partial": ("Partly seen","مرصود جزئياً"), "scan.incomplete": ("Incomplete","غير مكتمل"), "scan.notDetected": ("Not detected by scan","لم يكتشفه المسح"),
"detail.noVideo": ("No video in this project.","لا يوجد فيديو في هذا المشروع."),
"detail.noBookmark": ("No bookmark linked. Link one in the Video tab or with Edit.","لا توجد علامة مرتبطة. اربط علامة من تبويب الفيديو أو من تعديل."),
"measure.roomUnit": ("Room units","وحدة الغرف"), "measure.walls": ("Walls (%d)","الجدران (%d)"),
"measure.provenanceNote": ("Openings in mm. Scan values are RoomPlan estimates; ✓ = site-verified, ⚙︎ = manufacturing size.","الفتحات بالمم. قيم المسح تقديرات RoomPlan؛ ✓ = مُتحقق في الموقع، ⚙︎ = مقاس التصنيع."),
# edit
"edit.identity": ("Name & notes","الاسم والملاحظات"), "edit.name": ("Name","الاسم"), "edit.notes": ("Notes","ملاحظات"),
"edit.method": ("Method","الطريقة"), "method.laser": ("Laser","ليزر"), "method.tape": ("Tape","متر"), "method.other": ("Other","أخرى"),
"edit.scanFooter": ("Read-only. Scan values are never overwritten.","للقراءة فقط. قيم المسح لا يتم استبدالها أبداً."),
"edit.verifiedFooter": ("Your independent tape/laser measurement. Stored separately from the scan.","قياسك المستقل بالمتر أو الليزر. يُحفظ منفصلاً عن المسح."),
"edit.mfgFooter": ("The size to manufacture or order. Never taken from the scan.","المقاس المطلوب للتصنيع أو الطلب. لا يؤخذ من المسح أبداً."),
"edit.bookmark": ("Video bookmark","علامة الفيديو"), "edit.noBookmark": ("None","بدون"),
"edit.invalidNumber": ("Enter whole millimeters, e.g. 905.","أدخل مليمترات صحيحة، مثلاً 905."), "edit.nameRequired": ("Name is required.","الاسم مطلوب."),
# model
"model.whole": ("Whole survey","المعاينة كاملة"), "model.choose": ("Model","النموذج"), "model.quickLook": ("AR Quick Look","عرض AR"),
"model.note": ("Model exported by RoomPlan (parametric). Dimensions in the table come from the same geometry.","النموذج مُصدَّر من RoomPlan. أبعاد الجدول من نفس الهندسة."),
"model.none": ("No 3D model saved.","لا يوجد نموذج ثلاثي الأبعاد محفوظ."), "model.failed": ("Saving the 3D model failed. Retry from Export.","فشل حفظ النموذج. أعد المحاولة من التصدير."),
# video
"video.replay": ("Replay","إعادة"), "video.preRoll": ("Start before bookmark","البدء قبل العلامة"),
"video.addBookmark": ("Add bookmark at current time","إضافة علامة عند الوقت الحالي"), "video.bookmarks": ("Bookmarks","العلامات"),
"video.noBookmarks": ("No bookmarks","لا توجد علامات"), "video.assign": ("Link","ربط"), "video.assignTo": ("Link to","اربط بـ"),
"video.unlink": ("Remove link","إزالة الربط"), "video.unassigned": ("Not linked","غير مرتبطة"),
"video.synthetic": ("Synthetic sample video","فيديو تجريبي مصطنع"), "video.dropped": ("%d frames dropped","%d إطار مفقود"),
"video.interruptions": ("%d interruption(s)","%d انقطاع"),
# export
"export.title": ("Export & share","تصدير ومشاركة"), "export.pdf": ("PDF floor plan","مخطط PDF"), "export.usdz": ("USDZ 3D model","نموذج USDZ"),
"export.mp4": ("MP4 walkthrough","فيديو MP4"), "export.csv": ("CSV measurements","قياسات CSV"), "export.json": ("JSON project report (v1)","تقرير JSON (إصدار 1)"),
"export.ready": ("Ready","جاهز"), "export.notGenerated": ("Generated when shared","يُنشأ عند المشاركة"), "export.unavailable": ("Not available","غير متاح"),
"export.retryNeeded": ("Retry needed","يحتاج إعادة"), "export.shareAll": ("Share all","مشاركة الكل"),
"export.privacy": ("Files stay on this iPhone until you share them.","الملفات تبقى على هذا الآيفون حتى تشاركها."),
# pdf
"pdf.created": ("Created","تاريخ الإنشاء"), "pdf.rooms": ("Rooms","الغرف"), "pdf.tableTitle": ("Measurements (mm)","القياسات (مم)"),
"pdf.disclaimer": ("Scan dimensions are estimates from Apple RoomPlan. Verify on site before manufacturing.","أبعاد المسح تقديرات من Apple RoomPlan. تحقق في الموقع قبل التصنيع."),
"pdf.legend.scan": ("Numbers = scan estimate (mm)","الأرقام = تقدير المسح (مم)"), "pdf.legend.verified": ("✓ = site-verified (mm)","✓ = مُتحقق في الموقع (مم)"),
"pdf.legend.partial": ("Dashed wall = partly seen","جدار متقطع = مرصود جزئياً"), "pdf.legend.ceiling": ("Wall height ≠ ceiling height","ارتفاع الجدار ≠ ارتفاع السقف"),
"pdf.col.item": ("Item","البند"), "pdf.col.room": ("Room","الغرفة"), "pdf.col.scanW": ("Scan W","عرض مسح"), "pdf.col.scanH": ("Scan H","ارتفاع مسح"),
"pdf.col.verW": ("Verified W","عرض مُتحقق"), "pdf.col.verH": ("Verified H","ارتفاع مُتحقق"), "pdf.col.mfgW": ("Mfg W","عرض تصنيع"), "pdf.col.mfgH": ("Mfg H","ارتفاع تصنيع"), "pdf.col.video": ("Video","فيديو"),
# settings
"settings.title": ("Settings","الإعدادات"), "settings.language": ("Language","اللغة"), "settings.language.system": ("Same as iPhone","مثل الآيفون"),
"settings.frameSource": ("Video frame source","مصدر إطارات الفيديو"), "settings.frameSource.delegate": ("AR session delegate (default)","مندوب جلسة AR (افتراضي)"),
"settings.frameSource.polling": ("Poll current frame (fallback)","قراءة الإطار الحالي (بديل)"),
"settings.frameSource.footer": ("Use the fallback only if scanning or video misbehaves on your iPhone.","استخدم البديل فقط لو المسح أو الفيديو فيه مشكلة على جهازك."),
"settings.privacy": ("Privacy","الخصوصية"),
"settings.privacyText": ("Everything is processed and stored on this iPhone. No account, server or cloud is used, and project files are excluded from iCloud backup. Files leave the phone only when you share them.","كل شيء يُعالج ويُحفظ على هذا الآيفون. لا حساب ولا سيرفر ولا سحابة، وملفات المشاريع مستثناة من نسخ iCloud. الملفات لا تخرج من الجهاز إلا لما تشاركها."),
"settings.version": ("Version","الإصدار"), "settings.device": ("Device","الجهاز"),
}
import sys, os
def esc(s): return s.replace('\\','\\\\').replace('"','\\"')
for i,lang in enumerate(["en","ar"]):
    d=f"App/Resources/{lang}.lproj"; os.makedirs(d,exist_ok=True)
    with open(f"{d}/Localizable.strings","w") as f:
        f.write(f"/* Room Scan Inspector – {lang} */\n")
        for k in sorted(S): f.write(f'"{k}" = "{esc(S[k][i])}";\n')
    with open(f"{d}/InfoPlist.strings","w") as f:
        cam = ["The camera and LiDAR scanner are used to measure rooms and record the walkthrough video. Everything stays on this iPhone.",
               "تُستخدم الكاميرا وحساس LiDAR لقياس الغرف وتسجيل فيديو الجولة. كل شيء يبقى على هذا الآيفون."][i]
        f.write(f'"NSCameraUsageDescription" = "{esc(cam)}";\n"CFBundleDisplayName" = "{["Room Scan","مسح الغرف"][i]}";\n')
# check format specifier parity
import re
for k,(e,a) in S.items():
    fe=sorted(re.findall(r'%(?:\d\$)?[d@]',e)); fa=sorted(re.findall(r'%(?:\d\$)?[d@]',a))
    if fe!=fa: print("MISMATCH",k,fe,fa)
print(len(S))
