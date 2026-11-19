package com.roomscan.android.export

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.roomscan.android.AppSettings
import com.roomscan.android.DeviceInfo
import com.roomscan.android.ProjectRepository
import com.roomscan.android.R
import com.roomscan.android.repository
import com.roomscan.core.MeasurementCsv
import com.roomscan.core.OutputKind
import com.roomscan.core.OutputState
import com.roomscan.core.ProjectReport
import com.roomscan.core.SurveyProject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/** Produces each export on its own; one failure never blocks the others. */
object ExportService {
    enum class Kind(val output: OutputKind?, val labelRes: Int) {
        PDF(OutputKind.pdfPlan, R.string.export_pdf),
        CSV(OutputKind.csvMeasurements, R.string.export_csv),
        JSON(OutputKind.jsonReport, R.string.export_json),
        MP4(OutputKind.video, R.string.export_mp4),
    }

    fun relativePath(p: SurveyProject, kind: Kind): String {
        val base = p.name.replace(Regex("[^\\p{L}\\p{N}_-]+"), "-").trim('-').ifEmpty { "project" }.take(60)
        return when (kind) {
            Kind.PDF -> "exports/$base-plan.pdf"
            Kind.CSV -> "exports/$base-measurements.csv"
            Kind.JSON -> "exports/$base-report.json"
            Kind.MP4 -> p.video?.relativePath ?: "video.mp4"
        }
    }

    /** Writes one export and returns the updated project; throws on failure (already recorded as failed). */
    suspend fun produce(context: Context, repo: ProjectRepository, p: SurveyProject, kind: Kind): SurveyProject = withContext(Dispatchers.IO) {
        val rel = relativePath(p, kind)
        when (kind) {
            Kind.MP4 -> if (repo.file(p, rel).exists()) p else throw IllegalStateException(context.getString(R.string.export_no_video))
            Kind.CSV -> repo.store.writeOutput(OutputKind.csvMeasurements, rel, p) { it.writeText(MeasurementCsv.make(p), Charsets.UTF_8) }
            Kind.JSON -> repo.store.writeOutput(OutputKind.jsonReport, rel, p) {
                it.writeText(ProjectReport.make(p, "RoomScanInspector ${DeviceInfo.appVersion(context)}").encoded(), Charsets.UTF_8)
            }
            Kind.PDF -> repo.store.writeOutput(OutputKind.pdfPlan, rel, p) { PdfPlanRenderer.render(context, p, AppSettings(context).roomUnit, it) }
        }
    }

    fun share(context: Context, files: List<File>) {
        if (files.isEmpty()) return
        val authority = context.packageName + ".files"
        val uris = ArrayList<Uri>(files.map { FileProvider.getUriForFile(context, authority, it) })
        val intent = if (uris.size == 1) Intent(Intent.ACTION_SEND).apply {
            putExtra(Intent.EXTRA_STREAM, uris[0]); type = mime(files[0])
        } else Intent(Intent.ACTION_SEND_MULTIPLE).apply {
            putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris); type = "*/*"
        }
        intent.clipData = ClipData.newRawUri("", uris[0]).apply { uris.drop(1).forEach { addItem(ClipData.Item(it)) } }
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        context.startActivity(Intent.createChooser(intent, null))
    }

    private fun mime(f: File) = when (f.extension.lowercase()) {
        "pdf" -> "application/pdf"; "csv" -> "text/csv"; "json" -> "application/json"; "mp4" -> "video/mp4"; else -> "*/*"
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExportSheet(project: SurveyProject, onUpdated: (SurveyProject) -> Unit, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val repo = context.repository
    val scope = rememberCoroutineScope()
    var p by remember { mutableStateOf(project) }
    var busy by remember { mutableStateOf(false) }
    val errors = remember { mutableStateOf(mapOf<ExportService.Kind, String>()) }

    fun fileFor(kind: ExportService.Kind): File? {
        val out = kind.output ?: return null
        return if (kind == ExportService.Kind.MP4) p.video?.let { repo.file(p, it.relativePath) }?.takeIf { it.exists() }
        else repo.store.existingOutput(out, p)
    }

    suspend fun make(kind: ExportService.Kind): File? = try {
        p = ExportService.produce(context, repo, p, kind)
        onUpdated(p)
        errors.value = errors.value - kind
        fileFor(kind)
    } catch (e: Exception) {
        runCatching { p = repo.load(p.id); onUpdated(p) }
        errors.value = errors.value + (kind to (e.message ?: e.toString()))
        null
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp)) {
            Text(stringResource(R.string.export_title), style = MaterialTheme.typography.titleLarge)
            ExportService.Kind.entries.forEach { kind ->
                val state = kind.output?.let { p.outputs[it]?.state }
                val ready = fileFor(kind) != null
                val status = when {
                    errors.value[kind] != null || state == OutputState.failed -> stringResource(R.string.export_retry_needed)
                    ready -> stringResource(R.string.export_ready)
                    kind == ExportService.Kind.MP4 -> stringResource(R.string.export_unavailable)
                    else -> stringResource(R.string.export_not_generated)
                }
                Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(stringResource(kind.labelRes))
                        Text(status, style = MaterialTheme.typography.bodySmall,
                            color = if (status == stringResource(R.string.export_retry_needed)) Color(0xFFD32F2F) else Color.Unspecified)
                        errors.value[kind]?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Color(0xFFD32F2F)) }
                    }
                    TextButton(enabled = !busy, onClick = {
                        busy = true
                        scope.launch { make(kind)?.let { ExportService.share(context, listOf(it)) }; busy = false }
                    }) { Text(stringResource(R.string.export_share_one)) }
                }
            }
            Text(stringResource(R.string.export_no_usdz), style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(vertical = 8.dp))
            Button(enabled = !busy, modifier = Modifier.fillMaxWidth(), onClick = {
                busy = true
                scope.launch {
                    val files = ExportService.Kind.entries.mapNotNull { make(it) }
                    ExportService.share(context, files)
                    busy = false
                }
            }) { Text(stringResource(R.string.export_share_all)) }
            Text(stringResource(R.string.export_privacy), style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp))
        }
    }
}
