import SwiftUI
import SceneKit
import QuickLook
import InspectionCore

/// Reviewable 3D model (USDZ exported by RoomPlan). Orbit/zoom with SceneKit;
/// "AR Quick Look" opens Apple's viewer (place it in the room, measure, share).
struct ModelTab: View {
    @ObservedObject var model: ReviewModel
    @State private var quickLookURL: URL?
    @State private var selectedRoomModel: String?

    var body: some View {
        VStack {
            if let url = currentURL {
                USDZSceneView(url: url)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal)
                HStack {
                    if !roomModels.isEmpty {
                        Menu {
                            Button(Loc.t("model.whole")) { selectedRoomModel = nil }
                            ForEach(roomModels, id: \.path) { m in Button(m.name) { selectedRoomModel = m.path } }
                        } label: { Label(Loc.t("model.choose"), systemImage: "square.stack.3d.up") }
                    }
                    Spacer()
                    Button { quickLookURL = url } label: { Label(Loc.t("model.quickLook"), systemImage: "arkit") }
                        .buttonStyle(.bordered)
                }
                .padding()
                Text(Loc.t("model.note")).font(.caption).foregroundStyle(.secondary).padding(.horizontal)
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "cube.transparent").font(.system(size: 48)).foregroundStyle(.secondary)
                    Text(model.project.outputs[.model3D]?.state == .failed ? Loc.t("model.failed") : Loc.t("model.none"))
                        .multilineTextAlignment(.center).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .quickLookPreview($quickLookURL)
    }

    private var roomModels: [(name: String, path: String)] {
        model.project.rooms.compactMap { r in r.modelPath.map { (r.name, $0) } }
    }

    private var currentURL: URL? {
        if let p = selectedRoomModel {
            let u = model.store.url(for: p, in: model.project.id)
            return FileManager.default.fileExists(atPath: u.path) ? u : nil
        }
        return model.modelURL
    }
}

struct USDZSceneView: UIViewRepresentable {
    let url: URL

    final class Coordinator { var loadedURL: URL? }
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> SCNView {
        let v = SCNView()
        v.allowsCameraControl = true
        v.autoenablesDefaultLighting = true
        v.backgroundColor = .secondarySystemBackground
        v.antialiasingMode = .multisampling4X
        load(into: v, context: context)
        return v
    }

    func updateUIView(_ v: SCNView, context: Context) {
        if context.coordinator.loadedURL != url { load(into: v, context: context) }
    }

    private func load(into v: SCNView, context: Context) {
        v.scene = (try? SCNScene(url: url, options: nil)) ?? SCNScene()
        v.pointOfView = nil
        context.coordinator.loadedURL = url
    }
}
