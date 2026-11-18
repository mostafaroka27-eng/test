import SwiftUI
import InspectionCore

/// Interactive 2D plan drawn from RoomPlan geometry. Tap a room, wall, door or
/// window to see its dimensions and jump to its bookmarked moment in the video.
struct PlanTab: View {
    @ObservedObject var model: ReviewModel
    let onSelect: (LinkTarget) -> Void

    @State private var zoom: CGFloat = 1
    @State private var pan: CGSize = .zero
    @GestureState private var gestureZoom: CGFloat = 1
    @GestureState private var gesturePan: CGSize = .zero

    var body: some View {
        VStack(spacing: 0) {
            if let alignment = model.project.alignment, alignment.overall != .single {
                AlignmentBanner(report: alignment, project: model.project)
            }
            GeometryReader { geo in
                let base = transform(in: geo.size)
                let z = zoom * gestureZoom
                let p = CGSize(width: pan.width + gesturePan.width, height: pan.height + gesturePan.height)
                Canvas { ctx, _ in
                    draw(ctx: ctx, base: base, zoom: z, pan: p)
                }
                .contentShape(Rectangle())
                .onTapGesture(coordinateSpace: .local) { loc in
                    guard let base else { return }
                    let v = Point2D(x: (loc.x - p.width) / z, y: (loc.y - p.height) / z)
                    let planPoint = base.toPlan(v)
                    let tolerance = 22 / (base.scale * z)   // ~22 pt finger radius
                    if let hit = PlanModel.hitTest(model.project, at: planPoint, tolerance: tolerance) {
                        model.selection = hit
                        onSelect(hit)
                    }
                }
                .gesture(
                    SimultaneousGesture(
                        MagnificationGesture().updating($gestureZoom) { v, s, _ in s = v }
                            .onEnded { v in zoom = min(max(zoom * v, 0.5), 8) },
                        DragGesture().updating($gesturePan) { v, s, _ in s = v.translation }
                            .onEnded { v in pan.width += v.translation.width; pan.height += v.translation.height }
                    )
                )
            }
            // The plan is geometry: never mirror it in right-to-left layouts.
            .environment(\.layoutDirection, .leftToRight)
            .background(Color(.systemBackground))
            legend
        }
    }

    private func transform(in size: CGSize) -> PlanTransform? {
        guard let b = PlanModel.bounds(of: model.project) else { return nil }
        return PlanTransform(content: b, viewWidth: size.width, viewHeight: size.height, margin: 36)
    }

    private func pt(_ p: Point2D, _ base: PlanTransform, _ zoom: CGFloat, _ pan: CGSize) -> CGPoint {
        let v = base.toView(p)
        return CGPoint(x: v.x * zoom + pan.width, y: v.y * zoom + pan.height)
    }

    private func draw(ctx: GraphicsContext, base: PlanTransform?, zoom: CGFloat, pan: CGSize) {
        guard let base else {
            ctx.draw(Text(Loc.t("plan.empty")).foregroundColor(.secondary), at: CGPoint(x: 160, y: 120))
            return
        }
        let project = model.project
        let sel = model.selection

        // Rooms
        for room in project.rooms where room.floorPolygon.count >= 3 {
            var path = Path()
            path.addLines(room.floorPolygon.map { pt($0, base, zoom, pan) })
            path.closeSubpath()
            let fill: Color = room.alignment == .notAligned ? .red.opacity(0.12)
                : (room.alignment == .suspect ? .orange.opacity(0.12) : .blue.opacity(sel == .room(room.id) ? 0.22 : 0.08))
            ctx.fill(path, with: .color(fill))
            if let c = PlanMath.centroid(room.floorPolygon) {
                let area = Fmt.area(room.floorAreaM2)
                ctx.draw(Text(room.name).font(.caption.bold()), at: pt(c, base, zoom, pan))
                ctx.draw(Text(area).font(.caption2).foregroundColor(.secondary),
                         at: pt(c, base, zoom, pan).applying(.init(translationX: 0, y: 14)))
                if bookmarkExists(.room(room.id)) {
                    ctx.draw(Image(systemName: "play.circle.fill"), at: pt(c, base, zoom, pan).applying(.init(translationX: 0, y: 32)))
                }
            }
        }

        // Walls
        for wall in project.walls {
            var path = Path()
            path.move(to: pt(wall.start, base, zoom, pan)); path.addLine(to: pt(wall.end, base, zoom, pan))
            let partial = wall.dimensions.scan?.isPartiallyObserved == true
            let style = StrokeStyle(lineWidth: sel == .wall(wall.id) ? 6 : 4, lineCap: .round, dash: partial ? [6, 4] : [])
            ctx.stroke(path, with: .color(sel == .wall(wall.id) ? .accentColor : .primary), style: style)
        }

        // Wall dimension labels
        for label in PlanModel.wallLabels(project) {
            guard let mm = label.millimeters else { continue }
            let p = pt(label.anchor, base, zoom, pan)
            var layer = ctx
            layer.translateBy(x: p.x, y: p.y)
            layer.rotate(by: .radians(label.angle))
            let text = Text(label.isVerified ? "✓\(mm)" : "\(mm)")
                .font(.system(size: 10, weight: .medium).monospacedDigit())
                .foregroundColor(label.isVerified ? .green : .secondary)
            layer.draw(text, at: .zero)
        }

        // Openings
        for o in project.openings {
            let a = pt(o.start, base, zoom, pan), b = pt(o.end, base, zoom, pan)
            var gap = Path(); gap.move(to: a); gap.addLine(to: b)
            ctx.stroke(gap, with: .color(Color(.systemBackground)), lineWidth: 6)
            let color: Color = o.kind == .door ? .brown : (o.kind == .window ? .cyan : .gray)
            ctx.stroke(gap, with: .color(sel == .opening(o.id) ? .accentColor : color),
                       style: StrokeStyle(lineWidth: sel == .opening(o.id) ? 5 : 3, lineCap: .butt))
            if o.kind == .door { drawDoorSwing(ctx: ctx, a: a, b: b, color: color) }
            let mid = CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)
            let width = o.dimensions.bestWidthMM.map { "\($0.value)" } ?? Loc.t("value.notDetectedShort")
            let suffix = bookmarkExists(.opening(o.id)) ? " ▶︎" : ""
            ctx.draw(Text("\(o.name) · \(width)\(suffix)").font(.system(size: 10, weight: .semibold)).foregroundColor(color),
                     at: mid.applying(.init(translationX: 0, y: -12)))
        }
    }

    private func drawDoorSwing(ctx: GraphicsContext, a: CGPoint, b: CGPoint, color: Color) {
        // Quarter-circle swing symbol (direction is schematic; RoomPlan does not report hinge side).
        let r = hypot(b.x - a.x, b.y - a.y)
        guard r > 4 else { return }
        let angle = atan2(b.y - a.y, b.x - a.x)
        var arc = Path()
        arc.move(to: a)
        arc.addArc(center: a, radius: r, startAngle: .radians(angle), endAngle: .radians(angle + .pi / 2), clockwise: false)
        arc.closeSubpath()
        ctx.stroke(arc, with: .color(color.opacity(0.5)), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
    }

    private func bookmarkExists(_ t: LinkTarget) -> Bool { model.bookmark(for: t) != nil }

    private var legend: some View {
        HStack(spacing: 12) {
            Label(Loc.t("plan.legend.scan"), systemImage: "ruler").foregroundStyle(.secondary)
            Label(Loc.t("plan.legend.verified"), systemImage: "checkmark").foregroundStyle(.green)
            Label(Loc.t("plan.legend.partial"), systemImage: "line.diagonal").foregroundStyle(.secondary)
            Label(Loc.t("plan.legend.video"), systemImage: "play.fill").foregroundStyle(.secondary)
        }
        .font(.caption2)
        .padding(8)
    }
}

struct AlignmentBanner: View {
    let report: AlignmentReport
    let project: SurveyProject

    var body: some View {
        let color: Color = report.overall == .connected ? .green : (report.overall == .connectedWithWarnings ? .orange : .red)
        VStack(alignment: .leading, spacing: 4) {
            Text(Loc.t("alignment.\(report.overall.rawValue)")).font(.footnote.weight(.semibold))
            ForEach(Array(report.issues.enumerated()), id: \.offset) { _, issue in
                Text("• \(project.room(issue.roomID)?.name ?? "") – \(Loc.t("alignment.issue.\(issue.code.rawValue)"))")
                    .font(.caption2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(color.opacity(0.15))
    }
}
