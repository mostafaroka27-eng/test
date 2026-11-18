import SwiftUI
import InspectionCore

/// Measurement table grouped by room. Openings in millimeters; room
/// dimensions switchable between meters and millimeters.
struct MeasurementsTab: View {
    @ObservedObject var model: ReviewModel
    let onSelect: (LinkTarget) -> Void

    var body: some View {
        List {
            Section {
                Picker(Loc.t("measure.roomUnit"), selection: $model.roomUnit) {
                    Text(Loc.t("unit.m")).tag(LengthUnit.meters)
                    Text(Loc.t("unit.mm")).tag(LengthUnit.millimeters)
                }
                .pickerStyle(.segmented)
                Text(Loc.t("measure.provenanceNote")).font(.caption).foregroundStyle(.secondary)
            }
            ForEach(model.project.rooms.sorted { $0.scanIndex < $1.scanIndex }) { room in
                Section {
                    Button { onSelect(.room(room.id)) } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            row(Loc.t("dim.area"), Fmt.area(room.floorAreaM2))
                            row(Loc.t("dim.maxWallHeight"), Fmt.length(meters: room.maxWallHeightM, unit: model.roomUnit))
                            row(Loc.t("dim.ceilingVerified"), room.verifiedCeilingHeightMM.map { Fmt.mm($0) } ?? Loc.t("value.notEntered"))
                        }
                    }
                    .buttonStyle(.plain)

                    ForEach(model.project.openings.filter { $0.roomID == room.id }) { o in
                        Button { onSelect(.opening(o.id)) } label: { openingRow(o) }.buttonStyle(.plain)
                    }
                    DisclosureGroup(Loc.t("measure.walls", model.project.walls.filter { $0.roomID == room.id }.count)) {
                        ForEach(model.project.walls.filter { $0.roomID == room.id }) { w in
                            Button { onSelect(.wall(w.id)) } label: { wallRow(w) }.buttonStyle(.plain)
                        }
                    }
                } header: {
                    HStack {
                        Text(room.name)
                        if room.alignment == .notAligned || room.alignment == .suspect {
                            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.orange)
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }

    private func row(_ title: String, _ value: String) -> some View {
        HStack { Text(title).foregroundStyle(.secondary); Spacer(); Text(value).monospacedDigit() }.font(.callout)
    }

    private func openingRow(_ o: OpeningRecord) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(o.name).font(.body.weight(.semibold))
                    if model.bookmark(for: .opening(o.id)) != nil { Image(systemName: "play.circle").foregroundStyle(.tint) }
                }
                ScanMeta(scan: o.dimensions.scan)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(Fmt.mm(o.dimensions.scan?.widthMM)) × \(Fmt.mm(o.dimensions.scan?.heightMM))").monospacedDigit()
                if let v = o.dimensions.verified {
                    Text("✓ \(v.widthMM.map(String.init) ?? "—") × \(v.heightMM.map(String.init) ?? "—")")
                        .font(.caption).foregroundStyle(.green).monospacedDigit()
                }
                if let m = o.dimensions.manufacturing {
                    Text("⚙︎ \(m.widthMM.map(String.init) ?? "—") × \(m.heightMM.map(String.init) ?? "—")")
                        .font(.caption).foregroundStyle(.blue).monospacedDigit()
                }
            }
        }
    }

    private func wallRow(_ w: WallRecord) -> some View {
        HStack {
            Text(w.name).font(.callout)
            if w.dimensions.scan?.isPartiallyObserved == true {
                Image(systemName: "exclamationmark.triangle").foregroundStyle(.orange).font(.caption)
            }
            Spacer()
            VStack(alignment: .trailing) {
                Text(Fmt.mm(w.dimensions.scan?.widthMM)).monospacedDigit()
                if let v = w.dimensions.verified?.widthMM {
                    Text("✓ \(v)").font(.caption).foregroundStyle(.green).monospacedDigit()
                }
            }
        }
    }
}
