import SwiftUI
import InspectionCore

/// Edits a room/wall/opening. The scan-derived values are read-only; typed
/// verified and manufacturing sizes are stored in their own fields, so the
/// scan result is never overwritten.
struct ItemEditor: View {
    @ObservedObject var model: ReviewModel
    let target: LinkTarget
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var notes = ""
    @State private var verifiedW = ""
    @State private var verifiedH = ""
    @State private var method = "laser"
    @State private var mfgW = ""
    @State private var mfgH = ""
    @State private var ceiling = ""
    @State private var bookmarkID: UUID?
    @State private var validation: String?

    var body: some View {
        NavigationStack {
            Form {
                Section(Loc.t("edit.identity")) {
                    TextField(Loc.t("edit.name"), text: $name)
                    TextField(Loc.t("edit.notes"), text: $notes, axis: .vertical).lineLimit(2...6)
                }
                scanSection
                if case .room = target {
                    Section {
                        mmField(Loc.t("dim.ceilingVerified"), text: $ceiling)
                    } header: { Text(Loc.t("source.manualVerified")) } footer: { Text(Loc.t("dim.ceilingNote")) }
                } else {
                    Section {
                        mmField(isWall ? Loc.t("dim.length") : Loc.t("dim.width"), text: $verifiedW)
                        mmField(isWall ? Loc.t("dim.wallHeight") : Loc.t("dim.height"), text: $verifiedH)
                        Picker(Loc.t("edit.method"), selection: $method) {
                            Text(Loc.t("method.laser")).tag("laser")
                            Text(Loc.t("method.tape")).tag("tape")
                            Text(Loc.t("method.other")).tag("other")
                        }
                    } header: { Text(Loc.t("source.manualVerified")) } footer: { Text(Loc.t("edit.verifiedFooter")) }
                    Section {
                        mmField(isWall ? Loc.t("dim.length") : Loc.t("dim.width"), text: $mfgW)
                        mmField(isWall ? Loc.t("dim.wallHeight") : Loc.t("dim.height"), text: $mfgH)
                    } header: { Text(Loc.t("source.manufacturing")) } footer: { Text(Loc.t("edit.mfgFooter")) }
                }
                Section(Loc.t("edit.bookmark")) {
                    Picker(Loc.t("edit.bookmark"), selection: $bookmarkID) {
                        Text(Loc.t("edit.noBookmark")).tag(UUID?.none)
                        ForEach(model.project.bookmarks) { b in
                            Text("\(TimeFormat.clock(b.mediaTime)) – \(b.label)").tag(UUID?.some(b.id))
                        }
                    }
                }
                if let validation { Text(validation).foregroundStyle(.red) }
            }
            .navigationTitle(Loc.t("common.edit"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button(Loc.t("common.cancel")) { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button(Loc.t("common.save")) { save() } }
            }
            .onAppear(perform: load)
        }
    }

    private var isWall: Bool { if case .wall = target { return true }; return false }

    @ViewBuilder private var scanSection: some View {
        Section {
            switch target {
            case .opening(let id):
                if let o = model.project.opening(id) {
                    LabeledContent(Loc.t("dim.width"), value: Fmt.mm(o.dimensions.scan?.widthMM))
                    LabeledContent(Loc.t("dim.height"), value: Fmt.mm(o.dimensions.scan?.heightMM))
                }
            case .wall(let id):
                if let w = model.project.wall(id) {
                    LabeledContent(Loc.t("dim.length"), value: Fmt.mm(w.dimensions.scan?.widthMM))
                    LabeledContent(Loc.t("dim.wallHeight"), value: Fmt.mm(w.dimensions.scan?.heightMM))
                }
            case .room(let id):
                if let r = model.project.room(id) {
                    LabeledContent(Loc.t("dim.area"), value: Fmt.area(r.floorAreaM2))
                    LabeledContent(Loc.t("dim.maxWallHeight"), value: Fmt.meters(r.maxWallHeightM))
                }
            }
        } header: { Text(Loc.t("source.roomPlan")) } footer: { Text(Loc.t("edit.scanFooter")) }
    }

    private func mmField(_ title: String, text: Binding<String>) -> some View {
        HStack {
            Text(title)
            Spacer()
            TextField("mm", text: text)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 120)
            Text(Loc.t("unit.mm")).foregroundStyle(.secondary)
        }
    }

    private func load() {
        let p = model.project
        bookmarkID = model.bookmark(for: target)?.id
        switch target {
        case .opening(let id):
            guard let o = p.opening(id) else { return }
            name = o.name; notes = o.notes; fill(o.dimensions)
        case .wall(let id):
            guard let w = p.wall(id) else { return }
            name = w.name; notes = w.notes; fill(w.dimensions)
        case .room(let id):
            guard let r = p.room(id) else { return }
            name = r.name; notes = r.notes; ceiling = r.verifiedCeilingHeightMM.map(String.init) ?? ""
        }
    }

    private func fill(_ d: DimensionRecord) {
        verifiedW = d.verified?.widthMM.map(String.init) ?? ""
        verifiedH = d.verified?.heightMM.map(String.init) ?? ""
        method = d.verified?.method ?? "laser"
        mfgW = d.manufacturing?.widthMM.map(String.init) ?? ""
        mfgH = d.manufacturing?.heightMM.map(String.init) ?? ""
    }

    /// Empty field → nil; invalid text → validation error.
    private func parse(_ s: String) -> Int?? {
        let t = s.trimmingCharacters(in: .whitespaces)
        if t.isEmpty { return .some(nil) }
        guard let v = Units.parseMillimeters(t) else { return nil }
        return .some(v)
    }

    private func save() {
        guard let vw = parse(verifiedW), let vh = parse(verifiedH), let mw = parse(mfgW), let mh = parse(mfgH), let ch = parse(ceiling) else {
            validation = Loc.t("edit.invalidNumber")
            return
        }
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else { validation = Loc.t("edit.nameRequired"); return }

        func merged(_ old: ManualDimensions?, w: Int?, h: Int?, method: String?) -> ManualDimensions? {
            if w == nil && h == nil { return nil }
            if old?.widthMM == w && old?.heightMM == h && old?.method == method { return old }
            return ManualDimensions(widthMM: w, heightMM: h, method: method, enteredAt: Date())
        }

        switch target {
        case .opening(let id):
            guard let i = model.project.openings.firstIndex(where: { $0.id == id }) else { return }
            model.project.openings[i].name = trimmedName
            model.project.openings[i].notes = notes
            model.project.openings[i].dimensions.verified = merged(model.project.openings[i].dimensions.verified, w: vw, h: vh, method: method)
            model.project.openings[i].dimensions.manufacturing = merged(model.project.openings[i].dimensions.manufacturing, w: mw, h: mh, method: nil)
        case .wall(let id):
            guard let i = model.project.walls.firstIndex(where: { $0.id == id }) else { return }
            model.project.walls[i].name = trimmedName
            model.project.walls[i].notes = notes
            model.project.walls[i].dimensions.verified = merged(model.project.walls[i].dimensions.verified, w: vw, h: vh, method: method)
            model.project.walls[i].dimensions.manufacturing = merged(model.project.walls[i].dimensions.manufacturing, w: mw, h: mh, method: nil)
        case .room(let id):
            guard let i = model.project.rooms.firstIndex(where: { $0.id == id }) else { return }
            model.project.rooms[i].name = trimmedName
            model.project.rooms[i].notes = notes
            model.project.rooms[i].verifiedCeilingHeightMM = ch
        }

        let current = model.bookmark(for: target)?.id
        if bookmarkID != current {
            if let current { model.assign(current, to: nil) }
            if let bookmarkID { model.assign(bookmarkID, to: target) }
        }
        model.persist()
        dismiss()
    }
}
