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
