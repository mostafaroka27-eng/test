import Foundation

/// Per-room alignment state in the shared coordinate system.
public enum RoomAlignmentStatus: String, Codable, Sendable {
    /// Only one room in the project; nothing to align.
    case single
    /// Same AR session as the reference room and passed the geometric checks.
    case aligned
    /// Same session, but geometry looks suspicious (overlap or far gap). Shown, flagged.
    case suspect
    /// Captured after the AR session lost its world origin; cannot be placed reliably.
    case notAligned
}

public struct AlignmentReport: Codable, Hashable, Sendable {
    public enum Overall: String, Codable, Sendable { case single, connected, connectedWithWarnings, notConnected }

    public struct Issue: Codable, Hashable, Sendable {
        public var roomID: UUID
        public var code: Code
        public var detail: String
        public enum Code: String, Codable, Sendable {
            case sessionReset           // AR world origin changed between rooms
            case overlapsOtherRoom      // footprints overlap more than a wall thickness allows
            case isolated               // no other room within reach (no shared doorway/wall)
            case structureMergeFailed   // RoomPlan StructureBuilder threw
            case longTrackingLoss       // tracking limited for a long time during this room
        }
    }

    public var overall: Overall
    public var issues: [Issue]
    /// True when RoomPlan's StructureBuilder produced the merged model.
    public var structureMerged: Bool
}

/// Facts recorded per room during capture, used to judge alignment.
public struct RoomCaptureFacts: Sendable {
    public var roomID: UUID
    /// Increments every time the AR session restarts without relocalizing
    /// (world origin lost). Rooms with different epochs do not share coordinates.
    public var sessionEpoch: Int
    public var footprint: [Point2D]
    public var trackingLimitedSeconds: Double

    public init(roomID: UUID, sessionEpoch: Int, footprint: [Point2D], trackingLimitedSeconds: Double) {
        self.roomID = roomID; self.sessionEpoch = sessionEpoch
        self.footprint = footprint; self.trackingLimitedSeconds = trackingLimitedSeconds
    }
}

public enum AlignmentAssessor {
    /// Overlap above this fraction of the smaller room means misplacement
    /// (adjacent rooms only share a wall's thickness).
    public static let maxOverlapFraction = 0.10
    /// Absolute overlap tolerance for wall thickness and RoomPlan noise.
    public static let maxOverlapM2 = 0.6
    /// Rooms farther than this from every other room are flagged as isolated.
    public static let maxGapM = 1.5
    public static let maxTrackingLossSeconds = 10.0

    public static func assess(_ rooms: [RoomCaptureFacts], structureMerged: Bool, mergeError: String? = nil) -> (AlignmentReport, [UUID: RoomAlignmentStatus]) {
        guard rooms.count > 1 else {
            var statuses: [UUID: RoomAlignmentStatus] = [:]
            rooms.forEach { statuses[$0.roomID] = .single }
            return (AlignmentReport(overall: .single, issues: [], structureMerged: structureMerged), statuses)
        }
        var issues: [AlignmentReport.Issue] = []
        var status: [UUID: RoomAlignmentStatus] = [:]
        let referenceEpoch = rooms[0].sessionEpoch

        for r in rooms {
            status[r.roomID] = r.sessionEpoch == referenceEpoch ? .aligned : .notAligned
            if r.sessionEpoch != referenceEpoch {
                issues.append(.init(roomID: r.roomID, code: .sessionReset,
                                    detail: "AR session lost its world origin before this room was scanned."))
            }
            if r.trackingLimitedSeconds > maxTrackingLossSeconds {
                issues.append(.init(roomID: r.roomID, code: .longTrackingLoss,
                                    detail: String(format: "Tracking was limited for %.0f s.", r.trackingLimitedSeconds)))
                if status[r.roomID] == .aligned { status[r.roomID] = .suspect }
            }
        }

        let comparable = rooms.filter { status[$0.roomID] != .notAligned && $0.footprint.count >= 3 }
        for (i, a) in comparable.enumerated() {
            var nearest = Double.infinity
            for (j, b) in comparable.enumerated() where i != j {
                nearest = min(nearest, PlanMath.minDistance(between: a.footprint, and: b.footprint))
                if j > i {
                    let overlap = PlanMath.overlapArea(a.footprint, b.footprint)
                    let smaller = min(PlanMath.polygonArea(a.footprint), PlanMath.polygonArea(b.footprint))
                    if overlap > maxOverlapM2 && overlap > smaller * maxOverlapFraction {
                        for id in [a.roomID, b.roomID] {
                            status[id] = .suspect
                            issues.append(.init(roomID: id, code: .overlapsOtherRoom,
                                                detail: String(format: "Overlaps another room by %.1f m².", overlap)))
                        }
                    }
                }
            }
            if nearest > maxGapM {
                status[a.roomID] = .suspect
                issues.append(.init(roomID: a.roomID, code: .isolated,
                                    detail: String(format: "Nearest other room is %.1f m away.", nearest)))
            }
        }

        if !structureMerged, let mergeError {
            issues.append(.init(roomID: rooms[0].roomID, code: .structureMergeFailed, detail: mergeError))
        }

        let overall: AlignmentReport.Overall
        if status.values.contains(.notAligned) || (!structureMerged && mergeError != nil) {
            overall = .notConnected
        } else if status.values.contains(.suspect) {
            overall = .connectedWithWarnings
        } else {
            overall = .connected
        }
        return (AlignmentReport(overall: overall, issues: issues, structureMerged: structureMerged), status)
    }
}
