package com.roomscan.android.review

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Link
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.media3.exoplayer.ExoPlayer
import com.roomscan.android.R
import com.roomscan.core.BookmarkService
import com.roomscan.core.DimensionRecord
import com.roomscan.core.LengthUnit
import com.roomscan.core.LinkTarget
import com.roomscan.core.ManualDimensions
import com.roomscan.core.MeasurementCsv
import com.roomscan.core.MeasurementSource
import com.roomscan.core.OpeningKind
import com.roomscan.core.ScanConfidence
import com.roomscan.core.SurveyProject
import com.roomscan.core.TimeFormat
import com.roomscan.core.Units
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

// ---------------------------------------------------------------- item detail

@Composable
fun ItemDetail(model: ReviewModel, target: LinkTarget, player: ExoPlayer?, scope: CoroutineScope, onClose: () -> Unit) {
    val p = model.project
    var editing by remember(target) { mutableStateOf(false) }
    var linking by remember(target) { mutableStateOf(false) }
    val name = p.displayName(target) ?: return
    val bookmark = BookmarkService.bookmarkFor(target, p)

    Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(name, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
        TextButton(onClick = { editing = true }) { Text(stringResource(R.string.action_edit)) }
    }
    VideoSurface(player, Modifier.padding(horizontal = 16.dp))
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(
            if (bookmark != null) stringResource(R.string.detail_video_from, TimeFormat.clock(bookmark.mediaTime)) else stringResource(R.string.detail_no_bookmark),
            style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f),
        )
        TextButton(onClick = { linking = true }) { Text(stringResource(R.string.detail_link_bookmark)) }
    }

    when (target) {
        is LinkTarget.Opening -> p.opening(target.id)?.let { o ->
            SectionTitle(stringResource(when (o.kind) { OpeningKind.door -> R.string.kind_door; OpeningKind.window -> R.string.kind_window; else -> R.string.kind_opening }))
            DimensionTable(o.dimensions)
            o.sillHeightM?.let { KeyValue(stringResource(R.string.detail_sill_height), "${Units.millimetersFromMeters(it)} mm") }
            ScanMeta(o.dimensions)
            if (o.notes.isNotBlank()) KeyValue(stringResource(R.string.field_notes), o.notes)
        }
        is LinkTarget.Wall -> p.wall(target.id)?.let { w ->
            SectionTitle(stringResource(R.string.detail_wall_length_height))
            DimensionTable(w.dimensions)
            ScanMeta(w.dimensions)
            if (w.notes.isNotBlank()) KeyValue(stringResource(R.string.field_notes), w.notes)
        }
        is LinkTarget.Room -> p.room(target.id)?.let { r ->
            SectionTitle(stringResource(R.string.detail_room))
            KeyValue(stringResource(R.string.detail_area), Units.formatArea(r.floorAreaM2)?.let { "$it m²" } ?: "—")
            KeyValue(stringResource(R.string.detail_max_wall_height), Units.format(r.maxWallHeightM, LengthUnit.meters)?.let { "$it m" } ?: stringResource(R.string.scan_not_measured))
            KeyValue(stringResource(R.string.detail_verified_ceiling), r.verifiedCeilingHeightMM?.let { "✓ $it mm" } ?: "—", Color(0xFF1E7B34))
            KeyValue(stringResource(R.string.room_alignment), r.alignment.name)
            if (r.notes.isNotBlank()) KeyValue(stringResource(R.string.field_notes), r.notes)
        }
    }
    Spacer(Modifier.height(16.dp))
    OutlinedButton(onClick = onClose, modifier = Modifier.padding(16.dp).fillMaxWidth()) { Text(stringResource(R.string.action_close)) }

    if (editing) EditDialog(p, target, onDismiss = { editing = false }) { change -> editing = false; scope.launch { model.update(change) } }
    if (linking) PickBookmarkDialog(p, onDismiss = { linking = false }) { bookmarkId ->
        linking = false
        scope.launch { model.update { BookmarkService.assign(bookmarkId, target, it) } }
    }
}

@Composable
private fun DimensionTable(d: DimensionRecord) {
    val dash = "—"
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
        Text("", Modifier.weight(1.4f))
        Text(stringResource(R.string.dim_width_mm), Modifier.weight(1f), style = MaterialTheme.typography.labelMedium)
        Text(stringResource(R.string.dim_height_mm), Modifier.weight(1f), style = MaterialTheme.typography.labelMedium)
    }
    HorizontalDivider()
    @Composable fun row(label: String, w: Int?, h: Int?, color: Color = Color.Unspecified) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
            Text(label, Modifier.weight(1.4f))
            Text(w?.toString() ?: dash, Modifier.weight(1f), color = color, fontWeight = FontWeight.Medium)
            Text(h?.toString() ?: dash, Modifier.weight(1f), color = color, fontWeight = FontWeight.Medium)
        }
    }
    val scanLabel = stringResource(if (d.scan?.source == MeasurementSource.arcoreTap) R.string.dim_scan_tap else R.string.dim_scan)
    row(scanLabel, d.scan?.widthMM, d.scan?.heightMM)
    row("✓ " + stringResource(R.string.dim_verified), d.verified?.widthMM, d.verified?.heightMM, Color(0xFF1E7B34))
    fun signed(v: Int?) = v?.let { if (it > 0) "+$it" else "$it" }
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
        Text(stringResource(R.string.dim_delta), Modifier.weight(1.4f))
        Text(signed(d.widthDeltaMM) ?: dash, Modifier.weight(1f), color = Color(0xFFC0392B), fontWeight = FontWeight.Bold)
        Text(signed(d.heightDeltaMM) ?: dash, Modifier.weight(1f), color = Color(0xFFC0392B), fontWeight = FontWeight.Bold)
    }
    row("⚙ " + stringResource(R.string.dim_manufacturing), d.manufacturing?.widthMM, d.manufacturing?.heightMM)
    HorizontalDivider()
}

@Composable
private fun ScanMeta(d: DimensionRecord) {
    val scan = d.scan
    val status = MeasurementCsv.status(scan)
    val statusText = stringResource(when (status) {
        "not_detected" -> R.string.scan_not_detected
        "incomplete" -> R.string.scan_incomplete
        "partially_observed" -> R.string.scan_partial
        "low_confidence" -> R.string.scan_low_confidence
        else -> R.string.scan_detected
    })
    val confidence = stringResource(when (scan?.confidence) {
        ScanConfidence.high -> R.string.confidence_high
        ScanConfidence.medium -> R.string.confidence_medium
        ScanConfidence.low -> R.string.confidence_low
        else -> R.string.confidence_unknown
    })
    KeyValue(stringResource(R.string.detail_scan_status), statusText)
    KeyValue(stringResource(R.string.detail_confidence), confidence)
    d.verified?.method?.let { KeyValue(stringResource(R.string.field_method), it) }
}

// ---------------------------------------------------------------- editing

@Composable
private fun EditDialog(p: SurveyProject, target: LinkTarget, onDismiss: () -> Unit, onSave: ((SurveyProject) -> SurveyProject) -> Unit) {
    val dims: DimensionRecord? = when (target) {
        is LinkTarget.Opening -> p.opening(target.id)?.dimensions
        is LinkTarget.Wall -> p.wall(target.id)?.dimensions
        is LinkTarget.Room -> null
    }
    val room = (target as? LinkTarget.Room)?.let { p.room(it.id) }
    var name by remember { mutableStateOf(p.displayName(target) ?: "") }
    var notes by remember { mutableStateOf(when (target) { is LinkTarget.Opening -> p.opening(target.id)?.notes; is LinkTarget.Wall -> p.wall(target.id)?.notes; is LinkTarget.Room -> room?.notes } ?: "") }
    var vW by remember { mutableStateOf(dims?.verified?.widthMM?.toString() ?: "") }
    var vH by remember { mutableStateOf(dims?.verified?.heightMM?.toString() ?: "") }
    var method by remember { mutableStateOf(dims?.verified?.method ?: "") }
    var mW by remember { mutableStateOf(dims?.manufacturing?.widthMM?.toString() ?: "") }
    var mH by remember { mutableStateOf(dims?.manufacturing?.heightMM?.toString() ?: "") }
    var ceiling by remember { mutableStateOf(room?.verifiedCeilingHeightMM?.toString() ?: "") }
    var invalid by remember { mutableStateOf(false) }

    fun mm(s: String): Result<Int?> = if (s.isBlank()) Result.success(null) else Units.parseMillimeters(s)?.let { Result.success(it) } ?: Result.failure(IllegalArgumentException())

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.action_edit)) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text(stringResource(R.string.field_name)) }, singleLine = true)
                if (dims != null) {
                    Text(stringResource(R.string.edit_verified_hint), style = MaterialTheme.typography.bodySmall)
                    MmField(stringResource(R.string.edit_verified_width), vW) { vW = it }
                    MmField(stringResource(R.string.edit_verified_height), vH) { vH = it }
                    OutlinedTextField(method, { method = it }, label = { Text(stringResource(R.string.field_method)) }, singleLine = true)
                    Text(stringResource(R.string.edit_manufacturing_hint), style = MaterialTheme.typography.bodySmall)
                    MmField(stringResource(R.string.edit_manufacturing_width), mW) { mW = it }
                    MmField(stringResource(R.string.edit_manufacturing_height), mH) { mH = it }
                }
                if (room != null) MmField(stringResource(R.string.detail_verified_ceiling), ceiling) { ceiling = it }
                OutlinedTextField(notes, { notes = it }, label = { Text(stringResource(R.string.field_notes)) })
                if (invalid) Text(stringResource(R.string.edit_invalid_mm), color = Color(0xFFD32F2F))
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val values = listOf(vW, vH, mW, mH, ceiling).map(::mm)
                if (values.any { it.isFailure } || name.isBlank()) { invalid = true; return@TextButton }
                val (w, h, mw, mh, ceil) = values.map { it.getOrNull() }
                val newName = name.trim()
                onSave { proj ->
                    // Each tier is replaced on its own; the scan tier is never touched.
                    fun merge(d: DimensionRecord): DimensionRecord {
                        // Keep the original entry time when the numbers did not change.
                        val verified = if (w == null && h == null) null else ManualDimensions(widthMM = w, heightMM = h, method = method.ifBlank { null },
                            enteredAt = d.verified?.takeIf { it.widthMM == w && it.heightMM == h }?.enteredAt ?: com.roomscan.core.Dates.now())
                        val manufacturing = if (mw == null && mh == null) null else ManualDimensions(widthMM = mw, heightMM = mh,
                            enteredAt = d.manufacturing?.takeIf { it.widthMM == mw && it.heightMM == mh }?.enteredAt ?: com.roomscan.core.Dates.now())
                        return d.copy(verified = verified, manufacturing = manufacturing)
                    }
                    when (target) {
                        is LinkTarget.Opening -> proj.copy(openings = proj.openings.map { if (it.id == target.id) it.copy(name = newName, notes = notes, dimensions = merge(it.dimensions)) else it })
                        is LinkTarget.Wall -> proj.copy(walls = proj.walls.map { if (it.id == target.id) it.copy(name = newName, notes = notes, dimensions = merge(it.dimensions)) else it })
                        is LinkTarget.Room -> proj.copy(rooms = proj.rooms.map { if (it.id == target.id) it.copy(name = newName, notes = notes, verifiedCeilingHeightMM = ceil) else it })
                    }
                }
            }) { Text(stringResource(R.string.action_save)) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) } },
    )
}

@Composable
private fun MmField(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(value, onChange, label = { Text(label) }, singleLine = true, suffix = { Text("mm") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
}

@Composable
private fun PickBookmarkDialog(p: SurveyProject, onDismiss: () -> Unit, onPick: (java.util.UUID) -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.detail_link_bookmark)) },
        text = {
            if (p.bookmarks.isEmpty()) Text(stringResource(R.string.video_no_bookmarks))
            else LazyColumn {
                items(p.bookmarks, key = { it.id }) { b ->
                    Text("${TimeFormat.clock(b.mediaTime)}  ${b.label}" + (b.target?.let { t -> "  → " + (p.displayName(t) ?: "") } ?: ""),
                        modifier = Modifier.fillMaxWidth().clickable { onPick(b.id) }.padding(vertical = 12.dp))
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) } },
    )
}

// ---------------------------------------------------------------- measurements tab

@Composable
fun MeasurementsTab(p: SurveyProject, roomUnit: LengthUnit, onSelect: (LinkTarget) -> Unit) {
    LazyColumn(Modifier.fillMaxSize()) {
        item { Text(stringResource(R.string.measure_provenance_note), style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(16.dp)) }
        item { SectionTitle(stringResource(R.string.measure_rooms, p.rooms.size)) }
        items(p.rooms, key = { "r" + it.id }) { r ->
            val h = Units.format(r.maxWallHeightM, roomUnit)?.let { "$it ${if (roomUnit == LengthUnit.meters) "m" else "mm"}" } ?: "—"
            KeyValue(r.name, (Units.formatArea(r.floorAreaM2)?.let { "$it m²" } ?: "—") + " · " + stringResource(R.string.measure_wall_h_short) + " " + h) { onSelect(LinkTarget.Room(r.id)) }
        }
        item { SectionTitle(stringResource(R.string.measure_openings, p.openings.size)) }
        items(p.openings.sortedWith(compareBy({ it.kind.name }, { it.number })), key = { "o" + it.id }) { o ->
            val d = o.dimensions
            val text = buildString {
                append(d.scan?.widthMM?.toString() ?: "—"); append(" × "); append(d.scan?.heightMM?.toString() ?: "—")
                d.verified?.widthMM?.let { append("  ✓"); append(it) }
                d.widthDeltaMM?.let { append(" ("); append(if (it > 0) "+$it" else "$it"); append(")") }
                d.manufacturing?.widthMM?.let { append("  ⚙"); append(it) }
            }
            KeyValue(o.name, text) { onSelect(LinkTarget.Opening(o.id)) }
        }
        item { SectionTitle(stringResource(R.string.measure_walls, p.walls.size)) }
        items(p.walls, key = { "w" + it.id }) { w ->
            val d = w.dimensions
            val text = (d.scan?.widthMM?.toString() ?: "—") + (d.verified?.widthMM?.let { "  ✓$it" } ?: "") + (if (d.scan?.isPartiallyObserved == true) " ┅" else "")
            KeyValue(w.name, text) { onSelect(LinkTarget.Wall(w.id)) }
        }
        item { Spacer(Modifier.height(32.dp)) }
    }
}

// ---------------------------------------------------------------- video tab

@Composable
fun VideoTab(model: ReviewModel, player: ExoPlayer?, scope: CoroutineScope) {
    val p = model.project
    var assigning by remember { mutableStateOf<java.util.UUID?>(null) }
    val newLabel = stringResource(R.string.bookmark_default_label, p.bookmarks.size + 1)
    Column(Modifier.fillMaxSize()) {
        VideoSurface(player, Modifier.padding(12.dp))
        p.video?.let { v ->
            Text(stringResource(R.string.video_meta, TimeFormat.clock(v.durationSeconds), v.pixelWidth, v.pixelHeight, v.framesDropped) +
                (if (v.isSynthetic) " · " + stringResource(R.string.sample_short) else "") +
                (v.stopReason?.let { " · " + stringResource(R.string.video_stopped_early, it) } ?: ""),
                style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(horizontal = 16.dp))
        }
        Row(Modifier.padding(horizontal = 8.dp)) {
            TextButton(enabled = player != null, onClick = {
                val t = (player?.currentPosition ?: 0) / 1000.0
                scope.launch { model.update { BookmarkService.addReviewBookmark(t, newLabel, it).second } }
            }) { Text(stringResource(R.string.video_add_bookmark_here)) }
        }
        HorizontalDivider()
        LazyColumn(Modifier.weight(1f)) {
            if (p.bookmarks.isEmpty()) item { Text(stringResource(R.string.video_no_bookmarks), modifier = Modifier.padding(16.dp)) }
            items(p.bookmarks, key = { it.id }) { b ->
                Row(Modifier.fillMaxWidth().clickable { player?.seekTo((b.mediaTime * 1000).toLong()); player?.play() }.padding(start = 16.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("🔖 ${b.label}  ${TimeFormat.clock(b.mediaTime)}", fontWeight = FontWeight.Medium)
                        Text(b.target?.let { "→ " + (p.displayName(it) ?: "?") } ?: stringResource(R.string.video_unlinked), style = MaterialTheme.typography.bodySmall)
                    }
                    TextButton(onClick = { scope.launch { model.update { BookmarkService.retime(b.id, b.mediaTime - 0.5, it) } } }) { Text("−0.5") }
                    TextButton(onClick = { scope.launch { model.update { BookmarkService.retime(b.id, b.mediaTime + 0.5, it) } } }) { Text("+0.5") }
                    IconButton(onClick = { assigning = b.id }) { Icon(Icons.Filled.Link, stringResource(R.string.detail_link_bookmark)) }
                    IconButton(onClick = { scope.launch { model.update { BookmarkService.remove(b.id, it) } } }) { Icon(Icons.Filled.Delete, stringResource(R.string.action_delete)) }
                }
            }
        }
    }
    assigning?.let { id ->
        val targets = p.openings.map { LinkTarget.Opening(it.id) as LinkTarget } + p.rooms.map { LinkTarget.Room(it.id) } + p.walls.map { LinkTarget.Wall(it.id) }
        AlertDialog(
            onDismissRequest = { assigning = null },
            title = { Text(stringResource(R.string.video_link_to)) },
            text = {
                LazyColumn {
                    item { Text(stringResource(R.string.video_unlink), color = Color(0xFFD32F2F), modifier = Modifier.fillMaxWidth().clickable {
                        assigning = null; scope.launch { model.update { BookmarkService.assign(id, null, it) } } }.padding(vertical = 12.dp)) }
                    items(targets, key = { it.kind + it.id }) { t ->
                        Text(p.displayName(t) ?: "", modifier = Modifier.fillMaxWidth().clickable {
                            assigning = null; scope.launch { model.update { BookmarkService.assign(id, t, it) } } }.padding(vertical = 12.dp))
                    }
                }
            },
            confirmButton = { TextButton(onClick = { assigning = null }) { Text(stringResource(R.string.action_cancel)) } },
        )
    }
}
