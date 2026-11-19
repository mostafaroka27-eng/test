package com.roomscan.android.capture

import com.roomscan.android.DeviceInfo
import com.roomscan.android.ProjectRepository
import com.roomscan.core.AlignmentAssessor
import com.roomscan.core.Bookmark
import com.roomscan.core.BookmarkService
import com.roomscan.core.Dates
import com.roomscan.core.ManualSurveyBuilder
import com.roomscan.core.OpeningDraft
import com.roomscan.core.OpeningKind
import com.roomscan.core.OutputKind
import com.roomscan.core.RecordingClock
import com.roomscan.core.RoomCaptureFacts
import com.roomscan.core.RoomOutlineDraft
import com.roomscan.core.StorageBudget
import com.roomscan.core.SurveyProject
import com.roomscan.core.TapPoint
import com.roomscan.core.VideoInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID

/** Capture flow for one walkthrough: rooms are outlined by tapping, the video runs throughout. */
class CaptureController(
    private val repo: ProjectRepository,
    private val engine: ArEngine,
    private val scope: CoroutineScope,
    initial: SurveyProject,
) : ArEngine.Listener {

    enum class Phase { Ready, ScanningRoom, BetweenRooms, Finishing, Done }

    sealed class Tool {
        data object Corners : Tool()
        data object WallHeight : Tool()
        data class Opening(val kind: OpeningKind) : Tool()
    }

    /** One-shot messages; the screen turns them into localized text. */
    enum class Notice {
        BookmarkSaved, BookmarkNoVideo, NoSurface, NeedClosedRoom, NeedThreeCorners, OpeningSaved, HeightSaved,
        VideoStoppedBackground, VideoFailed, StorageLow, StorageFull, RoomOutlineDiscarded,
    }

    data class UiState(
        val phase: Phase = Phase.Ready,
        val project: SurveyProject,
        val roomIndex: Int = 0,
        val tool: Tool = Tool.Corners,
        val outline: RoomOutlineDraft = RoomOutlineDraft(),
        /** Set once the current room's outline is closed and saved. */
        val currentRoomId: UUID? = null,
        val opening: OpeningDraft? = null,
        val heightFloor: TapPoint? = null,
        val videoRecording: Boolean = false,
        val videoProblem: String? = null,
        val notice: Notice? = null,
        val noticeSerial: Int = 0,
        val bookmarkCount: Int = 0,
        val finishedProblems: List<String> = emptyList(),
    )

    private val startedProject = initial
    private val _ui = MutableStateFlow(UiState(project = initial))
    val ui: StateFlow<UiState> = _ui

    private var videoStartedAt: Instant? = null
    private var stoppedVideo: Triple<VideoRecorder.Result, RecordingClock, Pair<Int, Int>>? = null
    private var stopReason: String? = null
    private val facts = mutableListOf<RoomCaptureFacts>()
    private var roomStartMediaTime: Double? = null
    private var storageWarned = false

    init { engine.listener = this }

    private fun notice(n: Notice) = _ui.update { it.copy(notice = n, noticeSerial = it.noticeSerial + 1) }

    // ------------------------------------------------------------------ actions

    fun start() {
        val budget = StorageBudget()
        if (!budget.canStart(DeviceInfo.freeBytes(repo.projectDir(_ui.value.project)))) { notice(Notice.StorageFull); return }
        repo.file(_ui.value.project, VIDEO_PATH).delete()
        engine.startRecording(repo.file(_ui.value.project, VIDEO_PATH))
        engine.resetTrackingCounter()
        roomStartMediaTime = 0.0
        _ui.update { it.copy(phase = Phase.ScanningRoom, roomIndex = 1, tool = Tool.Corners, outline = RoomOutlineDraft(), currentRoomId = null) }
    }

    fun selectTool(tool: Tool) {
        val s = _ui.value
        if (tool !is Tool.Corners && s.currentRoomId == null) { notice(Notice.NeedClosedRoom); return }
        _ui.update { it.copy(tool = tool, opening = (tool as? Tool.Opening)?.let { t -> OpeningDraft(t.kind) }, heightFloor = null) }
    }

    /** Adds the point under the crosshair (or a tapped point) to the active tool. */
    fun addPoint(p: TapPoint?) {
        if (p == null) { notice(Notice.NoSurface); return }
        val s = _ui.value
        if (s.phase != Phase.ScanningRoom) return
        when (val tool = s.tool) {
            Tool.Corners -> if (s.currentRoomId == null) _ui.update { it.copy(outline = it.outline.add(p)) }
            Tool.WallHeight -> {
                val floor = s.heightFloor
                if (floor == null) _ui.update { it.copy(heightFloor = p) }
                else saveProject(ManualSurveyBuilder.setRoomWallHeight(s.project, s.currentRoomId!!, floor, p)) {
                    _ui.update { it.copy(heightFloor = null, tool = Tool.Corners) }; notice(Notice.HeightSaved)
                }
            }
            is Tool.Opening -> {
                val draft = (s.opening ?: OpeningDraft(tool.kind)).add(p)
                _ui.update { it.copy(opening = draft) }
                if (draft.top != null) saveOpening(draft)
            }
        }
    }

    /** Saves a door/window with width only (height not tapped). */
    fun saveOpeningWithoutHeight() { _ui.value.opening?.takeIf { it.isComplete }?.let(::saveOpening) }

    private fun saveOpening(draft: OpeningDraft) {
        val s = _ui.value
        val roomId = s.currentRoomId ?: return
        val (p, _) = ManualSurveyBuilder.addOpening(s.project, roomId, draft, s.outline.floorY)
        saveProject(p) { _ui.update { it.copy(opening = OpeningDraft(draft.kind)) }; notice(Notice.OpeningSaved) }
    }

    fun undo() = _ui.update {
        when {
            it.opening != null && it.opening.step > 0 -> it.copy(opening = it.opening.undo())
            it.heightFloor != null -> it.copy(heightFloor = null)
            it.currentRoomId == null -> it.copy(outline = it.outline.undo())
            else -> it
        }
    }

    fun closeRoom(name: String) {
        val s = _ui.value
        if (!s.outline.canClose) { notice(Notice.NeedThreeCorners); return }
        val (p, roomId) = ManualSurveyBuilder.addRoom(s.project, s.outline, name, roomStartMediaTime, null)
        saveProject(p) { _ui.update { it.copy(currentRoomId = roomId, tool = Tool.Opening(OpeningKind.door), opening = OpeningDraft(OpeningKind.door)) } }
    }

    fun bookmark(label: String) {
        val t = engine.mediaTimeNow()
        if (t == null || !engine.isRecording) { notice(Notice.BookmarkNoVideo); return }
        val s = _ui.value
        val b = Bookmark(mediaTime = t, label = label, roomScanIndex = s.roomIndex.takeIf { it > 0 }, origin = Bookmark.Origin.duringCapture)
        saveProject(s.project.copy(bookmarks = (s.project.bookmarks + b).sortedBy { it.mediaTime })) {
            _ui.update { it.copy(bookmarkCount = it.bookmarkCount + 1) }; notice(Notice.BookmarkSaved)
        }
    }

    fun finishRoom() {
        val s = _ui.value
        val roomId = s.currentRoomId ?: run { notice(Notice.NeedClosedRoom); return }
        val end = engine.mediaTimeNow()
        val p = s.project.copy(rooms = s.project.rooms.map { if (it.id == roomId) it.copy(captureEndMediaTime = end) else it })
        facts += RoomCaptureFacts(roomId, engine.sessionEpoch, p.room(roomId)!!.floorPolygon, engine.trackingLimitedSeconds)
        saveProject(p) { _ui.update { it.copy(phase = Phase.BetweenRooms, currentRoomId = null, outline = RoomOutlineDraft(), opening = null, heightFloor = null) } }
    }

    fun nextRoom() {
        engine.resetTrackingCounter()
        roomStartMediaTime = engine.mediaTimeNow()
        _ui.update { it.copy(phase = Phase.ScanningRoom, roomIndex = it.roomIndex + 1, tool = Tool.Corners, outline = RoomOutlineDraft(), currentRoomId = null) }
    }

    /** Ends the walkthrough: closes the MP4, records alignment, saves everything. */
    fun finishSurvey(onDone: (SurveyProject) -> Unit) {
        val s = _ui.value
        if (s.phase == Phase.ScanningRoom && s.currentRoomId != null) finishRoom()
        else if (s.phase == Phase.ScanningRoom && s.outline.corners.isNotEmpty()) notice(Notice.RoomOutlineDiscarded)
        _ui.update { it.copy(phase = Phase.Finishing) }
        val already = stoppedVideo
        if (already != null || !engine.isRecording) finalize(already, onDone)
        else engine.stopRecording { result, clock, w, h ->
            finalize(if (result != null && clock != null) Triple(result, clock, w to h) else null, onDone)
        }
    }

    /** Throws the walkthrough away: the project returns to how it was before this capture. */
    fun discard(onDone: () -> Unit) {
        engine.stopRecording { _, _, _, _ ->
            scope.launch {
                repo.file(startedProject, VIDEO_PATH).takeIf { startedProject.video == null }?.delete()
                repo.save(startedProject)
                onDone()
            }
        }
    }

    private fun finalize(video: Triple<VideoRecorder.Result, RecordingClock, Pair<Int, Int>>?, onDone: (SurveyProject) -> Unit) {
        scope.launch {
            var p = _ui.value.project
            val problems = mutableListOf<String>()
            if (video != null) {
                val (result, clock, size) = video
                val finished = when (result) {
                    is VideoRecorder.Result.Finished -> result
                    is VideoRecorder.Result.Failed -> { problems += result.message; result.partial }
                }
                if (finished != null && finished.framesWritten > 0) {
                    p = p.copy(video = VideoInfo(
                        relativePath = VIDEO_PATH, durationSeconds = finished.durationSeconds,
                        framesWritten = finished.framesWritten, framesDropped = finished.framesDropped,
                        pixelWidth = size.first, pixelHeight = size.second, rotationDegrees = 0, codec = "h264",
                        nominalFrameRate = 30.0, startedAt = videoStartedAt ?: Dates.now(),
                        interruptions = clock.interruptions, stopReason = stopReason,
                    ))
                    p = runCatching { repo.store.registerOutput(OutputKind.video, VIDEO_PATH, p) }.getOrElse { problems += it.message ?: "video"; p }
                    // Bookmarks can't point past the end of the saved file.
                    p = p.copy(bookmarks = p.bookmarks.map { it.copy(mediaTime = BookmarkService.clampedSeek(it.mediaTime, 0.0, finished.durationSeconds)) })
                }
            }
            if (facts.isNotEmpty()) {
                val (report, statuses) = AlignmentAssessor.assess(facts, structureMerged = false)
                p = p.copy(alignment = report, rooms = p.rooms.map { r -> statuses[r.id]?.let { r.copy(alignment = it) } ?: r })
            }
            p = repo.save(p.copy(captureDeviceModel = DeviceInfo.model))
            _ui.update { it.copy(phase = Phase.Done, project = p, finishedProblems = problems) }
            repo.refresh()
            onDone(p)
        }
    }

    private fun saveProject(p: SurveyProject, then: () -> Unit) {
        _ui.update { it.copy(project = p) }
        then()
        scope.launch { runCatching { repo.save(p) } }
    }

    // ------------------------------------------------------------------ engine callbacks (main thread)

    override fun onVideoStarted(width: Int, height: Int) {
        videoStartedAt = Dates.now()
        _ui.update { it.copy(videoRecording = true, videoProblem = null) }
    }

    override fun onVideoStopped(result: VideoRecorder.Result, reason: String, clock: RecordingClock, width: Int, height: Int) {
        stoppedVideo = Triple(result, clock, width to height)
        stopReason = reason
        _ui.update { it.copy(videoRecording = false, videoProblem = (result as? VideoRecorder.Result.Failed)?.message) }
        notice(if (reason == "appBackgrounded") Notice.VideoStoppedBackground else Notice.VideoFailed)
    }

    override fun onArError(message: String) = notice(Notice.NoSurface)

    /** Called about once a second by the screen to warn before the disk fills. */
    fun checkStorage() {
        if (!engine.isRecording) return
        when (StorageBudget().evaluate(DeviceInfo.freeBytes(repo.projectDir(_ui.value.project)))) {
            is StorageBudget.Verdict.Low -> if (!storageWarned) { storageWarned = true; notice(Notice.StorageLow) }
            StorageBudget.Verdict.MustStop -> engine.stopRecording { r, c, w, h ->
                if (r != null && c != null) onVideoStoppedByStorage(r, c, w, h)
            }
            else -> Unit
        }
    }

    private fun onVideoStoppedByStorage(r: VideoRecorder.Result, c: RecordingClock, w: Int, h: Int) {
        stoppedVideo = Triple(r, c, w to h); stopReason = "lowStorage"
        _ui.update { it.copy(videoRecording = false) }
        notice(Notice.StorageFull)
    }

    companion object { const val VIDEO_PATH = "video.mp4" }
}
