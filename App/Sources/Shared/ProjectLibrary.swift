import Foundation
import SwiftUI
import InspectionCore

/// App-wide access to locally saved projects.
///
/// Projects live in Application Support/Projects, which is private to the app
/// and is excluded from iCloud/iTunes backup so walkthrough footage never
/// leaves the phone unless the inspector exports it.
@MainActor
final class ProjectLibrary: ObservableObject {
    @Published private(set) var projects: [ProjectSummary] = []
    @Published private(set) var unreadableFolders: [String] = []
    @Published var lastError: String?

    let store: ProjectStore

    init(store: ProjectStore? = nil) {
        if let store {
            self.store = store
        } else {
            self.store = Self.makeDefaultStore()
        }
        refresh()
    }

    static func projectsRoot() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("Projects", isDirectory: true)
    }

    private static func makeDefaultStore() -> ProjectStore {
        var root = projectsRoot()
        do {
            let store = try ProjectStore(rootURL: root)
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try? root.setResourceValues(values)
            return store
        } catch {
            // Fall back to a temporary folder so the UI can still show the error.
            let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("Projects")
            return try! ProjectStore(rootURL: tmp)
        }
    }

    func refresh() {
        let listing = store.list()
        projects = listing.projects
        unreadableFolders = listing.unreadable
    }

    func create(name: String) -> SurveyProject? {
        do {
            var p = try store.create(name: name)
            p.appVersion = Bundle.main.appVersionString
            try store.save(p)
            refresh()
            return p
        } catch {
            lastError = error.localizedDescription
            return nil
        }
    }

    func load(_ id: UUID) -> SurveyProject? {
        do { return try store.load(id) } catch { lastError = error.localizedDescription; return nil }
    }

    func save(_ project: SurveyProject) {
        do { try store.save(project); refresh() } catch { lastError = error.localizedDescription }
    }

    func rename(_ id: UUID, to name: String) {
        do { _ = try store.rename(id, to: name); refresh() } catch { lastError = error.localizedDescription }
    }

    func delete(_ id: UUID) {
        do { try store.delete(id); refresh() } catch { lastError = error.localizedDescription }
    }

    /// Creates the labeled sample inspection, including its synthetic video.
    func createSample() async -> SurveyProject? {
        var sample = SampleProjectFactory.make()
        sample.appVersion = Bundle.main.appVersionString
        do {
            try store.save(sample, touch: false)
            let dir = store.directory(for: sample.id)
            try FileManager.default.createDirectory(at: dir.appendingPathComponent("exports"), withIntermediateDirectories: true)
            let videoURL = store.url(for: "video.mp4", in: sample.id)
            do {
                try await SampleVideoGenerator.generate(to: videoURL)
                try store.registerOutput(.video, relativePath: "video.mp4", in: &sample)
            } catch {
                store.markOutputFailed(.video, message: error.localizedDescription, in: &sample)
            }
            let snapshot = sample
            try? store.writeOutput(.model3D, relativePath: "model.usdz", in: &sample) { url in
                try SampleModelBuilder.write(snapshot, to: url)
            }
            refresh()
            return try store.load(sample.id)
        } catch {
            lastError = error.localizedDescription
            return nil
        }
    }
}

extension Bundle {
    var appVersionString: String {
        let v = infoDictionary?["CFBundleShortVersionString"] as? String ?? "?"
        let b = infoDictionary?["CFBundleVersion"] as? String ?? "?"
        return "\(v) (\(b))"
    }
}
