import Foundation
import AVFoundation
import SwiftUI
import InspectionCore

/// State for one opened project: edits, selection and the shared video player.
@MainActor
final class ReviewModel: ObservableObject {
    enum Tab: String, CaseIterable, Identifiable { case plan, model, measurements, video; var id: String { rawValue } }

    @Published var project: SurveyProject
    @Published var tab: Tab = .plan
    @Published var selection: LinkTarget?
    @Published var roomUnit: LengthUnit = .meters
    @Published var missingOutputs: [OutputKind] = []
    @Published var errorMessage: String?
    @Published var preRoll: Double {
        didSet { UserDefaults.standard.set(preRoll, forKey: "bookmarkPreRoll") }
    }

    let library: ProjectLibrary
    let player = AVPlayer()

    init(project: SurveyProject, library: ProjectLibrary) {
        self.project = project
        self.library = library
        self.preRoll = UserDefaults.standard.object(forKey: "bookmarkPreRoll") as? Double ?? BookmarkService.defaultPreRoll
        reloadPlayer()
        missingOutputs = library.store.verifyOutputs(of: project)
    }

    var store: ProjectStore { library.store }

    var videoURL: URL? { store.existingOutputURL(.video, in: project) }
    var modelURL: URL? { store.existingOutputURL(.model3D, in: project) }

    func reload() {
        if let p = library.load(project.id) { project = p }
        reloadPlayer()
        missingOutputs = store.verifyOutputs(of: project)
    }

    private func reloadPlayer() {
        if let url = videoURL {
            if (player.currentItem?.asset as? AVURLAsset)?.url != url {
                player.replaceCurrentItem(with: AVPlayerItem(url: url))
            }
        } else {
            player.replaceCurrentItem(with: nil)
        }
    }

    func persist() {
        project.updatedAt = Date()
        library.save(project)
    }

    // MARK: Video & bookmarks

    var currentTime: Double { player.currentTime().seconds.isFinite ? player.currentTime().seconds : 0 }

    /// Seeks frame-accurately (zero tolerance) to `seconds` and optionally plays.
    func seek(to seconds: Double, play: Bool = true) {
        let time = CMTime(seconds: seconds, preferredTimescale: 90_000)
        player.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] finished in
            guard finished, play else { return }
            Task { @MainActor in self?.player.play() }
        }
    }

    func seekTime(for target: LinkTarget) -> Double? {
        BookmarkService.seekTime(for: target, in: project, preRoll: preRoll)
    }

    @discardableResult
    func play(_ target: LinkTarget) -> Bool {
        guard let t = seekTime(for: target) else { return false }
        seek(to: t)
        return true
    }

    func bookmark(for target: LinkTarget) -> Bookmark? { BookmarkService.bookmark(for: target, in: project) }

    func assign(_ bookmarkID: UUID, to target: LinkTarget?) {
        do { try BookmarkService.assign(bookmarkID, to: target, in: &project); persist() }
        catch { errorMessage = error.localizedDescription }
    }

    func addBookmarkAtCurrentTime() {
        do {
            try BookmarkService.addReviewBookmark(at: currentTime, label: Loc.t("bookmark.defaultLabel", project.bookmarks.count + 1), in: &project)
            persist()
        } catch { errorMessage = error.localizedDescription }
    }

    func nudge(_ bookmarkID: UUID, by delta: Double) {
        guard let b = project.bookmarks.first(where: { $0.id == bookmarkID }) else { return }
        do { try BookmarkService.retime(bookmarkID, to: b.mediaTime + delta, in: &project); persist(); seek(to: b.mediaTime + delta, play: false) }
        catch { errorMessage = error.localizedDescription }
    }

    func renameBookmark(_ id: UUID, to label: String) {
        guard let i = project.bookmarks.firstIndex(where: { $0.id == id }) else { return }
        project.bookmarks[i].label = label
        persist()
    }

    func deleteBookmark(_ id: UUID) {
        project.bookmarks.removeAll { $0.id == id }
        persist()
    }

    /// All linkable plan items with display names, for pickers.
    var linkTargets: [(target: LinkTarget, name: String)] {
        project.rooms.map { (.room($0.id), $0.name) }
            + project.openings.map { (.opening($0.id), $0.name) }
            + project.walls.map { (.wall($0.id), $0.name) }
    }
}
