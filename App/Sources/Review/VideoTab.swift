import SwiftUI
import AVKit
import InspectionCore

/// The walkthrough video and its bookmarks. Bookmarks can be renamed,
/// nudged, deleted, added at the current time, and linked to plan items.
struct VideoTab: View {
    @ObservedObject var model: ReviewModel
    @State private var assigning: Bookmark?
    @State private var renaming: Bookmark?
    @State private var newLabel = ""

    var body: some View {
        VStack(spacing: 0) {
            if model.videoURL != nil {
                VideoPlayer(player: model.player)
                    .frame(height: 260)
                    .environment(\.layoutDirection, .leftToRight)
                if let v = model.project.video { videoInfo(v) }
            } else {
                Label(Loc.t("detail.noVideo"), systemImage: "video.slash").padding()
            }
            List {
                Section {
                    Picker(Loc.t("video.preRoll"), selection: $model.preRoll) {
                        Text("0 s").tag(0.0); Text("1 s").tag(1.0); Text("2 s").tag(2.0)
                    }
                    Button { model.addBookmarkAtCurrentTime() } label: {
                        Label(Loc.t("video.addBookmark"), systemImage: "bookmark.circle")
                    }
                    .disabled(model.videoURL == nil)
                }
                Section(Loc.t("video.bookmarks")) {
                    if model.project.bookmarks.isEmpty { Text(Loc.t("video.noBookmarks")).foregroundStyle(.secondary) }
                    ForEach(model.project.bookmarks) { b in
                        bookmarkRow(b)
                            .contentShape(Rectangle())
                            .onTapGesture { model.seek(to: max(0, b.mediaTime - model.preRoll)) }
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) { model.deleteBookmark(b.id) } label: { Label(Loc.t("common.delete"), systemImage: "trash") }
                                Button { renaming = b; newLabel = b.label } label: { Label(Loc.t("common.rename"), systemImage: "pencil") }
                            }
                            .swipeActions(edge: .leading) {
                                Button { assigning = b } label: { Label(Loc.t("video.assign"), systemImage: "link") }.tint(.blue)
                            }
                    }
                }
            }
        }
        .sheet(item: $assigning) { b in AssignBookmarkSheet(model: model, bookmark: b) }
        .alert(Loc.t("common.rename"), isPresented: Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })) {
            TextField("", text: $newLabel)
            Button(Loc.t("common.save")) { if let r = renaming { model.renameBookmark(r.id, to: newLabel) }; renaming = nil }
            Button(Loc.t("common.cancel"), role: .cancel) { renaming = nil }
        }
    }

    private func videoInfo(_ v: VideoInfo) -> some View {
        HStack(spacing: 12) {
            if v.isSynthetic { Text(Loc.t("video.synthetic")).foregroundStyle(.purple) }
            Text(Fmt.time(v.durationSeconds))
            Text("\(v.pixelWidth)×\(v.pixelHeight)")
            if v.framesDropped > 0 { Text(Loc.t("video.dropped", v.framesDropped)).foregroundStyle(.orange) }
            if !v.interruptions.isEmpty { Text(Loc.t("video.interruptions", v.interruptions.count)).foregroundStyle(.orange) }
            if let r = v.stopReason { Text(Loc.t("capture.video.stopped.\(r)")).foregroundStyle(.orange) }
        }
        .font(.caption2).padding(6)
    }

    private func bookmarkRow(_ b: Bookmark) -> some View {
        HStack {
            Text(Fmt.time(b.mediaTime)).monospacedDigit().frame(minWidth: 64, alignment: .leading)
            VStack(alignment: .leading) {
                Text(b.label)
                if let t = b.target, let name = model.project.displayName(for: t) {
                    Label(name, systemImage: "link").font(.caption).foregroundStyle(.tint)
                } else {
                    Text(Loc.t("video.unassigned")).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            HStack(spacing: 4) {
                Button { model.nudge(b.id, by: -0.5) } label: { Image(systemName: "gobackward") }
                Button { model.nudge(b.id, by: 0.5) } label: { Image(systemName: "goforward") }
                Button { assigning = b } label: { Image(systemName: "link.badge.plus") }
            }
            .buttonStyle(.borderless)
        }
    }
}

struct AssignBookmarkSheet: View {
    @ObservedObject var model: ReviewModel
    let bookmark: Bookmark
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Button(Loc.t("video.unlink")) { model.assign(bookmark.id, to: nil); dismiss() }
                Section(Loc.t("video.assignTo")) {
                    ForEach(model.linkTargets, id: \.target) { item in
                        Button {
                            model.assign(bookmark.id, to: item.target); dismiss()
                        } label: {
                            HStack {
                                Text(item.name)
                                Spacer()
                                if bookmark.target == item.target { Image(systemName: "checkmark") }
                            }
                        }
                    }
                }
            }
            .navigationTitle("\(TimeFormat.clock(bookmark.mediaTime)) – \(bookmark.label)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button(Loc.t("common.cancel")) { dismiss() } } }
        }
    }
}
