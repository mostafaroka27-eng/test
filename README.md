# Room Scan Inspector (iPhone, iPad, Android)

A standalone native iPhone app for joinery and fit-out site surveys. In one walkthrough the
inspector scans one or more rooms with the iPhone's LiDAR and camera and saves a single
inspection project that holds:

1. A dimensioned, interactive **2D floor plan**
2. A reviewable **3D model** (USDZ)
3. A **measurement table** of walls, doors, windows and openings, plus room wall heights
4. A real **camera video (MP4)** recorded from the same AR session during the scan
5. **Manual bookmarks** that link a room, door, window or wall to a moment in that video

Example: tap **Door 12** on the plan. The app shows its scan, site-verified and manufacturing
sizes and plays the walkthrough video from the moment that door was bookmarked.

Everything runs and is saved on the iPhone. There is no account, server, cloud, laptop or other
hardware. Project folders are excluded from iCloud backup, and files leave the phone only when
the inspector uses **Share**.

> Setup and device testing instructions in Egyptian Arabic: **[docs/SETUP_AR.md](docs/SETUP_AR.md)**

**Platforms**

- **iPhone** with LiDAR: full RoomPlan scanning (this README).
- **iPad** with LiDAR (iPad Pro 2020 and later): the same app. It runs full-screen and in portrait.
  iPads without LiDAR can open, review and export projects but cannot scan.
- **Android phones and tablets**: a separate native app in [`android/`](android/README.md). It
  uses ARCore tap measuring and the same project format, and builds to an APK in GitHub Actions.

---

## Requirements

| | |
|---|---|
| Xcode | 15.0 or later (16.x recommended) on macOS |
| iOS deployment target | **17.0**: needed for multi-room capture (`RoomCaptureView(frame:arSession:)`, `StructureBuilder`, `CapturedRoom.floors/sections`, `Surface.parentIdentifier`) |
| Scanning device | iPhone with LiDAR: 12 Pro / Pro Max, 13 Pro / Pro Max, 14 Pro / Pro Max, 15 Pro / Pro Max, 16 Pro / Pro Max and later Pro models |
| Simulator | Builds and runs. Scanning is unavailable there (RoomPlan needs LiDAR), so use the **sample inspection** |

The app checks support at runtime (`RoomCaptureSession.isSupported`,
`ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)`, and camera permission). If any
check fails, it shows a clear message instead of the Start Scan button.

## Repository layout

```
RoomScanInspector.xcodeproj      Xcode project (app + test targets, shared scheme)
project.yml                      Equivalent XcodeGen spec (optional)
App/Sources/
  RoomScanInspectorApp.swift     Entry point, language/RTL environment
  Projects/                      Projects screen + Settings
  Capture/                       RoomPlan capture controller, capture UI, CapturedRoom → records
  Video/                         ARFrame → MP4 recorder, sample video + sample model generators
  Review/                        Review tabs: 2D Plan, 3D Model, Measurements, Video; editors
  Export/                        PDF plan renderer, export service, share sheet
  Shared/                        Project library (local storage), localization, device support
App/Resources/                   Info.plist, en/ar strings, asset catalog
Packages/InspectionCore/         Platform-independent logic (Foundation only) + unit tests
AppTests/                        Simulator integration tests (sample project, video seek, exports)
docs/                            Measurement provenance, device test plan, Arabic setup guide
tools/                           Project/strings generators and pbxproj checker
```

`InspectionCore` holds everything that can be tested without a device: the project model,
unit conversion, local storage with atomic saves and per-output failure tracking, the shared
video/bookmark clock, frame pacing, plan geometry and hit-testing, the alignment checks, CSV and
the versioned JSON report. The app target holds what needs Apple's device frameworks: RoomPlan,
ARKit, AVFoundation, SceneKit, PDF rendering and SwiftUI.

## Build and run

### Simulator (no device needed)

1. Open `RoomScanInspector.xcodeproj` in Xcode.
2. Select the **RoomScanInspector** scheme and any iPhone simulator (iOS 17+).
3. Press **Run** (⌘R).
4. On the Projects screen, tap **+ › Add sample inspection**. The app generates a clearly labeled
   synthetic project (two rooms and a corridor), a synthetic MP4 with a visible timecode, and a
   simple USDZ.
5. Open it. Tap **Door 1** on the plan. The sheet shows 893 mm scan, 905 mm verified, and the
   video starts at **0:17.5** (the timecode is burned into the frame, so you can check it).

### Tests

- In Xcode: **Product › Test** (⌘U) runs both `RoomScanInspectorTests` (simulator integration)
  and `InspectionCoreTests` (core logic).
- Core logic only, on macOS or Linux: `cd Packages/InspectionCore && swift test`

| Test file | Covers |
|---|---|
| `UnitsTests` | m↔mm conversion and rounding, formatting, parsing typed mm/m (including Arabic-Indic digits), scan/verified/manufacturing tiers stay independent |
| `TimebaseAndBookmarkTests` | shared clock, interruption gaps, bookmark-to-frame timing, frame pacing under uneven timing, assign/reassign/seek, storage budget |
| `ProjectStoreTests` | create/rename/list/delete, **reopen after restart**, a failed output does not destroy others, missing-file detection, backup fallback, schema versioning |
| `ExportAndPlanTests` | **CSV export** columns and values, CSV escaping/formula safety, **JSON report** version and round-trip, plan transform and hit-testing, wall labels, alignment checks, capture guidance |
| `AppIntegrationTests` (simulator) | sample project reopens with video and model, **frame-accurate bookmark seek** in the MP4, PDF/CSV/JSON/USDZ/MP4 exports and their independence |

## Install on a LiDAR iPhone from Xcode

1. Connect the iPhone by cable and unlock it. Tap **Trust** on the phone if it asks.
2. In Xcode open **Settings › Accounts**, click **+**, and sign in with your Apple ID. A free
   Personal Team works for testing on your own phone.
3. Select the project in the navigator, then the **RoomScanInspector** target, then
   **Signing & Capabilities**:
   - Tick **Automatically manage signing**.
   - **Team**: choose your team (for example "Your Name (Personal Team)").
   - **Bundle Identifier**: change `com.example.roomscaninspector` to something unique, for example
     `com.yourname.roomscaninspector`. Personal teams require a unique ID.
   - Do the same for the **RoomScanInspectorTests** target if you will run tests on the device.
4. On the iPhone, turn on **Settings › Privacy & Security › Developer Mode** (iOS 16+). The phone
   restarts. Confirm **Turn On** afterwards.
5. In Xcode's device menu (top bar), pick your iPhone and press **Run**.
6. With a Personal Team, the first launch is blocked. On the phone go to **Settings › General ›
   VPN & Device Management**, tap your Apple ID under Developer App, then **Trust**. Run again.
   Personal Team builds expire after 7 days. Run from Xcode again to renew.
7. On first scan, allow **Camera** access.

## Using the app

**Projects**: + creates a project (it opens straight into capture on a supported phone). Swipe a
project to rename or delete it, and long-press it to export. Projects reopen with all outputs
after the app restarts. If an output file is missing or failed, it is flagged with "Export needs retry".

**Capture**: Apple's RoomCaptureView shows live coaching. The app adds:
- a recording indicator with elapsed time
- banners when tracking is weak, too fast, too dark, interrupted, or lost (with "go back to the
  last scanned area")
- "Revisit N walls" when walls still have unobserved edges or low confidence
- buttons: **Start Scan**, **Bookmark**, **Finish Room**, **Scan next room**, **Finish Survey**

Multi-room: after **Finish Room**, the video keeps recording while you walk through the doorway,
then tap **Scan next room**. Finish with **Finish Survey**.

**Review**: four tabs.
- **2D Plan**: rooms, walls, openings with mm labels. Tap an item to see its dimensions and video.
  Pinch to zoom and drag to pan. Dashed walls were only partly seen. ✓ marks verified values.
- **3D Model**: orbit the RoomPlan USDZ, switch to per-room models, or open AR Quick Look.
- **Measurements**: per room. Openings in mm, room dimensions in m or mm. Tap a row to edit the
  name, notes, the **site-verified** size, the **manufacturing** size, and the linked bookmark.
- **Video**: the walkthrough, bookmarks list (rename, ±0.5 s nudge, link to item, delete, add at
  current time), and an optional lead-in before the bookmark.

**Export**: PDF floor plan with visible dimensions and a measurement table page, USDZ, MP4, CSV,
and a versioned JSON report (`room-scan-inspector.project-report`, version 1). Each export is
independent. If one fails, it shows "Retry needed" and the others still work.

## Measurement provenance (summary)

See [docs/MEASUREMENTS.md](docs/MEASUREMENTS.md) for full detail.

- **Scan (RoomPlan)**: wall length/height and opening width/height come from
  `CapturedRoom.Surface.dimensions`. Plan positions come from `Surface.transform`. These are
  estimates.
- **Derived**: floor area, room maximum/minimum wall height, and window sill height are computed
  by the app from RoomPlan geometry.
- **Site-verified**: typed by the inspector after a tape or laser measurement. Stored separately.
  It never overwrites the scan.
- **Manufacturing**: typed by the inspector as the size to make or order. It is never taken from
  the scan.
- **Ceiling height**: RoomPlan does not capture ceilings, so the app never labels a scan value
  "ceiling height". It shows "Wall height, max (scan)". The only ceiling height is the one the
  inspector types as verified.
- Values RoomPlan did not provide are shown as **Not detected**, and walls only partly observed
  are flagged. Nothing is filled in silently.

## Video and bookmarks: how timing works

- ARKit cannot share the camera with an `AVCaptureSession`. Footage therefore comes from the
  RoomPlan AR session's own frames (`ARFrame.capturedImage`), as Apple DTS recommends. By
  default, frames are read with an `ARSessionDelegate` on the RoomPlan AR session.
- A watchdog switches to polling `ARSession.currentFrame` if delegate frames stop arriving.
  **Settings › Video frame source** forces polling on a phone where the delegate path misbehaves.
- Frames are appended at about 30 fps to an H.264 MP4 through `AVAssetWriter`. If the encoder is
  busy, the frame is dropped and counted. Frames are never queued, so memory stays flat on long
  scans and ARKit's frame pool is never starved.
- **Shared timebase**: the video's presentation times and every bookmark use one
  `RecordingClock`. Media time 0 is the first written frame. Input is ARKit's frame timestamp
  (system uptime). AR session interruptions pause the clock and the gap is removed, so a bookmark
  taken at a moment always maps to the frame captured at that moment.
- Orientation: capture is portrait. Sensor frames are landscape, so the track gets a 90° transform.
- Storage: recording will not start with less than about 2 minutes of space above a 500 MB
  reserve. It warns when space runs low and stops cleanly at the reserve. Footage recorded so far
  stays playable.
- If the app goes to the background, the video is finalized so it stays valid, and the scan's
  rooms remain saved.

## Multi-room and alignment

- One `ARSession` is shared by all rooms through `RoomCaptureView(frame:arSession:)`. After each
  room, `stop(pauseARSession: false)` keeps the coordinate system alive. At the end,
  `StructureBuilder(options: [.beautifyObjects]).capturedStructure(from:)` merges the rooms into
  one structure and one USDZ.
- Each room's raw `CapturedRoom` JSON and its own USDZ are saved **as soon as the room is
  finished**, so a later merge or export failure never loses a captured room.
- The app reports when rooms cannot be aligned reliably:
  - **Not aligned**: tracking was lost and not relocalized before the room was finished.
  - **Check alignment**: room footprints overlap more than a wall's thickness, a room is more
    than 1.5 m from every other room, or tracking was weak for over 10 s.
  - **Merge failed**: StructureBuilder returned an error. Rooms are kept separately and the
    first room's model is used as the main USDZ.
  These appear as a banner on the plan, colored room fills, a JSON report field, and a PDF header line.

## What was checked, and what needs a real iPhone

See [docs/DEVICE_TESTING.md](docs/DEVICE_TESTING.md) for the step-by-step physical acceptance test
and the measurement comparison sheet.

| Check | Where it runs |
|---|---|
| Core unit tests (`swift test`) | macOS or Linux |
| App build, simulator tests, sample flow | Mac with Xcode + simulator |
| RoomPlan scanning, multi-room merge, live guidance | **LiDAR iPhone only** |
| Real AR camera footage, frame timing, interruption handling | **LiDAR iPhone only** |
| Bookmark seek against real footage after app restart | **LiDAR iPhone only** |
| Scan vs. tape/laser accuracy | **LiDAR iPhone + tape/laser on site** |

## Known limitations (first release)

- Bookmarks are linked **manually**. Automatic suggestions (for example, a door detected at a
  bookmark time) will come only after the manual workflow is verified on site.
- Video is silent.
- A project holds one walkthrough. To re-survey, create a new project.
- RoomPlan does not report door hinge side or swing. The plan's swing arc is schematic.
- Capture is portrait-only.
