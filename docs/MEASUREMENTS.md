# Measurement provenance and data format

Every number the app shows, exports or prints carries one of these sources:

| Source (`MeasurementSource`) | Produced by | Examples | Storage |
|---|---|---|---|
| `roomPlan` | Apple RoomPlan `CapturedRoom.Surface` | wall length (`dimensions.x`), wall height (`dimensions.y`), opening width/height | `DimensionRecord.scan` (meters, `Double`) |
| `derivedFromRoomPlan` | This app, computed from RoomPlan geometry | floor area (shoelace on the floor polygon), room max/min wall height, window sill height (opening bottom − floor), plan positions (transform → X/Z) | `RoomRecord`, `OpeningRecord.sillHeightM` |
| `manualVerified` | Inspector, after a tape or laser measurement | verified door width 905 mm, verified ceiling height | `DimensionRecord.verified`, `RoomRecord.verifiedCeilingHeightMM` (integer mm) |
| `manufacturing` | Inspector, final size to make or order | door leaf 900 × 2100 | `DimensionRecord.manufacturing` (integer mm) |

The three tiers of `DimensionRecord` are independent fields. Editing the verified or
manufacturing size never changes `scan`. CSV, JSON and PDF show them in separate columns, and
CSV/PDF also show the difference (verified − scan).

## Geometry details

- **Plan coordinates**: meters in the AR session's world frame projected onto the floor:
  plan x = world X, plan y = world Z. All rooms from one walkthrough share this frame.
- **Wall/opening end points**: `transform.columns.3` (center) ± `transform.columns.0` (local X
  axis) × width/2.
- **Floor outline**: `CapturedRoom.floors[0].polygonCorners` transformed to world (iOS 17). If
  RoomPlan gives no floor, the app uses the convex hull of the wall end points. This is
  approximate for L-shaped rooms.
- **Opening → wall**: `Surface.parentIdentifier` when RoomPlan provides it, otherwise the
  nearest wall.
- **Ceiling**: RoomPlan does not model ceilings. "Wall height, max (scan)" is the tallest
  RoomPlan wall in the room. It is **not** labeled ceiling height anywhere. Only the
  inspector's typed `verifiedCeilingHeightMM` is called ceiling height.

## Incomplete or undetected values

| Situation | How it is shown | CSV `scan_status` |
|---|---|---|
| RoomPlan gave no width or height (≤ 1 cm) | "Not detected" / "n/d" | `incomplete` |
| No scan record at all | "Not detected by scan" | `not_detected` |
| Wall with fewer than 4 completed edges | dashed wall, "Partly seen" | `partially_observed` |
| Low RoomPlan confidence | "Low confidence" | `low_confidence` |
| Room without floor polygon | — | room row `floor_not_detected` |

## CSV (`*-measurements.csv`)

UTF-8 with BOM (Excel shows Arabic names correctly), CRLF line endings, RFC 4180 quoting. Free
text that starts with `= + - @` is prefixed with `'` to prevent spreadsheet formula injection.

Columns:
`item_type, item_id, room, name, scan_width_mm, scan_height_mm, scan_confidence, scan_status,
verified_width_mm, verified_height_mm, delta_width_mm, delta_height_mm, manufacturing_width_mm,
manufacturing_height_mm, sill_height_mm, room_area_m2, room_max_wall_height_m,
verified_ceiling_height_mm, video_time_s, notes`

`item_type` is `room`, `wall`, `door`, `window` or `opening`. For walls, *width* means length.
An empty cell means unknown or not entered. It never means zero.

## JSON report (`*-report-v1.json`)

```json
{
  "reportFormat": "room-scan-inspector.project-report",
  "reportVersion": 1,
  "generatedAt": "2026-11-18T10:00:00Z",
  "generator": "RoomScanInspector 1.0 (1)",
  "units": { ... },
  "provenance": { ... },
  "summary": { "roomCount": 3, "doorCount": 3, "openingsWithoutScanWidth": [], "alignment": "connected", ... },
  "project": { "schemaVersion": 1, "rooms": [...], "walls": [...], "openings": [...], "bookmarks": [...], "video": {...}, "outputs": {...}, "alignment": {...} }
}
```

`reportVersion` increases on any breaking change. `project.schemaVersion` is the on-device
project file version. The app refuses to open a project from a newer schema rather than
silently dropping fields.

## Project folder on the device

```
Application Support/Projects/<project-uuid>/
  project.json            schema-versioned project (atomic writes; previous copy in project.json.bak)
  rooms/room-N.json       raw RoomPlan CapturedRoom (Codable), kept for re-processing
  rooms/room-N.usdz       per-room model
  rooms/structure.json    merged CapturedStructure (multi-room)
  model.usdz              merged model, or the single room
  video.mp4               walkthrough
  exports/                PDF / CSV / JSON created when sharing
```

All paths inside `project.json` are relative, so projects survive the app container moving
between launches. The `Projects` folder is excluded from iCloud/iTunes backup.
