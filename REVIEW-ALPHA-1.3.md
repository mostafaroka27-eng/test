# Independent review — Alpha 1.3

Review date: 2026-10-29. Scope: the integrated planning, costing, topology, rotation and compatible project-boundary changes. This is a software review of the current working tree; it does not establish manufacturing approval, full commercial CAD/CAM parity, or successful hosted deployment.

## Result

No unresolved release-blocking correctness, XSS or data-loss defect was identified in the reviewed paths. The current back-construction changes were still being implemented by a separate agent when this review ran; their final geometry requires its own regression evidence.

## Findings addressed during development

1. **Calculation overflow could interrupt project application.** Project parsing accepts bounded valid financial inputs whose derived selling amount can exceed safe minor-unit arithmetic. An unhandled quote exception during `workspace.refresh()` could leave a valid design partly applied. The current workspace catches that calculation failure, preserves the open design and editable rates, clears unavailable totals, and reports an incomplete estimate. Earlier independent browser reproduction confirmed the design remained open and undoable after this guard.
2. **Display precision differed from currency calculations.** The costing engine now uses currency minor units, and current material/total displays use `quote.precision`. USD, OMR and JPY behavior must be kept covered by the costing regressions and browser cases.
3. **Orbit gesture could trigger selection.** The initial canvas handler checked only `pointerup.movementX/Y`. The reviewed current handler records pointer-down identity and coordinates, then rejects releases farther than four pixels. This avoids treating an orbit drag as a click.

## Boundaries inspected

- Project parsing preserves optional rotation and costing, validates supported quarter turns and validates the entire candidate before a UI commit.
- Imported projects missing the new stock-axis field retain legacy semantics; newly created units opt into the explicit Y convention.
- Topology remapping matches customized panels by semantic bay/slot keys, while legacy display IDs and serialized ordinal override keys remain readable.
- Costing distinguishes missing rates from explicit zero rates, applies overhead and profit-margin formulas in the documented order, and does not display a complete quote after a calculation error.
- Material/user text inserted into generated HTML is escaped; project tree IDs are constrained and escaped; cost material cells opt out of UI-label translation.
- Rotation in the scene matches the room module's positive-Y transform and front-arrow convention. Full panel envelopes include front protrusions.
- History snapshots are serialized and detached. Named revisions use validated detached snapshots and a single atomic storage write; corruption and quota errors preserve stored content.

## Runtime observation

An isolated Chromium session used the source server on port 4373 at 1366×768. It opened the viewport, switched to the room plan, changed rotation and invoked undo without browser exceptions. Chromium's actual accessibility tree exposed `Select Cabinet Unit` as a non-ignored button inside the plan; the top-level SVG image role did not hide the focusable unit action in this tested browser. This is a targeted observation, not a complete accessibility audit or cross-browser guarantee.

## Remaining limitations

- Full-model regeneration and repeated plan/quote refreshes can be expensive for large projects. The existing single-cabinet endurance record does not establish performance for thousands of parts or GPU memory behavior on ordinary Windows hardware.
- Arbitrary walls/openings, validated door swings, real corner cabinets, appliances/countertops, workshop-specific joinery and production CNC postprocessors are outside this milestone.
- Construction changes need explicit geometry tests and legacy compatibility checks; do not infer their correctness from this review of the other modules.
- Most diagnostic report/export content remains English even when core controls are Arabic. General interactive modeling, multi-selection and complete keyboard workflows remain partial.
- The live staging site remains unverified from this environment while its network policy blocks access.
