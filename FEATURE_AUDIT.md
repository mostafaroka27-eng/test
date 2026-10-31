# Feature audit — Alpha 1.3 (updated for 1.7.0)

## Alpha 1.8.0 additions — 2026-10-31

| Feature | Status | Evidence |
|---|---|---|
| Camera presets + saved views | Implemented | render-export.test.mjs, e2e/render.spec.mjs |
| High-resolution image export (FHD/2K/4K, PNG/JPEG/WebP, transparent, AO) | Implemented | e2e/render.spec.mjs; 4K checked by owner on a real GPU |
| Realistic room scene (walls with openings, floors, ceiling, cut-away) | Implemented, display only | render-export.test.mjs, e2e/render.spec.mjs |
| Path tracing | Not started (next branch) | — |

## Alpha 1.7.0 additions — 2026-10-31

| Capability | Status | Evidence |
| --- | --- | --- |
| Drawing layout: paper A3/A4, views, arrangement, scale, dims, tables, column side | Implemented and tested | `shop-drawing.test.mjs` (A4 size, view subsets, fallback scale, default = 1.5 sheet byte-for-byte); project round-trip; e2e reload |
| Clarification images on a details sheet | Implemented and tested | Validation (type, count, caption), sheet numbering, e2e upload + reload |
| Covers, filler, worktop, handles, LEDs, fittings on drawings | Implemented, visually checked | Screenshots EN/AR; legacy sheet unchanged |
| Assembly steps in 3D | Implemented and tested | Every part in exactly one step for 8 unit types; Chromium step-through |
| Part lookup by ID / uid / label QR payload | Implemented and tested | Case/space-insensitive; wrong project refused; changed sizes flagged |
| Camera barcode scanning | Implemented, not tested on a device | Headless browser has no camera; fallback message checked |
| Assembly booklet (A4 print) | Implemented, checked in Chromium | Popup with one 3D capture per step; physical print not checked |
| Workers' view (`?worker`) | Implemented and tested | Hides editing/other tabs; Arabic; phone width 390 px without overflow |
| Hardware/fasteners per joinery method | Not implemented | Listed as "per your joinery method (not calculated)" |


## Alpha 1.6.0 additions — 2026-10-31

| Capability | Status | Evidence |
| --- | --- | --- |
| Cover panels, top filler, plinth, worktop | Implemented and tested | Part sizes and positions in `details.test.mjs`; legacy projects unchanged (fixture comparison still passes); browser workflow |
| LED per shelf / under top, colour and strength | Implemented and tested | Strip length = inner bay width − 20; missing shelf warns; 3D strips checked in Chromium screenshot |
| Lighting & render quality controls | Implemented, checked in Chromium (software GL) | Values clamped in tests; not checked on a real GPU or phone |
| Glass type/colour, handle type/length/finish | Implemented and tested | Model fields validated; hardware list counts knobs/profiles; 3D visual only |
| Interior spaces table and accessories with fit check | Implemented and tested | Clear sizes, width/depth/height/worktop/drawer/overlap checks |
| Accessories list with quantities (CSV/print) | Implemented and tested | Hinges by door height, slide pairs, pins, rails, LEDs, brackets, worktops; fasteners "not calculated" |
| Kitchen units (11) and run placement | Implemented and tested | Each template builds; wall units stack above base units in browser workflow |
| Material library with photo | Implemented and tested | Validation limits, project round-trip, apply to carcass/fronts/worktop/glass, reload |
| Doors & windows, room areas, room sheet | Implemented and tested | Door-swing and window conflicts; floor/footprint/free; A4 sheet and client PDF room page |
| Shop drawings for covers/fillers/worktop/accessories | Implemented in 1.7.0 | See above |
| Corner units, continuous worktops, sink/hob cut-outs | Not implemented | See KNOWN_LIMITATIONS |
| NCD name in the interface | Removed | Internal data file name unchanged |

## Alpha 1.5.0 additions — 2026-10-30

| Capability | Status | Evidence |
| --- | --- | --- |
| Rokadex theme, local font, logo | Implemented, visually checked | Screenshots EN/AR/phone; font served locally (e2e asset test) |
| NCD templates from references (7 of 8) | Implemented and tested | Each template builds a valid cabinet; values traced to `defaults`/`CAT`/`DEF_STD` |
| Double hanging template | Not implemented | Engine supports one rail per bay; shown as "not available" |
| Reference finishes (30) and room templates (7) | Implemented and tested | De-duplicated colours; project round-trip with a reference finish |
| Company / project settings | Implemented and tested | Validation, size limit, storage round-trip, browser workflow |
| A3 shop drawings with scale and title block | Implemented and tested | Layout fits A3 for 5 sizes; front/interior/section/plan from the model; schedule count = parts |
| Printed scale accuracy | Not verified | Depends on printing at 100 % on A3; no physical print checked |
| 3D look (IBL, shadows, grain, handles, open fronts, LED) | Implemented, visually checked | Screenshots; display-only |
| Client showroom + client PDF | Implemented and tested in Chromium | Cards, switches, night mode, proposal pages and images |
| Reference prices in costing | Not used (by design) | Prices are company/currency specific |


## Alpha 1.4.0 matrix — 2026-10-30

| Capability | Status | Evidence |
| --- | --- | --- |
| Legacy geometry preservation | Implemented and tested | 73-configuration byte comparison with the 1.3.2 engine |
| Separate boxes / shared partitions | Implemented and tested | 764 / 776 mm reference case; browser workflow |
| Plinth, grooved back, back thickness | Implemented and tested | Hand-computed depths and back sizes; plinth refused with over-construction |
| Fixed/adjustable shelves, levels, rails | Implemented and tested | Clearances, overlap/ceiling rejection, rail clearance |
| Drawers bottom + shelves above, internal drawers | Implemented and tested | No-overlap positions, door conflict error, internal setback |
| Drawer slide selection | Implemented and tested; values unverified | Largest fitting length, explicit error, fixed-length rejection |
| Glass doors as glass parts | Implemented and tested | Material/thickness, excluded from sheets, supplier warning |
| Finish vs cut size, named edges | Implemented and tested | Deduction on/off cases; packing uses cut size |
| Stable part uid | Implemented and tested | Survives topology edits elsewhere; display IDs may renumber |
| Manufacturing CSV, QR labels | Implemented and tested in software | Model/CSV/label/drawing agreement; jsQR round trip; truncation rejected |
| Packing verifier | Implemented and tested | No lost parts, overlap, bounds, grain rotation |
| Project v3 + migration | Implemented and tested | v1/v2 migrate unchanged; v3 roundtrip; browser save/reload |
| Arabic for new controls | Implemented, partially tested | Browser check of key labels; dynamic messages remain English |
| NCD project import | Not implemented | Source package not supplied |
| Generic furniture blocks in plan | Partial | Conversion function only |
| Safari/iPhone, hosted staging | Not verified | No access from this environment |
| CNC / machine output | Blocked | No machine, controller, tooling or postprocessor data |


Audit date: 2026-10-29. Evidence combines source review, targeted regressions and local Chromium workflows. The supplied staging URL is `https://rokadex-staging.pages.dev/`; this environment received proxy CONNECT 403, so hosted behavior remains unverified here.

| Capability | Status | Evidence and scope |
| --- | --- | --- |
| Rectangular cabinet model | Implemented and tested within supported scope | Dimensions, shelves, doors, drawers, edge quantities and construction cases; no exhaustive workshop validation |
| Back construction | Implemented and tested software conventions | Legacy/inset/overlay; five added engine cases cover planes, depths, drawer coordinates and compatibility |
| Semantic panel identity | Implemented and tested | Stable bay/slot keys preserve edge edits and selection across topology changes; display/export IDs can renumber |
| Stock/grain interpretation | Implemented and tested | Explicit X/Y axes, constrained rotation, kerf/trim/bounds and incompatible-batch separation; old files retain legacy semantics |
| Sheet optimization | Partial | Deterministic shelf-packing preview and combined stock groups; no guillotine sequence, offcut inventory or optimality claim |
| Room planning | Partial, supported paths tested | Quarter-turn rotations, full envelopes including fronts, floor/ceiling/boundary/overlap warnings, wall and neighbor alignment, grid snap, selectable plan |
| Kitchen layouts | Partial, supported paths tested | Straight/L/U runs of rectangular cabinets; reject unsupported fits; open corner clearance, no real corner/appliance/countertop model |
| Drawings and DXF | Partial, supported paths tested | Model-derived elevations/panel SVG, nonoverlapping flat DXF outlines and millimetres; no production drawing standard or direct PDF/Excel writer |
| Cost estimate | Implemented and tested within stated basis | Nominal areas plus editable waste; material, edging, labor, hardware allowance, overhead and margin; missing prices stay incomplete; USD/OMR/JPY precision |
| Project preservation | Implemented and tested locally | Compatible v1/v2 files, atomic malformed-file rejection, detached undo/redo, autosave/restore, optional costing/rotation, ten named local revisions bounded to 4 MiB |
| Interface and Arabic | Partial, core workflows tested | Dedicated plan/cost/review tabs, readable controls and responsive CSS, RTL/LTR and language persistence; some diagnostics and exports remain English |
| Visualization | Partial, supported paths tested | WebGL, orbit/views, wireframe/explode, PNG and presentation; no path tracing or realistic material asset pipeline |
| Hardware/drilling reference | Partial | User-confirmed patterns, bounds/depth validation and safe CSV; no provenance verification, project persistence, machine face/tool or postprocessor |
| General CAD editor | Not implemented | No arbitrary sketch/modeling, multi-selection/grouping, layers or constraint solver |
| Production CNC | Blocked by external specifications | No verified machine, tooling, datum, postprocessor, simulation or physical acceptance |
| Build | Implemented and locally verified | Root entry, local hashed assets and Cloudflare Pages `dist` configuration |
| Hosted staging | Supplied but unverified from this environment | Proxy network denial prevents inspection; local success does not establish deployed results |

## Correctness and trust-boundary fixes

- Complete project parsing, resource bounds and safe IDs precede normal UI commits.
- Topology edits preserve customized edges on the matching semantic panel; removed parts do not transfer overrides to new panels.
- Scene, drawings and room checks consume generated panel geometry; replaced GPU resources are disposed.
- Explicit stock/back settings remove ambiguity for new designs while preserving legacy file behavior.
- Invalid drawer/front/bottom and rounded-zero dimensions are rejected; missing legacy settings receive defaults.
- Flat DXF rows use measured heights and separate panels; units are explicitly millimetres.
- CSV string cells escape quotes and neutralize spreadsheet formulas.
- Financial overflow cannot turn an incomplete estimate into a quote or prevent a valid design from opening.
- Dynamic bay edits retain history/autosave checkpoints; orbit drags are distinguished from click selection.

## Verification record

The final Alpha 1.3 gate passed **138 individual Node checks and ten Chromium workflows**, with no skipped cases reported. Browser coverage includes the earlier startup/export/compatibility/Arabic paths plus kitchen planning, rotation, topology preservation, estimates/currency/error recovery and named revisions as exercised by the checked-in tests.

A final frozen-build endurance run completed **57 cycles in 182.744 seconds with zero browser errors**. Its retained evidence is `/workspace/artifacts/validation/alpha-1.3-endurance/result.json`. A prior interrupted run was observed at **460 cycles / 1439.436 seconds / zero errors**; its volatile raw result was subsequently lost when test results were reset. The interrupted observation is not a completed endurance test and must not be represented as a one-hour run.

These results do not establish exhaustive geometry correctness, performance for thousands of parts, a full accessibility/platform matrix or manufacturing approval.

## External references and pending uploads

`GLOBAL_REFERENCES.md` separates inspected first-party FreeCAD/SketchUp sources from commercial documentation blocked by network policy. Newly supplied HTML references are being analyzed separately under `analysis/`; their visible features are not automatically implemented or integrated. The supplied PolyBoard RAR exceeds the available 32 MiB transfer limit and was not inspected.

The supplied-reference supplement adds a searchable library of five extracted JSON datasets and six authored reports, with cm→mm room presets. Its prices, proposed library entities and machining references are not automatically adopted as validated manufacturing rules. `reference-data.test.mjs` covers conversions, sample quantities/cost categories and reader bounds.
