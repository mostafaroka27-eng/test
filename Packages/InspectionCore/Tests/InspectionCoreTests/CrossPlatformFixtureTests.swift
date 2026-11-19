import XCTest
@testable import InspectionCore

/// The same fixture is decoded by the Android core tests
/// (android/core/src/test/.../CoreTests.kt), so a project file moves between
/// the iPhone and Android apps without conversion.
final class CrossPlatformFixtureTests: XCTestCase {
    private var fixtureURL: URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()   // InspectionCoreTests
            .deletingLastPathComponent()   // Tests
            .deletingLastPathComponent()   // InspectionCore
            .deletingLastPathComponent()   // Packages
            .deletingLastPathComponent()   // repo root
            .appendingPathComponent("shared/fixtures/project-v1.json")
    }

    func testDecodesSharedFixture() throws {
        let p = try ProjectStore.makeDecoder().decode(SurveyProject.self, from: Data(contentsOf: fixtureURL))
        XCTAssertEqual(p.name, "فيلا العامرات – الدور الأرضي")
        XCTAssertEqual(p.openings.first?.dimensions.scan?.widthMM, 893)
        XCTAssertEqual(p.openings.first?.dimensions.widthDeltaMM, 12)
        XCTAssertEqual(p.outputs[.pdfPlan]?.state, .failed)
        XCTAssertEqual(p.nextOpeningNumber[.door], 2)
        let door = try XCTUnwrap(p.openings.first)
        XCTAssertEqual(BookmarkService.seekTime(for: .opening(door.id), in: p), 17.5)
    }

    /// Android writes `"method": "arcoreTap"` inside scan dimensions; the
    /// iPhone app must ignore the unknown key and still open the project.
    func testIgnoresAndroidOnlyKeys() throws {
        var text = try String(contentsOf: fixtureURL, encoding: .utf8)
        text = text.replacingOccurrences(of: "\"confidence\" : \"high\",", with: "\"confidence\" : \"high\", \"method\" : \"arcoreTap\",")
        let p = try ProjectStore.makeDecoder().decode(SurveyProject.self, from: Data(text.utf8))
        XCTAssertEqual(p.openings.first?.dimensions.scan?.widthMM, 893)
    }
}
