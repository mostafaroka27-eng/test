# RokaDex Engineering Studio architecture

Alpha 1.3 is an independent browser application developed from the user-supplied Alpha 1.1 source. It has no backend, account system, database or connection to the RokaDex SaaS. Internal dimensions use millimetres; reports convert area and edge quantities to square metres and metres.

## Modules

| Module | Responsibility | Boundary |
| --- | --- | --- |
| `app.mjs` | Three.js scene, selection, inspector events, project application, history and backup checkpoints | Browser/DOM/WebGL orchestration |
| `workspace.mjs` | Plan, kitchen, alignment/grid, quote and named-revision controls | Commits validated project candidates through the app |
| `engine.mjs` | Cabinet validation, panel generation, construction contracts, grain-constrained packing, CSV and DXF | Pure engineering calculations; no machine control |
| `geometry.mjs` | Shared panel sizes on X/Y/Z axes | Same geometry basis for scene, drawings and room envelopes |
| `topology.mjs` | Reattach edge customizations to semantic bay/slot panels after topology edits | Legacy display IDs and JSON override keys remain readable |
| `room.mjs`, `layout.mjs` | Full modeled envelopes, quarter-turn rotation, room warnings, snapping/alignment and straight/L/U cabinet runs | One rectangular room; no installation or door-swing solver |
| `drawing.mjs`, `review.mjs` | Model-derived elevations, panel details, quantities, advisory review and project sheet preview | Preliminary drawings and reports |
| `costing.mjs` | Nominal area, editable rates/waste, edging, labor, hardware allowance, overhead and margin | User-input estimate; no supplier prices or optimized purchase quotation |
| `project.mjs` | Strict v1/v2 normalization, serialization, detached history and latest backup helpers | Complete validation before normal UI commits |
| `revisions.mjs` | Named local snapshots, bounded and atomically stored | At most ten revisions and 4 MiB; no cloud storage |
| `joinery.mjs`, `machining.mjs` | User-supplied hardware patterns and drilling references | No manufacturer approval, machine program or postprocessor |
| `i18n.mjs`, `index.html`, `style.css` | Arabic/English controls and dedicated design/plan/cost/review views | User data is not translated; some dynamic reports remain English |
| `boot.mjs` | Visible startup failure message | Dynamic app import and WebGL initialization failure boundary |

## Model and coordinate contracts

X points right, Y up, Z toward the cabinet front. `geometry.partSize()` and generated panel positions are shared by 3D, drawings and envelope calculations. Unit rotations are supported only at 0°, 90°, 180° and 270° around positive Y. Room checks use the resulting full panel envelope, including doors/drawer fronts, plus ceiling and floor boundaries.

Each generated panel has a semantic `key` based on kind, bay and slot where applicable. Selection and edge remapping use that key during topology edits. Display `id` and serialized ordinal `overrideKey` remain compatible with earlier exports; display IDs can still renumber and should not be used as permanent external references.

New units use explicit stock grain along sheet Y and inset-back construction. Imported files missing the new settings receive `legacy`, preserving their prior interpretation. Stock X is sheet width and Y is sheet length. Explicit X/Y modes distinguish grain parallel to a panel's length or width; unrestricted panels may rotate. Packing batches include the stock-axis setting. Back construction supports `legacy`, `inset` and `overlay`; model tests define back planes, carcass depth and drawer positions. These are documented software conventions, not workshop approval.

## Persistence and estimates

Project files retain format `rokadex-standalone` and versions 1/2. Version 1 receives the default room. Optional rotation and costing survive import/export, history and backups. Parsing bounds input to 5 MiB, 100 units, 2,000 parts per unit and 5,000 parts per project. Session undo/redo retains 30 detached snapshots. The latest automatic backup and named revisions are stored at this browser origin; storage failures are surfaced and JSON export remains the portable backup.

Quotes require explicit material and edge prices. Missing rates remain unpriced, and calculations beyond safe currency minor-unit arithmetic produce an incomplete estimate without preventing a valid design from opening. Currency formatting and rounding follow `Intl` minor units, including USD, OMR and JPY. Hardware is a user-entered cost allowance; the imported reference library is not persisted in project files.

## Build and verification

Pinned npm dependencies are bundled locally by Vite into `dist/`; no runtime CDN is required. Playwright serves the built output for Chromium workflows. The opt-in endurance script freezes a build before repeated editing and records metrics, errors and asset names. Local tests, a hosted staging request and physical manufacturing acceptance are separate evidence categories.

Full-model regeneration and synchronous packing remain. Future work should measure large assemblies before adding caches or replacing the existing modules. Arbitrary modeling, general constraints, grouping and production CAM remain outside this architecture milestone.

## Supplied reference boundary

`reference-data.mjs` validates and flattens JSON facts and converts the supplied room templates fromcentimetres tomillimetres. `reference-library.mjs` presents the five bundled datasets and authored Markdown reports, escapes all displayed source values and applies only explicitly selected room dimensions. It never evaluates uploaded HTML, imports supplier code, activates drilling or overwrites project rates. `analysis/SUMMARY_AR.md` maps all six supplied source types, evidence levels and unavailableRARcontent.
