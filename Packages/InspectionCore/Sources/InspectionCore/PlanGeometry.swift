import Foundation

public enum PlanMath {
    /// Shoelace formula; absolute area in m².
    public static func polygonArea(_ pts: [Point2D]) -> Double {
        guard pts.count >= 3 else { return 0 }
        var sum = 0.0
        for i in pts.indices {
            let a = pts[i], b = pts[(i + 1) % pts.count]
            sum += a.x * b.y - b.x * a.y
        }
        return abs(sum) / 2
    }

    public static func centroid(_ pts: [Point2D]) -> Point2D? {
        guard !pts.isEmpty else { return nil }
        let s = pts.reduce(Point2D(x: 0, y: 0), +)
        return s * (1.0 / Double(pts.count))
    }

    /// Ray-casting point-in-polygon.
    public static func contains(_ pts: [Point2D], _ p: Point2D) -> Bool {
        guard pts.count >= 3 else { return false }
        var inside = false
        var j = pts.count - 1
        for i in pts.indices {
            let a = pts[i], b = pts[j]
            if (a.y > p.y) != (b.y > p.y),
               p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x {
                inside.toggle()
            }
            j = i
        }
        return inside
    }

    public static func distance(from p: Point2D, toSegment a: Point2D, _ b: Point2D) -> Double {
        let ab = b - a
        let len2 = ab.x * ab.x + ab.y * ab.y
        guard len2 > 0 else { return p.distance(to: a) }
        let t = max(0, min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / len2))
        return p.distance(to: a + ab * t)
    }

    public static func minDistance(between a: [Point2D], and b: [Point2D]) -> Double {
        guard a.count >= 2, b.count >= 2 else { return .infinity }
        if a.contains(where: { contains(b, $0) }) || b.contains(where: { contains(a, $0) }) { return 0 }
        var best = Double.infinity
        for i in a.indices {
            let a0 = a[i], a1 = a[(i + 1) % a.count]
            for p in b { best = min(best, distance(from: p, toSegment: a0, a1)) }
        }
        for i in b.indices {
            let b0 = b[i], b1 = b[(i + 1) % b.count]
            for p in a { best = min(best, distance(from: p, toSegment: b0, b1)) }
        }
        return best
    }

    /// Approximate overlap area of two (possibly non-convex) polygons by
    /// sampling a grid over their common bounding box.
    public static func overlapArea(_ a: [Point2D], _ b: [Point2D], cell: Double = 0.05) -> Double {
        guard let ba = Bounds(points: a), let bb = Bounds(points: b), let common = ba.intersection(bb) else { return 0 }
        var count = 0
        var y = common.minY + cell / 2
        while y < common.maxY {
            var x = common.minX + cell / 2
            while x < common.maxX {
                let p = Point2D(x: x, y: y)
                if contains(a, p) && contains(b, p) { count += 1 }
                x += cell
            }
            y += cell
        }
        return Double(count) * cell * cell
    }

    /// Fallback outline when RoomPlan supplies no floor polygon: convex hull
    /// of the wall end points (monotone chain).
    public static func convexHull(_ points: [Point2D]) -> [Point2D] {
        let pts = Array(Set(points)).sorted { ($0.x, $0.y) < ($1.x, $1.y) }
        guard pts.count >= 3 else { return pts }
        func cross(_ o: Point2D, _ a: Point2D, _ b: Point2D) -> Double {
            (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
        }
        var lower: [Point2D] = []
        for p in pts {
            while lower.count >= 2 && cross(lower[lower.count - 2], lower[lower.count - 1], p) <= 0 { lower.removeLast() }
            lower.append(p)
        }
        var upper: [Point2D] = []
        for p in pts.reversed() {
            while upper.count >= 2 && cross(upper[upper.count - 2], upper[upper.count - 1], p) <= 0 { upper.removeLast() }
            upper.append(p)
        }
        return Array(lower.dropLast() + upper.dropLast())
    }
}

public struct Bounds: Equatable, Sendable {
    public var minX: Double, minY: Double, maxX: Double, maxY: Double
    public init(minX: Double, minY: Double, maxX: Double, maxY: Double) {
        self.minX = minX; self.minY = minY; self.maxX = maxX; self.maxY = maxY
    }
    public init?(points: [Point2D]) {
        guard let f = points.first else { return nil }
        var b = Bounds(minX: f.x, minY: f.y, maxX: f.x, maxY: f.y)
        for p in points { b.minX = min(b.minX, p.x); b.maxX = max(b.maxX, p.x); b.minY = min(b.minY, p.y); b.maxY = max(b.maxY, p.y) }
        self = b
    }
    public var width: Double { maxX - minX }
    public var height: Double { maxY - minY }
    public func intersection(_ o: Bounds) -> Bounds? {
        let r = Bounds(minX: max(minX, o.minX), minY: max(minY, o.minY), maxX: min(maxX, o.maxX), maxY: min(maxY, o.maxY))
        return (r.width > 0 && r.height > 0) ? r : nil
    }
}

/// Maps plan meters to view points (y down, like UIKit/SwiftUI/PDF contexts)
/// with uniform scale, centered, with a margin. Used by the on-screen plan,
/// hit-testing, and the PDF renderer so all three agree exactly.
public struct PlanTransform: Equatable, Sendable {
    public var scale: Double      // points per meter
    public var offsetX: Double
    public var offsetY: Double

    public init(content: Bounds, viewWidth: Double, viewHeight: Double, margin: Double) {
        let w = max(content.width, 0.5), h = max(content.height, 0.5)
        let s = min((viewWidth - 2 * margin) / w, (viewHeight - 2 * margin) / h)
        scale = max(s, 1)
        offsetX = (viewWidth - w * scale) / 2 - content.minX * scale
        offsetY = (viewHeight - h * scale) / 2 - content.minY * scale
    }

    public func toView(_ p: Point2D) -> Point2D { Point2D(x: p.x * scale + offsetX, y: p.y * scale + offsetY) }
    public func toPlan(_ v: Point2D) -> Point2D { Point2D(x: (v.x - offsetX) / scale, y: (v.y - offsetY) / scale) }
}

/// What to draw for a wall's dimension annotation.
public struct DimensionLabel: Equatable, Sendable {
    public var target: LinkTarget
    public var anchor: Point2D   // plan coordinates
    /// Angle of the wall in radians, normalized to (-π/2, π/2] so text is never upside down.
    public var angle: Double
    public var millimeters: Int?
    public var isVerified: Bool
}

public enum PlanModel {
    public static func bounds(of project: SurveyProject) -> Bounds? {
        var pts: [Point2D] = project.rooms.flatMap(\.floorPolygon)
        pts += project.walls.flatMap { [$0.start, $0.end] }
        return Bounds(points: pts)
    }

    /// Wall length labels, offset `offset` meters toward the room interior so
    /// labels of back-to-back walls don't collide. The verified length wins over
    /// the scan estimate, and the label says which one it shows.
    public static func wallLabels(_ project: SurveyProject, offset: Double = 0.25) -> [DimensionLabel] {
        project.walls.map { w in
            let mid = (w.start + w.end) * 0.5
            let dir = (w.end - w.start).normalized
            var normal = Point2D(x: -dir.y, y: dir.x)
            if let c = project.room(w.roomID).flatMap({ PlanMath.centroid($0.floorPolygon) }) {
                if ((c - mid).x * normal.x + (c - mid).y * normal.y) < 0 { normal = normal * -1 }
            }
            var angle = atan2(dir.y, dir.x)
            if angle > .pi / 2 { angle -= .pi } else if angle <= -.pi / 2 { angle += .pi }
            let verified = w.dimensions.verified?.widthMM
            return DimensionLabel(target: .wall(w.id), anchor: mid + normal * offset, angle: angle,
                                  millimeters: verified ?? w.dimensions.scan?.widthMM, isVerified: verified != nil)
        }
    }

    /// Hit test in plan coordinates. Openings win over walls, walls over rooms,
    /// because doors sit on walls and walls bound rooms.
    public static func hitTest(_ project: SurveyProject, at p: Point2D, tolerance: Double) -> LinkTarget? {
        let opening = project.openings
            .map { ($0, PlanMath.distance(from: p, toSegment: $0.start, $0.end)) }
            .filter { $0.1 <= tolerance }
            .min { $0.1 < $1.1 }
        if let o = opening { return .opening(o.0.id) }
        let wall = project.walls
            .map { ($0, PlanMath.distance(from: p, toSegment: $0.start, $0.end)) }
            .filter { $0.1 <= tolerance * 0.6 }
            .min { $0.1 < $1.1 }
        if let w = wall { return .wall(w.0.id) }
        if let r = project.rooms.first(where: { PlanMath.contains($0.floorPolygon, p) }) { return .room(r.id) }
        return nil
    }
}
