import Foundation

/// The single clock shared by the MP4 and every bookmark.
///
/// Input times are *host* times in seconds on the system uptime clock — the
/// clock `ARFrame.timestamp` uses. Media time 0 is the first frame written to
/// the MP4. While the AR session is interrupted no frames are written, and the
/// paused interval is removed from the media timeline, so a bookmark taken at
/// host time `h` always lands on the frame captured at `h` in the saved file.
public struct RecordingClock: Codable, Equatable, Sendable {
    public private(set) var originHostTime: Double?
    public private(set) var pausedAtHostTime: Double?
    public private(set) var totalPausedSeconds: Double = 0
    public private(set) var interruptions: [VideoInterruption] = []

    public init() {}

    public var isStarted: Bool { originHostTime != nil }
    public var isPaused: Bool { pausedAtHostTime != nil }

    public mutating func start(atHostTime host: Double) {
        precondition(originHostTime == nil, "RecordingClock started twice")
        originHostTime = host
    }

    public mutating func pause(atHostTime host: Double) {
        guard originHostTime != nil, pausedAtHostTime == nil else { return }
        pausedAtHostTime = host
    }

    /// Resumes after an interruption. Returns the gap that was removed.
    @discardableResult
    public mutating func resume(atHostTime host: Double, reason: String) -> Double {
        guard let pausedAt = pausedAtHostTime else { return 0 }
        let gap = max(0, host - pausedAt)
        let mediaAtPause = (mediaTime(forHostTime: pausedAt) ?? 0)
        totalPausedSeconds += gap
        pausedAtHostTime = nil
        interruptions.append(VideoInterruption(mediaTime: mediaAtPause, pausedSeconds: gap, reason: reason))
        return gap
    }

    /// Maps a host time to media time. Returns nil before the first frame.
    /// During a pause, times clamp to the pause point.
    public func mediaTime(forHostTime host: Double) -> Double? {
        guard let origin = originHostTime else { return nil }
        let effectiveHost: Double
        if let pausedAt = pausedAtHostTime, host > pausedAt { effectiveHost = pausedAt } else { effectiveHost = host }
        let t = effectiveHost - origin - totalPausedSeconds
        return t < 0 ? nil : t
    }
}

/// Decides which AR frames are written, so the encoder sees monotonic,
/// evenly-paced timestamps at a bounded rate regardless of ARKit's delivery
/// (ARKit typically runs at 60 Hz; we record at 30 fps to bound file size and CPU).
public struct FrameAdmission: Sendable {
    public enum Decision: Equatable, Sendable {
        case write(mediaTime: Double)
        case skipRateLimit
        case skipNonMonotonic
        case skipBeforeStart
        case skipPaused
    }

    public let targetFrameRate: Double
    public private(set) var lastWrittenMediaTime: Double?
    /// Frames ARKit delivered but the encoder could not accept (not ready / backpressure).
    public private(set) var droppedByEncoder = 0
    public private(set) var written = 0

    public init(targetFrameRate: Double = 30) {
        precondition(targetFrameRate > 0)
        self.targetFrameRate = targetFrameRate
    }

    /// Minimum spacing with 10% tolerance so 60 Hz input yields ~30 fps output
    /// even with timestamp jitter.
    var minSpacing: Double { 0.9 / targetFrameRate }

    public func decide(hostTime: Double, clock: RecordingClock) -> Decision {
        if clock.isPaused { return .skipPaused }
        guard let t = clock.mediaTime(forHostTime: hostTime) else { return .skipBeforeStart }
        if let last = lastWrittenMediaTime {
            if t <= last { return .skipNonMonotonic }
            if t - last < minSpacing { return .skipRateLimit }
        }
        return .write(mediaTime: t)
    }

    public mutating func didWrite(mediaTime: Double) {
        lastWrittenMediaTime = mediaTime
        written += 1
    }

    public mutating func didDropAtEncoder() { droppedByEncoder += 1 }
}

/// Decides whether there is room to keep recording.
public struct StorageBudget: Sendable {
    /// Free space that must remain for the RoomPlan model, JSON and exports.
    public var reserveBytes: Int64
    /// Expected encoder output in bytes per second.
    public var bytesPerSecond: Int64

    public init(reserveBytes: Int64 = 500_000_000, videoBitsPerSecond: Int = 6_000_000) {
        self.reserveBytes = reserveBytes
        self.bytesPerSecond = Int64(videoBitsPerSecond / 8)
    }

    public enum Verdict: Equatable, Sendable { case ok(secondsRemaining: Double), low(secondsRemaining: Double), mustStop }

    /// `low` warns when fewer than 5 minutes of footage fit; `mustStop` when the reserve is reached.
    public func evaluate(freeBytes: Int64) -> Verdict {
        let usable = freeBytes - reserveBytes
        if usable <= 0 { return .mustStop }
        let seconds = Double(usable) / Double(max(bytesPerSecond, 1))
        return seconds < 300 ? .low(secondsRemaining: seconds) : .ok(secondsRemaining: seconds)
    }

    /// Whether to allow starting a scan at all (needs at least 2 minutes of footage).
    public func canStart(freeBytes: Int64) -> Bool {
        switch evaluate(freeBytes: freeBytes) {
        case .ok: return true
        case .low(let s): return s >= 120
        case .mustStop: return false
        }
    }
}
