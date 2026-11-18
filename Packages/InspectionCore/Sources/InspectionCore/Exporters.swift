import Foundation

// MARK: - CSV

/// Measurement table as CSV. One row per room, wall and opening.
/// Column semantics are fixed and documented in docs/MEASUREMENTS.md:
/// scan columns are RoomPlan estimates; verified and manufacturing columns
/// are typed by the inspector and are never filled from the scan.
public enum MeasurementCSV {
    public static let columns = [
        "item_type", "item_id", "room", "name",
        "scan_width_mm", "scan_height_mm", "scan_confidence", "scan_status",
        "verified_width_mm", "verified_height_mm", "delta_width_mm", "delta_height_mm",
        "manufacturing_width_mm", "manufacturing_height_mm",
        "sill_height_mm", "room_area_m2", "room_max_wall_height_m", "verified_ceiling_height_mm",
        "video_time_s", "notes",
    ]

    /// - Parameter includeBOM: Prepends a UTF-8 BOM so Excel shows Arabic names correctly.
    public static func make(_ project: SurveyProject, includeBOM: Bool = true) -> String {
        var lines: [String] = [columns.joined(separator: ",")]
        let roomName: (UUID) -> String = { id in project.room(id)?.name ?? "" }
        let time: (LinkTarget) -> String = { t in
            BookmarkService.bookmark(for: t, in: project).map { Units.formatDecimal($0.mediaTime, decimals: 2) } ?? ""
        }

        for room in project.rooms.sorted(by: { $0.scanIndex < $1.scanIndex }) {
            lines.append(row([
                "room", room.id.uuidString, room.name, room.name,
                "", "", "", room.floorPolygon.count >= 3 ? "detected" : "floor_not_detected",
                "", "", "", "", "", "", "",
                Units.formatArea(squareMeters: room.floorAreaM2) ?? "",
                Units.format(meters: room.maxWallHeightM, as: .meters) ?? "",
                room.verifiedCeilingHeightMM.map(String.init) ?? "",
                time(.room(room.id)), room.notes,
            ]))
        }
        for wall in project.walls {
            let d = wall.dimensions
            lines.append(row([
                "wall", wall.id.uuidString, roomName(wall.roomID), wall.name,
                opt(d.scan?.widthMM), opt(d.scan?.heightMM), d.scan?.confidence.rawValue ?? "", status(d.scan),
                opt(d.verified?.widthMM), opt(d.verified?.heightMM), opt(d.widthDeltaMM), opt(d.heightDeltaMM),
                opt(d.manufacturing?.widthMM), opt(d.manufacturing?.heightMM),
                "", "", "", "", time(.wall(wall.id)), wall.notes,
            ]))
        }
        for o in project.openings.sorted(by: { ($0.kind.rawValue, $0.number) < ($1.kind.rawValue, $1.number) }) {
            let d = o.dimensions
            lines.append(row([
                o.kind.rawValue, o.id.uuidString, roomName(o.roomID), o.name,
                opt(d.scan?.widthMM), opt(d.scan?.heightMM), d.scan?.confidence.rawValue ?? "", status(d.scan),
                opt(d.verified?.widthMM), opt(d.verified?.heightMM), opt(d.widthDeltaMM), opt(d.heightDeltaMM),
                opt(d.manufacturing?.widthMM), opt(d.manufacturing?.heightMM),
                opt(o.sillHeightM.map(Units.millimeters(fromMeters:))), "", "", "",
                time(.opening(o.id)), o.notes,
            ]))
        }
        let body = lines.joined(separator: "\r\n") + "\r\n"
        return includeBOM ? "\u{FEFF}" + body : body
    }

    static func status(_ scan: ScanDimensions?) -> String {
        guard let scan else { return "not_detected" }
        if scan.widthM == nil || scan.heightM == nil { return "incomplete" }
        if scan.isPartiallyObserved { return "partially_observed" }
        if scan.confidence == .low { return "low_confidence" }
        return "detected"
    }

    static func opt(_ v: Int?) -> String { v.map(String.init) ?? "" }

    static func row(_ fields: [String]) -> String {
        fields.map(escape).joined(separator: ",")
    }

    /// RFC 4180 quoting. Also neutralizes spreadsheet formula injection in
    /// free-text fields (names/notes starting with = + - @).
    public static func escape(_ field: String) -> String {
        var f = field
        if let first = f.first, "=+-@".contains(first), Int(f) == nil, Double(f) == nil { f = "'" + f }
        if f.contains(",") || f.contains("\"") || f.contains("\n") || f.contains("\r") {
            return "\"" + f.replacingOccurrences(of: "\"", with: "\"\"") + "\""
        }
        return f
    }
}

// MARK: - JSON report

/// Versioned, self-describing project report for other tools.
public struct ProjectReport: Codable, Sendable {
    public static let format = "room-scan-inspector.project-report"
    public static let version = 1

    public var reportFormat: String
    public var reportVersion: Int
    public var generatedAt: Date
    public var generator: String
    public var units: [String: String]
    public var provenance: [String: String]
    public var summary: Summary
    public var project: SurveyProject

    public struct Summary: Codable, Sendable {
        public var roomCount: Int
        public var wallCount: Int
        public var doorCount: Int
        public var windowCount: Int
        public var openingCount: Int
        public var bookmarkCount: Int
        public var linkedBookmarkCount: Int
        public var openingsWithoutScanWidth: [String]
        public var wallsPartiallyObserved: [String]
        public var alignment: String?
        public var isSample: Bool
        public var hasVideo: Bool
    }

    public init(project: SurveyProject, generator: String, now: Date = Date()) {
        reportFormat = Self.format
        reportVersion = Self.version
        generatedAt = now
        self.generator = generator
        units = [
            "scan.widthM/heightM/depthM": "meters (RoomPlan native)",
            "verified.*MM / manufacturing.*MM": "millimeters (typed by inspector)",
            "Point2D": "meters, plan coordinates (world X, world Z) of the capture session",
            "Bookmark.mediaTime": "seconds from the first frame of video.mp4",
        ]
        provenance = [
            MeasurementSource.roomPlan.rawValue: "Apple RoomPlan CapturedRoom/CapturedStructure surface dimensions; estimates.",
            MeasurementSource.derivedFromRoomPlan.rawValue: "Computed by the app from RoomPlan geometry (floor area, wall height max/min, sill height).",
            MeasurementSource.manualVerified.rawValue: "Typed by the inspector after an independent tape/laser measurement.",
            MeasurementSource.manufacturing.rawValue: "Typed by the inspector as the size to manufacture; never derived from the scan.",
            "ceiling": "RoomPlan does not capture ceilings. Only verifiedCeilingHeightMM is a ceiling height.",
        ]
        summary = Summary(
            roomCount: project.rooms.count,
            wallCount: project.walls.count,
            doorCount: project.openings.filter { $0.kind == .door }.count,
            windowCount: project.openings.filter { $0.kind == .window }.count,
            openingCount: project.openings.filter { $0.kind == .opening }.count,
            bookmarkCount: project.bookmarks.count,
            linkedBookmarkCount: project.bookmarks.filter { $0.target != nil }.count,
            openingsWithoutScanWidth: project.openings.filter { $0.dimensions.scan?.widthM == nil }.map(\.name),
            wallsPartiallyObserved: project.walls.filter { $0.dimensions.scan?.isPartiallyObserved == true }.map(\.name),
            alignment: project.alignment?.overall.rawValue,
            isSample: project.isSample,
            hasVideo: project.video != nil
        )
        self.project = project
    }

    public func encoded() throws -> Data { try ProjectStore.makeEncoder().encode(self) }

    public static func decode(_ data: Data) throws -> ProjectReport {
        try ProjectStore.makeDecoder().decode(ProjectReport.self, from: data)
    }
}
