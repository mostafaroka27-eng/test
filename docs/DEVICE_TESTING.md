# Physical-device acceptance test

These steps need a LiDAR iPhone (iOS 17+) and an independent tape or laser measure. The
Arabic version of this guide is in [SETUP_AR.md](SETUP_AR.md).

## A. Quick checks (about 10 minutes)

1. **Support message**: install on a non-LiDAR iPhone if you have one. The Projects screen must
   say scanning is not available, and Start Scan is disabled. On the LiDAR iPhone, no message.
2. **Single room (order step 1)**: + › name "Test 1" › Start Scan. Scan one room. Tap
   **Bookmark** once while facing the door. **Finish Survey**.
   - The plan shows the room with wall lengths in mm and the door.
   - Force-quit the app (swipe up), reopen it, and open "Test 1". The plan, 3D model, table and
     video are all still there.
3. **Video and bookmark (step 2)**: Video tab. The bookmark is listed. Swipe right › Link › choose
   the door. On the plan, tap the door. The sheet shows its dimensions and the video plays from
   the bookmark. Check that the picture shows the door.
4. **Exports (step 3)**: Export › Share all › save to Files. Open the PDF (dimensions visible),
   USDZ (opens in Quick Look), MP4 (plays), CSV (opens in Numbers/Excel), and JSON.
5. **Interruptions**: during a scan, pull down Control Center for about 3 s and return. The
   "Scan interrupted" banner appears, then clears. After finishing, the Video tab shows
   "1 interruption" and bookmarks after the interruption still land on the right frame.
6. **Weak tracking**: point at a blank wall and move fast. The "Tracking is weak" banner appears.

## B. Final acceptance: one continuous walkthrough of two rooms and a corridor

1. Create project "Acceptance". Start Scan in **Room A**.
2. Scan Room A fully. Bookmark at each door and window, and say its name aloud if you want to
   remember it (video is silent, so note bookmark order on paper).
3. **Finish Room**. Do not stop the video. Walk into the **corridor**, tap **Scan next room**,
   and scan the corridor. Bookmark the doors.
4. **Finish Room**, walk into **Room B**, **Scan next room**, scan, bookmark.
5. **Finish Survey**.
6. Check:
   - [ ] The plan shows all three spaces **connected**, and the banner says "Rooms connected in
     one coordinate system". If it says otherwise, note the message.
   - [ ] Walls and openings have recognizable dimensions.
   - [ ] The 3D Model tab shows the merged model.
   - [ ] The Video tab plays real footage of the whole walk, including the walk between rooms.
7. Link each bookmark to its door or window (Video tab › swipe right › Link).
8. **Force-quit the app and reopen it.** Open "Acceptance", tap a bookmarked door on the plan,
   and confirm the video plays at the correct moment.
9. Measure with tape or laser and enter the values as **Site-verified** (tap the item › Edit).
   The scan value must stay unchanged next to it.

## C. Measurement comparison sheet

Fill this in from the Measurements tab, or from the CSV columns `scan_width_mm`,
`verified_width_mm` and `delta_width_mm`.

| # | Item (room · name) | Scan (mm) | Tape/laser (mm) | Difference (mm) | Notes |
|---|---|---|---|---|---|
| 1 | Room A · Wall 1 length | | | | |
| 2 | Room A · Wall 2 length | | | | |
| 3 | Corridor · Wall 1 length | | | | |
| 4 | Room B · Wall 1 length | | | | |
| 5 | Door 1 width | | | | |
| 6 | Door 2 width | | | | |
| 7 | Window 1 width | | | | |
| 8 | Window 1 height | | | | |

Report: the largest absolute difference, the average difference, and any item RoomPlan did not
detect. Expect wall lengths within a few centimeters in good light. Openings vary more, which is
why the verified and manufacturing fields exist.

## D. What to send back if something fails

- Screenshot of the banner or error
- Export › JSON report (contains alignment issues, video stop reasons, dropped frame counts)
- iPhone model and iOS version (Settings screen shows the model identifier)
- If video misbehaves, try **Settings › Video frame source › Poll current frame** and repeat step A.3
