import SwiftUI
import UIKit
import InspectionCore

/// Export & share. Shows the state of every output and lets the inspector
/// retry just the one that failed. Nothing leaves the phone until Share is used.
struct ExportScreen: View {
    @ObservedObject var model: ReviewModel
    @Environment(\.dismiss) private var dismiss
    @State private var shareItems: [URL] = []
    @State private var showShare = false
    @State private var errors: [ExportKind: String] = [:]
    @State private var busy = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(ExportKind.allCases) { kind in row(kind) }
                } footer: { Text(Loc.t("export.privacy")) }
                Section {
                    Button {
                        shareAll()
                    } label: { Label(Loc.t("export.shareAll"), systemImage: "square.and.arrow.up.on.square") }
                    .disabled(busy)
                }
            }
            .navigationTitle(Loc.t("export.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button(Loc.t("common.done")) { dismiss() } } }
            .sheet(isPresented: $showShare) { ShareSheet(items: shareItems) }
        }
    }

    private func row(_ kind: ExportKind) -> some View {
        let record = model.project.outputs[kind.outputKind]
        let available = model.store.existingOutputURL(kind.outputKind, in: model.project) != nil
        return HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(Loc.t("export.\(kind.rawValue)")).font(.body.weight(.semibold))
                Group {
                    if let e = errors[kind] ?? (record?.state == .failed ? record?.message : nil) {
                        Text(Loc.t("export.retryNeeded") + ": " + e).foregroundStyle(.red)
                    } else if available {
                        Text(Loc.t("export.ready")).foregroundStyle(.green)
                    } else if kind.isGenerated {
                        Text(Loc.t("export.notGenerated")).foregroundStyle(.secondary)
                    } else {
                        Text(Loc.t("export.unavailable")).foregroundStyle(.secondary)
                    }
                }
                .font(.caption)
            }
            Spacer()
            if kind.isGenerated || available {
                Button {
                    share([kind])
                } label: {
                    Image(systemName: (errors[kind] != nil || record?.state == .failed) ? "arrow.clockwise" : "square.and.arrow.up")
                }
                .buttonStyle(.bordered)
                .disabled(busy)
            }
        }
    }

    private func share(_ kinds: [ExportKind]) {
        busy = true
        defer { busy = false }
        let service = ExportService(store: model.store)
        var urls: [URL] = []
        for kind in kinds {
            do {
                urls.append(try service.produce(kind, project: &model.project))
                errors[kind] = nil
            } catch {
                errors[kind] = error.localizedDescription
            }
        }
        model.library.refresh()
        if !urls.isEmpty { shareItems = urls; showShare = true }
    }

    private func shareAll() {
        let kinds = ExportKind.allCases.filter { $0.isGenerated || model.store.existingOutputURL($0.outputKind, in: model.project) != nil }
        share(kinds)
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [URL]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
