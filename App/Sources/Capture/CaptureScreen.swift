import SwiftUI
import RoomPlan
import InspectionCore

/// Hosts Apple's `RoomCaptureView` (live RoomPlan guidance and coaching).
struct RoomCaptureContainer: UIViewRepresentable {
    let controller: CaptureSessionController
    func makeUIView(context: Context) -> RoomCaptureView { controller.roomCaptureView }
    func updateUIView(_ uiView: RoomCaptureView, context: Context) {}
}

/// Capture screen: Start Scan, Bookmark, Finish Room, Next Room, Finish Survey.
struct CaptureScreen: View {
    @StateObject private var controller: CaptureSessionController
    @Environment(\.scenePhase) private var scenePhase
    @State private var confirmDiscard = false
    let onDone: (SurveyProject?) -> Void

    init(project: SurveyProject, library: ProjectLibrary, onDone: @escaping (SurveyProject?) -> Void) {
        _controller = StateObject(wrappedValue: CaptureSessionController(project: project, library: library))
        self.onDone = onDone
    }

    var body: some View {
        ZStack {
            RoomCaptureContainer(controller: controller).ignoresSafeArea()
            VStack(spacing: 8) {
                statusBar
                if let g = controller.guidance { banner(Loc.t(g.key), severity: g.severity) }
                if controller.revisitWalls > 0, case .scanning = controller.phase {
                    banner(Loc.t("capture.revisit", controller.revisitWalls), severity: .info)
                }
                if let v = controller.videoProblem { banner(v, severity: .warning) }
                if let s = controller.storageWarning { banner(Loc.t("capture.storageLow", Int(s / 60)), severity: .warning) }
                if let e = controller.roomError { banner(e, severity: .critical) }
                Spacer()
                controls
            }
            .padding()
            if controller.bookmarkFlash {
                Text(Loc.t("capture.bookmarkSaved"))
                    .font(.headline).padding().background(.thinMaterial, in: Capsule())
                    .transition(.opacity)
            }
            if case .finishing = controller.phase { processingOverlay(Loc.t("capture.finishing")) }
            if case .processingRoom = controller.phase { processingOverlay(Loc.t("capture.processingRoom")) }
        }
        .animation(.easeInOut, value: controller.bookmarkFlash)
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .background { controller.handleBackground() }
        }
        .onChange(of: controller.phase) { _, newPhase in
            if newPhase == .finished, controller.finishProblems.isEmpty { onDone(controller.project) }
        }
        .alert(Loc.t("capture.finishedWithProblems"), isPresented: .constant(controller.phase == .finished && !controller.finishProblems.isEmpty)) {
            Button(Loc.t("common.ok")) { onDone(controller.project) }
        } message: {
            Text(controller.finishProblems.joined(separator: "\n"))
        }
        .confirmationDialog(Loc.t("capture.discard.title"), isPresented: $confirmDiscard, titleVisibility: .visible) {
            Button(Loc.t("capture.discard.confirm"), role: .destructive) { controller.discard(); onDone(nil) }
        }
        .statusBarHidden()
    }

    // MARK: Pieces

    private var statusBar: some View {
        HStack(spacing: 12) {
            Button { confirmDiscard = true } label: { Image(systemName: "xmark") }
                .buttonStyle(.bordered).tint(.white)
                .accessibilityLabel(Loc.t("capture.cancel"))
            HStack(spacing: 6) {
                Circle().fill(controller.isRecording ? Color.red : Color.gray).frame(width: 10, height: 10)
                Text(controller.isRecording ? Loc.t("capture.recording") : Loc.t("capture.notRecording"))
                Text(Fmt.time(controller.recordingSeconds)).monospacedDigit()
            }
            Spacer()
            Label("\(controller.bookmarkCount)", systemImage: "bookmark.fill")
            Label("\(controller.completedRooms)", systemImage: "square.split.bottomrightquarter")
        }
        .font(.subheadline.weight(.semibold))
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private func banner(_ text: String, severity: GuidanceMessage.Severity) -> some View {
        let color: Color = severity == .critical ? .red : (severity == .warning ? .orange : .blue)
        return Text(text)
            .font(.callout.weight(.medium))
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(10)
            .background(color.opacity(0.85), in: RoundedRectangle(cornerRadius: 10))
            .foregroundStyle(.white)
    }

    @ViewBuilder private var controls: some View {
        switch controller.phase {
        case .ready:
            bigButton(Loc.t("capture.start"), systemImage: "record.circle", tint: .red) { controller.startScan() }
        case .scanning(let room):
            VStack(spacing: 10) {
                Text(Loc.t("capture.scanningRoom", room)).font(.headline)
                    .padding(6).background(.thinMaterial, in: Capsule())
                bigButton(Loc.t("capture.bookmark"), systemImage: "bookmark.fill", tint: .yellow) { controller.addBookmark() }
                HStack {
                    bigButton(Loc.t("capture.finishRoom"), systemImage: "checkmark.square", tint: .blue) { controller.finishRoom() }
                    bigButton(Loc.t("capture.finishSurvey"), systemImage: "flag.checkered", tint: .green) { controller.finishSurvey() }
                }
            }
        case .betweenRooms(let done):
            VStack(spacing: 10) {
                Text(Loc.t("capture.roomsDone", done)).font(.headline)
                    .padding(6).background(.thinMaterial, in: Capsule())
                Text(Loc.t("capture.betweenRoomsHint")).font(.footnote).multilineTextAlignment(.center)
                    .padding(8).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 8))
                HStack {
                    bigButton(Loc.t("capture.nextRoom"), systemImage: "plus.square.on.square", tint: .blue) { controller.scanNextRoom() }
                    bigButton(Loc.t("capture.finishSurvey"), systemImage: "flag.checkered", tint: .green) { controller.finishSurvey() }
                }
            }
        case .failed(let message):
            VStack {
                banner(message, severity: .critical)
                bigButton(Loc.t("common.close"), systemImage: "xmark", tint: .gray) { onDone(nil) }
            }
        case .processingRoom, .finishing, .finished:
            EmptyView()
        }
    }

    private func bigButton(_ title: String, systemImage: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage).font(.headline).frame(maxWidth: .infinity, minHeight: 44)
        }
        .buttonStyle(.borderedProminent).tint(tint)
    }

    private func processingOverlay(_ text: String) -> some View {
        ZStack {
            Color.black.opacity(0.5).ignoresSafeArea()
            VStack(spacing: 12) { ProgressView(); Text(text).foregroundStyle(.white) }
        }
    }
}
