import Foundation

/// Manual bookmark workflow: create during capture, assign after capture,
/// resolve a plan tap to a seek time.
public enum BookmarkError: Error, Equatable {
    case unknownBookmark
    case unknownTarget
    case timeOutsideVideo
}

public enum BookmarkService {
    /// Optional lead-in before the bookmarked moment (seconds). Default 0 so a
    /// tap lands exactly on the bookmarked frame; the review screen lets the
    /// inspector choose a lead-in to see the approach to a door/window.
    public static let defaultPreRoll: Double = 0

    /// Creates a bookmark from a host time captured on the AR clock.
    /// Returns nil if the recording has not produced its first frame yet.
    public static func makeBookmark(hostTime: Double, clock: RecordingClock, label: String,
                                    roomScanIndex: Int?, now: Date = Date()) -> Bookmark? {
        guard let t = clock.mediaTime(forHostTime: hostTime) else { return nil }
        return Bookmark(mediaTime: t, label: label, createdAt: now, roomScanIndex: roomScanIndex,
                        target: nil, origin: .duringCapture)
    }

    /// Links a bookmark to a plan item. One bookmark per target: assigning a
    /// target that another bookmark already uses moves the link.
    public static func assign(_ bookmarkID: UUID, to target: LinkTarget?, in project: inout SurveyProject) throws {
        guard let idx = project.bookmarks.firstIndex(where: { $0.id == bookmarkID }) else { throw BookmarkError.unknownBookmark }
        if let target {
            guard project.displayName(for: target) != nil else { throw BookmarkError.unknownTarget }
            for i in project.bookmarks.indices where i != idx && project.bookmarks[i].target == target {
                project.bookmarks[i].target = nil
            }
        }
        project.bookmarks[idx].target = target
        project.updatedAt = Date()
    }

    /// Adds a bookmark at a time chosen while reviewing the video.
    @discardableResult
    public static func addReviewBookmark(at mediaTime: Double, label: String, in project: inout SurveyProject) throws -> Bookmark {
        if let duration = project.video?.durationSeconds, mediaTime < 0 || mediaTime > duration + 0.001 {
            throw BookmarkError.timeOutsideVideo
        }
        let b = Bookmark(mediaTime: max(0, mediaTime), label: label, origin: .addedInReview)
        project.bookmarks.append(b)
        project.bookmarks.sort { $0.mediaTime < $1.mediaTime }
        project.updatedAt = Date()
        return b
    }

    /// Moves a bookmark's time (e.g. nudging ±0.5 s in review), clamped to the video.
    public static func retime(_ bookmarkID: UUID, to mediaTime: Double, in project: inout SurveyProject) throws {
        guard let idx = project.bookmarks.firstIndex(where: { $0.id == bookmarkID }) else { throw BookmarkError.unknownBookmark }
        let upper = project.video?.durationSeconds ?? .greatestFiniteMagnitude
        project.bookmarks[idx].mediaTime = min(max(0, mediaTime), upper)
        project.bookmarks.sort { $0.mediaTime < $1.mediaTime }
        project.updatedAt = Date()
    }

    public static func bookmark(for target: LinkTarget, in project: SurveyProject) -> Bookmark? {
        project.bookmarks.first { $0.target == target }
    }

    /// The time the player should seek to when the target is tapped, or nil if
    /// the target has no bookmark or the project has no video.
    public static func seekTime(for target: LinkTarget, in project: SurveyProject,
                                preRoll: Double = defaultPreRoll) -> Double? {
        guard let video = project.video, let b = bookmark(for: target, in: project) else { return nil }
        return clampedSeek(b.mediaTime, preRoll: preRoll, duration: video.durationSeconds)
    }

    public static func clampedSeek(_ mediaTime: Double, preRoll: Double, duration: Double) -> Double {
        let t = mediaTime - preRoll
        return min(max(0, t), max(0, duration))
    }
}
