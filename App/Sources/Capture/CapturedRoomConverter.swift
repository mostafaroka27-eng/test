import Foundation
import RoomPlan
import simd
import InspectionCore

/// Converts RoomPlan output into the app's plan/measurement records.
///
/// Geometry provenance (see docs/MEASUREMENTS.md):
/// - wall length/height, opening width/height: `Surface.dimensions.x/.y` (RoomPlan)
/// - plan positions: `Surface.transform` projected to the floor (X/Z) (RoomPlan)
/// - floor outline: `floors[].polygonCorners` transformed to world (RoomPlan, iOS 17)
///   or, when absent, the convex hull of wall end points (derived; approximate)
/// - sill height, room max/min wall height, floor area: derived by this app
enum CapturedRoomConverter {
    struct RoomMeta {
        var scanIndex: Int
        var startMediaTime: Double?
        var endMediaTime: Double?
        var rawCapturePath: String?
        var modelPath: String?
        var alignment: RoomAlignmentStatus
    }

    /// Appends records for one captured room to `project`. Returns the room ID.
    @discardableResult
    static func append(_ room: CapturedRoom, meta: RoomMeta, to project: inout SurveyProject) -> UUID {
        let roomID = UUID()

        let wallHeights = room.walls.map { Double($0.dimensions.y) }
        let floorY: Double = {
            if let f = room.floors.first { return Double(f.transform.columns.3.y) }
            let bottoms = room.walls.map { Double($0.transform.columns.3.y - $0.dimensions.y / 2) }
            return bottoms.min() ?? 0
        }()

        var walls: [WallRecord] = []
        for (i, s) in room.walls.enumerated() {
            let (a, b) = endpoints(s)
            walls.append(WallRecord(
                roomID: roomID, roomPlanIdentifier: s.identifier,
                name: Loc.t("name.wall", meta.scanIndex, i + 1),
                start: a, end: b,
                dimensions: DimensionRecord(scan: scanDimensions(s, includeEdges: true))))
        }

        var floor = floorPolygon(room)
        if floor.count < 3 { floor = PlanMath.convexHull(walls.flatMap { [$0.start, $0.end] }) }

        let label = room.sections.first.map { "\($0.label)" }
        let record = RoomRecord(
            id: roomID,
            name: defaultRoomName(index: meta.scanIndex, label: label),
            scanIndex: meta.scanIndex,
            roomPlanIdentifier: room.identifier,
            sectionLabel: label,
            floorPolygon: floor,
            maxWallHeightM: wallHeights.max(),
            minWallHeightM: wallHeights.min(),
            rawCapturePath: meta.rawCapturePath,
            modelPath: meta.modelPath,
            captureStartMediaTime: meta.startMediaTime,
            captureEndMediaTime: meta.endMediaTime,
            alignment: meta.alignment)
        project.rooms.append(record)
        project.walls.append(contentsOf: walls)

        let surfaces: [(OpeningKind, CapturedRoom.Surface)] =
            room.doors.map { (.door, $0) } + room.windows.map { (.window, $0) } + room.openings.map { (.opening, $0) }
        for (kind, s) in surfaces {
            let (a, b) = endpoints(s)
            let center = (a + b) * 0.5
            let wallID = walls.first { $0.roomPlanIdentifier != nil && $0.roomPlanIdentifier == s.parentIdentifier }?.id
                ?? walls.min { PlanMath.distance(from: center, toSegment: $0.start, $0.end) < PlanMath.distance(from: center, toSegment: $1.start, $1.end) }?.id
            let bottom = Double(s.transform.columns.3.y - s.dimensions.y / 2)
            var isOpen: Bool? = nil
            if case .door(let open) = s.category { isOpen = open }
            let n = project.allocateOpeningNumber(for: kind)
            project.openings.append(OpeningRecord(
                roomID: roomID, wallID: wallID, roomPlanIdentifier: s.identifier,
                kind: kind, isOpenDoor: isOpen, number: n,
                name: Loc.t("name.\(kind.rawValue)", n),
                start: a, end: b,
                sillHeightM: max(0, bottom - floorY),
                dimensions: DimensionRecord(scan: scanDimensions(s, includeEdges: false))))
        }
        return roomID
    }

    static func defaultRoomName(index: Int, label: String?) -> String {
        if let label, label != "unidentified" {
            let localized = Loc.t("section.\(label)")
            if localized != "section.\(label)" { return Loc.t("name.roomWithLabel", index, localized) }
        }
        return Loc.t("name.room", index)
    }

    /// End points of a planar surface along its local X axis, projected to the floor plan.
    static func endpoints(_ s: CapturedRoom.Surface) -> (Point2D, Point2D) {
        let t = s.transform
        let axis = simd_normalize(simd_float3(t.columns.0.x, t.columns.0.y, t.columns.0.z))
        let center = simd_float3(t.columns.3.x, t.columns.3.y, t.columns.3.z)
        let half = axis * (s.dimensions.x / 2)
        let a = center - half, b = center + half
        return (Point2D(x: Double(a.x), y: Double(a.z)), Point2D(x: Double(b.x), y: Double(b.z)))
    }

    static func floorPolygon(_ room: CapturedRoom) -> [Point2D] {
        guard let floor = room.floors.first, !floor.polygonCorners.isEmpty else { return [] }
        return floor.polygonCorners.map { c in
            let w = floor.transform * simd_float4(c.x, c.y, c.z, 1)
            return Point2D(x: Double(w.x), y: Double(w.z))
        }
    }

    static func scanDimensions(_ s: CapturedRoom.Surface, includeEdges: Bool) -> ScanDimensions {
        let width = Double(s.dimensions.x), height = Double(s.dimensions.y)
        return ScanDimensions(
            widthM: width > 0.01 ? width : nil,
            heightM: height > 0.01 ? height : nil,
            depthM: s.dimensions.z > 0.001 ? Double(s.dimensions.z) : nil,
            confidence: confidence(s.confidence),
            completedEdges: includeEdges ? s.completedEdges.map { "\($0)" }.sorted() : nil)
    }

    static func confidence(_ c: CapturedRoom.Confidence) -> ScanConfidence {
        switch c {
        case .high: return .high
        case .medium: return .medium
        case .low: return .low
        @unknown default: return .unknown
        }
    }
}
