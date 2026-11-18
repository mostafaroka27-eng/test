import SwiftUI
import AVKit
import InspectionCore

/// Shown when a plan item or table row is tapped: observed dimensions, the
/// bookmarked footage (seeked immediately), and editing of names, notes,
/// verified/manufacturing sizes and the bookmark link.
struct ItemDetailSheet: View {
    @ObservedObject var model: ReviewModel
    let target: LinkTarget
    @State private var editing = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    videoSection
                    dimensionSummary
                }
                .padding()
            }
            .navigationTitle(model.project.displayName(for: target) ?? "")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(Loc.t("common.edit")) { editing = true }
                }
            }
            .sheet(isPresented: $editing) { ItemEditor(model: model, target: target) }
        }
        .onAppear { model.play(target) }
        .onDisappear { model.player.pause() }
    }

    @ViewBuilder private var videoSection: some View {
        if model.videoURL != nil, let b = model.bookmark(for: target) {
            VideoPlayer(player: model.player)
                .frame(height: 220)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            HStack {
                Label(Fmt.time(b.mediaTime), systemImage: "bookmark.fill")
                Text(b.label).foregroundStyle(.secondary)
                Spacer()
                Button(Loc.t("video.replay")) { model.play(target) }
            }
            .font(.footnote)
        } else if model.videoURL == nil {
            note(Loc.t("detail.noVideo"))
        } else {
            note(Loc.t("detail.noBookmark"))
        }
    }

    @ViewBuilder private var dimensionSummary: some View {
        switch target {
        case .opening(let id):
            if let o = model.project.opening(id) {
                DimensionTable(rows: [
                    (Loc.t("dim.width"), o.dimensions.scan?.widthMM, o.dimensions.verified?.widthMM, o.dimensions.manufacturing?.widthMM),
                    (Loc.t("dim.height"), o.dimensions.scan?.heightMM, o.dimensions.verified?.heightMM, o.dimensions.manufacturing?.heightMM),
                ])
                if let sill = o.sillHeightM, o.kind == .window {
                    LabeledContent(Loc.t("dim.sill"), value: Fmt.mm(Units.millimeters(fromMeters: sill)))
                }
                ScanMeta(scan: o.dimensions.scan)
                if !o.notes.isEmpty { note(o.notes) }
            }
        case .wall(let id):
            if let w = model.project.wall(id) {
                DimensionTable(rows: [
                    (Loc.t("dim.length"), w.dimensions.scan?.widthMM, w.dimensions.verified?.widthMM, w.dimensions.manufacturing?.widthMM),
                    (Loc.t("dim.wallHeight"), w.dimensions.scan?.heightMM, w.dimensions.verified?.heightMM, w.dimensions.manufacturing?.heightMM),
                ])
                ScanMeta(scan: w.dimensions.scan)
                if !w.notes.isEmpty { note(w.notes) }
            }
        case .room(let id):
            if let r = model.project.room(id) {
                LabeledContent(Loc.t("dim.area"), value: Fmt.area(r.floorAreaM2))
                LabeledContent(Loc.t("dim.maxWallHeight"), value: Fmt.length(meters: r.maxWallHeightM, unit: model.roomUnit))
                LabeledContent(Loc.t("dim.ceilingVerified"),
                               value: r.verifiedCeilingHeightMM.map { Fmt.mm($0) } ?? Loc.t("value.notEntered"))
                Text(Loc.t("dim.ceilingNote")).font(.caption).foregroundStyle(.secondary)
                LabeledContent(Loc.t("room.alignment"), value: Loc.t("roomAlignment.\(r.alignment.rawValue)"))
                if !r.notes.isEmpty { note(r.notes) }
            }
        }
    }

    private func note(_ text: String) -> some View {
        Text(text).font(.callout).foregroundStyle(.secondary)
    }
}

/// Three columns, never merged: scan estimate | site-verified | manufacturing.
struct DimensionTable: View {
    let rows: [(String, Int?, Int?, Int?)]

    var body: some View {
        Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 8) {
            GridRow {
                Text("")
                Text(Loc.t("source.roomPlan")).font(.caption.bold())
                Text(Loc.t("source.manualVerified")).font(.caption.bold()).foregroundStyle(.green)
                Text(Loc.t("source.manufacturing")).font(.caption.bold()).foregroundStyle(.blue)
            }
            ForEach(Array(rows.enumerated()), id: \.offset) { _, r in
                GridRow {
                    Text(r.0).font(.callout)
                    Text(Fmt.mm(r.1)).monospacedDigit()
                    Text(r.2.map { Fmt.mm($0) } ?? "—").monospacedDigit().foregroundStyle(.green)
                    Text(r.3.map { Fmt.mm($0) } ?? "—").monospacedDigit().foregroundStyle(.blue)
                }
            }
            if let s = rows.first, let scan = s.1, let verified = s.2 {
                GridRow {
                    Text(Loc.t("dim.delta")).font(.caption)
                    Text("").gridCellUnsizedAxes(.horizontal)
                    Text(Fmt.mm(verified - scan)).font(.caption).monospacedDigit()
                    Text("")
                }
            }
        }
    }
}

struct ScanMeta: View {
    let scan: ScanDimensions?
    var body: some View {
        if let scan {
            HStack(spacing: 10) {
                Label(Fmt.confidence(scan.confidence), systemImage: "gauge.medium")
                if scan.isPartiallyObserved { Label(Loc.t("scan.partial"), systemImage: "exclamationmark.triangle") }
                if scan.widthM == nil || scan.heightM == nil { Label(Loc.t("scan.incomplete"), systemImage: "questionmark.diamond") }
            }
            .font(.caption).foregroundStyle(.secondary)
        } else {
            Label(Loc.t("scan.notDetected"), systemImage: "questionmark.diamond").font(.caption).foregroundStyle(.orange)
        }
    }
}
