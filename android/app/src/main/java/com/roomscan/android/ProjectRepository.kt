package com.roomscan.android

import android.content.Context
import com.roomscan.android.export.SampleVideoGenerator
import com.roomscan.core.OutputKind
import com.roomscan.core.ProjectStore
import com.roomscan.core.ProjectSummary
import com.roomscan.core.SampleProjectFactory
import com.roomscan.core.SurveyProject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

/** Main-safe wrapper around [ProjectStore]; all disk work runs on Dispatchers.IO. */
class ProjectRepository(private val context: Context, val store: ProjectStore) {
    data class ListState(val projects: List<ProjectSummary> = emptyList(), val unreadable: List<String> = emptyList(), val loaded: Boolean = false)

    private val _list = MutableStateFlow(ListState())
    val list: StateFlow<ListState> = _list

    suspend fun refresh() = withContext(Dispatchers.IO) {
        val l = store.list()
        _list.value = ListState(l.projects, l.unreadable, loaded = true)
    }

    suspend fun create(name: String): SurveyProject = withContext(Dispatchers.IO) {
        val p = store.create(name)
        store.save(p.copy(captureDeviceModel = DeviceInfo.model, appVersion = DeviceInfo.appVersion(context)), touch = false)
    }.also { refresh() }

    suspend fun load(id: UUID): SurveyProject = withContext(Dispatchers.IO) { store.load(id) }

    suspend fun save(p: SurveyProject): SurveyProject = withContext(Dispatchers.IO) { store.save(p) }

    suspend fun rename(id: UUID, name: String) { withContext(Dispatchers.IO) { store.rename(id, name) }; refresh() }

    suspend fun delete(id: UUID) { withContext(Dispatchers.IO) { store.delete(id) }; refresh() }

    fun file(p: SurveyProject, relativePath: String): File = store.file(relativePath, p.id)

    fun projectDir(p: SurveyProject): File = store.directory(p.id)

    /** Builds the labeled synthetic sample and renders its 60 s video on the device. */
    suspend fun createSample(): SurveyProject = withContext(Dispatchers.IO) {
        val sample = SampleProjectFactory.make().copy(captureDeviceModel = DeviceInfo.model, appVersion = DeviceInfo.appVersion(context))
        java.io.File(store.directory(sample.id), "exports").mkdirs()
        var p = store.save(sample, touch = false)
        p = try {
            store.writeOutput(OutputKind.video, "video.mp4", p) { tmp -> SampleVideoGenerator.render(tmp) }
        } catch (e: Exception) {
            store.load(p.id)
        }
        p
    }.also { refresh() }
}
