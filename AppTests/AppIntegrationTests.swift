import XCTest
import AVFoundation
import PDFKit
@testable import RoomScanInspector
import InspectionCore

/// Simulator-runnable checks of the app layer (no LiDAR needed): sample
/// project creation, synthetic MP4 + bookmark seeking, reopening via a fresh
/// library instance, and all generated exports.
@MainActor
final class AppIntegrationTests: XCTestCase {
    var root: URL!

    override func setUp() async throws {
        root = FileManager.default.temporaryDirectory.appendingPathComponent("apptests-\(UUID().uuidString)")
    }

    override func tearDown() async throws { try? FileManager.default.removeItem(at: root) }

    private func makeLibrary() throws -> ProjectLibrary {
        ProjectLibrary(store: try ProjectStore(rootURL: root))
    }

    func testSampleProjectReopensWithVideoAndModel() async throws {
        let library = try makeLibrary()
        let created = await library.createSample()
        let sample = try XCTUnwrap(created)

        // "Restart": a new library over the same folder.
        let reopenedLibrary = try makeLibrary()
        let p = try XCTUnwrap(reopenedLibrary.load(sample.id))
        XCTAssertTrue(p.isSample)
        XCTAssertEqual(p.rooms.count, 3)
        XCTAssertEqual(reopenedLibrary.store.verifyOutputs(of: p), [])
        let videoURL = try XCTUnwrap(reopenedLibrary.store.existingOutputURL(.video, in: p))
        XCTAssertNotNil(reopenedLibrary.store.existingOutputURL(.model3D, in: p))

        let asset = AVURLAsset(url: videoURL)
        let duration = try await asset.load(.duration).seconds
        XCTAssertEqual(duration, SampleProjectFactory.videoDuration, accuracy: 0.2)
    }

    /// Seeking to a bookmark lands on the frame at that media time.
    func testBookmarkSeekIsFrameAccurate() async throws {
        let library = try makeLibrary()
        let created = await library.createSample()
        let sample = try XCTUnwrap(created)
        let door = try XCTUnwrap(sample.openings.first { $0.number == 1 && $0.kind == .door })
        let seek = try XCTUnwrap(BookmarkService.seekTime(for: .opening(door.id), in: sample))
        XCTAssertEqual(seek, 17.5, accuracy: 1e-9)

        let url = try XCTUnwrap(library.store.existingOutputURL(.video, in: sample))
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: url))
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero
        let (_, actual) = try await generator.image(at: CMTime(seconds: seek, preferredTimescale: 600))
        XCTAssertEqual(actual.seconds, seek, accuracy: 1.0 / SampleProjectFactory.videoFrameRate)
    }

    func testAllGeneratedExportsSucceedAndAreIndependent() async throws {
        let library = try makeLibrary()
        let created = await library.createSample()
        var p = try XCTUnwrap(created)
        let service = ExportService(store: library.store)

        let pdf = try service.produce(.pdf, project: &p)
        let doc = try XCTUnwrap(PDFDocument(url: pdf))
        XCTAssertGreaterThanOrEqual(doc.pageCount, 2)
        XCTAssertTrue(doc.page(at: 0)?.string?.contains("Door 1") ?? false, "plan page shows opening labels")

        let csv = try String(contentsOf: try service.produce(.csv, project: &p), encoding: .utf8)
        XCTAssertTrue(csv.contains("scan_width_mm"))

        let json = try Data(contentsOf: try service.produce(.json, project: &p))
        XCTAssertEqual(try ProjectReport.decode(json).reportVersion, ProjectReport.version)

        XCTAssertNoThrow(try service.produce(.usdz, project: &p))
        XCTAssertNoThrow(try service.produce(.mp4, project: &p))

        // Remove the video: MP4 export fails, others still work.
        try FileManager.default.removeItem(at: library.store.url(for: "video.mp4", in: p.id))
        XCTAssertThrowsError(try service.produce(.mp4, project: &p))
        XCTAssertNoThrow(try service.produce(.csv, project: &p))
    }

    func testPlanTransformMatchesPDFPage() {
        let p = SampleProjectFactory.make()
        let bounds = PlanModel.bounds(of: p)!
        let t = PlanTransform(content: bounds, viewWidth: Double(PDFPlanRenderer.pageSize.width - 80),
                              viewHeight: Double(PDFPlanRenderer.pageSize.height - 190), margin: 40)
        let tl = t.toView(Point2D(x: bounds.minX, y: bounds.minY))
        XCTAssertGreaterThanOrEqual(tl.x, 39.9)
        XCTAssertGreaterThanOrEqual(tl.y, 39.9)
    }
}
