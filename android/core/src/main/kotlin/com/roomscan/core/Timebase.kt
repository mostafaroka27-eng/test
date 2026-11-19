package com.roomscan.core

/**
 * The single clock shared by the MP4 and every bookmark (mirrors Timebase.swift).
 *
 * Host times are seconds on the clock ARCore uses for `Frame.getTimestamp()`.
 * Media time 0 is the first frame written. Interrupted intervals (app in the
 * background, camera lost) are removed from the media timeline, so a bookmark
 * taken at host time h lands on the frame captured at h in the saved file.
 */
class RecordingClock {
    var originHostTime: Double? = null; private set
    var pausedAtHostTime: Double? = null; private set
    var totalPausedSeconds: Double = 0.0; private set
    private val _interruptions = mutableListOf<VideoInterruption>()
    val interruptions: List<VideoInterruption> get() = _interruptions

    val isStarted get() = originHostTime != null
    val isPaused get() = pausedAtHostTime != null

    fun start(hostTime: Double) {
        check(originHostTime == null) { "RecordingClock started twice" }
        originHostTime = hostTime
    }

    fun pause(hostTime: Double) {
        if (originHostTime == null || pausedAtHostTime != null) return
        pausedAtHostTime = hostTime
    }

    /** Resumes after an interruption; returns the removed gap in seconds. */
    fun resume(hostTime: Double, reason: String): Double {
        val pausedAt = pausedAtHostTime ?: return 0.0
        val gap = maxOf(0.0, hostTime - pausedAt)
        val mediaAtPause = mediaTime(pausedAt) ?: 0.0
        totalPausedSeconds += gap
        pausedAtHostTime = null
        _interruptions += VideoInterruption(mediaAtPause, gap, reason)
        return gap
    }

    /** Host → media time; null before the first frame; clamps to the pause point while paused. */
    fun mediaTime(hostTime: Double): Double? {
        val origin = originHostTime ?: return null
        val paused = pausedAtHostTime
        val effective = if (paused != null && hostTime > paused) paused else hostTime
        val t = effective - origin - totalPausedSeconds
        return if (t < 0) null else t
    }
}

/** Decides which camera frames are encoded: monotonic, evenly paced, bounded rate. */
class FrameAdmission(val targetFrameRate: Double = 30.0) {
    sealed class Decision {
        data class Write(val mediaTime: Double) : Decision()
        data object SkipRateLimit : Decision()
        data object SkipNonMonotonic : Decision()
        data object SkipBeforeStart : Decision()
        data object SkipPaused : Decision()
    }

    init { require(targetFrameRate > 0) }

    var lastWrittenMediaTime: Double? = null; private set
    var droppedByEncoder = 0; private set
    var written = 0; private set

    internal val minSpacing get() = 0.9 / targetFrameRate

    fun decide(hostTime: Double, clock: RecordingClock): Decision {
        if (clock.isPaused) return Decision.SkipPaused
        val t = clock.mediaTime(hostTime) ?: return Decision.SkipBeforeStart
        lastWrittenMediaTime?.let { last ->
            if (t <= last) return Decision.SkipNonMonotonic
            if (t - last < minSpacing) return Decision.SkipRateLimit
        }
        return Decision.Write(t)
    }

    fun didWrite(mediaTime: Double) { lastWrittenMediaTime = mediaTime; written++ }
    fun didDropAtEncoder() { droppedByEncoder++ }
}

/** Whether there is room to keep recording (mirrors StorageBudget.swift). */
class StorageBudget(val reserveBytes: Long = 500_000_000L, videoBitsPerSecond: Int = 6_000_000) {
    val bytesPerSecond: Long = (videoBitsPerSecond / 8).toLong()

    sealed class Verdict {
        data class Ok(val secondsRemaining: Double) : Verdict()
        data class Low(val secondsRemaining: Double) : Verdict()
        data object MustStop : Verdict()
    }

    fun evaluate(freeBytes: Long): Verdict {
        val usable = freeBytes - reserveBytes
        if (usable <= 0) return Verdict.MustStop
        val seconds = usable.toDouble() / maxOf(bytesPerSecond, 1L)
        return if (seconds < 300) Verdict.Low(seconds) else Verdict.Ok(seconds)
    }

    fun canStart(freeBytes: Long): Boolean = when (val v = evaluate(freeBytes)) {
        is Verdict.Ok -> true
        is Verdict.Low -> v.secondsRemaining >= 120
        Verdict.MustStop -> false
    }
}
