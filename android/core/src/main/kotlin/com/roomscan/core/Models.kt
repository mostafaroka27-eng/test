@file:Suppress("EnumEntryName")

package com.roomscan.core

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.descriptors.element
import kotlinx.serialization.encoding.CompositeDecoder
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.encoding.decodeStructure
import kotlinx.serialization.encoding.encodeStructure
import java.time.Instant
import java.util.UUID
import kotlin.math.sqrt

// This file mirrors Packages/InspectionCore/Sources/InspectionCore/Models.swift.
// The JSON written here must be readable by the iPhone app and vice versa:
// same key names, same enum raw values, ISO 8601 dates without fractions,
// upper-case UUID strings, absent keys for null values.
// Enum entries deliberately use the Swift raw values as their names.

typealias Uuid = @Serializable(with = UuidSerializer::class) UUID
typealias Time = @Serializable(with = InstantSerializer::class) Instant

// ---------------------------------------------------------------- geometry

/** A point on the floor plan in meters: x = world X, y = world Z. */
@Serializable
data class Point2D(val x: Double, val y: Double) {
    operator fun plus(o: Point2D) = Point2D(x + o.x, y + o.y)
    operator fun minus(o: Point2D) = Point2D(x - o.x, y - o.y)
    operator fun times(s: Double) = Point2D(x * s, y * s)
    val length: Double get() = sqrt(x * x + y * y)
    fun distanceTo(o: Point2D) = (this - o).length
    val normalized: Point2D get() = length.let { if (it > 0) Point2D(x / it, y / it) else this }
}

// ---------------------------------------------------------------- provenance

/**
 * Where a number came from. Only `roomPlan` … `manufacturing` exist on iPhone.
 * `arcoreTap` is Android-only: a length measured by the inspector tapping two
 * points on the camera view, resolved with ARCore hit tests. It is used for
 * display and in the JSON report's provenance table, never stored per value
 * (the per-value marker is [ScanDimensions.method]).
 */
enum class MeasurementSource { roomPlan, derivedFromRoomPlan, manualVerified, manufacturing, arcoreTap }

@Serializable
enum class ScanConfidence { high, medium, low, unknown }

/**
 * Scan-derived dimensions in meters; null means "not measured / not detected".
 * [method] is written only by the Android app ("arcoreTap"); the iPhone app
 * ignores the key, and a missing key means RoomPlan.
 */
@Serializable
data class ScanDimensions(
    val widthM: Double? = null,
    val heightM: Double? = null,
    val depthM: Double? = null,
    val confidence: ScanConfidence,
    val completedEdges: List<String>? = null,
    val method: String? = null,
) {
    val widthMM: Int? get() = widthM?.let(Units::millimetersFromMeters)
    val heightMM: Int? get() = heightM?.let(Units::millimetersFromMeters)
    val isPartiallyObserved: Boolean get() = completedEdges?.let { it.size < 4 } ?: false
    val source: MeasurementSource get() = if (method == METHOD_ARCORE_TAP) MeasurementSource.arcoreTap else MeasurementSource.roomPlan

    companion object { const val METHOD_ARCORE_TAP = "arcoreTap" }
}

/** A dimension typed by a person. Never produced by the scanner. */
@Serializable
data class ManualDimensions(
    val widthMM: Int? = null,
    val heightMM: Int? = null,
    val depthMM: Int? = null,
    val method: String? = null,
    val note: String? = null,
    val enteredAt: Time = Dates.now(),
) {
    val isEmpty: Boolean get() = widthMM == null && heightMM == null && depthMM == null
}

/** The three independent tiers of a dimension. Editing one never touches the others. */
@Serializable
data class DimensionRecord(
    val scan: ScanDimensions? = null,
    val verified: ManualDimensions? = null,
    val manufacturing: ManualDimensions? = null,
) {
    val widthDeltaMM: Int? get() { val v = verified?.widthMM; val s = scan?.widthMM; return if (v != null && s != null) v - s else null }
    val heightDeltaMM: Int? get() { val v = verified?.heightMM; val s = scan?.heightMM; return if (v != null && s != null) v - s else null }

    /** Manufacturing beats verified beats scan. */
    val bestWidthMM: Pair<Int, MeasurementSource>? get() =
        manufacturing?.widthMM?.let { it to MeasurementSource.manufacturing }
            ?: verified?.widthMM?.let { it to MeasurementSource.manualVerified }
            ?: scan?.widthMM?.let { it to scan.source }
}

// ---------------------------------------------------------------- plan entities

@Serializable
enum class OpeningKind {
    door, window, opening;
    val defaultEnglishPrefix: String get() = when (this) { door -> "Door"; window -> "Window"; opening -> "Opening" }
}

@Serializable
enum class RoomAlignmentStatus { single, aligned, suspect, notAligned }

@Serializable
data class RoomRecord(
    val id: Uuid = UUID.randomUUID(),
    val name: String,
    val scanIndex: Int,
    val roomPlanIdentifier: Uuid? = null,
    val sectionLabel: String? = null,
    val floorPolygon: List<Point2D> = emptyList(),
    /** Maximum wall height measured in this room. Never called "ceiling height". */
    val maxWallHeightM: Double? = null,
    val minWallHeightM: Double? = null,
    val verifiedCeilingHeightMM: Int? = null,
    val rawCapturePath: String? = null,
    val modelPath: String? = null,
    val captureStartMediaTime: Double? = null,
    val captureEndMediaTime: Double? = null,
    val alignment: RoomAlignmentStatus = RoomAlignmentStatus.single,
    val notes: String = "",
) {
    val floorAreaM2: Double? get() = if (floorPolygon.size >= 3) PlanMath.polygonArea(floorPolygon) else null
}

@Serializable
data class WallRecord(
    val id: Uuid = UUID.randomUUID(),
    @SerialName("roomID") val roomId: Uuid,
    val roomPlanIdentifier: Uuid? = null,
    val name: String,
    val start: Point2D,
    val end: Point2D,
    /** scan.widthM = wall length, scan.heightM = wall height. */
    val dimensions: DimensionRecord,
    val notes: String = "",
)

@Serializable
data class OpeningRecord(
    val id: Uuid = UUID.randomUUID(),
    @SerialName("roomID") val roomId: Uuid,
    @SerialName("wallID") val wallId: Uuid? = null,
    val roomPlanIdentifier: Uuid? = null,
    val kind: OpeningKind,
    val isOpenDoor: Boolean? = null,
    /** Stable per-project number ("Door 12"); never reused. */
    val number: Int,
    val name: String,
    val start: Point2D,
    val end: Point2D,
    val sillHeightM: Double? = null,
    val dimensions: DimensionRecord,
    val notes: String = "",
) {
    val center: Point2D get() = (start + end) * 0.5
}

// ---------------------------------------------------------------- video & bookmarks

/** What a bookmark points at. JSON: {"kind": "room"|"opening"|"wall", "id": "<UUID>"}. */
@Serializable(with = LinkTargetSerializer::class)
sealed class LinkTarget {
    abstract val id: UUID
    data class Room(override val id: UUID) : LinkTarget()
    data class Opening(override val id: UUID) : LinkTarget()
    data class Wall(override val id: UUID) : LinkTarget()

    val kind: String get() = when (this) { is Room -> "room"; is Opening -> "opening"; is Wall -> "wall" }
}

object LinkTargetSerializer : KSerializer<LinkTarget> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("LinkTarget") {
        element<String>("kind")
        element<String>("id")
    }

    override fun serialize(encoder: Encoder, value: LinkTarget) = encoder.encodeStructure(descriptor) {
        encodeStringElement(descriptor, 0, value.kind)
        encodeStringElement(descriptor, 1, value.id.toString().uppercase())
    }

    override fun deserialize(decoder: Decoder): LinkTarget = decoder.decodeStructure(descriptor) {
        var kind: String? = null
        var id: UUID? = null
        while (true) {
            when (val i = decodeElementIndex(descriptor)) {
                0 -> kind = decodeStringElement(descriptor, 0)
                1 -> id = UUID.fromString(decodeStringElement(descriptor, 1))
                CompositeDecoder.DECODE_DONE -> break
                else -> error("Unexpected index $i")
            }
        }
        val uuid = requireNotNull(id) { "LinkTarget without id" }
        when (kind) {
            "room" -> LinkTarget.Room(uuid)
            "opening" -> LinkTarget.Opening(uuid)
            "wall" -> LinkTarget.Wall(uuid)
            else -> throw IllegalArgumentException("Unknown link kind $kind")
        }
    }
}

@Serializable
data class Bookmark(
    val id: Uuid = UUID.randomUUID(),
    /** Seconds from the first frame of the saved MP4 (the shared timebase). */
    val mediaTime: Double,
    val label: String,
    val createdAt: Time = Dates.now(),
    val roomScanIndex: Int? = null,
    val target: LinkTarget? = null,
    val origin: Origin,
) {
    @Serializable
    enum class Origin { duringCapture, addedInReview, sample }
}

@Serializable
data class VideoInterruption(val mediaTime: Double, val pausedSeconds: Double, val reason: String)

@Serializable
data class VideoInfo(
    val relativePath: String,
    val durationSeconds: Double,
    val framesWritten: Int,
    val framesDropped: Int,
    val pixelWidth: Int,
    val pixelHeight: Int,
    val rotationDegrees: Int,
    val codec: String,
    val nominalFrameRate: Double,
    val startedAt: Time,
    val interruptions: List<VideoInterruption> = emptyList(),
    val stopReason: String? = null,
    val isSynthetic: Boolean = false,
)

// ---------------------------------------------------------------- outputs

@Serializable
enum class OutputKind {
    rawRoomData, model3D, video, pdfPlan, csvMeasurements, jsonReport;
    val isExport: Boolean get() = this == pdfPlan || this == csvMeasurements || this == jsonReport
}

@Serializable
enum class OutputState { pending, ready, failed }

@Serializable
data class OutputRecord(
    val kind: OutputKind,
    val state: OutputState,
    val relativePath: String? = null,
    val message: String? = null,
    val updatedAt: Time = Dates.now(),
)

// ---------------------------------------------------------------- alignment

@Serializable
data class AlignmentReport(
    val overall: Overall,
    val issues: List<Issue>,
    val structureMerged: Boolean,
) {
    @Serializable
    enum class Overall { single, connected, connectedWithWarnings, notConnected }

    @Serializable
    data class Issue(@SerialName("roomID") val roomId: Uuid, val code: Code, val detail: String) {
        @Serializable
        enum class Code { sessionReset, overlapsOtherRoom, isolated, structureMergeFailed, longTrackingLoss }
    }
}

// ---------------------------------------------------------------- project

@Serializable
data class SurveyProject(
    val schemaVersion: Int = CURRENT_SCHEMA_VERSION,
    val id: Uuid = UUID.randomUUID(),
    val name: String,
    val createdAt: Time = Dates.now(),
    val updatedAt: Time = createdAt,
    val isSample: Boolean = false,
    val rooms: List<RoomRecord> = emptyList(),
    val walls: List<WallRecord> = emptyList(),
    val openings: List<OpeningRecord> = emptyList(),
    val bookmarks: List<Bookmark> = emptyList(),
    val video: VideoInfo? = null,
    val outputs: Map<OutputKind, OutputRecord> = emptyMap(),
    val alignment: AlignmentReport? = null,
    val notes: String = "",
    val nextOpeningNumber: Map<OpeningKind, Int> = emptyMap(),
    val captureDeviceModel: String? = null,
    val appVersion: String? = null,
) {
    val hasScan: Boolean get() = rooms.isNotEmpty()

    fun room(id: UUID) = rooms.firstOrNull { it.id == id }
    fun opening(id: UUID) = openings.firstOrNull { it.id == id }
    fun wall(id: UUID) = walls.firstOrNull { it.id == id }

    fun displayName(target: LinkTarget): String? = when (target) {
        is LinkTarget.Room -> room(target.id)?.name
        is LinkTarget.Opening -> opening(target.id)?.name
        is LinkTarget.Wall -> wall(target.id)?.name
    }

    /** Returns the next number for [kind] and the project with the counter advanced. */
    fun allocateOpeningNumber(kind: OpeningKind): Pair<Int, SurveyProject> {
        val n = nextOpeningNumber[kind] ?: 1
        return n to copy(nextOpeningNumber = nextOpeningNumber + (kind to n + 1))
    }

    companion object { const val CURRENT_SCHEMA_VERSION = 1 }
}

data class ProjectSummary(
    val id: UUID,
    val name: String,
    val createdAt: Instant,
    val updatedAt: Instant,
    val isSample: Boolean,
    val roomCount: Int,
    val openingCount: Int,
    val hasVideo: Boolean,
    val failedOutputs: List<OutputKind>,
) {
    constructor(p: SurveyProject) : this(
        p.id, p.name, p.createdAt, p.updatedAt, p.isSample, p.rooms.size, p.openings.size, p.video != null,
        p.outputs.values.filter { it.state == OutputState.failed }.map { it.kind }.sortedBy { it.name },
    )
}
