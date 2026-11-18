import SwiftUI
import InspectionCore

struct ProjectRoute: Hashable {
    let id: UUID
    let startCapture: Bool
}

/// Projects: create, rename, reopen, export and delete locally saved surveys.
struct ProjectsScreen: View {
    @EnvironmentObject private var library: ProjectLibrary
    @State private var path: [ProjectRoute] = []
    @State private var showNew = false
    @State private var newName = ""
    @State private var renameTarget: ProjectSummary?
    @State private var renameText = ""
    @State private var deleteTarget: ProjectSummary?
    @State private var exportProject: SurveyProject?
    @State private var showSettings = false
    @State private var creatingSample = false

    var body: some View {
        NavigationStack(path: $path) {
            List {
                if let key = DeviceSupport.messageKey(for: DeviceSupport.captureStatus()) {
                    Section { Label(Loc.t(key), systemImage: "exclamationmark.triangle").font(.callout).foregroundStyle(.orange) }
                }
                if !library.unreadableFolders.isEmpty {
                    Section { Text(Loc.t("projects.unreadable", library.unreadableFolders.count)).font(.caption).foregroundStyle(.red) }
                }
                if library.projects.isEmpty {
                    Section {
                        VStack(spacing: 8) {
                            Text(Loc.t("projects.empty")).font(.headline)
                            Text(Loc.t("projects.emptyHint")).font(.callout).foregroundStyle(.secondary).multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity).padding(.vertical)
                    }
                }
                ForEach(library.projects) { p in
                    NavigationLink(value: ProjectRoute(id: p.id, startCapture: false)) { ProjectRow(summary: p) }
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) { deleteTarget = p } label: { Label(Loc.t("common.delete"), systemImage: "trash") }
                            Button { renameTarget = p; renameText = p.name } label: { Label(Loc.t("common.rename"), systemImage: "pencil") }.tint(.indigo)
                        }
                        .contextMenu {
                            Button { renameTarget = p; renameText = p.name } label: { Label(Loc.t("common.rename"), systemImage: "pencil") }
                            Button { exportProject = library.load(p.id) } label: { Label(Loc.t("export.title"), systemImage: "square.and.arrow.up") }
                            Button(role: .destructive) { deleteTarget = p } label: { Label(Loc.t("common.delete"), systemImage: "trash") }
                        }
                }
            }
            .navigationTitle(Loc.t("projects.title"))
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showSettings = true } label: { Image(systemName: "gearshape") }.accessibilityLabel(Loc.t("settings.title"))
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button { newName = ""; showNew = true } label: { Label(Loc.t("projects.new"), systemImage: "plus") }
                        Button {
                            creatingSample = true
                            Task {
                                if let s = await library.createSample() { path.append(ProjectRoute(id: s.id, startCapture: false)) }
                                creatingSample = false
                            }
                        } label: { Label(Loc.t("projects.addSample"), systemImage: "testtube.2") }
                    } label: { Image(systemName: "plus") }
                    .accessibilityLabel(Loc.t("projects.new"))
                }
            }
            .navigationDestination(for: ProjectRoute.self) { route in
                if let project = library.load(route.id) {
                    ReviewScreen(project: project, library: library,
                                 startCapture: route.startCapture && DeviceSupport.captureStatus() == .supported)
                } else {
                    Text(Loc.t("projects.loadFailed"))
                }
            }
            .alert(Loc.t("projects.new"), isPresented: $showNew) {
                TextField(Loc.t("projects.namePlaceholder"), text: $newName)
                Button(Loc.t("projects.create")) {
                    if let p = library.create(name: newName) { path.append(ProjectRoute(id: p.id, startCapture: true)) }
                }
                Button(Loc.t("common.cancel"), role: .cancel) {}
            }
            .alert(Loc.t("common.rename"), isPresented: Binding(get: { renameTarget != nil }, set: { if !$0 { renameTarget = nil } })) {
                TextField(Loc.t("projects.namePlaceholder"), text: $renameText)
                Button(Loc.t("common.save")) { if let t = renameTarget { library.rename(t.id, to: renameText) }; renameTarget = nil }
                Button(Loc.t("common.cancel"), role: .cancel) { renameTarget = nil }
            }
            .confirmationDialog(Loc.t("projects.deleteTitle"), isPresented: Binding(get: { deleteTarget != nil }, set: { if !$0 { deleteTarget = nil } }), titleVisibility: .visible) {
                Button(Loc.t("common.delete"), role: .destructive) { if let t = deleteTarget { library.delete(t.id) }; deleteTarget = nil }
            } message: { Text(Loc.t("projects.deleteMessage")) }
            .alert(Loc.t("common.error"), isPresented: Binding(get: { library.lastError != nil }, set: { if !$0 { library.lastError = nil } })) {
                Button(Loc.t("common.ok")) { library.lastError = nil }
            } message: { Text(library.lastError ?? "") }
            .sheet(item: $exportProject) { p in
                ExportScreen(model: ReviewModel(project: p, library: library))
            }
            .sheet(isPresented: $showSettings) { SettingsScreen() }
            .overlay { if creatingSample { ProgressView(Loc.t("projects.creatingSample")).padding().background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12)) } }
            .refreshable { library.refresh() }
        }
    }
}

struct ProjectRow: View {
    let summary: ProjectSummary
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(summary.name).font(.headline).lineLimit(2)
                if summary.isSample {
                    Text(Loc.t("sample.short")).font(.caption2.bold()).padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color.purple.opacity(0.15), in: Capsule()).foregroundStyle(.purple)
                }
            }
            HStack(spacing: 10) {
                Text(summary.updatedAt.formatted(date: .abbreviated, time: .shortened))
                Label("\(summary.roomCount)", systemImage: "square.split.bottomrightquarter")
                if summary.hasVideo { Image(systemName: "video.fill") }
                if !summary.failedOutputs.isEmpty {
                    Label(Loc.t("projects.retryNeeded"), systemImage: "exclamationmark.arrow.circlepath").foregroundStyle(.red)
                }
            }
            .font(.caption).foregroundStyle(.secondary)
        }
    }
}

struct SettingsScreen: View {
    @EnvironmentObject private var language: LanguageSettings
    @Environment(\.dismiss) private var dismiss
    @AppStorage(SettingsKeys.frameSource) private var frameSource = "delegate"

    var body: some View {
        NavigationStack {
            Form {
                Section(Loc.t("settings.language")) {
                    Picker(Loc.t("settings.language"), selection: $language.language) {
                        Text(Loc.t("settings.language.system")).tag(AppLanguage.system)
                        Text("English").tag(AppLanguage.english)
                        Text("العربية").tag(AppLanguage.arabic)
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }
                Section {
                    Picker(Loc.t("settings.frameSource"), selection: $frameSource) {
                        Text(Loc.t("settings.frameSource.delegate")).tag("delegate")
                        Text(Loc.t("settings.frameSource.polling")).tag("polling")
                    }
                } footer: { Text(Loc.t("settings.frameSource.footer")) }
                Section(Loc.t("settings.privacy")) {
                    Text(Loc.t("settings.privacyText")).font(.callout)
                }
                Section {
                    LabeledContent(Loc.t("settings.version"), value: Bundle.main.appVersionString)
                    LabeledContent(Loc.t("settings.device"), value: DeviceSupport.modelIdentifier)
                }
            }
            .navigationTitle(Loc.t("settings.title"))
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button(Loc.t("common.done")) { dismiss() } } }
        }
    }
}
