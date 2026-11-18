import Foundation

// MARK: - Geometry primitives

/// A point on the floor plan, in meters, in the AR session's world frame
/// projected onto the floor: `x` = world X, `y` = world Z.
public struct Point2D: Codable, Hashable, Sendable {
    public var x: Double
    public var y: Double
    public init(x: Double, y: Double) { self.x = x; self.y = y }

    public static func + (a: Point2D, b: Point2D) -> Point2D { Point2D(x: a.x + b.x, y: a.y + b.y) }
    public static func - (a: Point2D, b: Point2D) -> Point2D { Point2D(x: a.x - b.x, y: a.y - b.y) }
    public static func * (a: Point2D, s: Double) -> Point2D { Point2D(x: a.x * s, y: a.y * s) }
    public var length: Double { (x * x + y * y).squareRoot() }
    public func distance(to other: Point2D) -> Double { (self - other).length }
    public var normalized: Point2D { let l = length; return l > 0 ? Point2D(x: x / l, y: y / l) : self }
}

// MARK: - Provenance

/// Where a number came from. The UI, CSV, JSON and PDF all carry this so a
/// scan estimate is never mistaken for a site-verified or manufacturing size.
public enum MeasurementSource: String, Codable, Sendable {
    /// Read directly from RoomPlan geometry (`CapturedRoom.Surface.dimensions`).
    case roomPlan
    /// Computed by this app from RoomPlan geometry (e.g. floor area, wall height maximum).
    case derivedFromRoomPlan
    /// Typed by the inspector after an independent tape/laser measurement.
    case manualVerified
    /// Typed by the inspector as the final size to manufacture/order.
    case manufacturing
}

public enum ScanConfidence: String, Codable, Sendable {
    case high, medium, low, unknown
}

/// Scan-derived dimensions in meters. `nil` means RoomPlan did not provide
/// the value; the UI shows that as "not detected" instead of a number.
public struct ScanDimensions: Codable, Hashable, Sendable {
    public var widthM: Double?
    public var heightM: Double?
    public var depthM: Double?
    public var confidence: ScanConfidence
    /// Edges RoomPlan reported as completely observed ("top", "bottom", "left", "right").
    /// An empty list for a wall means the wall was only partly seen.
    public var completedEdges: [String]?

    public init(widthM: Double?, heightM: Double?, depthM: Double? = nil,
                confidence: ScanConfidence, completedEdges: [String]? = nil) {
        self.widthM = widthM; self.heightM = heightM; self.depthM = depthM
        self.confidence = confidence; self.completedEdges = completedEdges
    }

    public var widthMM: Int? { widthM.map(Units.millimeters(fromMeters:)) }
    public var heightMM: Int? { heightM.map(Units.millimeters(fromMeters:)) }

    /// True when a wall is missing at least one observed edge.
    public var isPartiallyObserved: Bool {
        guard let completedEdges else { return false }
        return completedEdges.count < 4
    }
}

/// A dimension typed by a person. Never produced by the scanner.
public struct ManualDimensions: Codable, Hashable, Sendable {
    public var widthMM: Int?
    public var heightMM: Int?
    public var depthMM: Int?
    public var method: String?
    public var note: String?
    public var enteredAt: Date

    public init(widthMM: Int? = nil, heightMM: Int? = nil, depthMM: Int? = nil,
                method: String? = nil, note: String? = nil, enteredAt: Date = Date()) {
        self.widthMM = widthMM; self.heightMM = heightMM; self.depthMM = depthMM
        self.method = method; self.note = note; self.enteredAt = enteredAt
    }

    public var isEmpty: Bool { widthMM == nil && heightMM == nil && depthMM == nil }
}

/// The three independent tiers of a dimension. Editing one never touches the others.
public struct DimensionRecord: Codable, Hashable, Sendable {
    public var scan: ScanDimensions?
    public var verified: ManualDimensions?
    public var manufacturing: ManualDimensions?

    public init(scan: ScanDimensions? = nil, verified: ManualDimensions? = nil, manufacturing: ManualDimensions? = nil) {
        self.scan = scan; self.verified = verified; self.manufacturing = manufacturing
    }

    /// Difference verified − scan, in mm, for the acceptance comparison.
    public var widthDeltaMM: Int? {
        guard let v = verified?.widthMM, let s = scan?.widthMM else { return nil }
        return v - s
    }
    public var heightDeltaMM: Int? {
        guard let v = verified?.heightMM, let s = scan?.heightMM else { return nil }
        return v - s
    }

    /// Best available width for display, with its source. Manufacturing beats
    /// verified beats scan. Returns nil when nothing is known.
    public var bestWidthMM: (value: Int, source: MeasurementSource)? {
        if let m = manufacturing?.widthMM { return (m, .manufacturing) }
        if let v = verified?.widthMM { return (v, .manualVerified) }
        if let s = scan?.widthMM { return (s, .roomPlan) }
        return nil
    }
}

// MARK: - Plan entities

public enum OpeningKind: String, Codable, CaseIterable, Sendable {
    case door, window, opening

    public var nameKey: String { "kind.\(rawValue)" }
    public var defaultEnglishPrefix: String {
        switch self {
        case .door: return "Door"
        case .window: return "Window"
        case .opening: return "Opening"
        }
    }
}

public struct RoomRecord: Codable, Hashable, Identifiable, Sendable {
    public var id: UUID
    public var name: String
    /// 1-based order in which the room was scanned during the walkthrough.
    public var scanIndex: Int
    /// RoomPlan's `CapturedRoom.identifier`, when available.
    public var roomPlanIdentifier: UUID?
    /// RoomPlan section label (e.g. "bedroom") if recognized.
    public var sectionLabel: String?
    /// Floor outline in plan coordinates (meters). Empty when not detected.
    public var floorPolygon: [Point2D]
    /// Maximum wall height reported by RoomPlan in this room. RoomPlan does not
    /// capture ceilings, so this is labeled "wall height", never "ceiling height".
    public var maxWallHeightM: Double?
    public var minWallHeightM: Double?
    /// Ceiling height typed by the inspector after measuring on site.
    public var verifiedCeilingHeightMM: Int?
    /// Relative path of the raw RoomPlan JSON (`CapturedRoom` Codable) inside the project.
    public var rawCapturePath: String?
    /// Relative path of this room's own USDZ (kept even if merging fails).
    public var modelPath: String?
    public var captureStartMediaTime: Double?
    public var captureEndMediaTime: Double?
    public var alignment: RoomAlignmentStatus
    public var notes: String

    public init(id: UUID = UUID(), name: String, scanIndex: Int, roomPlanIdentifier: UUID? = nil,
                sectionLabel: String? = nil, floorPolygon: [Point2D] = [], maxWallHeightM: Double? = nil,
                minWallHeightM: Double? = nil, verifiedCeilingHeightMM: Int? = nil, rawCapturePath: String? = nil,
                modelPath: String? = nil, captureStartMediaTime: Double? = nil, captureEndMediaTime: Double? = nil,
                alignment: RoomAlignmentStatus = .single, notes: String = "") {
        self.id = id; self.name = name; self.scanIndex = scanIndex; self.roomPlanIdentifier = roomPlanIdentifier
        self.sectionLabel = sectionLabel; self.floorPolygon = floorPolygon; self.maxWallHeightM = maxWallHeightM
        self.minWallHeightM = minWallHeightM; self.verifiedCeilingHeightMM = verifiedCeilingHeightMM
        self.rawCapturePath = rawCapturePath; self.modelPath = modelPath
        self.captureStartMediaTime = captureStartMediaTime; self.captureEndMediaTime = captureEndMediaTime
        self.alignment = alignment; self.notes = notes
    }

    /// Floor area from the polygon (derived from RoomPlan geometry).
    public var floorAreaM2: Double? {
        guard floorPolygon.count >= 3 else { return nil }
        return PlanMath.polygonArea(floorPolygon)
    }
}

public struct WallRecord: Codable, Hashable, Identifiable, Sendable {
    public var id: UUID
    public var roomID: UUID
    public var roomPlanIdentifier: UUID?
    public var name: String
    public var start: Point2D
    public var end: Point2D
    /// `scan.widthM` is the wall length, `scan.heightM` the wall height.
    public var dimensions: DimensionRecord
    public var notes: String

    public init(id: UUID = UUID(), roomID: UUID, roomPlanIdentifier: UUID? = nil, name: String,
                start: Point2D, end: Point2D, dimensions: DimensionRecord, notes: String = "") {
        self.id = id; self.roomID = roomID; self.roomPlanIdentifier = roomPlanIdentifier; self.name = name
        self.start = start; self.end = end; self.dimensions = dimensions; self.notes = notes
    }
}

public struct OpeningRecord: Codable, Hashable, Identifiable, Sendable {
    public var id: UUID
    public var roomID: UUID
    public var wallID: UUID?
    public var roomPlanIdentifier: UUID?
    public var kind: OpeningKind
    /// RoomPlan's open/closed state for doors, if reported.
    public var isOpenDoor: Bool?
    /// Stable per-project number, e.g. 12 for "Door 12". Not reused after deletion.
    public var number: Int
    public var name: String
    /// Opening extent along its wall, in plan coordinates.
    public var start: Point2D
    public var end: Point2D
    /// Height of the opening's bottom edge above the floor (scan-derived), meters.
    public var sillHeightM: Double?
    /// `scan.widthM` = opening width, `scan.heightM` = opening height.
    public var dimensions: DimensionRecord
    public var notes: String

    public init(id: UUID = UUID(), roomID: UUID, wallID: UUID? = nil, roomPlanIdentifier: UUID? = nil,
                kind: OpeningKind, isOpenDoor: Bool? = nil, number: Int, name: String,
                start: Point2D, end: Point2D, sillHeightM: Double? = nil,
                dimensions: DimensionRecord, notes: String = "") {
        self.id = id; self.roomID = roomID; self.wallID = wallID; self.roomPlanIdentifier = roomPlanIdentifier
        self.kind = kind; self.isOpenDoor = isOpenDoor; self.number = number; self.name = name
        self.start = start; self.end = end; self.sillHeightM = sillHeightM
        self.dimensions = dimensions; self.notes = notes
    }

    public var center: Point2D { (start + end) * 0.5 }
}

// MARK: - Video & bookmarks

/// What a bookmark points at on the plan.
public enum LinkTarget: Codable, Hashable, Sendable {
    case room(UUID)
    case opening(UUID)
    case wall(UUID)

    private enum CodingKeys: String, CodingKey { case kind, id }
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let id = try c.decode(UUID.self, forKey: .id)
        switch try c.decode(String.self, forKey: .kind) {
        case "room": self = .room(id)
        case "opening": self = .opening(id)
        case "wall": self = .wall(id)
        case let other:
            throw DecodingError.dataCorruptedError(forKey: .kind, in: c, debugDescription: "Unknown link kind \(other)")
        }
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .room(let id): try c.encode("room", forKey: .kind); try c.encode(id, forKey: .id)
        case .opening(let id): try c.encode("opening", forKey: .kind); try c.encode(id, forKey: .id)
        case .wall(let id): try c.encode("wall", forKey: .kind); try c.encode(id, forKey: .id)
        }
    }
    public var id: UUID {
        switch self { case .room(let i), .opening(let i), .wall(let i): return i }
    }
}

public struct Bookmark: Codable, Hashable, Identifiable, Sendable {
    public var id: UUID
    /// Seconds from the first frame of the saved MP4 (the shared timebase).
    public var mediaTime: Double
    public var label: String
    public var createdAt: Date
    /// Which room scan was in progress when the bookmark was taken (1-based).
    public var roomScanIndex: Int?
    /// Manual link to a plan item. Nil until the inspector assigns it.
    public var target: LinkTarget?
    /// How the bookmark was created.
    public var origin: Origin

    public enum Origin: String, Codable, Sendable { case duringCapture, addedInReview, sample }

    public init(id: UUID = UUID(), mediaTime: Double, label: String, createdAt: Date = Date(),
                roomScanIndex: Int? = nil, target: LinkTarget? = nil, origin: Origin) {
        self.id = id; self.mediaTime = mediaTime; self.label = label; self.createdAt = createdAt
        self.roomScanIndex = roomScanIndex; self.target = target; self.origin = origin
    }
}

public struct VideoInterruption: Codable, Hashable, Sendable {
    public var mediaTime: Double
    public var pausedSeconds: Double
    public var reason: String
    public init(mediaTime: Double, pausedSeconds: Double, reason: String) {
        self.mediaTime = mediaTime; self.pausedSeconds = pausedSeconds; self.reason = reason
    }
}

public struct VideoInfo: Codable, Hashable, Sendable {
    public var relativePath: String
    public var durationSeconds: Double
    public var framesWritten: Int
    public var framesDropped: Int
    public var pixelWidth: Int
    public var pixelHeight: Int
    /// Rotation applied through the track transform (degrees clockwise).
    public var rotationDegrees: Int
    public var codec: String
    public var nominalFrameRate: Double
    public var startedAt: Date
    public var interruptions: [VideoInterruption]
    /// Why recording ended early, if it did (e.g. low storage, writer error).
    public var stopReason: String?
    /// True for the generated footage of the sample project.
    public var isSynthetic: Bool

    public init(relativePath: String, durationSeconds: Double, framesWritten: Int, framesDropped: Int,
                pixelWidth: Int, pixelHeight: Int, rotationDegrees: Int, codec: String, nominalFrameRate: Double,
                startedAt: Date, interruptions: [VideoInterruption] = [], stopReason: String? = nil,
                isSynthetic: Bool = false) {
        self.relativePath = relativePath; self.durationSeconds = durationSeconds
        self.framesWritten = framesWritten; self.framesDropped = framesDropped
        self.pixelWidth = pixelWidth; self.pixelHeight = pixelHeight; self.rotationDegrees = rotationDegrees
        self.codec = codec; self.nominalFrameRate = nominalFrameRate; self.startedAt = startedAt
        self.interruptions = interruptions; self.stopReason = stopReason; self.isSynthetic = isSynthetic
    }
}

// MARK: - Outputs

public enum OutputKind: String, Codable, CaseIterable, Sendable {
    case rawRoomData      // RoomPlan CapturedRoom JSON per room
    case model3D          // USDZ (merged structure or single room)
    case video            // MP4 walkthrough
    case pdfPlan          // export
    case csvMeasurements  // export
    case jsonReport       // export

    public var isExport: Bool { [.pdfPlan, .csvMeasurements, .jsonReport].contains(self) }
}

public enum OutputState: String, Codable, Sendable { case pending, ready, failed }

public struct OutputRecord: Codable, Hashable, Sendable {
    public var kind: OutputKind
    public var state: OutputState
    public var relativePath: String?
    public var message: String?
    public var updatedAt: Date
    public init(kind: OutputKind, state: OutputState, relativePath: String? = nil, message: String? = nil, updatedAt: Date = Date()) {
        self.kind = kind; self.state = state; self.relativePath = relativePath; self.message = message; self.updatedAt = updatedAt
    }
}

// MARK: - Project

public struct SurveyProject: Codable, Hashable, Identifiable, Sendable {
    public static let currentSchemaVersion = 1

    public var schemaVersion: Int
    public var id: UUID
    public var name: String
    public var createdAt: Date
    public var updatedAt: Date
    /// Sample projects are generated, not scanned, and are labeled everywhere.
    public var isSample: Bool
    public var rooms: [RoomRecord]
    public var walls: [WallRecord]
    public var openings: [OpeningRecord]
    public var bookmarks: [Bookmark]
    public var video: VideoInfo?
    public var outputs: [OutputKind: OutputRecord]
    public var alignment: AlignmentReport?
    public var notes: String
    /// Next number to assign per opening kind, so "Door 12" stays "Door 12".
    public var nextOpeningNumber: [OpeningKind: Int]
    public var captureDeviceModel: String?
    public var appVersion: String?

    public init(id: UUID = UUID(), name: String, createdAt: Date = Date(), isSample: Bool = false) {
        self.schemaVersion = Self.currentSchemaVersion
        self.id = id; self.name = name; self.createdAt = createdAt; self.updatedAt = createdAt
        self.isSample = isSample; self.rooms = []; self.walls = []; self.openings = []
        self.bookmarks = []; self.video = nil; self.outputs = [:]; self.alignment = nil
        self.notes = ""; self.nextOpeningNumber = [:]; self.captureDeviceModel = nil; self.appVersion = nil
    }

    public var hasScan: Bool { !rooms.isEmpty }

    public func room(_ id: UUID) -> RoomRecord? { rooms.first { $0.id == id } }
    public func opening(_ id: UUID) -> OpeningRecord? { openings.first { $0.id == id } }
    public func wall(_ id: UUID) -> WallRecord? { walls.first { $0.id == id } }

    public func displayName(for target: LinkTarget) -> String? {
        switch target {
        case .room(let id): return room(id)?.name
        case .opening(let id): return opening(id)?.name
        case .wall(let id): return wall(id)?.name
        }
    }

    /// Allocates the next number for an opening kind ("Door 12").
    public mutating func allocateOpeningNumber(for kind: OpeningKind) -> Int {
        let n = nextOpeningNumber[kind] ?? 1
        nextOpeningNumber[kind] = n + 1
        return n
    }

    // Dictionaries with enum keys encode as arrays in JSON by default; encode
    // them as objects keyed by raw value for a readable, stable report format.
    private enum CodingKeys: String, CodingKey {
        case schemaVersion, id, name, createdAt, updatedAt, isSample, rooms, walls, openings, bookmarks
        case video, outputs, alignment, notes, nextOpeningNumber, captureDeviceModel, appVersion
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        schemaVersion = try c.decode(Int.self, forKey: .schemaVersion)
        guard schemaVersion <= Self.currentSchemaVersion else {
            throw DecodingError.dataCorruptedError(forKey: .schemaVersion, in: c,
                debugDescription: "Project schema \(schemaVersion) is newer than this app supports (\(Self.currentSchemaVersion)).")
        }
        id = try c.decode(UUID.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        createdAt = try c.decode(Date.self, forKey: .createdAt)
        updatedAt = try c.decode(Date.self, forKey: .updatedAt)
        isSample = try c.decodeIfPresent(Bool.self, forKey: .isSample) ?? false
        rooms = try c.decodeIfPresent([RoomRecord].self, forKey: .rooms) ?? []
        walls = try c.decodeIfPresent([WallRecord].self, forKey: .walls) ?? []
        openings = try c.decodeIfPresent([OpeningRecord].self, forKey: .openings) ?? []
        bookmarks = try c.decodeIfPresent([Bookmark].self, forKey: .bookmarks) ?? []
        video = try c.decodeIfPresent(VideoInfo.self, forKey: .video)
        let rawOutputs = try c.decodeIfPresent([String: OutputRecord].self, forKey: .outputs) ?? [:]
        outputs = Dictionary(uniqueKeysWithValues: rawOutputs.compactMap { k, v in OutputKind(rawValue: k).map { ($0, v) } })
        alignment = try c.decodeIfPresent(AlignmentReport.self, forKey: .alignment)
        notes = try c.decodeIfPresent(String.self, forKey: .notes) ?? ""
        let rawNumbers = try c.decodeIfPresent([String: Int].self, forKey: .nextOpeningNumber) ?? [:]
        nextOpeningNumber = Dictionary(uniqueKeysWithValues: rawNumbers.compactMap { k, v in OpeningKind(rawValue: k).map { ($0, v) } })
        captureDeviceModel = try c.decodeIfPresent(String.self, forKey: .captureDeviceModel)
        appVersion = try c.decodeIfPresent(String.self, forKey: .appVersion)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(schemaVersion, forKey: .schemaVersion)
        try c.encode(id, forKey: .id)
        try c.encode(name, forKey: .name)
        try c.encode(createdAt, forKey: .createdAt)
        try c.encode(updatedAt, forKey: .updatedAt)
        try c.encode(isSample, forKey: .isSample)
        try c.encode(rooms, forKey: .rooms)
        try c.encode(walls, forKey: .walls)
        try c.encode(openings, forKey: .openings)
        try c.encode(bookmarks, forKey: .bookmarks)
        try c.encodeIfPresent(video, forKey: .video)
        try c.encode(Dictionary(uniqueKeysWithValues: outputs.map { ($0.key.rawValue, $0.value) }), forKey: .outputs)
        try c.encodeIfPresent(alignment, forKey: .alignment)
        try c.encode(notes, forKey: .notes)
        try c.encode(Dictionary(uniqueKeysWithValues: nextOpeningNumber.map { ($0.key.rawValue, $0.value) }), forKey: .nextOpeningNumber)
        try c.encodeIfPresent(captureDeviceModel, forKey: .captureDeviceModel)
        try c.encodeIfPresent(appVersion, forKey: .appVersion)
    }
}

public struct ProjectSummary: Hashable, Identifiable, Sendable {
    public var id: UUID
    public var name: String
    public var createdAt: Date
    public var updatedAt: Date
    public var isSample: Bool
    public var roomCount: Int
    public var hasVideo: Bool
    public var failedOutputs: [OutputKind]

    public init(_ p: SurveyProject) {
        id = p.id; name = p.name; createdAt = p.createdAt; updatedAt = p.updatedAt; isSample = p.isSample
        roomCount = p.rooms.count; hasVideo = p.video != nil
        failedOutputs = p.outputs.values.filter { $0.state == .failed }.map(\.kind).sorted { $0.rawValue < $1.rawValue }
    }
}
