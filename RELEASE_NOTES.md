# Alpha 1.11.0 CNC router G-code and beam saw exports — 2026-11-01

All in the new **CNC & saw** tab (same cards, collapsible groups and fields as the Properties inspector; machine / tool & feeds / holding & grooves / start-end code on the left, G-code preview and saw outputs on the right; one column on tablets). **Unverified on any machine — nothing here is "CNC ready".**

- **CNC router G-code** (`cnc.mjs`): one file per sheet from a router layout that keeps tool Ø + gap between parts. Outside profile of each part with the tool radius added (no G41/G42), equal depth passes down to board thickness + overcut into the spoilboard, smallest parts first, optional 2 or 4 holding tabs, back grooves (backConstruction "groove") machined first with the grooved face up. Linear G0/G1 only, absolute mm. Machine settings: controller (Generic ISO / Mach3-4 / GRBL), tool Ø, feed, plunge, spindle, step down, overcut, Z zero (board top or table), safe Z, tabs, direction (climb/conventional), sheet turned 90°, editable start/end code (ASCII only). Kept in this browser only.
- **Built-in check**: the generated code is read back and refused for download if any move leaves the sheet, a rapid move goes below the board top, or a cut goes deeper than board + overcut. Shows cut length and an estimated time (no acceleration).
- **Toolpath preview** (SVG): parts, profiles with cutting order and start points, tabs, grooves, origin (front-left X0 Y0).
- **Not included**: drilling (no verified hardware pattern yet), ramps/lead-ins, arcs, tool changes, nesting optimization. Needs the shop's own controller details and a sample file to confirm the dialect.
- **Beam / panel saw** (`beamsaw.mjs`): optimizer parts list CSV (comma, or semicolon with decimal comma for Arabic/European Excel; UTF-8 BOM) — one row per identical part, Length along the grain, cut sizes, edge band per side, finished sizes, part IDs, grooved flag. Plus a straight-through (guillotine) cutting plan from the sheet layout: trim, rip strips, cross-cut pieces, trim narrower pieces, offcuts — printable (PDF, EN/AR) and as CSV, with a check that it rebuilds exactly the planned pieces. The layout is not optimized.

Local validation: 234 Node checks (part spacing ≥ tool Ø + gap, every sheet's code passes the checker in two machine set-ups, D/2 offset and 4 × 4.575 mm passes on an 18 mm side, tab height, groove centre 3 mm from the rear edge, unsafe code is caught; optimizer list = every sheet part once with grain-swapped edges; saw sequence rebuilds every sheet). 28 Chromium workflows, including a new one on the kitchen sample: preview, G-code, settings kept after reload, semicolon CSV, cut sequence CSV, saw plan PDF.

---

# Alpha 1.10.0 approve & issue numbered revisions — 2026-10-31

- **Approve & issue** (Engineering review tab): freezes the current design as revision R<n> inside the project file, with an optional note (e.g. "Approved by client"). The design part (units, room, materials, costing, drawing layout, views, furniture, names) is copied with a content fingerprint; opening a file whose issued copy was edited by hand is refused with "R<n> was changed after it was issued".
- **Draft vs issued.** A badge next to the version shows "Draft R1 · not issued", "Issued R1", or "Draft R2 · changed since R1". The first change after an issue moves the design revision to the next number automatically; the same design cannot be issued twice and an issued number cannot be reused. Undo/redo never removes an issue.
- **Each issued revision** can be re-printed as a cut-list PDF, downloaded as its manufacturing CSV and as its own project file, or restored as the working draft (with confirmation; undo available). These always use the frozen copy, not the current draft.
- Stored in the project file and this browser's autosave only — not in the cloud. At most 30 issued revisions per file; each issue copies the design, so files with many photos grow (5 MB file limit).

Local validation: 227 Node checks (issue/reopen, R1 keeps its cut sizes after R2 edits, refusals, tampering, ordering, unknown data, stable fingerprint), 27 Chromium workflows including the full issue → edit → undo/redo → download R1 → reload flow.

---

# Alpha 1.9.0 printable cut list (PDF) — 2026-10-31

- **Print cut list · PDF** (next to Manufacturing CSV): one A4-landscape document from the same part records as the manufacturing CSV and labels. Identical parts of a unit are grouped with a quantity and every part ID is listed. Columns: unit, part, qty, thickness, finished L × W, cut L × W, edges L1 W1 L2 W2 with band thickness, grain, notes (groove, may rotate, not from sheet stock), part IDs. Grouped by material and thickness, with total cut area and edge-band length per material. Header: project, client, revision, manufacturing-rules version, date, company name/logo if set; marked preliminary, not a CNC program. English and Arabic (RTL). Save as PDF from the print dialog.
- The sheet explains the deduction it uses: cut = finished − edge thickness on each banded edge when edge deduction is on; no trimming or saw-kerf allowance is added.
- Fixed: the startup diagnostics test compared against a hard-coded version (it failed after the 1.8.2 version bump); it now reads package.json.

Local validation: 223 Node checks (hand-checked 900 × 2200 × 580 wardrobe: sides 2200 × 579 ×2, shelves 421 × 553 ×6, 6.18 m² MDF, 10.82 m edge band; every part listed once and equal to the CSV for three units with different thicknesses and deduction on/off), 26 Chromium workflows; a 6-unit kitchen + wardrobe design (94 parts, 53 lines) printed to PDF in English and Arabic.

---

# Alpha 1.8.2 edit the room and add furniture in 3D — 2026-10-31

- **Edit room** button in the 3D toolbar. While it is on: drag a wall (or the floor edge in the workshop view) to make the room wider/deeper, in 10 mm steps, with the size shown live; units and furniture keep their place against the opposite wall and doors/windows stay where they are on the wall. Drag a door or window to slide it along its wall (kept inside the wall). A room under 500 mm, or one that would cut through a door/window, is refused with a message. One undo step per drag.
- **Room furniture** (sidebar, under Doors & windows): 16 generic display models — fridge, freestanding cooker, dishwasher, washing machine, 3-seat sofa, armchair, coffee table, TV on stand, double and single bed, dining table, chair, desk, plant, rug, floor lamp. Add places it on a free floor spot; drag it (snaps to walls, units and other items; Alt = free), R rotates 90°, arrows nudge 10/100 mm, Delete removes, Esc deselects. Sizes are common starting values, not a product's datasheet.
- Furniture is saved in the project file as optional `items` (not written when empty) and never enters the cutting list, costing, drawings or manufacturing files (tested).

Local validation: 220 Node checks, 26 Chromium workflows; wall, window and furniture dragging checked in Chromium with the mouse. Not tried on a touch screen.

---

# Alpha 1.8.1 move units with the mouse and keyboard — 2026-10-31

- **Drag to move.** Select a unit, then drag it in the 3D view (3D design and Presentation tabs). It slides on the floor in 10 mm steps and snaps flush to a room wall or to a neighbouring unit's side (backs lined up) within 60 mm; a wall unit over a base unit lines up with its sides. Hold Alt to move freely. Dragging anything else still orbits the camera. One undo step per drag.
- **Keyboard.** Arrow keys move the selected unit 10 mm (Shift: 100 mm); R rotates 90°; Delete or Backspace removes it (the last unit cannot be removed); Ctrl+Z undoes. Keys are ignored while typing in a field and in the workers' view.
- **Accessory models.** Baskets, cargo, bottle pull-out, corner carousel, waste bins, dish rack, trouser and shoe racks, tie rack, mirror, pull-down rail, drawer trays, sink with tap and hob with burners are drawn as simple 3D models (generic shapes, not a supplier's product) instead of translucent boxes; still red when they do not fit.
- **Open fronts** button in the 3D toolbar opens or closes all doors and drawers to show the interior.
- **Mouse wheel zooms toward the cursor** (point at a unit and scroll to zoom into it).

Local validation: 213 Node checks, 26 Chromium workflows. Mouse dragging not tried on a touch screen.

---

# Alpha 1.8.0 camera views, high-resolution images and realistic room — 2026-10-31

- **Realistic room scene** (Presentation → Lighting: Scene "Realistic room"): solid 120 mm walls built from the room plan and cut around its doors and windows, skirting, window glass, frame and sill, a closed door leaf and frame, ceiling, and a floor of oak or walnut parquet, 60 × 60 porcelain tiles or polished concrete; wall colour is selectable. Walls between the camera and the room are hidden (dollhouse view); from inside the room all walls and the ceiling show. Exports use the same scene. Display only: kept in this browser, never in the project file or any output.

- **Camera views** in the Presentation tab: Front, Side, Top, Isometric and Eye level (1.6 m), framed to fit all units at the export's 16:9 shape. "Save current view" keeps named views (max 12) in the project file (optional `views`, not written when empty).
- **High-resolution image**: screen size, Full HD 1920×1080, 2K 2560×1440 or 4K 3840×2160; PNG, JPEG or WebP; transparent background for PNG/WebP (hides floor, grid and walls); contact shadows (GTAO) on opaque images. Selection outlines and size labels are never in the image. The frame is drawn off-screen at full size and the live view is restored before the browser paints. The GPU size limit is checked and reported.
- The Presentation panel is docked on the side so the 3D stays visible.
- Same real-time engine (three.js 0.166 WebGL). This is not path tracing. Views and images never change cut sizes or the manufacturing CSV (tested).

Local validation: 209 Node checks, 25 Chromium workflows. 4K export checked in software rendering (≈ 2–22 s there); not timed on a real GPU, phone or Safari.

---

# Alpha 1.7.0 shop-drawing layout, assembly steps and workers' view — 2026-10-31

- **Shop-drawing layout options** (Shop drawings → "Sheet layout", saved in the project): paper A3 or A4 landscape; which views appear (front, interior, section, plan); arrangement (automatic, in a row, two by two, one under another); scale (largest that fits, or a fixed 1:5 … 1:100, with a printed warning and a larger scale when the fixed one does not fit); full or overall-only dimensions; parts table and notes on or off; table column right or left. The default layout draws exactly the 1.5 sheet (checked by test).
- **Clarification images.** Up to 4 photos or sketches per unit with captions (reduced to ≤ 300 KB, stored in the project). They print on a numbered details sheet (SD-<unit>-D) right after the unit's drawing; sheet n / N counts it.
- **More on the drawings.** Cover panels, top filler and worktop are drawn with overall dimensions; handle type (bar, knob, profile, none), LED strips and accessory outlines on the interior view; glass and handle notes when not default.
- **Assembly mode.** A new "Assembly" tab builds the unit in 3D step by step: check parts → carcass → back → top (grooved backs) → plinth → covers → drawers → shelves → rails/LEDs/fittings → doors → handles → worktop → wall fixing. Each step lists its part IDs (same as cutting list and labels), a method text and the counted hardware (hinges by door height, slide pairs, 4 pins per adjustable shelf, 2 brackets per wall unit). Every part appears in exactly one step (tested).
- **Find a part by barcode.** Type a part ID, use a USB/Bluetooth barcode scanner (it types + Enter), or the phone camera (BarcodeDetector, or the bundled jsQR). The result shows the unit, the part's position (bay, left/right, height from floor), its assembly step and sizes, and highlights it in 3D. A label from another project is refused; a label whose sizes differ from the current design is flagged "reprint".
- **Assembly booklet.** Print an A4 booklet with a 3D picture, parts and hardware per step.
- **Workers' view.** One button (or open the site with `?worker`) hides editing, prices and other tabs and keeps Open, language, the 3D model and assembly. It is a view mode, not a security lock: anyone can leave it.

Local validation: 205 Node checks, 24 Chromium workflows, production build. Not validated on a real phone camera, Safari/iPhone, a physical printer or in a workshop. Assembly method texts and hardware counts are RokaDex starting instructions, not a manufacturer's assembly manual.

---

# Alpha 1.6.0 unit details, lighting, kitchens, materials and room sheet — 2026-10-31

- **Unit details.** Left/right cover panels (thickness and forward projection), top filler (height and setback), bottom plinth, and a worktop (thickness, overhang, material). Covers and the top filler are cut parts with their own IDs; the worktop is a supplier item, not packed on sheets. All default to 0, so older projects keep their geometry and part IDs.
- **Lighting per shelf.** Tick "under top" or "under shelf N" per bay, or select a shelf in 3D / the parts list and press the light button. LED colour (K) and strength per unit. Strips show in 3D and are counted in the accessories list (strip metres, profile metres, driver and sensor per lit unit). Render panel: quality (normal / high / very high), sun direction, height and strength, room light, exposure and "LEDs on"; kept in this browser only.
- **Glass doors and handles.** Glass type (clear, frosted, tinted, reflective, fluted) and colour; handle type (bar, knob, edge profile, none / push to open), length and finish.
- **Interior spaces and accessories.** A table of clear inside sizes per space with guidance on what usually fits. 16 accessories (wardrobe and kitchen: trouser rack, shoe rack, baskets, cutlery tray, bottle pull-out, bins, cargo, corner carousel, sink and hob cut-outs, etc.) placed per bay; each is checked against width, depth, height, worktop and drawer requirements and overlaps, with a warning when it does not fit.
- **Accessories list with quantities.** Hinges by door height (2 / 3 / 4 / 5), glass hinges, drawer slide pairs by length, handles/knobs/profile metres, shelf pins, rails and supports, LEDs, fittings, wall brackets and worktops, with the rule shown per line. CSV and print. Assembly fasteners are listed as "not calculated".
- **Kitchen section.** 11 kitchen units (base, drawer base, sink, hob, bottle, corner carousel base, wall units, tall larder, tall cargo, oven housing). "Place next to the selected unit" continues the run, and stacks wall units above base units.
- **Material library** (saved in the project): name, category, specification, thickness, sheet size, grain, colour and a photo (reduced to 1024 px) that is applied to the 3D model. Apply a material to the carcass, fronts, worktop or glass of a unit.
- **Room.** Doors and windows on each wall (with checks when a unit blocks a door swing or covers a window), mounting height for wall units, floor area / footprint / free floor and wall usage, and a printable A4 room sheet with a 3D view, top view, plan and areas. The client PDF gets a room page.
- **Interface.** Properties are grouped into collapsible sections; a context card above them shows the selected part and actions. "Inside sizes" shows clear sizes in 3D. The NCD name is removed from the interface.

Local validation: 196 Node checks, Chromium workflows (see HANDOFF), production build. Not validated on Safari/iPhone, a real GPU, a printer, a machine or a workshop. Accessory sizes and hardware rules are RokaDex starting values, not supplier data.

---

# Alpha 1.5.0 Rokadex look, shop drawings and client showroom — 2026-10-30

- **Rokadex design system.** The Studio uses the main Rokadex app's colours, IBM Plex Sans Arabic (bundled locally, no CDN), the gold hex-nut mark and "Powered by Rokadex · © Mostafa Mabrouk". Navy navigation rail, teal actions.
- **References feed the app instead of a raw data view.** The "Reference library" tab is removed. From `analysis/*.json` the app now builds 7 NCD wardrobe templates (long hanging, shelves, drawers + hanging, drawers + shelves, hanging + shelves, open shelves, glass display), 30 finish colours, and 7 room templates. "Double hanging" is listed as not available (one rail per bay). Prices in the references are not used.
- **Settings.** Company name (English/Arabic), logo (PNG/JPEG/WebP/SVG ≤ 400 KB), phone, email, website, tagline and address — empty by default, stored only in this browser. Project name and client name are saved in the project file (optional v3 fields).
- **A3 shop drawings** at a true standard scale (1:5 … 1:100, chosen to fit): front elevation (doors closed, hinge swing marks, handles), interior with doors removed (shelf levels, rails, bay widths, interior height), section through bay 1, plan, dimension chains, grouped parts schedule, notes, finish swatch and a title block with company logo/name/contact, project, client, unit, drawing number, scale, sheet n/N, revision and date. Arabic or English. Print the whole set as A3 PDF or download it as HTML.
- **3D look.** Image-based lighting, soft shadows, procedural wood grain for wood finishes, satin melamine, bar handles on doors and drawer fronts, doors on hinge pivots and drawers that slide. Handles, LEDs and grain are display only.
- **Client showroom** (based on the supplied reel): dollhouse room with walls cut at 1.2 m, a card per unit with "Open" and "LED" switches, Overview / Front / Top / Auto-rotate camera, Day/Night, company branding and a **client PDF** (A4 landscape: cover with room render, one page per unit with closed and open renders, size, finish and counted features; no prices).

Local validation: 182 Node checks, Chromium workflows (see HANDOFF), production build. Not validated on Safari/iPhone, the hosted site, a printer, a machine or a workshop.

---

# Alpha 1.4.0 engineering model — 2026-10-30

Cabinet rules **cab-2.0**, one part model for every output, project format v3. Existing projects keep their geometry: a recorded snapshot of the 1.3.2 engine (73 configurations) is compared byte-for-byte in the test suite.

- Separate boxes or shared partitions (2400 mm / 3 bays / 18 mm → 764 or 776 mm inside), plinth with kickboard, grooved back with recorded groove operations, fixed or adjustable shelves with their own clearances, explicit shelf levels, hanging rails, drawers at the bottom with a fixed shelf and shelves/rail above, internal drawers behind doors, slide length chosen from configured lengths with an explicit error when none fits, separate door/drawer-box/drawer-bottom/back materials and thicknesses, real glass doors (supplier items, excluded from sheets).
- Every part has a stable semantic `uid`, finish size and cut size (edge-band deduction on/off), named edges L1/W1/L2/W2, rotation permission, sheet/non-sheet flag, operations, rule source and verification status.
- Manufacturing CSV and printable part labels with QR codes carrying project ID, design revision, part uid and full-precision sizes with a checksum. Labels are decoded in tests by an independent QR decoder.
- Sheet packing uses cut sizes, excludes non-sheet items, never rotates grain-locked parts; an independent verifier checks no lost/duplicated parts, no overlaps (kerf included) and bounds.
- Drawings show shelf levels, rails, inner bay widths, project ID, revision and rules version.
- Project files are saved as v3 (`projectId`, `designRevision`, `lengthUnit`, `migratedFrom`); v1/v2 open unchanged.
- `npm test` now runs on Node 22 and 24.

Local validation: 163 Node checks, 18 Chromium workflows, production build. Not validated on Safari/iPhone, the hosted site, a machine or a workshop.

---

# Alpha 1.3.2 startup recovery — 2026-10-29

A supplied iPhone screenshot shows the older dark interface and a generic startup error. That error came from the catch-all dynamic import handler: it also appeared for missing modules or unrelated initialization exceptions. The screenshot alone does not establish a WebGL failure. Hosted inspection remains blocked by the environment proxy; the exact phone-side cause has not been reproduced.

- WebGL initialization failure now activates model-derived 2D elevations and preserves editing, undo, autosave, JSON/CSV/SVG exports, planning, estimates and references. 3D-only controls are disabled visibly.
- Graphics-context loss during presentation returns to the editor in 2D. The project is preserved. 3D recovery requires a reload; no automatic context-restoration promise is made.
- Startup module/application exceptions show the actual error safely as text, the build version, reload and manual diagnostics download. Diagnostics contain version, error/name and browser user-agent, with no project or browser-storage contents and no external submission.
- Smaller pixel-ratio/shadow buffers on compact viewports; a second context attempt without antialiasing before 2D fallback. Alpha 1.3.2 is visible in the header on mobile and desktop.

Regression tests failed on the previous build for blocked WebGL and module-load failure. Local validation: 138 Node checks and 15 Chromium workflows, including simulated context loss. This does not establish physical iPhone/WebKit acceptance or verify the Cloudflare deployment. Upload the new complete production ZIP to the existing staging project's new deployment; verify the visible version after reload.

---

# Alpha 1.3.1 interface update — 2026-10-29

- Light, neutral workspace panels with green actions, clearer section hierarchy, larger input targets and a dark 3D viewport.
- Grouped project actions, clearer workspace navigation, revised material/part tables and reference/estimate surfaces.
- Focus workspace hides the library and inspector to expand the canvas; the same button or Escape restores them. This is view-only state and does not alter the project or undo history.
- Arabic/English labels, RTL layout, keyboard skip link and focus indicators. Phone links jump to Properties and Design library; tablet scene actions wrap inside the viewport.
- Browser validation covers 1440, 1024, 768 and 390 px widths, focus/restore, unchanged design data, phone editing, library actions and reference navigation. Desktop and mobile screenshots retained under `/workspace/artifacts/ui-refresh/`.

Local validation: 138 Node checks and 12 Chromium workflows. No Cloudflare deployment or hosted verification is included in this interface update.

---

# Alpha 1.3 development milestone — 2026-10-29

This release develops engineering accuracy, room planning, estimating and workspace usability together. It remains a standalone prototype; it does not complete the full master brief or establish parity with commercial CAD/CAM software.

## Changed and added

- Semantic panel keys and topology-aware edge remapping preserve edits on the intended bay/slot while retaining compatible display IDs and JSON override keys.
- Explicit stock grain on X/Y, permitted rotation metadata and separate stock-axis batches. Old projects missing the setting retain legacy behavior; new units use Y.
- Explicit legacy/inset/overlay back construction, including coordinated carcass, back, shelf, partition and drawer planes. Five added engine cases verify the construction contract; it is not workshop approval.
- Flat DXF uses measured row heights, nonoverlapping outlines and explicit millimetres.
- Quarter-turn cabinet rotation and full modeled envelopes, including front protrusions. Room review warns about floor, ceiling, wall and overlap conflicts.
- Straight/L/U rectangular cabinet runs, selectable room plans, wall/neighbor alignment and grid snapping. Corners retain open clearance; no corner cabinet, countertop or appliance geometry is invented.
- Nominal-area cost estimates with editable material rates, edging, waste, labor, hardware allowance, overhead and profit margin. Missing prices stay incomplete. Currency precision follows minor units, including USD/OMR/JPY; unsafe totals remain unavailable without preventing design editing.
- Named local revisions: at most ten snapshots and 4 MiB, with validated restore/delete and storage-error handling. JSON export remains the portable backup.
- Dedicated plan, cost and review tabs, readable controls, numeric alignment and responsive/Arabic improvements. Orbit drags are distinguished from click selection.
- Primary-source research in `GLOBAL_REFERENCES.md` and independent review in `REVIEW-ALPHA-1.3.md`.

## Verified results

The final local build/test gate passed **138 individual Node checks and ten Chromium workflows**, with no skipped cases reported. These include the existing startup/export/compatibility/Arabic paths and the added kitchen/rotation, topology, costing/currency/error recovery and named-revision workflows. The production build bundles runtime dependencies locally.

A final **frozen-build endurance run passed 57 cycles in 182.744 seconds with zero browser errors**. Retained result: `/workspace/artifacts/validation/alpha-1.3-endurance/result.json`; it records the tested asset names and samples. A previous run was observed at **460 cycles / 1439.436 seconds / zero errors** before interruption. Its volatile raw file was lost during a later test-results reset. That interrupted observation is not a completed run, and **no one-hour endurance completion is claimed**.

The user supplied `https://rokadex-staging.pages.dev/`. Inspection from this environment received proxy CONNECT 403; a saved allowlist draft does not establish active network access. Hosted assets and user flows have therefore not been verified here. Local Chromium success is separate from cross-browser/GPU/accessibility acceptance and physical manufacturing validation.

## References, uploads and remaining work

FreeCAD and SketchUp observations cite inspected first-party sources. Commercial documentation unavailable through the network proxy is marked unverified. Newly uploaded HTML references are analyzed separately under `analysis/`; their features are not represented as integrated. The PolyBoard RAR exceeds the available 32 MiB transfer limit and was not inspected.

See `KNOWN_LIMITATIONS.md`, `FEATURE_AUDIT.md` and `DEVELOPMENT_ROADMAP.md` for supported scope. Remaining work includes arbitrary rooms/openings, direct modeling/grouping/constraints, saved hardware-library provenance, richer cabinet families, supplier/stock-purchase costing, large-project profiling and validated manufacturing/CAM. Production CNC export remains unavailable.

---

# Alpha 1.2 development milestone — 2026-10-28

This milestone develops the supplied Alpha 1.1 source in the previously README-only repository. It is a standalone prototype, not a completed professional CAD/CAM system. The full development brief remains a roadmap; this release covers reliable local launch/build, project preservation and selected correctness defects.

## Changed and added

- Reproducible npm lockfile and Node.js 24 pin; Three.js 0.166.1 stays at the source version and is bundled locally. No runtime CDN is required.
- Root `index.html`, Vite development/production commands, separate vendor asset, Cloudflare Pages `dist` configuration, response headers, MIT notice and automated CI checks.
- Visible startup failure message if module loading or WebGL initialization fails.
- Strict, atomic project-file parsing with v1/v2 compatibility, size/workload bounds and safe unique IDs.
- Latest local autosave and reload recovery; new project, cabinet duplication and session undo/redo (30 states).
- Arabic/English core UI labels and saved language selection, preserving live inputs and user-entered names/materials. Some dynamic engineering diagnostics remain English.
- Reject nonpositive drawer fronts/bottoms and rounded-zero panels; handle missing legacy drawer defaults and camel-case drawer edge overrides.
- Correct CSV quoting/formula protection for cutting lists, drilling references and hardware references.
- Dispose replaced scene geometry/materials and use generated panel coordinates in 3D.
- Model-derived front/side SVG elevations reflect per-bay shelves, drawers, doors and construction methods.
- Sample three-cabinet kitchen concept and architecture/audit/roadmap/limitations documents.

## Verification

- Frozen installation: `npm ci --no-audit --no-fund` succeeded.
- `npm test`: **76 individual checks passed**, none skipped. Includes production-output structure, dimensions, drawers, edge flags, drawings, project/history/storage, exports and packing regressions.
- `npm run build`: produced a root entry and local hashed assets in `dist`, without the former CDN import or a large-chunk warning.
- Four Chromium tests run against the production build: network-blocked startup, edit/history/backup/import/export workflow, malicious-file rejection and legacy import, Arabic language/direction/input persistence. Full workflow includes drawer/shelf history and reload, CSV/SVG/PNG downloads, model-derived drawing content and presentation.
- Development server entry and transformed JavaScript returned HTTP 200 with JavaScript MIME and npm resolution.
- npm audit reported **0 known vulnerabilities** for runtime and complete installed trees at validation time.

The CDN-blocked startup test failed on the imported source before the fix. Project-preservation/browser cases failed before the controls were integrated. Targeted engineering and export regressions failed before their fixes. Initial browser execution without a bundled Playwright browser required configuring the already-installed system Chromium; the committed configuration now detects it automatically.

These are local Linux/headless Chromium results, not a full cross-browser/GPU/mobile acceptance run. Cloudflare-hosted deployment has not been performed or verified. Software tests do not establish physical manufacturing approval.

## Remaining work

See `KNOWN_LIMITATIONS.md` and `DEVELOPMENT_ROADMAP.md`. Important open items include stable part identity across topology changes, stock/grain-axis interpretation, back-inset construction coordinates, saved hardware libraries/provenance, costing, richer room/editor features, large-project profiling and professional drawing/CAM validation. No production CNC export is enabled.

## Cloud environment

Reusable installation and startup instructions were saved as an environment configuration draft. Saving the draft does not publish a snapshot or deploy the website. Review and save it in environment settings, then publish the environment if you want a reusable published environment version.

## Alpha1.3 supplied-reference analysis supplement

Added a searchable, escaped, paginated reference-data library from three uploaded HTML sources, the supplied PolyBoard library manual and the supplied printed sample. Facts retain units and provenance; the independent proposed library schema remains a proposal. Seven room presets convertcm tomm and remain undoable. Original uploaded executable code, proprietary assets, contact data and PDFs are not redistributed in the application. Reference prices and machining fields are not automatically applied to the design. Both PolyBoardRAR transfers exceeded32MiB and remain uninspected. See `analysis/SUMMARY_AR.md` for the full evidence and limitations.

Final supplement validation: **138 individual Node checks** and **10 Chromium workflows** passed; the reference workflow was rechecked after final report bundling. The completed182.744second frozen-build endurance run covered the corepre-reference Alpha1.3 editing/tools, not all source-data browsing or large-project performance. An earlierlonger test stoppedat460cycles/~24minutes; it was not a completedonehourrun. No hostedCloudflarevalidation or physicalmachiningapproval is claimed.
