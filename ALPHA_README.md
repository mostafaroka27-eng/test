# RokaDex Engineering Studio — Alpha 1.1

## New: Project-wide panel sheet planning (preview)
- Packs panels from **all cabinets together** for compatible stock configurations, reducing unnecessary separate-cabinet sheet counts.
- Keeps stock dimensions, kerf, trim, material, thickness, and grain groups separate.
- Displays a project-wide SVG sheet preview and exports CSV positions and SVG drawings.
- Reports unplaced panels and utilization. All exports are **NOT FOR FABRICATION OR CNC**.
- Tested packing for multiple cabinets and checked that placed panels do not overlap.

**Still not a professional nesting/CAM engine:** no guillotine sequencing, offcut inventory, saw optimization, machining operations, toolpaths, or manufacturer-approved postprocessors. Engineering approval and shop-floor validation remain mandatory.

Run: `python -m http.server 8080` from this folder, then open localhost:8080. Three.js still requires network access. Tests: `node --test *.test.mjs`.

---

# RokaDex Engineering Studio — Alpha 0.7 (standalone prototype)

**Not a finished CAD/CAM system and not approved for production CNC.**

## New in Alpha 0.7
- Rectangular room planner with editable width, depth, and ceiling height (millimetres).
- Three translucent room walls and outline in the 3D viewport.
- Snap selected cabinet to back/front/left/right room boundary.
- Detect out-of-room footprints, cabinet footprint overlaps, and cabinets taller than the ceiling.
- Export preliminary room top-view SVG with unit footprints and conflict notes.
- JSON v2 project files include room dimensions; legacy v1 project files remain loadable.

**Limitations:** footprint conflict checks are 2D rectangles; they do not account for door swings, hardware, access clearances, rotated furniture, walls with openings, installations, services, structural loads, or CNC. All geometry, parts, cutting, assembly, and DXF outputs remain preliminary and require engineering review. Three.js loads over the network.

## Run locally
From the extracted folder: `python -m http.server 8080`, then open `http://localhost:8080`.

## Tests
`node --test engine.test.mjs room.test.mjs` and `node --check app.mjs`.

# RokaDex Design & Manufacturing Studio — Standalone Alpha 0.4

Independent static web application. No connection to existing Rokadex, Cloudflare account, or Supabase; no account or credentials required.

## Run
Serve this folder with a local static HTTP server, e.g. `python -m http.server 8080`, then open `http://localhost:8080`. Or upload the *contents* of this folder to a separate Cloudflare Pages project. Internet connection is required to load Three.js ES modules from esm.sh.

## Available in this build
- One unified workspace with multiple independent parametric cabinet units and kitchen-base/wardrobe presets (presets share the cabinet engine).
- 3D orbit, zoom, selection, isometric/front/top views, wireframe and exploded preview.
- Parametric panels, shelves, partitions, back, and optional 1–4 flat door leaves with editable reveal/overlay; dimensions and construction modes.
- Parts list and preliminary edge banding lengths, CSV export.
- Schematic front/side shop drawing SVG export, **not fabrication drawings**.
- Simple rectangular sheet packing preview respecting grouping by material, thickness and grain; **not production-grade optimization**.
- Basic material color choices, client presentation view, PNG export.
- Local JSON project save/load. No server, no project sync, no multi-user collaboration.

## Explicit limitations / engineering risks
- Only rectangular carcasses and flat door leaves; no freehand 3D modeling, room walls, drawers, hinges, joinery, drilling or CAM. Door placement is schematic and has no validated hinge clearances.
- Shelves are equally spaced in each bay. The back is modeled as a separate full-size overlay panel; validate your construction standards.
- Edge banding counts are schematic and do not include workshop-specific machining allowances, edge compensation, adhesive, solid lipping, hardware, or manufacturer data.
- Cut dimensions are nominal geometric dimensions; **not approved manufacturing dimensions**.
- Shelf-packing may use more sheets than necessary and does not generate guillotine sequences or CNC nesting.
- SVG is schematic and not dimensioned/approved to professional shop-drawing standards.
- Preview uses real-time WebGL rasterization, not photorealistic offline rendering.
- Arabic toggle currently changes page direction only, not all text.
- Browser interaction not yet tested on every mobile/browser/GPU. Three.js loads from CDN and needs network access.
- All data is local to browser session unless exported. No data is uploaded by this app.

## Tests
`node --test engine.test.mjs`
`node --check app.mjs`

## Next milestones
1. Real-world workshop acceptance tests and rule versioning.
2. Full component tree, transform gizmos and floorplan/room editing.
3. Door/drawer/hinge/assembly systems and validated shop drawings.
4. Production nesting, CAM operation preview, machine-specific verified postprocessors.
5. Better materials, HDRI, optional offline renderer, animation and bilingual UI.
6. Optional integration adapter for existing Rokadex after source/security audit.


## Alpha 0.3 additions (independent reference implementation)
- Editable X/Z placement for cabinet units in the common 3D scene.
- Whole-project cut list CSV, alongside per-unit CSV.
- Printable component/assembly schedule with unique IDs and edge flags.
- Material/edge length rollup by material and thickness in manufacturing view.
- The Mozaik workflow was studied through official published documentation; direct video playback was not verified. These are independently implemented workflow concepts, not Mozaik code or UI.
- Not validated for fabrication, machining or CNC.

## Alpha 0.4 additions
- Three configurable manufacturing-method presets; rules remain preliminary and must be approved by a shop engineer.
- Hardware schedule estimate for conceptual concealed hinges; no manufacturer drilling or load validation.
- Corrected first-fit sheet packing across multiple sheets (prior layout could fail to place fitting parts).
- Dedicated regression tests for sheet count, method application and hardware disclaimers.
- Not a Cabinet Vision, Mozaik or PolyBoard feature-complete equivalent. No CNC/G-code or production-approved drawings.

## Alpha 0.5 — Engineering editor
- Select an individual panel in the 3D model or cut-list row.
- Inspect its stable part ID, type and dimensions.
- Override edge-banding flags for a specific panel and restore defaults.
- Configure independent shelf counts for each bay; regenerates geometry and cutting list.
- Save/load these settings in project JSON.
- **Engineering limitation:** schematic edges and shop drawings, not approved fabrication details; no CNC toolpaths or validated machining coordinates.


## Alpha 0.6 — engineering integration
- Per-bay parametric drawer bank, including front, sides, rear, inner face, bottom; updated 3D preview and cut lists.
- Concept-only DXF flat-panel outlines (not drilling, machining or G-code).
- Preliminary slide-pair estimate.
- Manufacturing clearances and dimensions are unverified; do not fabricate directly from these outputs.
- **Known limitations:** drawers and hinged doors can visually overlap; no collision detection, wall editor, real joinery toolpaths, manufacturing-grade drawings, production nesting, hardware catalogs, or verified CNC postprocessors. Internet connection required for Three.js CDN.

## Alpha 0.8 — drilling reference editor
- Select a generated panel, configure 32 mm-style pitch, offsets, margin, diameter and depth, and preview reference holes as SVG.
- Download a panel-specific SVG or CSV coordinate reference. This is not a validated joinery system, hardware hole specification, CNC program, G-code, or drill-face selection.
- Requires manufacturer approval, verified datum and orientation, tool/machine settings, clearance checks, and test machining before production.
- The design studio still requires online Three.js dependencies; no browser end-to-end test has been completed.

## Alpha 0.9 — Hardware library import (safe reference workflow)

The new hardware section accepts a **user-supplied JSON library** containing manufacturer-confirmed drilling patterns. Download the JSON template in the app; fill `items[]` with item `id`, `type` (hinge/slide/connector/shelfPin/other), `manufacturer`, `model`, `sourceDocument`, `verified:true` and a `pattern` of `{x,y,diameter,depth}` holes in mm. Example values in the template are placeholders and are not accepted as approved hardware.

The editor rejects unverified patterns and holes outside a panel or at/through panel thickness. Export is reference CSV **only**; panel face, datum, rotation, orientation, machining tools, hardware load capacity, and machine control have NOT been validated. No proprietary manufacturer catalogs or competitor software files are bundled. The app's 3D library still loads from a third-party CDN.

**To reach verified manufacturing**: supply an authorized catalog or manufacturer's official data sheet, real machine model/controller and approved sample parts, then compare shop-floor measurements and outputs. No CNC-ready programs are produced by this build.

## Alpha 1.0 — Standalone engineering review milestone (2026-10-28)
- **Standalone-first policy:** no existing Rokadex SaaS API, database, production domain, or customer data connection.
- Added `review.mjs` for project-wide engineering audit: duplicate unit validation, layout footprint issues, conceptual door/drawer conflicts, per-unit preliminary sheet packing failures, and persistent manufacturing approval blocker.
- Project-wide material/edge rollups and review-only manufacturing CSV (formula injection protection on exported fields).
- Dimension-labeled panel detail SVG for a selected part; all exports explicitly marked **NOT FOR FABRICATION**.
- Engineering review panel is available in the 3D studio workspace.
- Run `node --test *.test.mjs` to verify the complete unit suite; run `node --check app.mjs` for syntax.
- **Unfinished:** production CAD, verified joinery, supplier-certified hardware, machining face/datum, machine-specific postprocessors, browser E2E tests, rendering pipeline, true professional nesting, and shop-floor acceptance tests.
- **Do not run generated files on CNC or release for fabrication.**
