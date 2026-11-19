package com.roomscan.core

import kotlinx.serialization.Serializable
import java.time.Instant

/** Measurement table as CSV, same 20 columns as MeasurementCSV.swift (see docs/MEASUREMENTS.md). */
object MeasurementCsv {
    val columns = listOf(
        "item_type", "item_id", "room", "name",
        "scan_width_mm", "scan_height_mm", "scan_confidence", "scan_status",
        "verified_width_mm", "verified_height_mm", "delta_width_mm", "delta_height_mm",
        "manufacturing_width_mm", "manufacturing_height_mm",
        "sill_height_mm", "room_area_m2", "room_max_wall_height_m", "verified_ceiling_height_mm",
        "video_time_s", "notes",
    )

    fun make(project: SurveyProject, includeBom: Boolean = true): String {
        val lines = mutableListOf(columns.joinToString(","))
        fun roomName(id: java.util.UUID) = project.room(id)?.name ?: ""
        fun time(t: LinkTarget) = BookmarkService.bookmarkFor(t, project)?.let { Units.formatDecimal(it.mediaTime, 2) } ?: ""
        fun opt(v: Int?) = v?.toString() ?: ""

        for (room in project.rooms.sortedBy { it.scanIndex }) {
            lines += row(listOf(
                "room", room.id.upper(), room.name, room.name,
                "", "", "", if (room.floorPolygon.size >= 3) "detected" else "floor_not_detected",
                "", "", "", "", "", "", "",
                Units.formatArea(room.floorAreaM2) ?: "",
                Units.format(room.maxWallHeightM, LengthUnit.meters) ?: "",
                opt(room.verifiedCeilingHeightMM),
                time(LinkTarget.Room(room.id)), room.notes,
            ))
        }
        for (w in project.walls) {
            val d = w.dimensions
            lines += row(listOf(
                "wall", w.id.upper(), roomName(w.roomId), w.name,
                opt(d.scan?.widthMM), opt(d.scan?.heightMM), d.scan?.confidence?.name ?: "", status(d.scan),
                opt(d.verified?.widthMM), opt(d.verified?.heightMM), opt(d.widthDeltaMM), opt(d.heightDeltaMM),
                opt(d.manufacturing?.widthMM), opt(d.manufacturing?.heightMM),
                "", "", "", "", time(LinkTarget.Wall(w.id)), w.notes,
            ))
        }
        for (o in project.openings.sortedWith(compareBy({ it.kind.name }, { it.number }))) {
            val d = o.dimensions
            lines += row(listOf(
                o.kind.name, o.id.upper(), roomName(o.roomId), o.name,
                opt(d.scan?.widthMM), opt(d.scan?.heightMM), d.scan?.confidence?.name ?: "", status(d.scan),
                opt(d.verified?.widthMM), opt(d.verified?.heightMM), opt(d.widthDeltaMM), opt(d.heightDeltaMM),
                opt(d.manufacturing?.widthMM), opt(d.manufacturing?.heightMM),
                opt(o.sillHeightM?.let(Units::millimetersFromMeters)), "", "", "",
                time(LinkTarget.Opening(o.id)), o.notes,
            ))
        }
        val body = lines.joinToString("\r\n") + "\r\n"
        return if (includeBom) "﻿" + body else body
    }

    fun status(scan: ScanDimensions?): String = when {
        scan == null -> "not_detected"
        scan.widthM == null || scan.heightM == null -> "incomplete"
        scan.isPartiallyObserved -> "partially_observed"
        scan.confidence == ScanConfidence.low -> "low_confidence"
        else -> "detected"
    }

    private fun row(fields: List<String>) = fields.joinToString(",") { escape(it) }

    /** RFC 4180 quoting plus spreadsheet formula-injection guard. */
    fun escape(field: String): String {
        var f = field
        val first = f.firstOrNull()
        if (first != null && first in "=+-@" && f.toIntOrNull() == null && f.toDoubleOrNull() == null) f = "'$f"
        return if (f.any { it == ',' || it == '"' || it == '\n' || it == '\r' }) "\"" + f.replace("\"", "\"\"") + "\"" else f
    }

    private fun java.util.UUID.upper() = toString().uppercase()
}

/** Versioned report, same format id and version as ProjectReport.swift. */
@Serializable
data class ProjectReport(
    val reportFormat: String = FORMAT,
    val reportVersion: Int = VERSION,
    val generatedAt: Time,
    val generator: String,
    val units: Map<String, String>,
    val provenance: Map<String, String>,
    val summary: Summary,
    val project: SurveyProject,
) {
    @Serializable
    data class Summary(
        val roomCount: Int,
        val wallCount: Int,
        val doorCount: Int,
        val windowCount: Int,
        val openingCount: Int,
        val bookmarkCount: Int,
        val linkedBookmarkCount: Int,
        val openingsWithoutScanWidth: List<String>,
        val wallsPartiallyObserved: List<String>,
        val alignment: String? = null,
        val isSample: Boolean,
        val hasVideo: Boolean,
    )

    fun encoded(): String = ProjectJson.json.encodeToString(serializer(), this)

    companion object {
        const val FORMAT = "room-scan-inspector.project-report"
        const val VERSION = 1

        fun make(project: SurveyProject, generator: String, now: Instant = Dates.now()) = ProjectReport(
            generatedAt = now,
            generator = generator,
            units = mapOf(
                "scan.widthM/heightM/depthM" to "meters (RoomPlan native on iPhone; ARCore tap measurement on Android)",
                "verified.*MM / manufacturing.*MM" to "millimeters (typed by inspector)",
                "Point2D" to "meters, plan coordinates (world X, world Z) of the capture session",
                "Bookmark.mediaTime" to "seconds from the first frame of video.mp4",
            ),
            provenance = mapOf(
                MeasurementSource.roomPlan.name to "Apple RoomPlan CapturedRoom/CapturedStructure surface dimensions; estimates.",
                MeasurementSource.derivedFromRoomPlan.name to "Computed by the app from RoomPlan geometry (floor area, wall height max/min, sill height).",
                MeasurementSource.arcoreTap.name to "Android: distance between two points the inspector tapped, resolved by ARCore hit tests (scan.method = \"arcoreTap\"); estimates, accuracy depends on the device.",
                MeasurementSource.manualVerified.name to "Typed by the inspector after an independent tape/laser measurement.",
                MeasurementSource.manufacturing.name to "Typed by the inspector as the size to manufacture; never derived from the scan.",
                "ceiling" to "Neither RoomPlan nor the Android tap tool captures ceilings. Only verifiedCeilingHeightMM is a ceiling height.",
            ),
            summary = Summary(
                roomCount = project.rooms.size,
                wallCount = project.walls.size,
                doorCount = project.openings.count { it.kind == OpeningKind.door },
                windowCount = project.openings.count { it.kind == OpeningKind.window },
                openingCount = project.openings.count { it.kind == OpeningKind.opening },
                bookmarkCount = project.bookmarks.size,
                linkedBookmarkCount = project.bookmarks.count { it.target != null },
                openingsWithoutScanWidth = project.openings.filter { it.dimensions.scan?.widthM == null }.map { it.name },
                wallsPartiallyObserved = project.walls.filter { it.dimensions.scan?.isPartiallyObserved == true }.map { it.name },
                alignment = project.alignment?.overall?.name,
                isSample = project.isSample,
                hasVideo = project.video != null,
            ),
            project = project,
        )

        fun decode(text: String): ProjectReport = ProjectJson.json.decodeFromString(serializer(), text)
    }
}
