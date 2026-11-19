import Foundation

/// Platform-neutral inputs mirrored from RoomPlan/ARKit by the app.
public enum ScanInstruction: String, Sendable {
    // Mirrors RoomCaptureSession.Instruction
    case normal, moveCloseToWall, moveAwayFromWall, slowDown, turnOnLight, lowTexture
}

public enum TrackingQuality: Equatable, Sendable {
    case normal
    case notAvailable
    case limited(reason: String)  // "excessiveMotion", "insufficientFeatures", "initializing", "relocalizing"
}

public struct GuidanceMessage: Equatable, Sendable {
    public enum Severity: Int, Comparable, Sendable {
        case info = 0, warning = 1, critical = 2
        public static func < (a: Severity, b: Severity) -> Bool { a.rawValue < b.rawValue }
    }
    /// Localization key in Localizable.strings.
    public var key: String
    public var severity: Severity

    public init(key: String, severity: Severity) {
        self.key = key
        self.severity = severity
    }
}

/// Turns live RoomPlan/ARKit signals into the banner shown during capture.
public struct CaptureGuidance: Sendable {
    /// Tracking must be limited this long before we warn (avoid flicker).
    public var limitedGraceSeconds: Double = 1.0
    public private(set) var limitedSince: Double?
    public private(set) var limitedAccumulated: Double = 0
    private var lastUpdate: Double?

    public init() {}

    /// Feed the latest tracking state with a monotonic time (seconds).
    public mutating func updateTracking(_ q: TrackingQuality, at time: Double) {
        if let last = lastUpdate, limitedSince != nil { limitedAccumulated += max(0, time - last) }
        lastUpdate = time
        switch q {
        case .normal: limitedSince = nil
        case .limited, .notAvailable: if limitedSince == nil { limitedSince = time }
        }
    }

    public mutating func resetAccumulated() { limitedAccumulated = 0 }

    public func message(instruction: ScanInstruction, tracking: TrackingQuality, at time: Double) -> GuidanceMessage? {
        if let since = limitedSince, time - since >= limitedGraceSeconds {
            switch tracking {
            case .limited(let reason) where reason == "relocalizing":
                return GuidanceMessage(key: "guidance.relocalizing", severity: .critical)
            case .limited(let reason) where reason == "excessiveMotion":
                return GuidanceMessage(key: "guidance.trackingWeak.motion", severity: .warning)
            case .limited(let reason) where reason == "insufficientFeatures":
                return GuidanceMessage(key: "guidance.trackingWeak.features", severity: .warning)
            case .notAvailable:
                return GuidanceMessage(key: "guidance.trackingLost", severity: .critical)
            default:
                return GuidanceMessage(key: "guidance.trackingWeak", severity: .warning)
            }
        }
        switch instruction {
        case .normal: return nil
        case .moveCloseToWall: return GuidanceMessage(key: "guidance.moveCloser", severity: .info)
        case .moveAwayFromWall: return GuidanceMessage(key: "guidance.moveAway", severity: .info)
        case .slowDown: return GuidanceMessage(key: "guidance.slowDown", severity: .warning)
        case .turnOnLight: return GuidanceMessage(key: "guidance.turnOnLight", severity: .warning)
        case .lowTexture: return GuidanceMessage(key: "guidance.lowTexture", severity: .warning)
        }
    }

    /// Live RoomPlan wall snapshot (from `captureSession(_:didUpdate:)`) reduced to what matters for coverage.
    public struct WallCoverage: Sendable {
        public var completedEdges: Int   // 0...4
        public var confidence: ScanConfidence
        public init(completedEdges: Int, confidence: ScanConfidence) {
            self.completedEdges = completedEdges; self.confidence = confidence
        }
    }

    /// Number of walls the operator should revisit: walls with an unobserved
    /// edge or low confidence. Shown as "Revisit N walls" before Finish Room.
    public static func wallsToRevisit(_ walls: [WallCoverage]) -> Int {
        walls.filter { $0.completedEdges < 4 || $0.confidence == .low }.count
    }
}
