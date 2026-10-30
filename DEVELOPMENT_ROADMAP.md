# Development roadmap

Preserve the supplied application and compatible project files. Ship working, reviewable increments and keep the studio independent from RokaDex SaaS. The full master brief is a long-term capability roadmap, not a claim that this prototype already matches commercial CAD/CAM products.

## Delivered through Alpha 1.3

- Reliable local Vite build with bundled dependencies, visible startup errors and Cloudflare Pages output configuration.
- Strict v1/v2 project boundary, latest autosave/restore, 30-state undo/redo and ten named local revisions bounded to 4 MiB.
- Semantic panel keys and edge-remapping on topology edits; compatible display IDs.
- Explicit stock X/Y grain axes and legacy interpretation; separate incompatible packing batches.
- Legacy/inset/overlay back construction with coordinated panel/drawer planes; model-derived scene and drawings.
- Flat DXF with measured row spacing and millimetres; safe CSV exporters.
- Quarter-turn cabinet rotation, full panel envelope warnings, plan selection, wall/neighbor alignment and grid snapping.
- Straight/L/U rectangular kitchen runs with fit/conflict rejection.
- Editable nominal-area estimates for materials, edges, waste, labor, hardware allowance, overhead and margin; currency precision and incomplete-estimate recovery.
- Dedicated plan/cost/review tabs, more readable controls and improved responsive/Arabic behavior.
- Documented primary references and independent source review.

Final local gate: **138 Node checks and ten Chromium workflows passed**. Frozen-build endurance: **57 cycles / 182.744 seconds / zero browser errors**. A prior run was interrupted after an observed 460 cycles/1439.436 seconds. No completed one-hour run is claimed.

## Delivered in Alpha 1.4.0 (2026-10-30)

Cabinet rules cab-2.0, unified part model (uid, finish/cut size, named edges, operations, provenance), project format v3 with migration, manufacturing CSV, QR part labels, packing verifier, annotated drawings. Local gate: 163 Node checks, 18 Chromium workflows, production build. See `HANDOFF.md` for the prioritized remaining work.

## 1. Complete acceptance and preservation

Enable supported access to the supplied staging host, then verify the exact deployed assets and critical user flows. Broaden browser/GPU/mobile/accessibility checks. Keep hosted evidence separate from local results. Add project metadata and hardware-library persistence with schema regression cases before introducing shared/cloud storage.

Exit criterion: representative projects can be edited, saved, reopened and deployed without losing their supported state, with actual platform evidence recorded.

## 2. Extend engineering contracts

Expand construction and manufacturing rule precedence with documented workshop inputs. Preserve semantic identities through more structural operations, and define explicit mappings for external report references. Add real clearance/assembly tests before treating nominal panel geometry as manufacturing dimensions.

Exit criterion: every supported formula and coordinate convention has deterministic examples, invalid-input rejection and model/drawing/report consistency checks.

## 3. Improve planning and direct editing

Add validated wall openings, richer rooms, explicit corner/appliance/countertop models, predictable direct manipulation, multi-selection, grouping/layers and constraints in separate vertical slices. Complete dynamic localization and keyboard workflows. Treat the newly uploaded HTML documents as reference-analysis inputs, not source to paste into the application.

Exit criterion: each new editor tool changes the real model, participates in undo/save and has a complete browser-tested path.

## 4. Materials, estimates and packing

Add supplier-specific stock/rate catalogs, sheet-purchase pricing, hardware bill-of-materials pricing, taxes and documented currency policy as needed. Measure larger assemblies before optimizing. Introduce better nesting/offcut algorithms only with grain, trim, kerf, boundary and overlap regressions; keep preliminary layouts distinct from machine programs.

Exit criterion: quantities, pricing basis and missing evidence remain explicit; user-supplied real prices replace assumptions.

## 5. Validated manufacturing and CAM

Require authorized manufacturer data for installation patterns. Define face/origin/tool/depth/clearance contracts. Require machine/controller/tooling specifications, independently validated postprocessors, simulation and physical acceptance pieces before production CNC export.

## Delivery discipline

Record implemented/partial/unverified/blocked capabilities, actual commands/results, compatibility changes and remaining evidence. Never substitute a passing unit count, visible button, marketing comparison or interrupted soak test for end-to-end completion.
