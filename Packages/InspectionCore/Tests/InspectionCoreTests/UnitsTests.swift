import XCTest
@testable import InspectionCore

final class UnitsTests: XCTestCase {
    func testMetersToMillimetersRounding() {
        XCTAssertEqual(Units.millimeters(fromMeters: 0.8934), 893)
        XCTAssertEqual(Units.millimeters(fromMeters: 1.0625), 1063)  // exact binary half → away from zero
        XCTAssertEqual(Units.millimeters(fromMeters: 2.1), 2100)
        XCTAssertEqual(Units.millimeters(fromMeters: 0), 0)
        XCTAssertEqual(Units.millimeters(fromMeters: -0.0625), -63)
    }

    func testMillimetersToMeters() {
        XCTAssertEqual(Units.meters(fromMillimeters: 905), 0.905, accuracy: 1e-12)
    }

    func testFormatting() {
        XCTAssertEqual(Units.format(meters: 4.2049, as: .meters), "4.20")
        XCTAssertEqual(Units.format(meters: 4.2051, as: .meters), "4.21")
        XCTAssertEqual(Units.format(meters: 0.9, as: .millimeters), "900")
        XCTAssertEqual(Units.format(millimeters: 2150, as: .meters), "2.150")
        XCTAssertNil(Units.format(meters: nil, as: .meters))
        XCTAssertNil(Units.format(meters: .nan, as: .meters))
        XCTAssertEqual(Units.formatArea(squareMeters: 15.123), "15.12")
    }

    func testParseMillimeters() {
        XCTAssertEqual(Units.parseMillimeters("2150"), 2150)
        XCTAssertEqual(Units.parseMillimeters(" 2,150 mm"), 2150)
        XCTAssertEqual(Units.parseMillimeters("2 150"), 2150)
        XCTAssertEqual(Units.parseMillimeters("٢١٥٠"), 2150)
        XCTAssertEqual(Units.parseMillimeters("٩٠٥ مم"), 905)
        XCTAssertNil(Units.parseMillimeters(""))
        XCTAssertNil(Units.parseMillimeters("-5"))
        XCTAssertNil(Units.parseMillimeters("0"))
        XCTAssertNil(Units.parseMillimeters("21.5"))
        XCTAssertNil(Units.parseMillimeters("abc"))
        XCTAssertNil(Units.parseMillimeters("200000"))
    }

    func testParseMeters() {
        XCTAssertEqual(Units.parseMetersToMillimeters("2.45"), 2450)
        XCTAssertEqual(Units.parseMetersToMillimeters("2,45 m"), 2450)
        XCTAssertEqual(Units.parseMetersToMillimeters("٢٫٧٥"), 2750)
        XCTAssertNil(Units.parseMetersToMillimeters("x"))
    }

    func testTimeFormat() {
        XCTAssertEqual(TimeFormat.clock(0), "0:00.0")
        XCTAssertEqual(TimeFormat.clock(17.55), "0:17.5")
        XCTAssertEqual(TimeFormat.clock(125.0), "2:05.0")
        XCTAssertEqual(TimeFormat.clock(-1), "--:--")
    }

    func testDimensionTiersAreIndependent() {
        var d = DimensionRecord(scan: ScanDimensions(widthM: 0.893, heightM: 2.095, confidence: .high))
        d.verified = ManualDimensions(widthMM: 905, heightMM: 2100)
        XCTAssertEqual(d.scan?.widthMM, 893, "verified entry must not overwrite scan")
        XCTAssertEqual(d.widthDeltaMM, 12)
        XCTAssertEqual(d.heightDeltaMM, 5)
        XCTAssertEqual(d.bestWidthMM?.value, 905)
        XCTAssertEqual(d.bestWidthMM?.source, .manualVerified)
        d.manufacturing = ManualDimensions(widthMM: 900)
        XCTAssertEqual(d.bestWidthMM?.source, .manufacturing)
        XCTAssertEqual(d.verified?.widthMM, 905)
        XCTAssertEqual(d.scan?.widthMM, 893)
    }
}
