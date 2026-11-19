# Room Scan Inspector for Android (phones and tablets)

The Android version of the inspection app. It uses the same project format as the iOS app
(`schemaVersion` 1), the same three measurement tiers (scan, site-verified, manufacturing),
the same CSV columns and the same video bookmarks.

## How measuring differs from iPhone

Android phones have no RoomPlan, and most have no LiDAR. The Android app uses **ARCore**:

- The inspector taps (or aims the centre crosshair at) the floor corners of a room. Walls are
  built from those corners.
- For a door, window or opening: tap the left jamb, the right jamb, then the top. The opening
  snaps to the nearest wall within 0.5 m. Sill height is measured from the floor.
- Wall height: tap the floor, then the top of the wall.
- Every scan value records `method: "arcoreTap"` and a confidence. A plane or depth hit is
  `medium` and a feature-point hit is `low`. A tap is **never** `high`. Treat Android scan values
  as estimates and fill in **site-verified** values with tape or laser.
- There is no USDZ export on Android. PDF, CSV, JSON and MP4 are produced.
- If the device has no ARCore support, the app still opens projects, shows the sample, edits
  measurements and exports. Only capture is disabled.

## Requirements

| | |
|---|---|
| Android | 8.0 (API 26) or later |
| Capture | A device on Google's ARCore supported list. The app offers to install "Google Play Services for AR" |
| Tablets | Supported. From 840 dp wide the review screen shows the plan and the item details side by side |

## Build

```
cd android
./gradlew :core:test          # shared logic tests (plain JVM)
./gradlew :app:assembleDebug  # APK at app/build/outputs/apk/debug/app-debug.apk
```

JDK 17 and the Android SDK (platform 35) are required. `./gradlew -PcoreOnly=true :core:test`
runs the core tests without the Android SDK.

CI (`.github/workflows/android.yml`) runs both and attaches `RoomScanInspector-android.apk` to every run. On the
default branch it also refreshes the **android-latest** pre-release, which gives a stable download
link. The APK is signed with the committed debug key, so each new build installs over the old
one without losing projects. This is a test build, not a Play Store build.

## Layout

```
core/   Pure Kotlin. Models, JSON (iOS-compatible), units, timebase, bookmarks, plan geometry,
        CSV/report export, project store, manual capture builder. Unit tests in core/src/test.
app/    Compose UI, ARCore capture, MediaCodec video recorder, ExoPlayer review, PDF renderer.
tools/  generate_strings.py builds values/ and values-ar/ strings.xml from one table.
```

## What was checked

- `:core:test` (28 tests) passes on JVM, including decoding the iOS fixture
  `shared/fixtures/project-v1.json`. The iOS test suite decodes the same fixture.
- The `app` module has **not** been compiled yet. The build container could not reach Google's
  Maven repository, so the first compile happens in GitHub Actions.
- Nothing has run on an Android device yet. ARCore capture, video recording, accuracy and
  tablet layout all need a real device.
