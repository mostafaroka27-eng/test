# Known limitations — Alpha 1.8.0 additions

- Images are real-time renders (three.js WebGL) with contact shadows; there is no path tracing or global illumination yet, so light does not bounce between walls. Not comparable to V-Ray/D5.
- The realistic room uses procedural floor textures and plain painted walls; no furniture props, curtains or outdoor view. Door leaves are always shown closed.
- The room is rectangular (width × depth × height); L-shaped rooms and sloped ceilings are not modelled.
- 4K export was timed on one real GPU (≈ 0.2 s without AO); not tested on phones or Safari.

# Known limitations — Alpha 1.7.0 additions

- Camera scanning has only been checked as far as "no camera" handling in a headless browser. It has not been tried on a real phone; use typed IDs or a USB/Bluetooth scanner if the camera does not read the label.
- The workers' view hides editing controls but is not access control; a worker can leave it or open the full app. Prices are hidden because the cost tab is hidden, not removed from the project file.
- Assembly steps are generic for the cabinet types RokaDex models. They do not include joinery-specific instructions (dowels, cam locks, screws) and fasteners are not counted. Follow your workshop standard.
- Drawing images are photos only (PNG/JPEG/WebP, max 4 per unit, ≤ 300 KB each after reduction); PDF or DXF attachments are not supported. They make the project file larger.
- A fixed drawing scale that does not fit falls back to the next larger scale with a warning on the sheet; the layout does not re-flow tables to make room.
- Door/window openings, corner units and continuous worktops are still not drawn on shop drawings.

# Known limitations — Alpha 1.6.0 additions

- Corner units are not modelled. The "corner carousel" accessory sits in a normal 900 base; blind-corner geometry is not drawn.
- One worktop piece per unit; joints, cut-outs for sink/hob and continuous worktops along a run are not drawn (sink and hob are listed and shown as stand-ins only).
- Shop drawings do not yet draw cover panels, top fillers, worktops, glass type, handle type or accessories; they appear in the parts list and accessories list. Shop-drawing layout options come in 1.7.
- Accessory sizes, fit rules and hardware rules (hinges per door height, 4 pins per adjustable shelf, 2 brackets per wall unit, one driver per lit unit) are RokaDex starting values, not supplier data. Fasteners are not calculated.
- Interior "what fits" text is general guidance, not a check against the client's real items.
- Material photos are stored inside the project file (≤ 350 KB each, max 60 materials); large libraries make project files larger. The photo is a visual texture only; it does not change cut sizes.
- Door/window checks are rectangular (swing zone and window rectangle). Openings are not drawn on shop drawings.
- Lighting quality "very high" may be slow on phones; it has not been tested on a real GPU, Safari or iPhone.
- Wall-unit stacking with "Place next to the selected unit" only places directly above a base unit when that space is free; otherwise it continues the run sideways.

# Known limitations — Alpha 1.5.0 additions

- Shop drawings are drawn at a true scale only when printed at 100 % on A3 landscape. Browser print dialogs may scale "to fit"; check the 1:n bar before measuring. Drawings remain preliminary: no drilling, tolerances or approval.
- The section is taken through the centre of bay 1 only. Upper cabinets, corners and fillers are not drawn because the engine does not model them yet.
- Handles in 3D and on drawings are generic bars (320 mm max, NCD default length); no hardware catalogue. LED strips and lights are visual only and do not enter the cut list or estimate.
- The showroom shows only your cabinets and the room shell. Furniture, people, cars or landscaping like the reference reel need 3D assets that are not included.
- Night mode and lighting are approximate real-time rendering, not a photoreal render.
- Company settings live in this browser's storage. Use the same browser or re-enter them on another device; they are not stored in project files.
- "Double hanging" from NCD is not available until the engine supports two rails per bay.

# Known limitations — Alpha 1.4.0 additions

- cab-2.0 values (slide lengths 250–600, 13 mm slide clearance per side, groove 8 mm / allowance 2 mm, shelf clearances, rail clearance) are editable software conventions taken from the supplied NCD reference or chosen as starting points. None is supplier- or workshop-approved.
- The NCD-integrated package (ncd-designer.html, legacy originals) was not among the supplied files. There is no NCD project importer; NCD compute rules were read only from the analysis report.
- Plinth is supported only with top/bottom between sides. Upper cabinets, fillers, end panels and corner units are not modeled.
- External drawer fronts cannot be combined with full-height doors; mixed door-over-drawer fronts are not modeled.
- Hanging rail length is the inner bay width; end-support fittings are not deducted.
- Groove operations are recorded data only (no tool, face origin or machine program). Drilling for hinges/slides is not generated.
- QR labels were verified by decoding the generated matrix in software, not with a workshop scanner. Label payload length is capped at 700 characters.
- Furniture catalogue conversion exists (`referenceFurniture`) but generic furniture blocks are not yet placed in the room plan.
- Cost estimate still combines cost and margin on one screen; supplier price lists are not applied.
- Version 3 project files cannot be opened by 1.3.x builds.

# Known limitations — Alpha 1.3.2

This remains a standalone engineering prototype. Software tests and reference comparisons do not approve fabrication drawings, procurement, cutting instructions or CNC programs.

## Geometry, rooms and editing

Supported geometry is rectangular carcasses, per-bay shelves, flat doors and conceptual drawer banks in one rectangular room. Quarter-turn unit rotation, full modeled envelopes and simple straight/L/U runs are implemented. Arbitrary walls/openings, angles, real corner cabinets, countertops/appliances, face frames, general sketching, grouping, multi-selection, layers and a constraint solver are absent.

Room warnings use axis-aligned full panel envelopes, with floor/ceiling/boundary checks. They do not solve door swings, installation clearances, loads, hardware motion or full 3D collisions. Kitchen side runs leave corner clearance; they do not invent a corner unit. Back modes define consistent software planes but still require workshop-specific construction validation. Legacy back geometry remains available for old files and should not be inferred to satisfy the new construction contract.

Semantic keys preserve panel customizations during supported topology edits. Display/export IDs remain generation-order based and can renumber, so references held by external documents are not permanent identities.

## Packing, drawings and estimates

Explicit stock X/Y grain modes are supported. Files without that setting preserve legacy interpretation; legacy tall panels can therefore remain unplaced until the user deliberately changes the axis. Shelf packing is a preview, not optimal nesting, guillotine sequencing, saw order, offcut tracking or CAM.

SVG and DXF remain schematic. DXF has nonoverlapping outlines and millimetre units, but no validated machining datums, installation details, tolerances, sections or assembly sequence. Browser print-to-PDF is not a direct professional PDF export engine.

Costing is based on nominal panel area plus a user-entered waste percentage, not optimized sheet purchase quantities or supplier quotations. Rates are user input. Hardware cost is a manual allowance; labor/machine effort is not automatically derived. Missing rates and unsafe derived amounts leave estimates incomplete. Currency minor-unit rounding does not provide accounting/tax compliance or exchange-rate conversion.

## Preservation, localization and performance

Files remain compatible v1/v2, with optional costing and rotation. Local undo retains 30 session snapshots; named revisions retain at most ten snapshots and 4 MiB at this browser origin. The latest autosave and revisions can be unavailable, cleared or quota-limited. Export JSON for portable backup. There is no account, cloud sync, multi-user editing or shared revision service. Imported hardware reference libraries are not included in saved projects.

Core Arabic/English controls and RTL/LTR work, but some engineering diagnostics and export content remain English. Light/dark switching and complete keyboard/accessibility/platform coverage are unfinished.

Geometry/material disposal is implemented, but scene regeneration, room comparisons and packing are synchronous. The retained final endurance result covers one cabinet for 57 cycles/182.744 seconds; a separately observed interrupted run reached 460 cycles/1439.436 seconds. Neither proves large-project speed, GPU-memory stability or a one-hour test. Ordinary Windows GPU/browser acceptance remains to be performed.

## External evidence and references

The user supplied `https://rokadex-staging.pages.dev/`, but the environment proxy denied access with CONNECT 403. This is a local inspection blocker, not evidence that the website is broken or correct. The saved network addition is a draft and does not establish active access.

No verified machine/controller, tooling, datum, postprocessor, simulation or physical test-piece acceptance was supplied. Production CNC remains unavailable. A `verified:true` flag in a user hardware library is a user assertion, not independently authenticated manufacturer evidence.

FreeCAD/SketchUp primary-source observations are recorded in `GLOBAL_REFERENCES.md`; commercial feature comparisons remain unverified where access was blocked. Uploaded HTML references under analysis are not integrated features. The PolyBoard RAR was not inspected because it exceeds the available 32 MiB transfer limit.

Uploaded HTML/default catalogs and PDF outputs are available as reference facts only. The21pageexample uses groovedbackconstruction, unequaldoors andLegraBoxcomponents; thedefaultmodel is not an exact reconstruction. Five coordinate annotations remain clipped and two printedgrooves havezerolength. BothRARuploads exceed32MiB and were not inspected.


## Startup and graphics fallback

When WebGL initialization fails or its context is lost, the current cabinet is shown as 2D SVG elevations. Orbit, wireframe, explode, 3D presentation and PNG preview controls are disabled; SVG/CSV/JSON and project editing remain usable. Reload is required to retry 3D. Source modules must still load successfully for 2D operation. A general startup error includes a manually downloadable diagnostic, not an inferred GPU diagnosis. iPhone/WebKit hardware acceptance and the exact supplied screenshot's cause remain unverified; local regressions use Chromium with simulated unavailable/lost graphics contexts.
