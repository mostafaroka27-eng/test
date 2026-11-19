package com.roomscan.android.projects

import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.core.os.LocaleListCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.roomscan.android.AppSettings
import com.roomscan.android.R
import com.roomscan.android.repository
import com.roomscan.core.LengthUnit
import com.roomscan.core.ProjectSummary
import com.roomscan.core.SampleProjectFactory
import kotlinx.coroutines.launch
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.UUID

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectsScreen(onOpen: (UUID) -> Unit, onCapture: (UUID) -> Unit) {
    val context = LocalContext.current
    val repo = context.repository
    val scope = rememberCoroutineScope()
    val state by repo.list.collectAsStateWithLifecycle()
    var showNew by remember { mutableStateOf(false) }
    var showSettings by remember { mutableStateOf(false) }
    var renaming by remember { mutableStateOf<ProjectSummary?>(null) }
    var deleting by remember { mutableStateOf<ProjectSummary?>(null) }
    var creatingSample by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { repo.refresh() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.projects_title)) },
                actions = { IconButton(onClick = { showSettings = true }) { Icon(Icons.Filled.Settings, stringResource(R.string.settings_title)) } },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(onClick = { showNew = true }, icon = { Icon(Icons.Filled.Add, null) }, text = { Text(stringResource(R.string.projects_new)) })
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
            LazyColumn(Modifier.widthIn(max = 760.dp).fillMaxWidth(), contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 96.dp)) {
                if (state.unreadable.isNotEmpty()) item {
                    Text(stringResource(R.string.projects_unreadable, state.unreadable.size), color = Color(0xFFD32F2F), modifier = Modifier.padding(8.dp))
                }
                if (state.loaded && state.projects.isEmpty()) item {
                    Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(stringResource(R.string.projects_empty), style = MaterialTheme.typography.titleMedium)
                        Spacer(Modifier.height(8.dp))
                        Text(stringResource(R.string.projects_empty_hint))
                    }
                }
                items(state.projects, key = { it.id }) { p ->
                    ProjectRow(p, onClick = { onOpen(p.id) }, onRename = { renaming = p }, onDelete = { deleting = p })
                }
                item {
                    TextButton(onClick = {
                        creatingSample = true
                        scope.launch {
                            runCatching { repo.createSample() }.onFailure { error = it.message }
                            creatingSample = false
                        }
                    }, enabled = !creatingSample, modifier = Modifier.padding(top = 8.dp)) {
                        Text(stringResource(if (creatingSample) R.string.projects_creating_sample else R.string.projects_add_sample))
                    }
                }
            }
        }
    }

    if (showNew) NameDialog(
        title = stringResource(R.string.projects_new), initial = "", confirm = stringResource(R.string.projects_create),
        onDismiss = { showNew = false },
        onConfirm = { name ->
            showNew = false
            scope.launch { runCatching { repo.create(name) }.onSuccess { onCapture(it.id) }.onFailure { error = it.message } }
        },
    )
    renaming?.let { p ->
        NameDialog(stringResource(R.string.projects_rename), p.name, stringResource(R.string.action_save), { renaming = null }) { name ->
            renaming = null
            scope.launch { runCatching { repo.rename(p.id, name) }.onFailure { error = it.message } }
        }
    }
    deleting?.let { p ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text(stringResource(R.string.projects_delete_title)) },
            text = { Text(stringResource(R.string.projects_delete_message)) },
            confirmButton = { TextButton(onClick = { deleting = null; scope.launch { runCatching { repo.delete(p.id) }.onFailure { error = it.message } } }) { Text(stringResource(R.string.action_delete), color = Color(0xFFD32F2F)) } },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text(stringResource(R.string.action_cancel)) } },
        )
    }
    if (showSettings) SettingsDialog { showSettings = false }
    error?.let { e ->
        AlertDialog(onDismissRequest = { error = null }, text = { Text(e) }, confirmButton = { TextButton(onClick = { error = null }) { Text(stringResource(R.string.action_ok)) } })
    }
}

@Composable
private fun ProjectRow(p: ProjectSummary, onClick: () -> Unit, onRename: () -> Unit, onDelete: () -> Unit) {
    var menu by remember { mutableStateOf(false) }
    val date = remember(p.updatedAt) { DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT).withZone(ZoneId.systemDefault()).format(p.updatedAt) }
    Card(Modifier.fillMaxWidth().padding(vertical = 6.dp).clickable(onClick = onClick)) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(if (p.isSample) SampleProjectFactory.SAMPLE_NAME else p.name, style = MaterialTheme.typography.titleMedium)
                Text(stringResource(R.string.projects_row_summary, p.roomCount, p.openingCount) + " · " + date, style = MaterialTheme.typography.bodySmall)
                Row {
                    if (p.isSample) AssistChip(onClick = onClick, label = { Text(stringResource(R.string.sample_badge)) })
                    if (p.failedOutputs.isNotEmpty()) AssistChip(onClick = onClick, label = { Text(stringResource(R.string.projects_retry_needed), color = Color(0xFFD32F2F)) })
                }
            }
            Box {
                IconButton(onClick = { menu = true }) { Icon(Icons.Filled.MoreVert, null) }
                DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    DropdownMenuItem(text = { Text(stringResource(R.string.projects_rename)) }, onClick = { menu = false; onRename() })
                    DropdownMenuItem(text = { Text(stringResource(R.string.action_delete)) }, onClick = { menu = false; onDelete() })
                }
            }
        }
    }
}

@Composable
fun NameDialog(title: String, initial: String, confirm: String, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var text by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { OutlinedTextField(text, { text = it }, singleLine = true, label = { Text(stringResource(R.string.projects_name_placeholder)) }) },
        confirmButton = { TextButton(onClick = { onConfirm(text) }, enabled = text.isNotBlank()) { Text(confirm) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) } },
    )
}

@Composable
private fun SettingsDialog(onDismiss: () -> Unit) {
    val context = LocalContext.current
    val settings = remember { AppSettings(context) }
    var unit by remember { mutableStateOf(settings.roomUnit) }
    val current = AppCompatDelegate.getApplicationLocales().toLanguageTags()
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.settings_title)) },
        text = {
            Column {
                Text(stringResource(R.string.settings_language), style = MaterialTheme.typography.titleSmall)
                listOf("" to R.string.settings_language_system, "ar" to R.string.settings_language_ar, "en" to R.string.settings_language_en).forEach { (tag, label) ->
                    Row(Modifier.fillMaxWidth().clickable { AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag)) }, verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = current == tag || (tag.isNotEmpty() && current.startsWith(tag)), onClick = { AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag)) })
                        Text(stringResource(label))
                    }
                }
                Spacer(Modifier.height(12.dp))
                Text(stringResource(R.string.measure_room_unit), style = MaterialTheme.typography.titleSmall)
                listOf(LengthUnit.meters to R.string.unit_m, LengthUnit.millimeters to R.string.unit_mm).forEach { (u, label) ->
                    Row(Modifier.fillMaxWidth().clickable { unit = u; settings.roomUnit = u }, verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = unit == u, onClick = { unit = u; settings.roomUnit = u })
                        Text(stringResource(label))
                    }
                }
                Spacer(Modifier.height(12.dp))
                Text(stringResource(R.string.settings_accuracy_note), style = MaterialTheme.typography.bodySmall)
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_ok)) } },
    )
}
