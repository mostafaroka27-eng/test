package com.roomscan.core

import java.io.File
import java.nio.file.Files
import java.time.Instant
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class UnitsTests {
    @Test fun metersToMillimetersRounding() {
        assertEquals(893, Units.millimetersFromMeters(0.8934))
        assertEquals(1063, Units.millimetersFromMeters(1.0625))
        assertEquals(2100, Units.millimetersFromMeters(2.1))
        assertEquals(0, Units.millimetersFromMeters(0.0))
        assertEquals(-63, Units.millimetersFromMeters(-0.0625))
    }

    @Test fun formatting() {
        assertEquals("4.20", Units.format(4.2049, LengthUnit.meters))
        assertEquals("4.21", Units.format(4.2051, LengthUnit.meters))
        assertEquals("900", Units.format(0.9, LengthUnit.millimeters))
        assertEquals("2.150", Units.formatMillimeters(2150, LengthUnit.meters))
        assertNull(Units.format(null, LengthUnit.meters))
        assertNull(Units.format(Double.NaN, LengthUnit.meters))
        assertEquals("15.12", Units.formatArea(15.123))
    }

    @Test fun parseMillimeters() {
        assertEquals(2150, Units.parseMillimeters("2150"))
        assertEquals(2150, Units.parseMillimeters(" 2,150 mm"))
        assertEquals(2150, Units.parseMillimeters("2 150"))
        assertEquals(2150, Units.parseMillimeters("٢١٥٠"))
        assertEquals(905, Units.parseMillimeters("٩٠٥ مم"))
        for (bad in listOf("", "-5", "0", "21.5", "abc", "200000")) assertNull(Units.parseMillimeters(bad), bad)
    }

    @Test fun parseMeters() {
        assertEquals(2450, Units.parseMetersToMillimeters("2.45"))
        assertEquals(2450, Units.parseMetersToMillimeters("2,45 m"))
        assertEquals(2750, Units.parseMetersToMillimeters("٢٫٧٥"))
        assertNull(Units.parseMetersToMillimeters("x"))
    }

    @Test fun timeFormat() {
        assertEquals("0:00.0", TimeFormat.clock(0.0))
        assertEquals("0:17.5", TimeFormat.clock(17.55))
        assertEquals("2:05.0", TimeFormat.clock(125.0))
        assertEquals("--:--", TimeFormat.clock(-1.0))
    }

    @Test fun dimensionTiersAreIndependent() {
        var d = DimensionRecord(scan = ScanDimensions(widthM = 0.893, heightM = 2.095, confidence = ScanConfidence.high))
        d = d.copy(verified = ManualDimensions(widthMM = 905, heightMM = 2100))
        assertEquals(893, d.scan?.widthMM)
        assertEquals(12, d.widthDeltaMM)
        assertEquals(5, d.heightDeltaMM)
        assertEquals(905 to MeasurementSource.manualVerified, d.bestWidthMM)
        d = d.copy(manufacturing = ManualDimensions(widthMM = 900))
        assertEquals(MeasurementSource.manufacturing, d.bestWidthMM?.second)
        assertEquals(905, d.verified?.widthMM)
        assertEquals(893, d.scan?.widthMM)
    }
}

class TimebaseTests {
    @Test fun clockRemovesInterruptions() {
        val c = RecordingClock()
        assertNull(c.mediaTime(100.0))
        c.start(100.0)
        assertEquals(5.0, c.mediaTime(105.0))
        c.pause(110.0)
        assertEquals(10.0, c.mediaTime(115.0), "clamps while paused")
        assertEquals(8.0, c.resume(118.0, "background"))
        assertEquals(11.0, c.mediaTime(119.0))
        assertEquals(listOf(VideoInterruption(10.0, 8.0, "background")), c.interruptions)
    }

    @Test fun admissionPacesFrames() {
        val c = RecordingClock().apply { start(0.0) }
        val a = FrameAdmission(30.0)
        var written = 0
        var t = 0.0
        while (t < 1.0) {
            val d = a.decide(t, c)
            if (d is FrameAdmission.Decision.Write) { a.didWrite(d.mediaTime); written++ }
            t += 1.0 / 60
        }
        assertTrue(written in 29..31, "wrote $written")
        assertEquals(FrameAdmission.Decision.SkipNonMonotonic, a.decide(0.1, c))
        c.pause(2.0)
        assertEquals(FrameAdmission.Decision.SkipPaused, a.decide(2.5, c))
    }

    @Test fun storageBudget() {
        val b = StorageBudget()
        assertEquals(StorageBudget.Verdict.MustStop, b.evaluate(400_000_000))
        assertIs<StorageBudget.Verdict.Low>(b.evaluate(600_000_000))
        assertTrue(b.canStart(10_000_000_000))
        assertFalse(b.canStart(550_000_000))
    }
}

class BookmarkTests {
    private val sample = SampleProjectFactory.make(Instant.parse("2026-11-18T09:00:00Z"))

    @Test fun seekForSampleDoor() {
        val door1 = sample.openings.first { it.name == "Door 1" }
        assertEquals(17.5, BookmarkService.seekTime(LinkTarget.Opening(door1.id), sample))
        assertEquals(15.5, BookmarkService.seekTime(LinkTarget.Opening(door1.id), sample, preRoll = 2.0))
    }

    @Test fun assignMovesLink() {
        val door1 = LinkTarget.Opening(sample.openings.first { it.name == "Door 1" }.id)
        val unassigned = sample.bookmarks.first { it.target == null }
        val p = BookmarkService.assign(unassigned.id, door1, sample)
        assertEquals(unassigned.id, BookmarkService.bookmarkFor(door1, p)?.id)
        assertEquals(1, p.bookmarks.count { it.target == door1 })
        assertFailsWith<BookmarkException> { BookmarkService.assign(UUID.randomUUID(), door1, sample) }
        assertFailsWith<BookmarkException> { BookmarkService.assign(unassigned.id, LinkTarget.Wall(UUID.randomUUID()), sample) }
    }

    @Test fun reviewBookmarkMustBeInsideVideo() {
        assertFailsWith<BookmarkException> { BookmarkService.addReviewBookmark(61.0, "x", sample) }
        val (b, p) = BookmarkService.addReviewBookmark(12.0, "x", sample)
        assertEquals(Bookmark.Origin.addedInReview, b.origin)
        assertEquals(p.bookmarks.sortedBy { it.mediaTime }, p.bookmarks)
    }

    @Test fun makeBookmarkUsesSharedClock() {
        val c = RecordingClock()
        assertNull(BookmarkService.makeBookmark(5.0, c, "b", 1))
        c.start(3.0)
        assertEquals(2.0, BookmarkService.makeBookmark(5.0, c, "b", 1)?.mediaTime)
    }
}

class CrossPlatformJsonTests {
    private val fixture = File(System.getProperty("fixtureDir") ?: "../../shared/fixtures", "project-v1.json")

    @Test fun decodesProjectWrittenByIPhoneApp() {
        val p = ProjectJson.decode(fixture.readText())
        assertEquals("فيلا العامرات – الدور الأرضي", p.name)
        assertEquals(UUID.fromString("0a1b2c3d-4e5f-4061-8728-394a5b6c7d8e"), p.id)
        assertEquals(Instant.parse("2026-11-18T09:14:00Z"), p.createdAt)
        val door = p.openings.single()
        assertEquals(893, door.dimensions.scan?.widthMM)
        assertEquals(905, door.dimensions.verified?.widthMM)
        assertEquals(12, door.dimensions.widthDeltaMM)
        assertEquals(MeasurementSource.roomPlan, door.dimensions.scan?.source)
        assertEquals(LinkTarget.Opening(door.id), p.bookmarks[0].target)
        assertNull(p.bookmarks[1].target)
        assertEquals(42.0, p.bookmarks[1].mediaTime)
        assertEquals(OutputState.failed, p.outputs[OutputKind.pdfPlan]?.state)
        assertEquals(2, p.nextOpeningNumber[OpeningKind.door])
        assertTrue(p.walls.single().dimensions.scan!!.isPartiallyObserved)
        assertEquals(AlignmentReport.Overall.connectedWithWarnings, p.alignment?.overall)
        assertEquals(17.5, BookmarkService.seekTime(LinkTarget.Opening(door.id), p))
    }

    @Test fun writesTheSameShapeTheIPhoneAppReads() {
        val p = ProjectJson.decode(fixture.readText())
        val text = ProjectJson.encode(p)
        assertFalse(text.contains("null"), "null values must be omitted like Swift Codable")
        assertTrue(text.contains("\"createdAt\": \"2026-11-18T09:14:00Z\""))
        assertTrue(text.contains("\"0A1B2C3D-4E5F-4061-8728-394A5B6C7D8E\""), "UUIDs upper-case")
        assertTrue(text.contains("\"roomID\""))
        assertTrue(Regex("\"outputs\": \\{\\s*\"model3D\"").containsMatchIn(text), "enum-keyed maps are JSON objects")
        assertEquals(p, ProjectJson.decode(text))
    }

    @Test fun rejectsNewerSchema() {
        val newer = fixture.readText().replace("\"schemaVersion\" : 1", "\"schemaVersion\" : 2")
        assertFailsWith<NewerSchemaException> { ProjectJson.decode(newer) }
    }

    @Test fun sampleRoundTripsLosslessly() {
        val s = SampleProjectFactory.make()
        assertEquals(s, ProjectJson.decode(ProjectJson.encode(s)))
    }
}

class StoreTests {
    private fun tempStore() = ProjectStore(Files.createTempDirectory("store").toFile())

    @Test fun createSaveReopen() {
        val store = tempStore()
        val p = store.create("  Villa  ")
        assertEquals("Villa", p.name)
        assertTrue(store.directory(p.id).name == p.id.toString().uppercase())
        val renamed = store.rename(p.id, "Villa 2")
        assertEquals("Villa 2", ProjectStore(store.root).load(p.id).name)
        assertEquals(listOf(renamed.id), store.list().projects.map { it.id })
        assertFailsWith<ProjectStore.StoreException.InvalidName> { store.create("   ") }
    }

    @Test fun corruptFileFallsBackToBackup() {
        val store = tempStore()
        val p = store.create("A")
        store.save(p.copy(notes = "second"))
        File(store.directory(p.id), "project.json").writeText("{ broken")
        assertEquals("A", store.load(p.id).name)
        File(store.directory(p.id), "project.json.bak").writeText("{ broken")
        assertFailsWith<ProjectStore.StoreException.CorruptProject> { store.load(p.id) }
        assertEquals(listOf(p.id.toString().uppercase()), store.list().unreadable)
    }

    @Test fun failedOutputIsIsolated() {
        val store = tempStore()
        var p = store.create("A")
        p = store.writeOutput(OutputKind.csvMeasurements, "exports/m.csv", p) { it.writeText("ok") }
        assertFailsWith<IllegalStateException> {
            store.writeOutput(OutputKind.pdfPlan, "exports/plan.pdf", p) { error("boom") }
        }
        val reloaded = store.load(p.id)
        assertEquals(OutputState.ready, reloaded.outputs[OutputKind.csvMeasurements]?.state)
        assertEquals(OutputState.failed, reloaded.outputs[OutputKind.pdfPlan]?.state)
        assertNotNull(store.existingOutput(OutputKind.csvMeasurements, reloaded))
        File(store.directory(p.id), "exports/m.csv").delete()
        assertEquals(listOf(OutputKind.csvMeasurements), store.verifyOutputs(reloaded))
    }
}

class ExportTests {
    private val sample = SampleProjectFactory.make(Instant.parse("2026-11-18T09:00:00Z"))

    @Test fun csvShape() {
        val csv = MeasurementCsv.make(sample)
        assertTrue(csv.startsWith("﻿item_type,item_id"))
        val lines = csv.removePrefix("﻿").split("\r\n").filter { it.isNotEmpty() }
        assertEquals(1 + 3 + 12 + 5, lines.size)
        val door1 = lines.first { it.contains(",Door 1,") }.split(",")
        assertEquals("893", door1[4]); assertEquals("905", door1[8]); assertEquals("12", door1[10]); assertEquals("17.50", door1[18])
        assertEquals("incomplete", MeasurementCsv.status(sample.openings.first { it.name == "Door 3" }.dimensions.scan))
        assertEquals("'=1+1", MeasurementCsv.escape("=1+1"))
        assertEquals("\"a,\"\"b\"\"\"", MeasurementCsv.escape("a,\"b\""))
        assertEquals("-5", MeasurementCsv.escape("-5"))
    }

    @Test fun reportRoundTrip() {
        val r = ProjectReport.make(sample, "test")
        val back = ProjectReport.decode(r.encoded())
        assertEquals(ProjectReport.FORMAT, back.reportFormat)
        assertEquals(3, back.summary.doorCount)
        assertEquals(emptyList(), back.summary.openingsWithoutScanWidth, "Door 3 has a width, only its height is missing")
        assertEquals(sample, back.project)
    }
}

class PlanTests {
    private val sample = SampleProjectFactory.make()

    @Test fun hitTestPrefersOpenings() {
        val door1 = sample.openings.first { it.name == "Door 1" }
        assertEquals(LinkTarget.Opening(door1.id), PlanModel.hitTest(sample, Point2D(4.22, 1.4), 0.2))
        assertIs<LinkTarget.Wall>(PlanModel.hitTest(sample, Point2D(4.2, 3.0), 0.2))
        assertIs<LinkTarget.Room>(PlanModel.hitTest(sample, Point2D(2.0, 2.0), 0.2))
        assertNull(PlanModel.hitTest(sample, Point2D(20.0, 20.0), 0.2))
    }

    @Test fun transformRoundTrip() {
        val t = PlanTransform.fit(PlanModel.bounds(sample)!!, 800.0, 400.0, 20.0)
        val p = Point2D(3.3, 1.1)
        val back = t.toPlan(t.toView(p))
        assertEquals(p.x, back.x, 1e-9); assertEquals(p.y, back.y, 1e-9)
    }

    @Test fun sampleRoomsAreConnected() {
        val facts = sample.rooms.map { RoomCaptureFacts(it.id, 0, it.floorPolygon, 0.0) }
        val (report, _) = AlignmentAssessor.assess(facts, structureMerged = false)
        assertEquals(AlignmentReport.Overall.connected, report.overall)
        val moved = facts.mapIndexed { i, f -> if (i == 2) f.copy(sessionEpoch = 1) else f }
        assertEquals(AlignmentReport.Overall.notConnected, AlignmentAssessor.assess(moved, false).first.overall)
    }
}

class ManualCaptureTests {
    private fun tap(x: Double, y: Double, z: Double, q: HitQuality = HitQuality.plane) = TapPoint(Vec3(x, y, z), q)

    @Test fun roomFromCornersAndDoorSnapsToWall() {
        var room = RoomOutlineDraft()
        for ((x, z) in listOf(0.0 to 0.0, 4.0 to 0.0, 4.0 to 3.0, 0.0 to 3.0)) room = room.add(tap(x, -1.4, z))
        room = room.copy(wallHeight = tap(1.0, -1.4, 0.0) to tap(1.0, 1.31, 0.0))
        val (p1, roomId) = ManualSurveyBuilder.addRoom(SurveyProject(name = "T"), room, "Room 1", 0.0, 30.0)
        assertEquals(12.0, p1.room(roomId)!!.floorAreaM2!!, 1e-9)
        assertEquals(4, p1.walls.size)
        assertEquals(4000, p1.walls[0].dimensions.scan?.widthMM)
        assertEquals(2710, p1.walls[0].dimensions.scan?.heightMM)
        assertEquals(ScanConfidence.medium, p1.walls[0].dimensions.scan?.confidence)
        assertEquals(MeasurementSource.arcoreTap, p1.walls[0].dimensions.scan?.source)

        var door = OpeningDraft(OpeningKind.door)
        door = door.add(tap(4.03, -1.39, 1.0)).add(tap(4.02, -1.41, 1.905, HitQuality.point)).add(tap(4.0, 0.69, 1.4))
        val (p2, o) = ManualSurveyBuilder.addOpening(p1, roomId, door, room.floorY)
        assertEquals("Door 1", o.name)
        assertEquals(p1.walls[1].id, o.wallId, "snapped to the x = 4 wall")
        assertEquals(4.0, o.start.x, 1e-9)
        assertEquals(905, o.dimensions.scan?.widthMM)
        assertEquals(2100, o.dimensions.scan?.heightMM)
        assertEquals(0.0, o.sillHeightM)
        assertEquals(ScanConfidence.low, o.dimensions.scan?.confidence, "a feature-point tap lowers confidence")
        assertEquals(2, p2.nextOpeningNumber[OpeningKind.door])
    }

    @Test fun windowSillAndMissingTop() {
        var room = RoomOutlineDraft()
        for ((x, z) in listOf(0.0 to 0.0, 3.0 to 0.0, 3.0 to 3.0)) room = room.add(tap(x, 0.0, z))
        val (p, roomId) = ManualSurveyBuilder.addRoom(SurveyProject(name = "T"), room, "R", null, null)
        assertNull(p.walls[0].dimensions.scan?.heightM)
        val w = OpeningDraft(OpeningKind.window).add(tap(1.0, 0.9, 0.0)).add(tap(2.2, 0.9, 0.0))
        val (_, o) = ManualSurveyBuilder.addOpening(p, roomId, w, room.floorY)
        assertEquals(1200, o.dimensions.scan?.widthMM)
        assertNull(o.dimensions.scan?.heightM)
        assertEquals(0.9, o.sillHeightM!!, 1e-9)
        assertEquals("incomplete", MeasurementCsv.status(o.dimensions.scan))
        val withHeight = ManualSurveyBuilder.setRoomWallHeight(p, roomId, tap(0.5, 0.0, 0.5), tap(0.5, 2.65, 0.5, HitQuality.point))
        assertEquals(2650, withHeight.walls[0].dimensions.scan?.heightMM)
        assertEquals(3000, withHeight.walls[0].dimensions.scan?.widthMM, "length untouched")
        assertEquals(ScanConfidence.low, withHeight.walls[0].dimensions.scan?.confidence)
        assertEquals(2.65, withHeight.rooms[0].maxWallHeightM!!, 1e-9)
    }
}
