package com.roomscan.core

import java.util.Locale
import java.util.UUID
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.max
import kotlin.math.min

/** Mirrors PlanGeometry.swift. */
object PlanMath {
    fun polygonArea(pts: List<Point2D>): Double {
        if (pts.size < 3) return 0.0
        var sum = 0.0
        for (i in pts.indices) {
            val a = pts[i]; val b = pts[(i + 1) % pts.size]
            sum += a.x * b.y - b.x * a.y
        }
        return abs(sum) / 2
    }

    fun centroid(pts: List<Point2D>): Point2D? =
        if (pts.isEmpty()) null else pts.fold(Point2D(0.0, 0.0)) { a, b -> a + b } * (1.0 / pts.size)

    fun contains(pts: List<Point2D>, p: Point2D): Boolean {
        if (pts.size < 3) return false
        var inside = false
        var j = pts.size - 1
        for (i in pts.indices) {
            val a = pts[i]; val b = pts[j]
            if ((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside
            j = i
        }
        return inside
    }

    fun distanceToSegment(p: Point2D, a: Point2D, b: Point2D): Double {
        val ab = b - a
        val len2 = ab.x * ab.x + ab.y * ab.y
        if (len2 <= 0) return p.distanceTo(a)
        val t = (((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / len2).coerceIn(0.0, 1.0)
        return p.distanceTo(a + ab * t)
    }

    fun minDistance(a: List<Point2D>, b: List<Point2D>): Double {
        if (a.size < 2 || b.size < 2) return Double.POSITIVE_INFINITY
        if (a.any { contains(b, it) } || b.any { contains(a, it) }) return 0.0
        var best = Double.POSITIVE_INFINITY
        for (i in a.indices) { val a0 = a[i]; val a1 = a[(i + 1) % a.size]; for (p in b) best = min(best, distanceToSegment(p, a0, a1)) }
        for (i in b.indices) { val b0 = b[i]; val b1 = b[(i + 1) % b.size]; for (p in a) best = min(best, distanceToSegment(p, b0, b1)) }
        return best
    }

    fun overlapArea(a: List<Point2D>, b: List<Point2D>, cell: Double = 0.05): Double {
        val ba = Bounds.of(a) ?: return 0.0
        val bb = Bounds.of(b) ?: return 0.0
        val common = ba.intersection(bb) ?: return 0.0
        var count = 0
        var y = common.minY + cell / 2
        while (y < common.maxY) {
            var x = common.minX + cell / 2
            while (x < common.maxX) {
                val p = Point2D(x, y)
                if (contains(a, p) && contains(b, p)) count++
                x += cell
            }
            y += cell
        }
        return count * cell * cell
    }
}

data class Bounds(val minX: Double, val minY: Double, val maxX: Double, val maxY: Double) {
    val width get() = maxX - minX
    val height get() = maxY - minY
    fun intersection(o: Bounds): Bounds? {
        val r = Bounds(max(minX, o.minX), max(minY, o.minY), min(maxX, o.maxX), min(maxY, o.maxY))
        return if (r.width > 0 && r.height > 0) r else null
    }
    companion object {
        fun of(points: List<Point2D>): Bounds? {
            if (points.isEmpty()) return null
            return Bounds(points.minOf { it.x }, points.minOf { it.y }, points.maxOf { it.x }, points.maxOf { it.y })
        }
    }
}

/** Plan meters → view units (y down). Shared by the screen, hit-testing and the PDF. */
data class PlanTransform(val scale: Double, val offsetX: Double, val offsetY: Double) {
    fun toView(p: Point2D) = Point2D(p.x * scale + offsetX, p.y * scale + offsetY)
    fun toPlan(v: Point2D) = Point2D((v.x - offsetX) / scale, (v.y - offsetY) / scale)

    companion object {
        fun fit(content: Bounds, viewWidth: Double, viewHeight: Double, margin: Double): PlanTransform {
            val w = max(content.width, 0.5); val h = max(content.height, 0.5)
            val s = max(min((viewWidth - 2 * margin) / w, (viewHeight - 2 * margin) / h), 1.0)
            return PlanTransform(s, (viewWidth - w * s) / 2 - content.minX * s, (viewHeight - h * s) / 2 - content.minY * s)
        }
    }
}

data class DimensionLabel(val target: LinkTarget, val anchor: Point2D, val angle: Double, val millimeters: Int?, val isVerified: Boolean)

object PlanModel {
    fun bounds(project: SurveyProject): Bounds? =
        Bounds.of(project.rooms.flatMap { it.floorPolygon } + project.walls.flatMap { listOf(it.start, it.end) })

    fun wallLabels(project: SurveyProject, offset: Double = 0.25): List<DimensionLabel> = project.walls.map { w ->
        val mid = (w.start + w.end) * 0.5
        val dir = (w.end - w.start).normalized
        var normal = Point2D(-dir.y, dir.x)
        project.room(w.roomId)?.let { PlanMath.centroid(it.floorPolygon) }?.let { c ->
            if ((c - mid).x * normal.x + (c - mid).y * normal.y < 0) normal = normal * -1.0
        }
        var angle = atan2(dir.y, dir.x)
        if (angle > PI / 2) angle -= PI else if (angle <= -PI / 2) angle += PI
        val verified = w.dimensions.verified?.widthMM
        DimensionLabel(LinkTarget.Wall(w.id), mid + normal * offset, angle, verified ?: w.dimensions.scan?.widthMM, verified != null)
    }

    /** Openings win over walls, walls over rooms. */
    fun hitTest(project: SurveyProject, p: Point2D, tolerance: Double): LinkTarget? {
        project.openings.map { it to PlanMath.distanceToSegment(p, it.start, it.end) }
            .filter { it.second <= tolerance }.minByOrNull { it.second }
            ?.let { return LinkTarget.Opening(it.first.id) }
        project.walls.map { it to PlanMath.distanceToSegment(p, it.start, it.end) }
            .filter { it.second <= tolerance * 0.6 }.minByOrNull { it.second }
            ?.let { return LinkTarget.Wall(it.first.id) }
        return project.rooms.firstOrNull { PlanMath.contains(it.floorPolygon, p) }?.let { LinkTarget.Room(it.id) }
    }
}

// ---------------------------------------------------------------- alignment (mirrors Alignment.swift)

data class RoomCaptureFacts(val roomId: UUID, val sessionEpoch: Int, val footprint: List<Point2D>, val trackingLimitedSeconds: Double)

object AlignmentAssessor {
    const val MAX_OVERLAP_FRACTION = 0.10
    const val MAX_OVERLAP_M2 = 0.6
    const val MAX_GAP_M = 1.5
    const val MAX_TRACKING_LOSS_SECONDS = 10.0

    fun assess(
        rooms: List<RoomCaptureFacts>,
        structureMerged: Boolean,
        mergeError: String? = null,
    ): Pair<AlignmentReport, Map<UUID, RoomAlignmentStatus>> {
        if (rooms.size <= 1) {
            return AlignmentReport(AlignmentReport.Overall.single, emptyList(), structureMerged) to
                rooms.associate { it.roomId to RoomAlignmentStatus.single }
        }
        val issues = mutableListOf<AlignmentReport.Issue>()
        val status = linkedMapOf<UUID, RoomAlignmentStatus>()
        val reference = rooms[0].sessionEpoch
        for (r in rooms) {
            status[r.roomId] = if (r.sessionEpoch == reference) RoomAlignmentStatus.aligned else RoomAlignmentStatus.notAligned
            if (r.sessionEpoch != reference) issues += AlignmentReport.Issue(r.roomId, AlignmentReport.Issue.Code.sessionReset,
                "AR session lost its world origin before this room was scanned.")
            if (r.trackingLimitedSeconds > MAX_TRACKING_LOSS_SECONDS) {
                issues += AlignmentReport.Issue(r.roomId, AlignmentReport.Issue.Code.longTrackingLoss,
                    String.format(Locale.US, "Tracking was limited for %.0f s.", r.trackingLimitedSeconds))
                if (status[r.roomId] == RoomAlignmentStatus.aligned) status[r.roomId] = RoomAlignmentStatus.suspect
            }
        }
        val comparable = rooms.filter { status[it.roomId] != RoomAlignmentStatus.notAligned && it.footprint.size >= 3 }
        for ((i, a) in comparable.withIndex()) {
            var nearest = Double.POSITIVE_INFINITY
            for ((j, b) in comparable.withIndex()) {
                if (i == j) continue
                nearest = min(nearest, PlanMath.minDistance(a.footprint, b.footprint))
                if (j > i) {
                    val overlap = PlanMath.overlapArea(a.footprint, b.footprint)
                    val smaller = min(PlanMath.polygonArea(a.footprint), PlanMath.polygonArea(b.footprint))
                    if (overlap > MAX_OVERLAP_M2 && overlap > smaller * MAX_OVERLAP_FRACTION) {
                        for (id in listOf(a.roomId, b.roomId)) {
                            status[id] = RoomAlignmentStatus.suspect
                            issues += AlignmentReport.Issue(id, AlignmentReport.Issue.Code.overlapsOtherRoom,
                                String.format(Locale.US, "Overlaps another room by %.1f m².", overlap))
                        }
                    }
                }
            }
            if (nearest > MAX_GAP_M) {
                status[a.roomId] = RoomAlignmentStatus.suspect
                issues += AlignmentReport.Issue(a.roomId, AlignmentReport.Issue.Code.isolated,
                    String.format(Locale.US, "Nearest other room is %.1f m away.", nearest))
            }
        }
        if (!structureMerged && mergeError != null) {
            issues += AlignmentReport.Issue(rooms[0].roomId, AlignmentReport.Issue.Code.structureMergeFailed, mergeError)
        }
        val overall = when {
            status.values.contains(RoomAlignmentStatus.notAligned) || (!structureMerged && mergeError != null) -> AlignmentReport.Overall.notConnected
            status.values.contains(RoomAlignmentStatus.suspect) -> AlignmentReport.Overall.connectedWithWarnings
            else -> AlignmentReport.Overall.connected
        }
        return AlignmentReport(overall, issues, structureMerged) to status
    }
}
