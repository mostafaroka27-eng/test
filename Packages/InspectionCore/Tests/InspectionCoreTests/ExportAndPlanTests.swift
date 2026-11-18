import XCTest
@testable import InspectionCore

final class ExportAndPlanTests: XCTestCase {
    // MARK: CSV

    func testCSVHeaderAndRows() {
        let p = SampleProjectFactory.make()
        let csv = MeasurementCSV.make(p)
        XCTAssertTrue(csv.hasPrefix("\u{FEFF}item_type,item_id,room,name,scan_width_mm"))
        let lines = csv.dropFirst().components(separatedBy: "\r\n").filter { !$0.isEmpty }
        XCTAssertEqual(lines.count, 1 + p.rooms.count + p.walls.count + p.openings.count)
        let columns = MeasurementCSV.columns.count
        for line in lines { XCTAssertEqual(parse(line).count, columns, line) }
    }

    func testCSVDoorRowKeepsScanAndVerifiedSeparate() throws {
        let p = SampleProjectFactory.make()
        let csv = MeasurementCSV.make(p, includeBOM: false)
        let rows = csv.components(separatedBy: "\r\n").map(parse)
        let header = rows[0]
        let door1 = try XCTUnwrap(rows.first { $0.count == header.count && $0[3] == "Door 1" })
        func col(_ n: String) -> String { door1[header.firstIndex(of: n)!] }
        XCTAssertEqual(col("item_type"), "door")
        XCTAssertEqual(col("scan_width_mm"), "893")
        XCTAssertEqual(col("scan_height_mm"), "2095")
        XCTAssertEqual(col("verified_width_mm"), "905")
        XCTAssertEqual(col("delta_width_mm"), "12")
        XCTAssertEqual(col("manufacturing_width_mm"), "")
        XCTAssertEqual(col("video_time_s"), "17.50")
        XCTAssertEqual(col("scan_status"), "detected")

        let door3 = try XCTUnwrap(rows.first { $0.count == header.count && $0[3] == "Door 3" })
        XCTAssertEqual(door3[header.firstIndex(of: "scan_height_mm")!], "", "undetected height stays empty")
        XCTAssertEqual(door3[header.firstIndex(of: "scan_status")!], "incomplete")

        let room = try XCTUnwrap(rows.first { $0.first == "room" })
        XCTAssertEqual(room[header.firstIndex(of: "room_area_m2")!], "15.12")
        XCTAssertEqual(room[header.firstIndex(of: "room_max_wall_height_m")!], "2.71")
    }

    func testCSVEscaping() {
        XCTAssertEqual(MeasurementCSV.escape("a,b"), "\"a,b\"")
        XCTAssertEqual(MeasurementCSV.escape("say \"hi\""), "\"say \"\"hi\"\"\"")
        XCTAssertEqual(MeasurementCSV.escape("=SUM(A1)"), "'=SUM(A1)")
        XCTAssertEqual(MeasurementCSV.escape("-12"), "-12")
        XCTAssertEqual(MeasurementCSV.escape("غرفة النوم"), "غرفة النوم")
    }

    // MARK: JSON report

    func testReportIsVersionedAndRoundTrips() throws {
        let p = SampleProjectFactory.make(now: Date(timeIntervalSince1970: 1_700_000_000))
        let report = ProjectReport(project: p, generator: "tests")
        let data = try report.encoded()
        let obj = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(obj["reportFormat"] as? String, "room-scan-inspector.project-report")
        XCTAssertEqual(obj["reportVersion"] as? Int, 1)
        let back = try ProjectReport.decode(data)
        XCTAssertEqual(back.project, p)
        XCTAssertEqual(back.summary.doorCount, 3)
        XCTAssertEqual(back.summary.windowCount, 2)
        XCTAssertEqual(back.summary.linkedBookmarkCount, 4)
        XCTAssertTrue(back.summary.isSample)
        let projectObj = try XCTUnwrap(obj["project"] as? [String: Any])
        XCTAssertNotNil(projectObj["outputs"] as? [String: Any], "outputs encode as an object keyed by kind")
    }

    // MARK: Plan geometry

    func testAreaAndContainment() {
        let r = SampleProjectFactory.rect(0, 0, 4, 3)
        XCTAssertEqual(PlanMath.polygonArea(r), 12, accuracy: 1e-9)
        XCTAssertTrue(PlanMath.contains(r, Point2D(x: 1, y: 1)))
        XCTAssertFalse(PlanMath.contains(r, Point2D(x: 5, y: 1)))
        let l: [Point2D] = [.init(x: 0, y: 0), .init(x: 4, y: 0), .init(x: 4, y: 1), .init(x: 1, y: 1), .init(x: 1, y: 3), .init(x: 0, y: 3)]
        XCTAssertEqual(PlanMath.polygonArea(l), 6, accuracy: 1e-9)
        XCTAssertFalse(PlanMath.contains(l, Point2D(x: 3, y: 2)))
    }

    func testTransformRoundTripAndFit() {
        let b = Bounds(minX: -2, minY: 1, maxX: 8, maxY: 6)
        let t = PlanTransform(content: b, viewWidth: 400, viewHeight: 300, margin: 20)
        XCTAssertEqual(t.scale, 36, accuracy: 1e-9) // min(360/10, 260/5)
        let p = Point2D(x: 3.3, y: 4.4)
        let back = t.toPlan(t.toView(p))
        XCTAssertEqual(back.x, p.x, accuracy: 1e-9); XCTAssertEqual(back.y, p.y, accuracy: 1e-9)
        let tl = t.toView(Point2D(x: b.minX, y: b.minY)), br = t.toView(Point2D(x: b.maxX, y: b.maxY))
        XCTAssertGreaterThanOrEqual(tl.x, 20 - 1e-9); XCTAssertLessThanOrEqual(br.x, 380 + 1e-9)
    }

    func testHitTestPrefersOpeningThenWallThenRoom() {
        let p = SampleProjectFactory.make()
        let door1 = p.openings.first { $0.name == "Door 1" }!
        XCTAssertEqual(PlanModel.hitTest(p, at: Point2D(x: 4.22, y: 1.4), tolerance: 0.2), .opening(door1.id))
        if case .wall? = PlanModel.hitTest(p, at: Point2D(x: 4.21, y: 3.0), tolerance: 0.2) {} else { XCTFail("expected wall") }
        XCTAssertEqual(PlanModel.hitTest(p, at: Point2D(x: 7, y: 1.5), tolerance: 0.2), .room(p.rooms[2].id))
        XCTAssertNil(PlanModel.hitTest(p, at: Point2D(x: 20, y: 20), tolerance: 0.2))
    }

    func testWallLabelsPreferVerifiedAndPointInward() {
        var p = SampleProjectFactory.make()
        let idx = p.walls.firstIndex { $0.roomID == p.rooms[0].id }!   // bottom wall y=0 of room 1
        p.walls[idx].dimensions.verified = ManualDimensions(widthMM: 4195)
        let label = PlanModel.wallLabels(p).first { $0.target == .wall(p.walls[idx].id) }!
        XCTAssertEqual(label.millimeters, 4195)
        XCTAssertTrue(label.isVerified)
        XCTAssertGreaterThan(label.anchor.y, 0, "label offset toward room interior")
        XCTAssertEqual(label.angle, 0, accuracy: 1e-9)
        let vertical = PlanModel.wallLabels(p).first { $0.target == .wall(p.walls[idx + 1].id) }!
        XCTAssertEqual(abs(vertical.angle), .pi / 2, accuracy: 1e-9)
        XCTAssertEqual(vertical.millimeters, 3600)
    }

    func testConvexHull() {
        let pts = [Point2D(x: 0, y: 0), .init(x: 2, y: 0), .init(x: 1, y: 1), .init(x: 2, y: 2), .init(x: 0, y: 2)]
        XCTAssertEqual(PlanMath.polygonArea(PlanMath.convexHull(pts)), 4, accuracy: 1e-9)
    }

    // MARK: Alignment

    func testAlignmentConnected() {
        let s = SampleProjectFactory.make()
        let facts = s.rooms.map { RoomCaptureFacts(roomID: $0.id, sessionEpoch: 0, footprint: $0.floorPolygon, trackingLimitedSeconds: 1) }
        let (report, status) = AlignmentAssessor.assess(facts, structureMerged: true)
        XCTAssertEqual(report.overall, .connected, "\(report.issues)")
        XCTAssertTrue(status.values.allSatisfy { $0 == .aligned })
    }

    func testAlignmentDetectsSessionResetOverlapAndGap() {
        let a = RoomCaptureFacts(roomID: UUID(), sessionEpoch: 0, footprint: SampleProjectFactory.rect(0, 0, 4, 4), trackingLimitedSeconds: 0)
        let overlapping = RoomCaptureFacts(roomID: UUID(), sessionEpoch: 0, footprint: SampleProjectFactory.rect(2, 0, 6, 4), trackingLimitedSeconds: 0)
        let reset = RoomCaptureFacts(roomID: UUID(), sessionEpoch: 1, footprint: SampleProjectFactory.rect(0, 0, 3, 3), trackingLimitedSeconds: 0)
        let (r1, s1) = AlignmentAssessor.assess([a, overlapping, reset], structureMerged: false, mergeError: "merge failed")
        XCTAssertEqual(r1.overall, .notConnected)
        XCTAssertEqual(s1[reset.roomID], .notAligned)
        XCTAssertEqual(s1[a.roomID], .suspect)
        XCTAssertTrue(r1.issues.contains { $0.code == .overlapsOtherRoom })
        XCTAssertTrue(r1.issues.contains { $0.code == .structureMergeFailed })

        let far = RoomCaptureFacts(roomID: UUID(), sessionEpoch: 0, footprint: SampleProjectFactory.rect(20, 0, 23, 3), trackingLimitedSeconds: 0)
        let (r2, s2) = AlignmentAssessor.assess([a, far], structureMerged: true)
        XCTAssertEqual(r2.overall, .connectedWithWarnings)
        XCTAssertEqual(s2[far.roomID], .suspect)
        XCTAssertTrue(r2.issues.contains { $0.code == .isolated })

        let (r3, s3) = AlignmentAssessor.assess([a], structureMerged: false)
        XCTAssertEqual(r3.overall, .single); XCTAssertEqual(s3[a.roomID], .single)
    }

    // MARK: Guidance

    func testGuidanceWarnsOnlyAfterGracePeriod() {
        var g = CaptureGuidance()
        g.updateTracking(.limited(reason: "excessiveMotion"), at: 10)
        XCTAssertNil(g.message(instruction: .normal, tracking: .limited(reason: "excessiveMotion"), at: 10.5))
        g.updateTracking(.limited(reason: "excessiveMotion"), at: 11.2)
        XCTAssertEqual(g.message(instruction: .normal, tracking: .limited(reason: "excessiveMotion"), at: 11.2)?.key, "guidance.trackingWeak.motion")
        XCTAssertEqual(g.limitedAccumulated, 1.2, accuracy: 1e-9)
        g.updateTracking(.normal, at: 12)
        XCTAssertEqual(g.message(instruction: .slowDown, tracking: .normal, at: 12)?.key, "guidance.slowDown")
        XCTAssertNil(g.message(instruction: .normal, tracking: .normal, at: 12))
        XCTAssertEqual(CaptureGuidance.wallsToRevisit([.init(completedEdges: 4, confidence: .high),
                                                       .init(completedEdges: 2, confidence: .high),
                                                       .init(completedEdges: 4, confidence: .low)]), 2)
    }

    // MARK: helpers

    /// Minimal RFC 4180 field splitter for assertions.
    private func parse(_ line: String) -> [String] {
        var fields: [String] = [], cur = "", quoted = false
        let it = Array(line)
        var i = 0
        while i < it.count {
            let ch = it[i]
            if quoted {
                if ch == "\"" { if i + 1 < it.count && it[i + 1] == "\"" { cur.append("\""); i += 1 } else { quoted = false } }
                else { cur.append(ch) }
            } else if ch == "\"" { quoted = true }
            else if ch == "," { fields.append(cur); cur = "" }
            else { cur.append(ch) }
            i += 1
        }
        fields.append(cur)
        return fields
    }
}
