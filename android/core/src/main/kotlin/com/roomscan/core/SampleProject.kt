package com.roomscan.core

import java.time.Instant

/**
 * The same clearly labeled synthetic sample as SampleProject.swift (two rooms +
 * corridor). Not a scan. The app generates the matching 60 s video on device.
 */
object SampleProjectFactory {
    const val SAMPLE_NAME = "SAMPLE – Two rooms and corridor (synthetic)"
    const val VIDEO_DURATION = 60.0
    const val VIDEO_WIDTH = 640
    const val VIDEO_HEIGHT = 480
    const val VIDEO_FRAME_RATE = 10.0

    data class Segment(val start: Double, val end: Double, val caption: String)

    val videoSegments = listOf(
        Segment(0.0, 20.0, "Room 1 – Bedroom"),
        Segment(20.0, 32.0, "Corridor"),
        Segment(32.0, 60.0, "Room 2 – Living"),
    )

    fun make(now: Instant = Dates.now()): SurveyProject {
        var p = SurveyProject(name = SAMPLE_NAME, createdAt = now, updatedAt = now, isSample = true,
            notes = "Synthetic sample for preview and testing. Not measured on site.")

        val roomA = RoomRecord(name = "Room 1 – Bedroom", scanIndex = 1, sectionLabel = "bedroom", floorPolygon = rect(0.0, 0.0, 4.2, 3.6),
            maxWallHeightM = 2.71, minWallHeightM = 2.69, captureStartMediaTime = 0.0, captureEndMediaTime = 20.0, alignment = RoomAlignmentStatus.aligned)
        val corridor = RoomRecord(name = "Corridor", scanIndex = 2, floorPolygon = rect(4.3, 0.0, 5.5, 4.0),
            maxWallHeightM = 2.70, minWallHeightM = 2.68, captureStartMediaTime = 20.0, captureEndMediaTime = 32.0, alignment = RoomAlignmentStatus.aligned)
        val roomB = RoomRecord(name = "Room 2 – Living", scanIndex = 3, sectionLabel = "livingRoom", floorPolygon = rect(5.6, 0.0, 9.4, 3.4),
            maxWallHeightM = 2.72, minWallHeightM = 2.70, captureStartMediaTime = 32.0, captureEndMediaTime = 60.0, alignment = RoomAlignmentStatus.aligned)

        fun walls(room: RoomRecord, height: Double, partialIndex: Int? = null): List<WallRecord> {
            val poly = room.floorPolygon
            return poly.indices.map { i ->
                val a = poly[i]; val b = poly[(i + 1) % poly.size]
                val partial = i == partialIndex
                WallRecord(roomId = room.id, name = "${room.name} · Wall ${i + 1}", start = a, end = b,
                    dimensions = DimensionRecord(scan = ScanDimensions(widthM = a.distanceTo(b), heightM = height,
                        confidence = if (partial) ScanConfidence.medium else ScanConfidence.high,
                        completedEdges = if (partial) listOf("bottom", "left", "right") else listOf("top", "bottom", "left", "right"))))
            }
        }
        p = p.copy(rooms = listOf(roomA, corridor, roomB),
            walls = walls(roomA, 2.71) + walls(corridor, 2.70, partialIndex = 2) + walls(roomB, 2.72))

        fun add(kind: OpeningKind, room: RoomRecord, wall: Int, a: Point2D, b: Point2D, height: Double?, sill: Double?,
                confidence: ScanConfidence = ScanConfidence.high, verified: ManualDimensions? = null): OpeningRecord {
            val (n, numbered) = p.allocateOpeningNumber(kind)
            val o = OpeningRecord(roomId = room.id, wallId = numbered.walls.filter { it.roomId == room.id }.getOrNull(wall)?.id,
                kind = kind, isOpenDoor = if (kind == OpeningKind.door) false else null, number = n, name = "${kind.defaultEnglishPrefix} $n",
                start = a, end = b, sillHeightM = sill,
                dimensions = DimensionRecord(scan = ScanDimensions(widthM = a.distanceTo(b), heightM = height, confidence = confidence), verified = verified))
            p = numbered.copy(openings = numbered.openings + o)
            return o
        }

        val door1 = add(OpeningKind.door, roomA, 1, Point2D(4.2, 1.0), Point2D(4.2, 1.893), 2.095, 0.0,
            verified = ManualDimensions(widthMM = 905, heightMM = 2100, method = "laser", note = "Sample verified value", enteredAt = now))
        val door2 = add(OpeningKind.door, corridor, 1, Point2D(5.5, 2.2), Point2D(5.5, 3.012), 2.09, 0.0)
        add(OpeningKind.door, corridor, 2, Point2D(5.35, 4.0), Point2D(4.45, 4.0), null, 0.0, ScanConfidence.low)
        val win1 = add(OpeningKind.window, roomA, 0, Point2D(1.2, 0.0), Point2D(2.6, 0.0), 1.2, 0.9)
        add(OpeningKind.window, roomB, 1, Point2D(9.4, 1.0), Point2D(9.4, 2.2), 1.4, 0.8, ScanConfidence.medium)

        return p.copy(
            bookmarks = listOf(
                Bookmark(mediaTime = 8.0, label = "Window", createdAt = now, roomScanIndex = 1, target = LinkTarget.Opening(win1.id), origin = Bookmark.Origin.sample),
                Bookmark(mediaTime = 17.5, label = "Door to corridor", createdAt = now, roomScanIndex = 1, target = LinkTarget.Opening(door1.id), origin = Bookmark.Origin.sample),
                Bookmark(mediaTime = 30.0, label = "Door to living", createdAt = now, roomScanIndex = 2, target = LinkTarget.Opening(door2.id), origin = Bookmark.Origin.sample),
                Bookmark(mediaTime = 40.0, label = "Living overview", createdAt = now, roomScanIndex = 3, target = LinkTarget.Room(roomB.id), origin = Bookmark.Origin.sample),
                Bookmark(mediaTime = 50.0, label = "Unassigned bookmark", createdAt = now, roomScanIndex = 3, target = null, origin = Bookmark.Origin.sample),
            ),
            video = VideoInfo(relativePath = "video.mp4", durationSeconds = VIDEO_DURATION,
                framesWritten = (VIDEO_DURATION * VIDEO_FRAME_RATE).toInt(), framesDropped = 0,
                pixelWidth = VIDEO_WIDTH, pixelHeight = VIDEO_HEIGHT, rotationDegrees = 0, codec = "h264",
                nominalFrameRate = VIDEO_FRAME_RATE, startedAt = now, isSynthetic = true),
            alignment = AlignmentReport(AlignmentReport.Overall.connected, emptyList(), structureMerged = false),
        )
    }

    fun rect(x0: Double, y0: Double, x1: Double, y1: Double) =
        listOf(Point2D(x0, y0), Point2D(x1, y0), Point2D(x1, y1), Point2D(x0, y1))
}
