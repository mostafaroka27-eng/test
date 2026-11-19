package com.roomscan.android.capture

import android.Manifest
import android.app.Activity
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LargeFloatingActionButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.ar.core.ArCoreApk
import com.google.ar.core.TrackingFailureReason
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.UnavailableException
import com.roomscan.android.R
import com.roomscan.android.repository
import com.roomscan.core.OpeningKind
import com.roomscan.core.SurveyProject
import com.roomscan.core.TapPoint
import com.roomscan.core.TimeFormat
import com.roomscan.core.Units
import com.roomscan.core.Vec3
import kotlinx.coroutines.delay
import kotlin.math.abs

private enum class ArAvailability { Checking, Ready, NeedsPermission, Unsupported, Failed }

@Composable
fun CaptureScreen(project: SurveyProject, onFinished: (SurveyProject) -> Unit, onCancel: () -> Unit) {
    val context = LocalContext.current
    val activity = context as Activity
    val repo = context.repository
    val scope = rememberCoroutineScope()
    val engine = remember { ArEngine(activity) }
    val controller = remember { CaptureController(repo, engine, scope, project) }
    val ui by controller.ui.collectAsStateWithLifecycle()
    val ar by engine.state.collectAsStateWithLifecycle()
    var availability by remember { mutableStateOf(ArAvailability.Checking) }
    var installRequested by remember { mutableStateOf(false) }
    var confirmDiscard by remember { mutableStateOf(false) }

    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        availability = if (granted) ArAvailability.Checking else ArAvailability.NeedsPermission
    }

    fun prepareAr() {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            availability = ArAvailability.NeedsPermission
            return
        }
        try {
            when (ArCoreApk.getInstance().requestInstall(activity, !installRequested)) {
                ArCoreApk.InstallStatus.INSTALL_REQUESTED -> { installRequested = true; return }
                ArCoreApk.InstallStatus.INSTALLED -> Unit
            }
            engine.ensureSession()
            engine.resume()
            availability = ArAvailability.Ready
        } catch (e: UnavailableException) {
            availability = if (ArCoreApk.getInstance().checkAvailability(context).isUnsupported) ArAvailability.Unsupported else ArAvailability.Failed
        } catch (e: Exception) {
            availability = ArAvailability.Failed
        }
    }

    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> prepareAr()
                Lifecycle.Event.ON_PAUSE -> engine.pause()
                else -> Unit
            }
        }
        lifecycle.addObserver(observer)
        engine.view.keepScreenOn = true
        onDispose {
            lifecycle.removeObserver(observer)
            engine.pause()
            engine.close()
            activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }
    LaunchedEffect(availability) { if (availability == ArAvailability.Checking && lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) prepareAr() }

    // Keep the image upright in the MP4: no rotation while a walkthrough is running.
    LaunchedEffect(ui.phase) {
        activity.requestedOrientation = if (ui.phase == CaptureController.Phase.Ready) ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        else ActivityInfo.SCREEN_ORIENTATION_LOCKED
    }
    LaunchedEffect(ui.videoRecording) { while (ui.videoRecording) { controller.checkStorage(); delay(1000) } }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        when (availability) {
            ArAvailability.Ready, ArAvailability.Checking -> {
                AndroidView(factory = { engine.view }, modifier = Modifier.fillMaxSize())
                MeasureOverlay(ar, ui, onTap = { x, y -> engine.hitTest(x, y) { controller.addPoint(it) } })
            }
            ArAvailability.NeedsPermission -> CenterMessage(stringResource(R.string.capture_camera_permission)) {
                Button(onClick = { permission.launch(Manifest.permission.CAMERA) }) { Text(stringResource(R.string.capture_allow_camera)) }
            }
            ArAvailability.Unsupported -> CenterMessage(stringResource(R.string.capture_ar_unsupported)) {}
            ArAvailability.Failed -> CenterMessage(stringResource(R.string.capture_ar_failed)) {
                Button(onClick = { availability = ArAvailability.Checking }) { Text(stringResource(R.string.action_retry)) }
            }
        }

        TopStatus(ar, ui, Modifier.align(Alignment.TopCenter))
        NoticeBanner(ui, Modifier.align(Alignment.Center))

        val roomName = stringResource(R.string.room_default_name, ui.roomIndex)
        val bookmarkLabel = stringResource(R.string.bookmark_default_label, ui.bookmarkCount + 1)
        BottomControls(
            ui = ui, ar = ar, enabled = availability == ArAvailability.Ready,
            onStart = controller::start,
            onAddPoint = { engine.hitTestCenter { controller.addPoint(it) } },
            onUndo = controller::undo,
            onTool = controller::selectTool,
            onCloseRoom = { controller.closeRoom(roomName) },
            onSaveWithoutHeight = controller::saveOpeningWithoutHeight,
            onBookmark = { controller.bookmark(bookmarkLabel) },
            onFinishRoom = controller::finishRoom,
            onNextRoom = controller::nextRoom,
            onFinishSurvey = { controller.finishSurvey(onFinished) },
            onCancel = { if (ui.phase == CaptureController.Phase.Ready) onCancel() else confirmDiscard = true },
            modifier = Modifier.align(Alignment.BottomCenter),
        )

        if (ui.phase == CaptureController.Phase.Finishing) {
            Box(Modifier.fillMaxSize().background(Color(0x99000000)), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    CircularProgressIndicator()
                    Spacer(Modifier.height(12.dp))
                    Text(stringResource(R.string.capture_finishing), color = Color.White)
                }
            }
        }
    }

    if (confirmDiscard) AlertDialog(
        onDismissRequest = { confirmDiscard = false },
        title = { Text(stringResource(R.string.capture_discard_title)) },
        text = { Text(stringResource(R.string.capture_discard_message)) },
        confirmButton = { TextButton(onClick = { confirmDiscard = false; controller.discard(onCancel) }) { Text(stringResource(R.string.capture_discard_confirm), color = Color(0xFFD32F2F)) } },
        dismissButton = { TextButton(onClick = { confirmDiscard = false }) { Text(stringResource(R.string.action_keep_scanning)) } },
    )
}

@Composable
private fun CenterMessage(text: String, action: @Composable () -> Unit) {
    Column(Modifier.fillMaxSize().padding(32.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text, color = Color.White, fontSize = 17.sp)
        Spacer(Modifier.height(16.dp))
        action()
    }
}

/** Draws tapped points, the room outline, the live segment to the crosshair and its length. */
@Composable
private fun MeasureOverlay(ar: ArFrameState, ui: CaptureController.UiState, onTap: (Float, Float) -> Unit) {
    val measurer = rememberTextMeasurer()
    val label = TextStyle(color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold, background = Color(0xCC000000))
    Canvas(Modifier.fillMaxSize().pointerInput(Unit) { detectTapGestures { onTap(it.x, it.y) } }) {
        fun proj(v: Vec3): Offset? = ar.project(v)?.let { Offset(it.first, it.second) }
        val orange = Color(0xFFFF9500); val blue = Color(0xFF4DA3FF); val green = Color(0xFF34C759)

        // Room outline (open while drawing, closed once saved).
        val corners = ui.outline.corners.map { it.position }
        val pts = corners.mapNotNull(::proj)
        for (i in 0 until pts.size - 1) drawLine(green, pts[i], pts[i + 1], strokeWidth = 6f)
        if (ui.currentRoomId != null && pts.size >= 3) drawLine(green, pts.last(), pts.first(), strokeWidth = 6f)
        pts.forEach { drawCircle(green, 12f, it); drawCircle(Color.White, 12f, it, style = Stroke(3f)) }

        // Opening being measured.
        ui.opening?.let { o ->
            listOfNotNull(o.jambA, o.jambB, o.top).mapNotNull { proj(it.position) }.forEach { drawCircle(orange, 12f, it) }
            val a = o.jambA?.position?.let(::proj); val b = o.jambB?.position?.let(::proj)
            if (a != null && b != null) drawLine(orange, a, b, strokeWidth = 6f)
        }
        ui.heightFloor?.position?.let(::proj)?.let { drawCircle(blue, 12f, it) }

        // Live segment from the last point to the crosshair, with its length in mm.
        val reticle = ar.reticle
        val center = Offset(size.width / 2, size.height / 2)
        val anchor: Vec3? = when {
            ui.heightFloor != null -> ui.heightFloor.position
            ui.opening?.jambB != null -> ui.opening.jambB!!.position
            ui.opening?.jambA != null -> ui.opening.jambA!!.position
            ui.currentRoomId == null && corners.isNotEmpty() -> corners.last()
            else -> null
        }
        if (reticle != null && anchor != null) {
            val from = proj(anchor)
            val meters = when {
                ui.heightFloor != null -> abs(reticle.position.y - anchor.y)
                ui.opening?.jambB != null -> reticle.position.y - (ui.opening.bottomY ?: anchor.y)
                else -> reticle.position.horizontalDistanceTo(anchor)
            }
            if (from != null) drawLine(Color.White, from, center, strokeWidth = 4f)
            val text = "${Units.millimetersFromMeters(meters)} mm"
            val layout = measurer.measure(text, label)
            drawText(layout, topLeft = Offset(center.x - layout.size.width / 2f, center.y - 70f))
        }

        // Crosshair: solid when the centre hits a surface, dashed-looking grey when not.
        val c = when (reticle?.quality) { null -> Color(0x88FFFFFF); com.roomscan.core.HitQuality.point -> Color(0xFFFFCC00); else -> Color.White }
        drawCircle(c, 26f, center, style = Stroke(4f))
        drawLine(c, center.copy(x = center.x - 40f), center.copy(x = center.x - 14f), strokeWidth = 4f)
        drawLine(c, center.copy(x = center.x + 14f), center.copy(x = center.x + 40f), strokeWidth = 4f)
        drawLine(c, center.copy(y = center.y - 40f), center.copy(y = center.y - 14f), strokeWidth = 4f)
        drawLine(c, center.copy(y = center.y + 14f), center.copy(y = center.y + 40f), strokeWidth = 4f)
    }
}

@Composable
private fun TopStatus(ar: ArFrameState, ui: CaptureController.UiState, modifier: Modifier) {
    Column(modifier.fillMaxWidth().statusBarsPadding().padding(12.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            val rec = ar.recordingMediaTime
            Pill(if (rec != null) "● " + TimeFormat.clock(rec) else stringResource(R.string.capture_not_recording),
                if (rec != null) Color(0xEEFF3B30) else Color(0x99000000))
            Pill(when (ui.phase) {
                CaptureController.Phase.ScanningRoom -> stringResource(R.string.capture_scanning_room, ui.roomIndex)
                CaptureController.Phase.BetweenRooms -> stringResource(R.string.capture_rooms_done, ui.project.rooms.size)
                else -> stringResource(R.string.capture_title)
            }, Color(0x99000000))
        }
        val hint = when {
            ui.phase == CaptureController.Phase.Ready -> stringResource(R.string.capture_hint_ready)
            ar.tracking != TrackingState.TRACKING -> when (ar.failure) {
                TrackingFailureReason.INSUFFICIENT_LIGHT -> stringResource(R.string.tracking_light)
                TrackingFailureReason.EXCESSIVE_MOTION -> stringResource(R.string.tracking_motion)
                TrackingFailureReason.INSUFFICIENT_FEATURES -> stringResource(R.string.tracking_features)
                TrackingFailureReason.CAMERA_UNAVAILABLE -> stringResource(R.string.tracking_camera)
                else -> stringResource(R.string.tracking_initializing)
            }
            ui.phase == CaptureController.Phase.BetweenRooms -> stringResource(R.string.capture_between_rooms_hint)
            ui.phase != CaptureController.Phase.ScanningRoom -> null
            ui.tool == CaptureController.Tool.WallHeight ->
                stringResource(if (ui.heightFloor == null) R.string.hint_height_floor else R.string.hint_height_top)
            ui.tool is CaptureController.Tool.Opening -> stringResource(when (ui.opening?.step ?: 0) {
                0 -> R.string.hint_opening_a; 1 -> R.string.hint_opening_b; else -> R.string.hint_opening_top
            })
            ui.currentRoomId == null -> stringResource(if (ui.outline.corners.size < 3) R.string.hint_corners else R.string.hint_corners_close)
            else -> null
        }
        val warn = ar.tracking != TrackingState.TRACKING && ui.phase != CaptureController.Phase.Ready
        if (hint != null) {
            Spacer(Modifier.height(8.dp))
            Text(hint, color = Color.White, fontSize = 14.sp,
                modifier = Modifier.background(if (warn) Color(0xEEFF9500) else Color(0xAA000000), RoundedCornerShape(12.dp)).padding(10.dp).fillMaxWidth())
        }
        if (ui.videoProblem != null) {
            Spacer(Modifier.height(6.dp))
            Text(stringResource(R.string.capture_video_failed, ui.videoProblem), color = Color.White, fontSize = 13.sp,
                modifier = Modifier.background(Color(0xEED32F2F), RoundedCornerShape(12.dp)).padding(10.dp).fillMaxWidth())
        }
    }
}

@Composable
private fun Pill(text: String, color: Color) {
    Text(text, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp,
        modifier = Modifier.background(color, RoundedCornerShape(20.dp)).padding(horizontal = 14.dp, vertical = 6.dp))
}

@Composable
private fun NoticeBanner(ui: CaptureController.UiState, modifier: Modifier) {
    var visible by remember { mutableStateOf<CaptureController.Notice?>(null) }
    LaunchedEffect(ui.noticeSerial) {
        if (ui.notice != null) { visible = ui.notice; delay(2200); visible = null }
    }
    val n = visible ?: return
    val (text, color) = when (n) {
        CaptureController.Notice.BookmarkSaved -> stringResource(R.string.capture_bookmark_saved) to Color(0xEE34C759)
        CaptureController.Notice.OpeningSaved -> stringResource(R.string.capture_opening_saved) to Color(0xEE34C759)
        CaptureController.Notice.HeightSaved -> stringResource(R.string.capture_height_saved) to Color(0xEE34C759)
        CaptureController.Notice.BookmarkNoVideo -> stringResource(R.string.capture_bookmark_no_video) to Color(0xEEFF9500)
        CaptureController.Notice.NoSurface -> stringResource(R.string.capture_no_surface) to Color(0xEEFF9500)
        CaptureController.Notice.NeedClosedRoom -> stringResource(R.string.capture_need_closed_room) to Color(0xEEFF9500)
        CaptureController.Notice.NeedThreeCorners -> stringResource(R.string.capture_need_three_corners) to Color(0xEEFF9500)
        CaptureController.Notice.RoomOutlineDiscarded -> stringResource(R.string.capture_outline_discarded) to Color(0xEEFF9500)
        CaptureController.Notice.VideoStoppedBackground -> stringResource(R.string.capture_video_stopped_background) to Color(0xEEFF9500)
        CaptureController.Notice.VideoFailed -> stringResource(R.string.capture_video_failed, ui.videoProblem ?: "") to Color(0xEED32F2F)
        CaptureController.Notice.StorageLow -> stringResource(R.string.capture_storage_low) to Color(0xEEFF9500)
        CaptureController.Notice.StorageFull -> stringResource(R.string.capture_storage_full) to Color(0xEED32F2F)
    }
    Text(text, color = Color.White, fontWeight = FontWeight.Bold,
        modifier = modifier.padding(32.dp).widthIn(max = 420.dp).background(color, RoundedCornerShape(16.dp)).padding(14.dp))
}

@Composable
private fun BottomControls(
    ui: CaptureController.UiState,
    ar: ArFrameState,
    enabled: Boolean,
    onStart: () -> Unit,
    onAddPoint: () -> Unit,
    onUndo: () -> Unit,
    onTool: (CaptureController.Tool) -> Unit,
    onCloseRoom: () -> Unit,
    onSaveWithoutHeight: () -> Unit,
    onBookmark: () -> Unit,
    onFinishRoom: () -> Unit,
    onNextRoom: () -> Unit,
    onFinishSurvey: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier,
) {
    Column(
        modifier.fillMaxWidth().widthIn(max = 720.dp).navigationBarsPadding().padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        when (ui.phase) {
            CaptureController.Phase.Ready -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = onCancel, colors = ButtonDefaults.outlinedButtonColors(containerColor = Color(0xCCFFFFFF))) { Text(stringResource(R.string.action_cancel)) }
                Button(onClick = onStart, enabled = enabled && ar.tracking == TrackingState.TRACKING) { Text(stringResource(R.string.capture_start)) }
            }

            CaptureController.Phase.ScanningRoom -> {
                if (ui.currentRoomId != null) {
                    Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ToolChip(stringResource(R.string.kind_door), ui.tool == CaptureController.Tool.Opening(OpeningKind.door)) { onTool(CaptureController.Tool.Opening(OpeningKind.door)) }
                        ToolChip(stringResource(R.string.kind_window), ui.tool == CaptureController.Tool.Opening(OpeningKind.window)) { onTool(CaptureController.Tool.Opening(OpeningKind.window)) }
                        ToolChip(stringResource(R.string.kind_opening), ui.tool == CaptureController.Tool.Opening(OpeningKind.opening)) { onTool(CaptureController.Tool.Opening(OpeningKind.opening)) }
                        ToolChip(stringResource(R.string.tool_wall_height), ui.tool == CaptureController.Tool.WallHeight) { onTool(CaptureController.Tool.WallHeight) }
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                    IconButton(onClick = onUndo, modifier = Modifier.size(56.dp).background(Color(0xCCFFFFFF), RoundedCornerShape(28.dp))) {
                        Icon(Icons.AutoMirrored.Filled.Undo, stringResource(R.string.action_undo))
                    }
                    LargeFloatingActionButton(onClick = onAddPoint, containerColor = Color.White) {
                        Icon(Icons.Filled.Add, stringResource(R.string.capture_add_point), modifier = Modifier.size(40.dp))
                    }
                    IconButton(onClick = onBookmark, modifier = Modifier.size(56.dp).background(Color(0xFFFF9500), RoundedCornerShape(28.dp))) {
                        Icon(Icons.Filled.Bookmark, stringResource(R.string.capture_bookmark), tint = Color.White)
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (ui.currentRoomId == null) {
                        FilledTonalButton(onClick = onCloseRoom, enabled = ui.outline.canClose) { Text(stringResource(R.string.capture_close_room)) }
                    } else {
                        if (ui.opening?.isComplete == true && ui.opening.top == null)
                            FilledTonalButton(onClick = onSaveWithoutHeight) { Text(stringResource(R.string.capture_save_without_height)) }
                        Button(onClick = onFinishRoom) { Text(stringResource(R.string.capture_finish_room)) }
                    }
                    OutlinedButton(onClick = onCancel, colors = ButtonDefaults.outlinedButtonColors(containerColor = Color(0xCCFFFFFF))) { Text(stringResource(R.string.action_cancel)) }
                }
            }

            CaptureController.Phase.BetweenRooms -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                IconButton(onClick = onBookmark, modifier = Modifier.size(52.dp).background(Color(0xFFFF9500), RoundedCornerShape(26.dp))) {
                    Icon(Icons.Filled.Bookmark, stringResource(R.string.capture_bookmark), tint = Color.White)
                }
                Button(onClick = onNextRoom) { Text(stringResource(R.string.capture_next_room)) }
                FilledTonalButton(onClick = onFinishSurvey) { Text(stringResource(R.string.capture_finish_survey)) }
            }

            else -> Unit
        }
        if (ui.phase == CaptureController.Phase.ScanningRoom && ui.project.rooms.isNotEmpty() && ui.currentRoomId == null) {
            TextButton(onClick = onFinishSurvey) { Text(stringResource(R.string.capture_finish_survey), color = Color.White) }
        }
    }
}

@Composable
private fun ToolChip(text: String, selected: Boolean, onClick: () -> Unit) {
    FilterChip(
        selected = selected, onClick = onClick, label = { Text(text) },
        colors = FilterChipDefaults.filterChipColors(containerColor = Color(0xCCFFFFFF), selectedContainerColor = Color(0xFF0A7AFF), selectedLabelColor = Color.White),
    )
}

@Suppress("unused")
private fun TapPoint.describe() = "${position.x},${position.y},${position.z}"
