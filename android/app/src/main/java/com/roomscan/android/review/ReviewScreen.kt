package com.roomscan.android.review

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.VerticalDivider
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.SeekParameters
import androidx.media3.ui.PlayerView
import com.roomscan.android.AppSettings
import com.roomscan.android.R
import com.roomscan.android.export.ExportSheet
import com.roomscan.android.repository
import com.roomscan.core.AlignmentReport
import com.roomscan.core.LinkTarget
import com.roomscan.core.SurveyProject
import kotlinx.coroutines.launch
import java.io.File

/** Holds the project being reviewed and persists every edit immediately. */
class ReviewModel(initial: SurveyProject, private val save: suspend (SurveyProject) -> SurveyProject) {
    var project by mutableStateOf(initial)
        private set
    var error by mutableStateOf<String?>(null)

    suspend fun update(change: (SurveyProject) -> SurveyProject) {
        val next = try { change(project) } catch (e: Exception) { error = e.message; return }
        project = next
        try { project = save(next) } catch (e: Exception) { error = e.message }
    }

    fun replace(p: SurveyProject) { project = p }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReviewScreen(initial: SurveyProject, onBack: () -> Unit, onCapture: () -> Unit) {
    val context = LocalContext.current
    val repo = context.repository
    val scope = rememberCoroutineScope()
    val model = remember(initial.id) { ReviewModel(initial) { repo.save(it) } }
    val settings = remember { AppSettings(context) }
    val p = model.project
    var tab by remember { mutableIntStateOf(0) }
    var selected by remember { mutableStateOf<LinkTarget?>(null) }
    var showExport by remember { mutableStateOf(false) }
    val wide = LocalConfiguration.current.screenWidthDp >= 840
    val missing = remember(p.outputs) { repo.store.verifyOutputs(p) }

    val videoFile = p.video?.let { repo.file(p, it.relativePath) }?.takeIf { it.exists() }
    val player = rememberPlayer(videoFile)

    fun openTarget(t: LinkTarget) {
        selected = t
        val seek = com.roomscan.core.BookmarkService.seekTime(t, p, settings.preRollSeconds)
        if (seek != null && player != null) { player.seekTo((seek * 1000).toLong()); player.play() }
    }

    Scaffold(topBar = {
        TopAppBar(
            title = { Text(p.name, maxLines = 1) },
            navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.action_back)) } },
            actions = {
                IconButton(onClick = onCapture) { Icon(Icons.Filled.CameraAlt, stringResource(R.string.review_scan_more)) }
                IconButton(onClick = { showExport = true }) { Icon(Icons.Filled.Share, stringResource(R.string.export_title)) }
            },
        )
    }) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (p.isSample) Banner(stringResource(R.string.sample_badge), Color(0xFFFFF3D6), Color(0xFF8A5A00))
            if (missing.isNotEmpty()) Banner(stringResource(R.string.review_missing_files, missing.joinToString { it.name }), Color(0xFFFDE2E1), Color(0xFFB3261E))
            if (!p.hasScan) Banner(stringResource(R.string.review_no_scan), Color(0xFFE8F0FE), Color(0xFF174EA6))
            TabRow(selectedTabIndex = tab) {
                listOf(R.string.tab_plan, R.string.tab_measurements, R.string.tab_video).forEachIndexed { i, label ->
                    Tab(selected = tab == i, onClick = { tab = i }, text = { Text(stringResource(label)) })
                }
            }
            Row(Modifier.fillMaxSize()) {
                Box(Modifier.weight(1f).fillMaxHeight()) {
                    when (tab) {
                        0 -> Column {
                            AlignmentBanner(p.alignment)
                            PlanView(p, selected, onSelect = ::openTarget, modifier = Modifier.fillMaxSize())
                        }
                        1 -> MeasurementsTab(p, settings.roomUnit, onSelect = ::openTarget)
                        else -> VideoTab(model, player, scope)
                    }
                }
                if (wide && selected != null && tab != 2) {
                    VerticalDivider()
                    Column(Modifier.width(400.dp).fillMaxHeight().verticalScroll(rememberScrollState())) {
                        ItemDetail(model, selected!!, player, scope, onClose = { selected = null })
                    }
                }
            }
        }
    }

    if (!wide && selected != null && tab != 2) {
        ModalBottomSheet(onDismissRequest = { selected = null; player?.pause() }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                ItemDetail(model, selected!!, player, scope, onClose = { selected = null; player?.pause() })
            }
        }
    }
    if (showExport) ExportSheet(model.project, onUpdated = model::replace, onDismiss = { showExport = false })
    model.error?.let { e ->
        androidx.compose.material3.AlertDialog(onDismissRequest = { model.error = null }, text = { Text(e) },
            confirmButton = { androidx.compose.material3.TextButton(onClick = { model.error = null }) { Text(stringResource(R.string.action_ok)) } })
    }
}

@Composable
fun Banner(text: String, bg: Color, fg: Color) {
    Text(text, color = fg, style = MaterialTheme.typography.bodySmall,
        modifier = Modifier.fillMaxWidth().background(bg).padding(horizontal = 16.dp, vertical = 8.dp))
}

@Composable
private fun AlignmentBanner(a: AlignmentReport?) {
    a ?: return
    val (text, bg, fg) = when (a.overall) {
        AlignmentReport.Overall.single -> return
        AlignmentReport.Overall.connected -> Triple(stringResource(R.string.alignment_connected), Color(0xFFE3F7E8), Color(0xFF1E7B34))
        AlignmentReport.Overall.connectedWithWarnings -> Triple(stringResource(R.string.alignment_warnings), Color(0xFFFFF3D6), Color(0xFF8A5A00))
        AlignmentReport.Overall.notConnected -> Triple(stringResource(R.string.alignment_not_connected), Color(0xFFFDE2E1), Color(0xFFB3261E))
    }
    Banner(text, bg, fg)
}

/** One ExoPlayer per review screen, released with it. Seeks land on the exact frame. */
@Composable
fun rememberPlayer(file: File?): ExoPlayer? {
    val context = LocalContext.current
    val player = remember(file?.path) {
        file?.let {
            ExoPlayer.Builder(context).build().apply {
                setSeekParameters(SeekParameters.EXACT)
                setMediaItem(MediaItem.fromUri(Uri.fromFile(it)))
                repeatMode = Player.REPEAT_MODE_OFF
                prepare()
            }
        }
    }
    DisposableEffect(player) { onDispose { player?.release() } }
    return player
}

@Composable
fun VideoSurface(player: ExoPlayer?, modifier: Modifier = Modifier) {
    if (player == null) {
        Box(modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color(0xFF222222), RoundedCornerShape(12.dp)), contentAlignment = androidx.compose.ui.Alignment.Center) {
            Text(stringResource(R.string.video_none), color = Color.White)
        }
        return
    }
    AndroidView(
        factory = { PlayerView(it).apply { this.player = player; useController = true; setShowNextButton(false); setShowPreviousButton(false) } },
        update = { it.player = player },
        modifier = modifier.fillMaxWidth().aspectRatio(4f / 3f),
    )
}

@Composable
fun SectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 4.dp))
}

@Composable
fun KeyValue(key: String, value: String, valueColor: Color = Color.Unspecified, onClick: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().let { if (onClick != null) it.clickable(onClick = onClick) else it }.padding(horizontal = 16.dp, vertical = 6.dp)) {
        Text(key, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        Text(value, color = valueColor, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun Gap() { Spacer(Modifier.height(8.dp)); HorizontalDivider() }
