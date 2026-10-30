# Alpha 1.3: engineering, planning and estimating

User priority (2026-10-29): improve engineering accuracy, professional usability and kitchen/room tools together, using international software as functional references.

| Module | Deliverable | Acceptance |
| --- | --- | --- |
| Panel identity | Preserve edge edits on the same semantic panel across shelf topology changes; retain old display IDs | Regression for inserting shelves in another bay; removed panels lose stale overrides |
| Stock contract | Explicit stock X/Y grain axes, legacy interpretation retained for old files | Tall panels fit appropriate stock axis; forbidden rotations rejected; mixed stock axes stay separate |
| Drafting | Nonoverlapping DXF outlines with explicit millimetres | Large-panel rectangle bounds never overlap |
| Room planning | Quarter-turn rotation, full panel envelope, wall/neighbor alignment, grid snap, straight/L/U cabinet runs | No wall penetration by doors; valid generated layouts have no overlap; rejected layouts leave current project unchanged |
| Cost estimate | Editable material area prices, edge rate, waste, labor, hardware allowance, overhead and profit margin | Missing rates remain unpriced; tested formulas; settings survive JSON, backups and undo |
| Workspace | Dedicated plan, cost and engineering review modes; readable controls and Arabic labels | 1366×768 canvas and controls usable; 390px layout scrolls; inputs and existing export flows work |
| Reference research | First-party sources and explicit verification status | Every external capability claim cites its owner; unavailable pages are marked unverified |

Build order: pure model/tests → project boundary → complete UI paths → browser verification → preview release ZIP and experimental Git branch.

Commands: `npm test`, `npm run build`, `npm run test:e2e`, `npm run verify`. Pure modules use existing Node tests; complete workflows use Playwright against the built output. No new runtime dependencies are needed.

Keep JSON v1/v2 readable, preserve proxy/TLS verification and source modules. Keep application state separate from view state. No production SaaS integration, CNC postprocessor, manufacturer drilling assumptions, fabricated prices or claim of full CAD/CAM parity. Pricing is a nominal-area estimate with user-entered waste, not an optimized sheet-purchase quotation. Professional manufacturing validation and the larger master brief remain future work.

The supplied staging URL is `https://rokadex-staging.pages.dev/`. Its inspection is currently blocked by the environment network allowlist (CONNECT 403), so local browser results must remain separate from hosted results. Network additions are saved for environment settings review, not represented as active access.
