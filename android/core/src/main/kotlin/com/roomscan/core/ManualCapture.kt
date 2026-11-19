package com.roomscan.core

import java.util.UUID
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * Android capture model. There is no RoomPlan on Android, so geometry comes
 * from points the inspector taps on the camera view; ARCore resolves each tap
 * to a 3D point (y up, meters). Everything here is pure Kotlin so it is unit
 * tested on the JVM; the app only supplies the 3D points.
 */
data class Vec3(val x: Double, val y: Double, val z: Double) {
    operator fun minus(o: Vec3) = Vec3(x - o.x, y - o.y, z - o.z)
    val length get() = sqrt(x * x + y * y + z * z)
    fun distanceTo(o: Vec3) = (this - o).length
    /** Floor-plan projection: x = world X, y = world Z (same convention as iPhone). */
    val plan get() = Point2D(x, z)
    fun horizontalDistanceTo(o: Vec3) = plan.distanceTo(o.plan)
}

/** How a tap was resolved. Tap measurements are never reported as "high" confidence. */
enum class HitQuality {
    /** Hit a detected plane inside its polygon. */
    plane,
    /** Hit the depth map (ARCore Depth API). */
    depth,
    /** Hit a sparse feature point, or an estimated point; least reliable. */
    point;

    val confidence: ScanConfidence get() = when (this) { plane, depth -> ScanConfidence.medium; point -> ScanConfidence.low }
}

data class TapPoint(val position: Vec3, val quality: HitQuality)

private fun worst(points: List<TapPoint>): ScanConfidence =
    if (points.any { it.quality == HitQuality.point }) ScanConfidence.low else ScanConfidence.medium

/** A room outlined by tapping its floor corners in order (clockwise or counter-clockwise). */
data class RoomOutlineDraft(
    val corners: List<TapPoint> = emptyList(),
    /** Optional wall height from a floor tap and a tap on the top of a wall. */
    val wallHeight: Pair<TapPoint, TapPoint>? = null,
) {
    val canClose get() = corners.size >= 3
    val floorY: Double? get() = corners.takeIf { it.isNotEmpty() }?.map { it.position.y }?.average()
    val wallHeightM: Double? get() = wallHeight?.let { (a, b) -> abs(b.position.y - a.position.y) }

    fun add(p: TapPoint) = copy(corners = corners + p)
    fun undo() = copy(corners = corners.dropLast(1))
}

/** An opening measured by tapping both jambs at the bottom edge, then the top edge. */
data class OpeningDraft(
    val kind: OpeningKind,
    val jambA: TapPoint? = null,
    val jambB: TapPoint? = null,
    val top: TapPoint? = null,
) {
    val step: Int get() = listOfNotNull(jambA, jambB, top).size
    val isComplete get() = jambA != null && jambB != null
    val widthM: Double? get() { val a = jambA ?: return null; val b = jambB ?: return null; return a.position.horizontalDistanceTo(b.position) }
    val bottomY: Double? get() = listOfNotNull(jambA, jambB).takeIf { it.size == 2 }?.minOf { it.position.y }
    val heightM: Double? get() { val t = top ?: return null; val b = bottomY ?: return null; return (t.position.y - b).takeIf { it > 0.05 } }

    fun add(p: TapPoint): OpeningDraft = when {
        jambA == null -> copy(jambA = p)
        jambB == null -> copy(jambB = p)
        top == null -> copy(top = p)
        else -> this
    }
    fun undo(): OpeningDraft = when {
        top != null -> copy(top = null)
        jambB != null -> copy(jambB = null)
        else -> copy(jambA = null)
    }
}

object ManualSurveyBuilder {
    const val WALL_SNAP_M = 0.5
    const val SILL_ZERO_TOLERANCE_M = 0.03

    /** Adds a closed room outline (and its walls) to the project. Returns the project and the new room id. */
    fun addRoom(
        project: SurveyProject,
        draft: RoomOutlineDraft,
        name: String,
        captureStartMediaTime: Double?,
        captureEndMediaTime: Double?,
    ): Pair<SurveyProject, UUID> {
        require(draft.canClose) { "A room needs at least 3 corners" }
        val scanIndex = (project.rooms.maxOfOrNull { it.scanIndex } ?: 0) + 1
        val polygon = draft.corners.map { it.position.plan }
        val h = draft.wallHeightM
        val room = RoomRecord(
            name = name, scanIndex = scanIndex, floorPolygon = polygon,
            maxWallHeightM = h, minWallHeightM = h,
            captureStartMediaTime = captureStartMediaTime, captureEndMediaTime = captureEndMediaTime,
        )
        val heightQuality = draft.wallHeight?.toList() ?: emptyList()
        val walls = polygon.indices.map { i ->
            val a = draft.corners[i]; val b = draft.corners[(i + 1) % polygon.size]
            WallRecord(
                roomId = room.id,
                name = "$name · Wall ${i + 1}",
                start = a.position.plan, end = b.position.plan,
                dimensions = DimensionRecord(scan = ScanDimensions(
                    widthM = a.position.horizontalDistanceTo(b.position),
                    heightM = h,
                    confidence = worst(listOf(a, b) + heightQuality),
                    method = ScanDimensions.METHOD_ARCORE_TAP,
                )),
            )
        }
        return project.copy(rooms = project.rooms + room, walls = project.walls + walls) to room.id
    }

    /**
     * Adds a measured opening to [roomId], snapped onto the nearest wall of that
     * room when one is within [WALL_SNAP_M]. Returns the project and the opening.
     */
    fun addOpening(project: SurveyProject, roomId: UUID, draft: OpeningDraft, floorY: Double?): Pair<SurveyProject, OpeningRecord> {
        require(draft.isComplete) { "Tap both sides of the opening first" }
        val a = draft.jambA!!; val b = draft.jambB!!
        var start = a.position.plan; var end = b.position.plan
        val center = (start + end) * 0.5
        val wall = project.walls.filter { it.roomId == roomId }
            .map { it to PlanMath.distanceToSegment(center, it.start, it.end) }
            .filter { it.second <= WALL_SNAP_M }.minByOrNull { it.second }?.first
        if (wall != null) { start = projectOnLine(start, wall.start, wall.end); end = projectOnLine(end, wall.start, wall.end) }

        val sill = if (floorY != null && draft.bottomY != null) (draft.bottomY!! - floorY).let { if (it < SILL_ZERO_TOLERANCE_M) 0.0 else it } else null
        val (number, numbered) = project.allocateOpeningNumber(draft.kind)
        val opening = OpeningRecord(
            roomId = roomId, wallId = wall?.id, kind = draft.kind,
            number = number, name = "${draft.kind.defaultEnglishPrefix} $number",
            start = start, end = end, sillHeightM = sill,
            dimensions = DimensionRecord(scan = ScanDimensions(
                widthM = draft.widthM, heightM = draft.heightM,
                confidence = worst(listOfNotNull(a, b, draft.top)),
                method = ScanDimensions.METHOD_ARCORE_TAP,
            )),
        )
        return numbered.copy(openings = numbered.openings + opening) to opening
    }

    /**
     * Sets the measured wall height (floor tap → top-of-wall tap) on every wall
     * of a room and on the room's max/min wall height. Never a ceiling height.
     */
    fun setRoomWallHeight(project: SurveyProject, roomId: UUID, floor: TapPoint, top: TapPoint): SurveyProject {
        val h = abs(top.position.y - floor.position.y)
        val q = listOf(floor, top)
        return project.copy(
            rooms = project.rooms.map { if (it.id == roomId) it.copy(maxWallHeightM = h, minWallHeightM = h) else it },
            walls = project.walls.map { w ->
                if (w.roomId != roomId) w else {
                    val scan = w.dimensions.scan
                    val confidence = if (scan?.confidence == ScanConfidence.low || worst(q) == ScanConfidence.low) ScanConfidence.low else ScanConfidence.medium
                    w.copy(dimensions = w.dimensions.copy(scan = (scan ?: ScanDimensions(confidence = confidence, method = ScanDimensions.METHOD_ARCORE_TAP))
                        .copy(heightM = h, confidence = confidence)))
                }
            },
        )
    }

    private fun projectOnLine(p: Point2D, a: Point2D, b: Point2D): Point2D {
        val ab = b - a
        val len2 = ab.x * ab.x + ab.y * ab.y
        if (len2 <= 0) return p
        val t = ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / len2
        return a + ab * t
    }
}
