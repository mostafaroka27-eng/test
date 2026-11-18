import UIKit
import InspectionCore

/// Renders the floor plan with visible dimensions (page 1) and the
/// measurement table (following pages) to an A3-landscape PDF.
enum PDFPlanRenderer {
    static let pageSize = CGSize(width: 1191, height: 842) // A3 landscape, points

    static func render(_ project: SurveyProject, to url: URL) throws {
        let renderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: pageSize), format: format(project))
        try renderer.writePDF(to: url) { ctx in
            ctx.beginPage()
            drawHeader(project, in: ctx.cgContext)
            drawPlan(project, in: CGRect(x: 40, y: 110, width: pageSize.width - 80, height: pageSize.height - 190))
            drawLegend(at: CGPoint(x: 40, y: pageSize.height - 70))
            drawTable(project, ctx: ctx)
        }
    }

    private static func format(_ project: SurveyProject) -> UIGraphicsPDFRendererFormat {
        let f = UIGraphicsPDFRendererFormat()
        f.documentInfo = [
            kCGPDFContextTitle as String: project.name,
            kCGPDFContextCreator as String: "Room Scan Inspector",
        ]
        return f
    }

    // MARK: Text helpers (CoreText shapes Arabic correctly)

    private static func attrs(_ size: CGFloat, _ weight: UIFont.Weight = .regular, _ color: UIColor = .black) -> [NSAttributedString.Key: Any] {
        [.font: UIFont.systemFont(ofSize: size, weight: weight), .foregroundColor: color]
    }

    private static func draw(_ s: String, at p: CGPoint, _ a: [NSAttributedString.Key: Any], centered: Bool = false) {
        let ns = s as NSString
        let size = ns.size(withAttributes: a)
        ns.draw(at: centered ? CGPoint(x: p.x - size.width / 2, y: p.y - size.height / 2) : p, withAttributes: a)
    }

    // MARK: Page 1

    private static func drawHeader(_ p: SurveyProject, in cg: CGContext) {
        draw(p.name, at: CGPoint(x: 40, y: 30), attrs(22, .bold))
        let df = DateFormatter(); df.dateStyle = .medium; df.timeStyle = .short; df.locale = Locale(identifier: Loc.code)
        var line = "\(Loc.t("pdf.created")): \(df.string(from: p.createdAt))   ·   \(Loc.t("pdf.rooms")): \(p.rooms.count)"
        if let a = p.alignment { line += "   ·   \(Loc.t("alignment.\(a.overall.rawValue)"))" }
        draw(line, at: CGPoint(x: 40, y: 62), attrs(11, .regular, .darkGray))
        draw(Loc.t("pdf.disclaimer"), at: CGPoint(x: 40, y: 80), attrs(10, .medium, .systemRed))
        if p.isSample {
            draw(Loc.t("sample.badge"), at: CGPoint(x: pageSize.width - 360, y: 30), attrs(14, .bold, .systemPurple))
        }
    }

    private static func drawPlan(_ project: SurveyProject, in rect: CGRect) {
        guard let bounds = PlanModel.bounds(of: project), let cg = UIGraphicsGetCurrentContext() else { return }
        let t = PlanTransform(content: bounds, viewWidth: rect.width, viewHeight: rect.height, margin: 40)
        func pt(_ p: Point2D) -> CGPoint { let v = t.toView(p); return CGPoint(x: rect.minX + v.x, y: rect.minY + v.y) }

        // Rooms
        for room in project.rooms where room.floorPolygon.count >= 3 {
            cg.beginPath()
            cg.addLines(between: room.floorPolygon.map(pt))
            cg.closePath()
            let fill: UIColor = room.alignment == .notAligned ? UIColor.systemRed.withAlphaComponent(0.10)
                : (room.alignment == .suspect ? UIColor.systemOrange.withAlphaComponent(0.10) : UIColor.systemBlue.withAlphaComponent(0.06))
            cg.setFillColor(fill.cgColor)
            cg.fillPath()
            if let c = PlanMath.centroid(room.floorPolygon) {
                let cp = pt(c)
                draw(room.name, at: cp, attrs(12, .bold), centered: true)
                draw(Fmt.area(room.floorAreaM2), at: CGPoint(x: cp.x, y: cp.y + 16), attrs(10, .regular, .darkGray), centered: true)
                draw("\(Loc.t("dim.maxWallHeight")) \(Fmt.meters(room.maxWallHeightM))", at: CGPoint(x: cp.x, y: cp.y + 30), attrs(8, .regular, .darkGray), centered: true)
                if let ch = room.verifiedCeilingHeightMM {
                    draw("✓ \(Loc.t("dim.ceilingVerified")) \(ch)", at: CGPoint(x: cp.x, y: cp.y + 42), attrs(8, .medium, .systemGreen), centered: true)
                }
            }
        }

        // Walls
        cg.setLineCap(.round)
        for w in project.walls {
            cg.setStrokeColor(UIColor.black.cgColor)
            cg.setLineWidth(3)
            cg.setLineDash(phase: 0, lengths: w.dimensions.scan?.isPartiallyObserved == true ? [6, 4] : [])
            cg.strokeLineSegments(between: [pt(w.start), pt(w.end)])
        }
        cg.setLineDash(phase: 0, lengths: [])

        // Wall dimensions (rotated along the wall)
        for label in PlanModel.wallLabels(project, offset: 18 / t.scale) {
            guard let mm = label.millimeters else { continue }
            let p = pt(label.anchor)
            cg.saveGState()
            cg.translateBy(x: p.x, y: p.y)
            cg.rotate(by: CGFloat(label.angle))
            draw(label.isVerified ? "✓ \(mm)" : "\(mm)", at: .zero,
                 attrs(9, .medium, label.isVerified ? .systemGreen : .darkGray), centered: true)
            cg.restoreGState()
        }

        // Openings
        for o in project.openings {
            let a = pt(o.start), b = pt(o.end)
            cg.setStrokeColor(UIColor.white.cgColor); cg.setLineWidth(5)
            cg.strokeLineSegments(between: [a, b])
            let color: UIColor = o.kind == .door ? .brown : (o.kind == .window ? .systemTeal : .gray)
            cg.setStrokeColor(color.cgColor); cg.setLineWidth(2.5)
            cg.strokeLineSegments(between: [a, b])
            let mid = CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 12)
            let w = o.dimensions.scan?.widthMM.map(String.init) ?? Loc.t("value.notDetectedShort")
            let h = o.dimensions.scan?.heightMM.map(String.init) ?? Loc.t("value.notDetectedShort")
            var text = "\(o.name)  \(w)×\(h)"
            if let v = o.dimensions.verified, let vw = v.widthMM { text += "  ✓\(vw)" }
            draw(text, at: mid, attrs(8, .semibold, color), centered: true)
        }

        // Scale bar (1 m)
        let barY = rect.maxY - 8
        cg.setStrokeColor(UIColor.black.cgColor); cg.setLineWidth(2)
        cg.strokeLineSegments(between: [CGPoint(x: rect.minX, y: barY), CGPoint(x: rect.minX + t.scale, y: barY)])
        draw("1 m", at: CGPoint(x: rect.minX + t.scale + 6, y: barY - 7), attrs(9))
    }

    private static func drawLegend(at origin: CGPoint) {
        let items = [Loc.t("pdf.legend.scan"), Loc.t("pdf.legend.verified"), Loc.t("pdf.legend.partial"), Loc.t("pdf.legend.ceiling")]
        draw(items.joined(separator: "    ·    "), at: origin, attrs(9, .regular, .darkGray))
    }

    // MARK: Table pages

    private static func drawTable(_ p: SurveyProject, ctx: UIGraphicsPDFRendererContext) {
        let cols: [(String, CGFloat)] = [
            (Loc.t("pdf.col.item"), 230), (Loc.t("pdf.col.room"), 190),
            (Loc.t("pdf.col.scanW"), 100), (Loc.t("pdf.col.scanH"), 100),
            (Loc.t("pdf.col.verW"), 100), (Loc.t("pdf.col.verH"), 100),
            (Loc.t("pdf.col.mfgW"), 100), (Loc.t("pdf.col.mfgH"), 100), (Loc.t("pdf.col.video"), 80),
        ]
        var y: CGFloat = 0
        func newPage() {
            ctx.beginPage()
            draw("\(p.name) – \(Loc.t("pdf.tableTitle"))", at: CGPoint(x: 40, y: 30), attrs(16, .bold))
            y = 64
            var x: CGFloat = 40
            for (title, w) in cols { draw(title, at: CGPoint(x: x, y: y), attrs(9, .bold)); x += w }
            y += 18
        }
        func row(_ values: [String], color: UIColor = .black) {
            if y > pageSize.height - 50 { newPage() }
            var x: CGFloat = 40
            for (i, v) in values.enumerated() { draw(v, at: CGPoint(x: x, y: y), attrs(9, .regular, color)); x += cols[i].1 }
            y += 15
        }
        func s(_ v: Int?) -> String { v.map(String.init) ?? "—" }
        func t(_ target: LinkTarget) -> String { BookmarkService.bookmark(for: target, in: p).map { TimeFormat.clock($0.mediaTime) } ?? "" }

        newPage()
        for room in p.rooms.sorted(by: { $0.scanIndex < $1.scanIndex }) {
            row(["■ \(room.name)  \(Fmt.area(room.floorAreaM2))", "", "", Units.format(meters: room.maxWallHeightM, as: .millimeters) ?? "—",
                 "", s(room.verifiedCeilingHeightMM), "", "", t(.room(room.id))], color: .systemBlue)
            for o in p.openings where o.roomID == room.id {
                let d = o.dimensions
                row([o.name, room.name, s(d.scan?.widthMM), s(d.scan?.heightMM), s(d.verified?.widthMM), s(d.verified?.heightMM),
                     s(d.manufacturing?.widthMM), s(d.manufacturing?.heightMM), t(.opening(o.id))])
            }
            for w in p.walls where w.roomID == room.id {
                let d = w.dimensions
                row([w.name, room.name, s(d.scan?.widthMM), s(d.scan?.heightMM), s(d.verified?.widthMM), s(d.verified?.heightMM),
                     s(d.manufacturing?.widthMM), s(d.manufacturing?.heightMM), t(.wall(w.id))], color: .darkGray)
            }
        }
    }
}
