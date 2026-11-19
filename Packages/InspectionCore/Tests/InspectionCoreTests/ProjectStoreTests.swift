import XCTest
@testable import InspectionCore

final class ProjectStoreTests: XCTestCase {
    var root: URL!

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory.appendingPathComponent("store-\(UUID().uuidString)")
    }
    override func tearDownWithError() throws { try? FileManager.default.removeItem(at: root) }

    func testCreateRenameListDelete() throws {
        let store = try ProjectStore(rootURL: root)
        let a = try store.create(name: "  Villa 12 – Majlis ")
        XCTAssertEqual(a.name, "Villa 12 – Majlis")
        XCTAssertThrowsError(try store.create(name: "   "))
        let b = try store.create(name: "شقة ١٤")
        XCTAssertEqual(store.list().projects.count, 2)
        // Dates are stored to the whole second (shared format with Android),
        // so step past the second b was created in before checking the order.
        Thread.sleep(forTimeInterval: 1.1)
        let renamed = try store.rename(a.id, to: "Villa 12 – Majlis rev")
        XCTAssertEqual(renamed.name, "Villa 12 – Majlis rev")
        XCTAssertEqual(store.list().projects.first?.id, a.id, "most recently updated first")
        try store.delete(b.id)
        XCTAssertEqual(store.list().projects.map(\.id), [a.id])
    }

    /// Simulates an app restart: a brand-new store instance over the same folder
    /// restores every field and every output file.
    func testReopenAfterRestartRestoresEverything() throws {
        let store = try ProjectStore(rootURL: root)
        var p = try store.create(name: "Reopen")
        let sample = SampleProjectFactory.make(now: Date(timeIntervalSince1970: 1_700_000_000))
        p.rooms = sample.rooms; p.walls = sample.walls; p.openings = sample.openings
        p.bookmarks = sample.bookmarks; p.nextOpeningNumber = sample.nextOpeningNumber
        p.video = sample.video; p.alignment = sample.alignment
        try store.save(p)
        try store.writeOutput(.model3D, relativePath: "model.usdz", in: &p) { try Data("usdz".utf8).write(to: $0) }
        try store.writeOutput(.video, relativePath: "video.mp4", in: &p) { try Data("mp4".utf8).write(to: $0) }
        try store.writeOutput(.rawRoomData, relativePath: "rooms/room-1.json", in: &p) { try Data("{}".utf8).write(to: $0) }

        let reopened = try ProjectStore(rootURL: root)
        let q = try reopened.load(p.id)
        XCTAssertEqual(q.rooms, p.rooms)
        XCTAssertEqual(q.walls, p.walls)
        XCTAssertEqual(q.openings, p.openings)
        XCTAssertEqual(q.bookmarks, p.bookmarks)
        XCTAssertEqual(q.video, p.video)
        XCTAssertEqual(q.nextOpeningNumber, p.nextOpeningNumber)
        XCTAssertEqual(q.alignment, p.alignment)
        for kind in [OutputKind.model3D, .video, .rawRoomData] {
            XCTAssertNotNil(reopened.existingOutputURL(kind, in: q), "\(kind) should resolve after restart")
        }
        XCTAssertEqual(reopened.verifyOutputs(of: q), [])
        let door = q.openings.first { $0.name == "Door 1" }!
        XCTAssertEqual(BookmarkService.seekTime(for: .opening(door.id), in: q)!, 17.5, accuracy: 1e-9)
    }

    func testFailedOutputDoesNotDestroyOthers() throws {
        let store = try ProjectStore(rootURL: root)
        var p = try store.create(name: "Failure")
        try store.writeOutput(.model3D, relativePath: "model.usdz", in: &p) { try Data("good".utf8).write(to: $0) }
        struct DiskFull: Error {}
        XCTAssertThrowsError(try store.writeOutput(.pdfPlan, relativePath: "exports/plan.pdf", in: &p) { _ in throw DiskFull() })
        // A failing re-export of an existing output keeps the old file.
        XCTAssertThrowsError(try store.writeOutput(.model3D, relativePath: "model.usdz", in: &p) { _ in throw DiskFull() })

        let q = try store.load(p.id)
        XCTAssertEqual(q.outputs[.pdfPlan]?.state, .failed)
        XCTAssertNotNil(q.outputs[.pdfPlan]?.message)
        XCTAssertEqual(q.outputs[.model3D]?.state, .failed, "status shows the retry is needed")
        let modelURL = store.url(for: "model.usdz", in: p.id)
        XCTAssertEqual(try String(contentsOf: modelURL, encoding: .utf8), "good", "previous good file survives")
        XCTAssertEqual(ProjectSummary(q).failedOutputs, [.model3D, .pdfPlan])

        // Retry succeeds.
        var r = q
        try store.writeOutput(.pdfPlan, relativePath: "exports/plan.pdf", in: &r) { try Data("%PDF".utf8).write(to: $0) }
        XCTAssertEqual(try store.load(p.id).outputs[.pdfPlan]?.state, .ready)
    }

    func testMissingFileIsReportedAfterReopen() throws {
        let store = try ProjectStore(rootURL: root)
        var p = try store.create(name: "Missing")
        try store.writeOutput(.video, relativePath: "video.mp4", in: &p) { try Data("x".utf8).write(to: $0) }
        try FileManager.default.removeItem(at: store.url(for: "video.mp4", in: p.id))
        XCTAssertEqual(store.verifyOutputs(of: try store.load(p.id)), [.video])
        XCTAssertNil(store.existingOutputURL(.video, in: p))
        XCTAssertThrowsError(try store.registerOutput(.video, relativePath: "video.mp4", in: &p))
    }

    func testCorruptProjectFallsBackToBackup() throws {
        let store = try ProjectStore(rootURL: root)
        var p = try store.create(name: "Backup")
        p.notes = "second save"
        try store.save(p)       // .bak now holds the first save
        p.notes = "third save"
        try store.save(p)       // .bak holds the second save
        let file = store.directory(for: p.id).appendingPathComponent(ProjectStore.projectFileName)
        try Data("{ not json".utf8).write(to: file)
        XCTAssertEqual(try store.load(p.id).notes, "second save")
    }

    func testUnreadableFolderIsListedNotHidden() throws {
        let store = try ProjectStore(rootURL: root)
        let id = UUID()
        let dir = store.directory(for: id)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try Data("garbage".utf8).write(to: dir.appendingPathComponent(ProjectStore.projectFileName))
        XCTAssertEqual(store.list().unreadable, [id.uuidString])
    }

    func testNewerSchemaIsRejected() throws {
        var json = String(data: try ProjectStore.makeEncoder().encode(SurveyProject(name: "x")), encoding: .utf8)!
        json = json.replacingOccurrences(of: "\"schemaVersion\" : 1", with: "\"schemaVersion\" : 99")
        XCTAssertThrowsError(try ProjectStore.makeDecoder().decode(SurveyProject.self, from: Data(json.utf8)))
    }
}
