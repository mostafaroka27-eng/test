package com.roomscan.core

import java.io.File
import java.io.IOException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.util.UUID

/**
 * File-based local storage with the same folder layout as ProjectStore.swift:
 *
 *     <root>/<PROJECT-UUID>/project.json (+ .bak), rooms/, video.mp4, exports/
 *
 * Every path stored in project.json is relative to the project folder.
 */
class ProjectStore(val root: File) {
    sealed class StoreException(message: String) : IOException(message) {
        class ProjectNotFound(id: UUID) : StoreException("Project $id was not found.")
        class InvalidName : StoreException("Project name cannot be empty.")
        class CorruptProject(detail: String) : StoreException("Project file could not be read: $detail")
        class OutputMissing(kind: OutputKind) : StoreException("The ${kind.name} file is missing.")
    }

    data class Listing(val projects: List<ProjectSummary>, val unreadable: List<String>)

    private val lock = Any()

    init { root.mkdirs() }

    fun directory(id: UUID) = File(root, id.toString().uppercase())
    fun file(relativePath: String, id: UUID) = File(directory(id), relativePath)
    private fun projectFile(id: UUID) = File(directory(id), PROJECT_FILE)

    fun create(name: String, isSample: Boolean = false, now: java.time.Instant = Dates.now()): SurveyProject {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) throw StoreException.InvalidName()
        val p = SurveyProject(name = trimmed, createdAt = now, updatedAt = now, isSample = isSample)
        File(directory(p.id), "rooms").mkdirs()
        File(directory(p.id), "exports").mkdirs()
        save(p, touch = false)
        return p
    }

    /** Atomic write of project.json; the previous version is kept as project.json.bak. */
    fun save(project: SurveyProject, touch: Boolean = true): SurveyProject = synchronized(lock) {
        val p = if (touch) project.copy(updatedAt = Dates.now()) else project
        val target = projectFile(p.id)
        target.parentFile.mkdirs()
        if (target.exists()) target.copyTo(File(target.path + ".bak"), overwrite = true)
        val temp = File(target.parentFile, ".tmp-${UUID.randomUUID()}-$PROJECT_FILE")
        temp.writeText(ProjectJson.encode(p), Charsets.UTF_8)
        moveReplacing(temp, target)
        p
    }

    /** Loads a project, falling back to the .bak copy if the main file is corrupt. */
    fun load(id: UUID): SurveyProject {
        val f = projectFile(id)
        if (!f.exists()) throw StoreException.ProjectNotFound(id)
        return try {
            ProjectJson.decode(f.readText(Charsets.UTF_8))
        } catch (e: NewerSchemaException) {
            throw e
        } catch (e: Exception) {
            val bak = File(f.path + ".bak")
            runCatching { ProjectJson.decode(bak.readText(Charsets.UTF_8)) }.getOrNull()
                ?: throw StoreException.CorruptProject(e.message ?: e.toString())
        }
    }

    fun list(): Listing {
        val summaries = mutableListOf<ProjectSummary>()
        val unreadable = mutableListOf<String>()
        root.listFiles()?.filter { it.isDirectory }?.forEach { dir ->
            val id = runCatching { UUID.fromString(dir.name) }.getOrNull() ?: return@forEach
            runCatching { summaries += ProjectSummary(load(id)) }.onFailure { unreadable += dir.name }
        }
        return Listing(summaries.sortedByDescending { it.updatedAt }, unreadable)
    }

    fun rename(id: UUID, name: String): SurveyProject {
        val trimmed = name.trim()
        if (trimmed.isEmpty()) throw StoreException.InvalidName()
        return save(load(id).copy(name = trimmed))
    }

    fun delete(id: UUID) {
        val dir = directory(id)
        if (!dir.exists()) throw StoreException.ProjectNotFound(id)
        if (!dir.deleteRecursively()) throw IOException("Could not delete $dir")
    }

    /**
     * Writes one output through a temp file. Failure marks only this output as
     * failed (the project and every other output stay intact) and rethrows.
     * Returns the saved project.
     */
    fun writeOutput(kind: OutputKind, relativePath: String, project: SurveyProject, produce: (File) -> Unit): SurveyProject {
        val target = file(relativePath, project.id)
        target.parentFile.mkdirs()
        val temp = File(target.parentFile, ".tmp-${UUID.randomUUID()}-${target.name}")
        try {
            produce(temp)
            if (!temp.exists()) throw StoreException.OutputMissing(kind)
            moveReplacing(temp, target)
            return save(project.copy(outputs = project.outputs + (kind to OutputRecord(kind, OutputState.ready, relativePath))))
        } catch (e: Exception) {
            temp.delete()
            val previous = project.outputs[kind]
            runCatching {
                save(project.copy(outputs = project.outputs + (kind to OutputRecord(kind, OutputState.failed, previous?.relativePath, e.message ?: e.toString()))))
            }
            throw e
        }
    }

    /** Registers a file another component wrote in place (e.g. the finished MP4). */
    fun registerOutput(kind: OutputKind, relativePath: String, project: SurveyProject): SurveyProject {
        if (!file(relativePath, project.id).exists()) {
            runCatching { markOutputFailed(kind, StoreException.OutputMissing(kind).message ?: "", project) }
            throw StoreException.OutputMissing(kind)
        }
        return save(project.copy(outputs = project.outputs + (kind to OutputRecord(kind, OutputState.ready, relativePath))))
    }

    fun markOutputFailed(kind: OutputKind, message: String, project: SurveyProject): SurveyProject =
        save(project.copy(outputs = project.outputs + (kind to OutputRecord(kind, OutputState.failed, project.outputs[kind]?.relativePath, message))))

    fun existingOutput(kind: OutputKind, project: SurveyProject): File? {
        val rec = project.outputs[kind] ?: return null
        if (rec.state != OutputState.ready) return null
        val f = file(rec.relativePath ?: return null, project.id)
        return if (f.exists()) f else null
    }

    fun verifyOutputs(project: SurveyProject): List<OutputKind> = project.outputs.values
        .filter { it.state == OutputState.ready && it.relativePath != null && !file(it.relativePath, project.id).exists() }
        .map { it.kind }.sortedBy { it.name }

    private fun moveReplacing(from: File, to: File) {
        try {
            Files.move(from.toPath(), to.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
        } catch (e: java.nio.file.AtomicMoveNotSupportedException) {
            Files.move(from.toPath(), to.toPath(), StandardCopyOption.REPLACE_EXISTING)
        }
    }

    companion object { const val PROJECT_FILE = "project.json" }
}
