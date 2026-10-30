# Global CAD and woodworking workflow references

Research date: **2026-10-29**, Asia/Muscat. These references guide independent RokaDex design and validation. They are not evidence that RokaDex matches a commercial product or is approved for manufacturing.

## Evidence and access

The environment could read first-party FreeCAD and SketchUp GitHub sources. Requests to the product/documentation websites listed below were rejected by the environment's HTTP proxy with **CONNECT 403 / HTTP 000**. That response is an environment access limitation; no product page or feature documentation was retrieved from those websites.

| Reference | Primary source | What was actually verified | RokaDex use |
| --- | --- | --- | --- |
| FreeCAD | [Official README at `baaff9d`](https://github.com/FreeCAD/FreeCAD/blob/baaff9d3928e23d254b7fa4176ecc0af61445fa7/README.md) | Describes parametric modeling through model-history parameters, geometry-constrained 2D sketches, and drawings derived from 3D models. README retrieved successfully; no executable FreeCAD benchmark was run. | Keep parameters authoritative; derive viewport geometry, panel quantities and drawings from the same model. Constrained arbitrary sketching remains future work. |
| SketchUp | [Official Ruby API tutorials at `f9827d1`](https://github.com/SketchUp/sketchup-ruby-api-tutorials/tree/f9827d173c6fcec179dfba259804090aaeaad429) | The official examples document undoable operations, direct input tools, measurement-bar text input, and inference locking. Sources below were inspected; SketchUp itself was not run. | Give each editing action one coherent undo step; validate numeric input; provide clear placement/alignment controls. General interactive modeling and inference tools remain future work. |
| Cabinet Vision / Hexagon | [Official product target](https://hexagon.com/products/cabinet-vision) | **Not verified in this environment:** website access blocked. Product was requested as a reference in the supplied development brief. | Evaluation target: the relationship between cabinet configuration, manufacturing rules, drawings and part schedules. Do not claim equivalent functionality without reviewing the product documentation and testing RokaDex's own results. |
| Mozaik | [Official website target](https://www.mozaiksoftware.com/) | **Not verified in this environment:** website access blocked. Product was requested as a reference in the supplied development brief. | Evaluation target: a practical cabinet-to-room-to-manufacturing workflow. Feature/version comparisons are pending primary-source review. |
| PolyBoard / Wood Designer | [Official website target](https://wooddesigner.org/) | **Not verified in this environment:** website access blocked. Product family was requested in the supplied brief. | Evaluation target: configurable cabinet construction and linked engineering outputs. No manufacturer rules or proprietary formulas are inferred from the product name. |
| OptiCut / OptiNest / Wood Designer | [Official website target](https://wooddesigner.org/) | **Not verified in this environment:** website access blocked. Product names were supplied by the user. | Evaluation target: the clarity of stock/grain/kerf constraints and layout reports. RokaDex's shelf-packing preview is not asserted to match either product's optimization or machine output. |

## Verified SketchUp examples

The following are first-party tutorial observations, not copied RokaDex implementation:

- [Hello Cube tutorial](https://github.com/SketchUp/sketchup-ruby-api-tutorials/blob/f9827d173c6fcec179dfba259804090aaeaad429/tutorials/01_hello_cube/tut_hello_cube/main.rb): comments explain grouping model changes into a single undo operation, committing that operation, and aborting a failed operation in production. This supports RokaDex acceptance criteria for atomic edits and recovery.
- [Press + Drag + Release tool](https://github.com/SketchUp/sketchup-ruby-api-tutorials/blob/f9827d173c6fcec179dfba259804090aaeaad429/examples/03_press_drag_release_tool/README.md): documents both drag-release and click-move-click interaction patterns. RokaDex should select one predictable interaction per tool before attempting a general direct-modeling editor.
- [Measurement Bar tool](https://github.com/SketchUp/sketchup-ruby-api-tutorials/blob/f9827d173c6fcec179dfba259804090aaeaad429/examples/04_vcb_tool/README.md): documents text input for measurements. Its [implementation](https://github.com/SketchUp/sketchup-ruby-api-tutorials/blob/f9827d173c6fcec179dfba259804090aaeaad429/examples/04_vcb_tool/ex_vcb_tool/main.rb) checks invalid length input before applying geometry. RokaDex uses millimetres internally and must make units explicit rather than copying SketchUp's internal inch convention.
- [Tool Inference Lock](https://github.com/SketchUp/sketchup-ruby-api-tutorials/blob/f9827d173c6fcec179dfba259804090aaeaad429/examples/05_tool_inference_lock/README.md): documents Shift/arrow-key inference locking. This is a future editor reference; numeric alignment and grid tools do not constitute an equivalent inference system.

## Acceptance criteria derived for RokaDex

These are **RokaDex engineering decisions**, not claims about unavailable commercial documentation:

1. A dimension change must propagate to panel geometry, cut quantities, drawings and cost inputs from one generated model.
2. Imported projects must retain their established stock/grain interpretation until the user explicitly changes it. New axis conventions must be visible and saved.
3. A placed panel must satisfy sheet bounds, trim, kerf, grain and rotation constraints. The report must list every unplaced part; tests must detect overlap.
4. Room placement and wall snapping must use the modeled envelope, including front protrusions and supported rotations, rather than claiming clearance from carcass dimensions alone.
5. A cost estimate must distinguish a missing rate from a deliberate zero rate and distinguish profit margin from markup. Editable workshop rates are inputs, not invented supplier prices.
6. Layout generation, alignment and pricing changes must be undoable and must survive project serialization and local backup.
7. Tool and inspector text must remain readable at ordinary laptop sizes, with visible errors, keyboard focus and working Arabic/English direction.
8. No commercial feature comparison, industry-standard compliance or production CNC readiness is claimed without matching primary documentation and independent validation.

## Research still required

Enable access to `hexagon.com`, `www.mozaiksoftware.com`, `wooddesigner.org` and `help.sketchup.com` for first-party product/help research. Additional destinations should be requested only if a subsequent supported redirect or documentation request requires them. Current blocked requests do not establish which additional hosts are necessary.

After access is available, record product edition/version, exact documentation URL, reviewed workflow and observed constraints for each comparison. Run representative RokaDex projects against documented acceptance criteria; do not substitute a marketing feature list for manufacturing validation.

No proprietary source code, assets, catalogs, algorithms or manufacturer drilling dimensions were copied or reconstructed in this research. No integration with any referenced application was added.

## Supplied primary documents reviewed subsequently

The user supplied Wood Designer's 61-page Quick Design Libraries manual (PDF metadata2018/copyright2016) and a21-page PolyBoard7.08c report dated2025-01-19. These are now reviewed primary supplied materials; they do not establish access to current product websites or binary7.4. Page-cited analyses and independently proposed data schemas are in `analysis/POLYBOARD_LIBRARY_MANUAL.md` and `analysis/POLYBOARD_210_SAMPLE.md`. No vendor libraries or executable code were copied.
