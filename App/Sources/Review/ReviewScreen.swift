import SwiftUI
import InspectionCore

struct ReviewScreen: View {
    @StateObject private var model: ReviewModel
    @EnvironmentObject private var library: ProjectLibrary
    @State private var showCapture: Bool
    @State private var showExport = false
    @State private var detailTarget: LinkTarget?

    init(project: SurveyProject, library: ProjectLibrary, startCapture: Bool = false) {
        _model = StateObject(wrappedValue: ReviewModel(project: project, library: library))
        _showCapture = State(initialValue: startCapture)
    }

    var body: some View {
        VStack(spacing: 0) {
            if model.project.isSample { SampleBadge().padding(.horizontal).padding(.top, 6) }
            if !model.missingOutputs.isEmpty {
                Text(Loc.t("review.missingFiles", model.missingOutputs.map { Loc.t("output.\($0.rawValue)") }.joined(separator: ", ")))
                    .font(.footnote).foregroundStyle(.white).padding(8).frame(maxWidth: .infinity)
                    .background(Color.orange)
            }
            if model.project.hasScan || model.project.isSample {
                Picker("", selection: $model.tab) {
                    Text(Loc.t("tab.plan")).tag(ReviewModel.Tab.plan)
                    Text(Loc.t("tab.model")).tag(ReviewModel.Tab.model)
                    Text(Loc.t("tab.measurements")).tag(ReviewModel.Tab.measurements)
                    Text(Loc.t("tab.video")).tag(ReviewModel.Tab.video)
                }
                .pickerStyle(.segmented)
                .padding()
                Group {
                    switch model.tab {
                    case .plan: PlanTab(model: model) { detailTarget = $0 }
                    case .model: ModelTab(model: model)
                    case .measurements: MeasurementsTab(model: model) { detailTarget = $0 }
                    case .video: VideoTab(model: model)
                    }
                }
                .frame(maxHeight: .infinity)
            } else {
                EmptyScanView { showCapture = true }
            }
        }
        .navigationTitle(model.project.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showExport = true } label: { Image(systemName: "square.and.arrow.up") }
                    .accessibilityLabel(Loc.t("export.title"))
                    .disabled(!model.project.hasScan && !model.project.isSample)
            }
        }
        .sheet(item: Binding(get: { detailTarget.map(IdentifiedTarget.init) }, set: { detailTarget = $0?.target })) { item in
            ItemDetailSheet(model: model, target: item.target)
                .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showExport) {
            ExportScreen(model: model)
        }
        .fullScreenCover(isPresented: $showCapture) {
            CaptureScreen(project: model.project, library: library) { _ in
                showCapture = false
                model.reload()
            }
        }
        .alert(Loc.t("common.error"), isPresented: Binding(get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })) {
            Button(Loc.t("common.ok")) { model.errorMessage = nil }
        } message: { Text(model.errorMessage ?? "") }
        .onDisappear { model.player.pause() }
    }
}

struct IdentifiedTarget: Identifiable {
    let target: LinkTarget
    var id: String { "\(target)" }
}

struct SampleBadge: View {
    var body: some View {
        Label(Loc.t("sample.badge"), systemImage: "testtube.2")
            .font(.footnote.weight(.semibold))
            .padding(.horizontal, 10).padding(.vertical, 6)
            .frame(maxWidth: .infinity)
            .background(Color.purple.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
            .foregroundStyle(.purple)
    }
}

struct EmptyScanView: View {
    let start: () -> Void
    var body: some View {
        let status = DeviceSupport.captureStatus()
        VStack(spacing: 16) {
            Image(systemName: "viewfinder").font(.system(size: 56)).foregroundStyle(.secondary)
            Text(Loc.t("review.noScan")).font(.headline)
            if let key = DeviceSupport.messageKey(for: status) {
                Text(Loc.t(key)).font(.callout).multilineTextAlignment(.center).foregroundStyle(.secondary).padding(.horizontal)
            }
            Button(action: start) { Label(Loc.t("capture.start"), systemImage: "record.circle") }
                .buttonStyle(.borderedProminent)
                .disabled(status != .supported)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
