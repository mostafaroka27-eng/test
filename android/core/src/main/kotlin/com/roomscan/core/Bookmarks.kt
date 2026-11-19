package com.roomscan.core

import java.time.Instant
import java.util.UUID

class BookmarkException(val reason: Reason) : Exception(reason.name) {
    enum class Reason { UnknownBookmark, UnknownTarget, TimeOutsideVideo }
}

/** Manual bookmark workflow (mirrors Bookmarks.swift). All functions return a new project. */
object BookmarkService {
    const val DEFAULT_PRE_ROLL = 0.0

    fun makeBookmark(hostTime: Double, clock: RecordingClock, label: String, roomScanIndex: Int?, now: Instant = Dates.now()): Bookmark? {
        val t = clock.mediaTime(hostTime) ?: return null
        return Bookmark(mediaTime = t, label = label, createdAt = now, roomScanIndex = roomScanIndex, origin = Bookmark.Origin.duringCapture)
    }

    /** One bookmark per target: assigning a target another bookmark uses moves the link. */
    fun assign(bookmarkId: UUID, target: LinkTarget?, project: SurveyProject): SurveyProject {
        if (project.bookmarks.none { it.id == bookmarkId }) throw BookmarkException(BookmarkException.Reason.UnknownBookmark)
        if (target != null && project.displayName(target) == null) throw BookmarkException(BookmarkException.Reason.UnknownTarget)
        val updated = project.bookmarks.map { b ->
            when {
                b.id == bookmarkId -> b.copy(target = target)
                target != null && b.target == target -> b.copy(target = null)
                else -> b
            }
        }
        return project.copy(bookmarks = updated, updatedAt = Dates.now())
    }

    fun addReviewBookmark(mediaTime: Double, label: String, project: SurveyProject): Pair<Bookmark, SurveyProject> {
        project.video?.durationSeconds?.let { d ->
            if (mediaTime < 0 || mediaTime > d + 0.001) throw BookmarkException(BookmarkException.Reason.TimeOutsideVideo)
        }
        val b = Bookmark(mediaTime = maxOf(0.0, mediaTime), label = label, origin = Bookmark.Origin.addedInReview)
        return b to project.copy(bookmarks = (project.bookmarks + b).sortedBy { it.mediaTime }, updatedAt = Dates.now())
    }

    fun retime(bookmarkId: UUID, mediaTime: Double, project: SurveyProject): SurveyProject {
        if (project.bookmarks.none { it.id == bookmarkId }) throw BookmarkException(BookmarkException.Reason.UnknownBookmark)
        val upper = project.video?.durationSeconds ?: Double.MAX_VALUE
        val t = mediaTime.coerceIn(0.0, upper)
        return project.copy(
            bookmarks = project.bookmarks.map { if (it.id == bookmarkId) it.copy(mediaTime = t) else it }.sortedBy { it.mediaTime },
            updatedAt = Dates.now(),
        )
    }

    fun remove(bookmarkId: UUID, project: SurveyProject): SurveyProject =
        project.copy(bookmarks = project.bookmarks.filterNot { it.id == bookmarkId }, updatedAt = Dates.now())

    fun bookmarkFor(target: LinkTarget, project: SurveyProject): Bookmark? = project.bookmarks.firstOrNull { it.target == target }

    fun seekTime(target: LinkTarget, project: SurveyProject, preRoll: Double = DEFAULT_PRE_ROLL): Double? {
        val video = project.video ?: return null
        val b = bookmarkFor(target, project) ?: return null
        return clampedSeek(b.mediaTime, preRoll, video.durationSeconds)
    }

    fun clampedSeek(mediaTime: Double, preRoll: Double, duration: Double): Double =
        (mediaTime - preRoll).coerceIn(0.0, maxOf(0.0, duration))
}
