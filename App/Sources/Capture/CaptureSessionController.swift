import Foundation
import ARKit
import RoomPlan
import UIKit
import Combine
import InspectionCore

/// Drives one walkthrough: RoomPlan capture of one or more rooms in a single
/// AR session (one coordinate system), the MP4 of the same AR camera frames,
/// and manual bookmarks on the shared timebase.
///
/// Multi-room workflow (iOS 17, Apple "Scanning the rooms of a single structure"):
/// one `ARSession` is shared by the `RoomCaptureView`; after each room
/// `stop(pauseARSession: false)` keeps tracking alive so the next room is in
/// the same coordinate space; `StructureBuilder` merges the rooms at the end.
@MainActor
final class CaptureSessionController: NSObject, ObservableObject {
    enum Phase: Equatable {
        case ready
        case scanning(room: Int)
        case processingRoom(room: Int)
        case betweenRooms(completed: Int)
        case finishing
        case finished
        case failed(String)
    }

    @Published private(set) var phase: Phase = .ready
    @Published private(set) var guidance: GuidanceMessage?
    @Published private(set) var revisitWalls = 0
    @Published private(set) var liveWallCount = 0
    @Published private(set) var recordingSeconds: Double = 0
    @Published private(set) var isRecording = false
    @Published private(set) var framesDropped = 0
    @Published private(set) var storageWarning: Double?
    @Published private(set) var videoProblem: String?
    @Published private(set) var bookmarkCount = 0
    @Published private(set) var roomError: String?
    @Published private(set) var completedRooms = 0
    @Published private(set) var finishProblems: [String] = []
    @Published var bookmarkFlash = false

    let arSession = ARSession()
    private(set) lazy var roomCaptureView: RoomCaptureView = {
        let v = RoomCaptureView(frame: .zero, arSession: arSession)
        v.captureSession.delegate = self
        v.delegate = viewDelegate
        return v
    }()

    private let library: ProjectLibrary
    private(set) var project: SurveyProject
    private let configuration = RoomCaptureSession.Configuration()
    private let viewDelegate = RoomCaptureViewDelegateStub()
    private let recorder = WalkthroughVideoRecorder()
    private lazy var frameRouter = ARFrameRouter(recorder: recorder, owner: self)
    private var pump: CADisplayLink?
    private var watchdog: Timer?
    private var lastSeenFrameCount = 0
    private var staleTicks = 0

    private var tracking: TrackingQuality = .notAvailable
    private var instruction: ScanInstruction = .normal
    private var guidanceState = CaptureGuidance()
    private var lastLiveUpdate: Date = .distantPast

    // Per-room bookkeeping
    private var capturedRooms: [CapturedRoom] = []
    private var roomMetas: [CapturedRoomConverter.RoomMeta] = []
    private var roomFacts: [(epoch: Int, trackingLimited: Double)] = []
    private var roomStartMediaTime: Double?
    private var sessionEpoch = 0
    private var worldOriginTrusted = true
    private var finishAfterCurrentRoom = false
    private var bookmarks: [Bookmark] = []
    private var discarded = false

    /// "delegate" (default): frames via ARSessionDelegate on the RoomPlan AR session,
    /// as recommended by Apple DTS. "polling": read `currentFrame` on the display link
    /// and never touch the AR session's delegate (field fallback, set in Settings).
    private var usePolling: Bool { UserDefaults.standard.string(forKey: SettingsKeys.frameSource) == "polling" }

    static let videoPath = "video.mp4"

    init(project: SurveyProject, library: ProjectLibrary) {
        self.project = project
        self.library = library
        super.init()
        recorder.onEvent = { [weak self] event in self?.handle(event) }
    }

    var currentRoomIndex: Int {
        if case .scanning(let r) = phase { return r }
        return completedRooms + 1
    }

    // MARK: - Controls

    func startScan() {
        guard case .ready = phase else { return }
        guard StorageBudget(videoBitsPerSecond: WalkthroughVideoRecorder.bitRate).canStart(freeBytes: DeviceSupport.freeBytes()) else {
            phase = .failed(Loc.t("capture.error.storage"))
            return
        }
        do {
            try recorder.prepare(url: library.store.url(for: Self.videoPath, in: project.id),
                                 rotationDegrees: Self.interfaceRotationDegrees())
        } catch {
            videoProblem = error.localizedDescription  // scanning continues without video
        }
        project.captureDeviceModel = DeviceSupport.modelIdentifier
        UIApplication.shared.isIdleTimerDisabled = true
        runRoom(index: 1)
        startWatchdog()
    }

    func addBookmark() {
        guard case .scanning = phase else { return }
        let host = arSession.currentFrame?.timestamp ?? ProcessInfo.processInfo.systemUptime
        guard let t = recorder.mediaTime(forHostTime: host) else {
            videoProblem = Loc.t("capture.bookmark.noVideo")
            return
        }
        let b = Bookmark(mediaTime: t, label: Loc.t("bookmark.defaultLabel", bookmarks.count + 1),
                         roomScanIndex: currentRoomIndex, origin: .duringCapture)
        bookmarks.append(b)
        bookmarkCount = bookmarks.count
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        bookmarkFlash = true
        Task { try? await Task.sleep(nanoseconds: 600_000_000); self.bookmarkFlash = false }
    }

    /// Ends the current room but keeps the AR session (and video) running.
    func finishRoom() {
        guard case .scanning(let r) = phase else { return }
        phase = .processingRoom(room: r)
        roomCaptureView.captureSession.stop(pauseARSession: false)
    }

    func scanNextRoom() {
        guard case .betweenRooms(let done) = phase else { return }
        roomError = nil
        runRoom(index: done + 1)
    }

    func finishSurvey() {
        switch phase {
        case .scanning(let r):
            finishAfterCurrentRoom = true
            phase = .processingRoom(room: r)
            roomCaptureView.captureSession.stop()
        case .betweenRooms:
            // The capture session is already stopped; only the AR session (video) is running.
            arSession.pause()
            Task { await finalize() }
        default:
            break
        }
    }

    /// Discards everything captured in this session (video and room files).
    func discard() {
        discarded = true
        stopTimers()
        roomCaptureView.captureSession.stop()
        recorder.cancel()
        let dir = library.store.directory(for: project.id).appendingPathComponent("rooms")
        try? FileManager.default.removeItem(at: dir)
        UIApplication.shared.isIdleTimerDisabled = false
    }

    /// Called when the app leaves the foreground mid-scan: keep the footage valid.
    func handleBackground() {
        if recorder.isActive { recorder.stopEarly(reason: "appBackgrounded") }
    }

    // MARK: - Room lifecycle

    private func runRoom(index: Int) {
        roomStartMediaTime = recorder.mediaTime(forHostTime: ProcessInfo.processInfo.systemUptime) ?? 0
        guidanceState.resetAccumulated()
        revisitWalls = 0
        liveWallCount = 0
        roomCaptureView.captureSession.run(configuration: configuration)
        if usePolling {
            if pump == nil { startPolling() }
        } else {
            // Attach after run(): the capture session configures the AR session on run.
            arSession.delegateQueue = recorder.queue
            arSession.delegate = frameRouter
        }
        phase = .scanning(room: index)
    }

    fileprivate func roomEnded(data: CapturedRoomData, error: Error?) {
        guard !discarded else { return }
        let index = completedRooms + 1
        let endTime = recorder.mediaTime(forHostTime: ProcessInfo.processInfo.systemUptime)
        Task {
            do {
                if let error { throw error }
                let builder = RoomBuilder(options: [.beautifyObjects])
                let room = try await builder.capturedRoom(from: data)
                try saveRoomFiles(room, index: index, endTime: endTime)
                capturedRooms.append(room)
                completedRooms = capturedRooms.count
            } catch {
                roomError = Loc.t("capture.error.room", index, error.localizedDescription)
            }
            if finishAfterCurrentRoom {
                await finalize()
            } else {
                phase = .betweenRooms(completed: completedRooms)
            }
        }
    }

    /// Persists the raw RoomPlan data and a per-room USDZ immediately, so a later
    /// failure (merge, export, crash) never loses an already captured room.
    private func saveRoomFiles(_ room: CapturedRoom, index: Int, endTime: Double?) throws {
        let rawPath = "rooms/room-\(index).json"
        let modelPath = "rooms/room-\(index).usdz"
        let store = library.store
        let data = try JSONEncoder().encode(room)
        let rawURL = store.url(for: rawPath, in: project.id)
        try FileManager.default.createDirectory(at: rawURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: rawURL, options: .atomic)
        var savedModel: String? = modelPath
        do { try room.export(to: store.url(for: modelPath, in: project.id), exportOptions: .parametric) } catch { savedModel = nil }

        if !worldOriginTrusted { sessionEpoch += 1; worldOriginTrusted = true }
        roomMetas.append(.init(scanIndex: index, startMediaTime: roomStartMediaTime, endMediaTime: endTime,
                               rawCapturePath: rawPath, modelPath: savedModel, alignment: .single))
        roomFacts.append((sessionEpoch, guidanceState.limitedAccumulated))
    }

    // MARK: - Finalize

    private func finalize() async {
        phase = .finishing
        stopTimers()
        UIApplication.shared.isIdleTimerDisabled = false
        var problems: [String] = []
        let store = library.store
        var p = project

        // 1. Video — independent of geometry; failure is recorded, not fatal.
        let videoResult: Result<VideoInfo, Error> = await withCheckedContinuation { cont in
            recorder.finish(relativePath: Self.videoPath) { cont.resume(returning: $0) }
        }
        switch videoResult {
        case .success(let info):
            p.video = info
            do { try store.registerOutput(.video, relativePath: Self.videoPath, in: &p) }
            catch { problems.append(Loc.t("finish.problem.video", error.localizedDescription)) }
        case .failure(let error):
            store.markOutputFailed(.video, message: error.localizedDescription, in: &p)
            problems.append(Loc.t("finish.problem.video", error.localizedDescription))
        }
        p.bookmarks = bookmarks.sorted { $0.mediaTime < $1.mediaTime }

        guard !capturedRooms.isEmpty else {
            problems.append(Loc.t("finish.problem.noRooms"))
            try? store.save(p)
            project = p
            finishProblems = problems
            library.refresh()
            phase = .finished
            return
        }
        p.outputs[.rawRoomData] = OutputRecord(kind: .rawRoomData, state: .ready, relativePath: "rooms")

        // 2. Merge rooms into one structure (multi-room only).
        var structure: CapturedStructure?
        var mergeError: String?
        if capturedRooms.count > 1 {
            do {
                let builder = StructureBuilder(options: [.beautifyObjects])
                structure = try await builder.capturedStructure(from: capturedRooms)
                if let s = structure, let data = try? JSONEncoder().encode(s) {
                    try? data.write(to: store.url(for: "rooms/structure.json", in: p.id), options: .atomic)
                }
            } catch {
                mergeError = error.localizedDescription
                problems.append(Loc.t("finish.problem.merge", error.localizedDescription))
            }
        }

        // 3. Plan records. Rooms come from the merged structure when it kept every room.
        let rooms: [CapturedRoom]
        if let s = structure, s.rooms.count == capturedRooms.count { rooms = s.rooms } else { rooms = capturedRooms }
        p.rooms = []; p.walls = []; p.openings = []; p.nextOpeningNumber = [:]
        var ids: [UUID] = []
        for (room, meta) in zip(rooms, roomMetas) {
            ids.append(CapturedRoomConverter.append(room, meta: meta, to: &p))
        }

        // 4. Alignment check.
        let facts = zip(ids, roomFacts).map { id, f in
            RoomCaptureFacts(roomID: id, sessionEpoch: f.epoch,
                             footprint: p.room(id)?.floorPolygon ?? [], trackingLimitedSeconds: f.trackingLimited)
        }
        let (report, status) = AlignmentAssessor.assess(facts, structureMerged: structure != nil, mergeError: mergeError)
        p.alignment = report
        for i in p.rooms.indices { p.rooms[i].alignment = status[p.rooms[i].id] ?? .single }
        try? store.save(p)

        // 5. 3D model: merged structure, else the single/first room.
        do {
            try store.writeOutput(.model3D, relativePath: "model.usdz", in: &p) { url in
                if let structure {
                    try structure.export(to: url, metadataURL: nil, modelProvider: nil, exportOptions: .parametric)
                } else if rooms.count == 1 {
                    try rooms[0].export(to: url, exportOptions: .parametric)
                } else {
                    // Not merged: export the first room; each room keeps its own rooms/room-N.usdz.
                    try rooms[0].export(to: url, exportOptions: .parametric)
                }
            }
        } catch {
            problems.append(Loc.t("finish.problem.model", error.localizedDescription))
        }

        do { try store.save(p) } catch { problems.append(error.localizedDescription) }
        project = p
        finishProblems = problems
        library.refresh()
        phase = .finished
    }

    // MARK: - Live updates

    fileprivate func liveUpdate(_ room: CapturedRoom) {
        guard Date().timeIntervalSince(lastLiveUpdate) > 0.5 else { return }
        lastLiveUpdate = Date()
        let coverage = room.walls.map {
            CaptureGuidance.WallCoverage(completedEdges: $0.completedEdges.count,
                                         confidence: CapturedRoomConverter.confidence($0.confidence))
        }
        liveWallCount = coverage.count
        revisitWalls = CaptureGuidance.wallsToRevisit(coverage)
    }

    fileprivate func instructionChanged(_ i: RoomCaptureSession.Instruction) {
        switch i {
        case .normal: instruction = .normal
        case .moveCloseToWall: instruction = .moveCloseToWall
        case .moveAwayFromWall: instruction = .moveAwayFromWall
        case .slowDown: instruction = .slowDown
        case .turnOnLight: instruction = .turnOnLight
        case .lowTexture: instruction = .lowTexture
        @unknown default: instruction = .normal
        }
        refreshGuidance()
    }

    fileprivate func trackingChanged(_ state: ARCamera.TrackingState) {
        let q: TrackingQuality
        switch state {
        case .normal:
            q = .normal
            if case .limited(let r) = tracking, r == "relocalizing" { worldOriginTrusted = true }
        case .notAvailable: q = .notAvailable
        case .limited(let reason):
            switch reason {
            case .excessiveMotion: q = .limited(reason: "excessiveMotion")
            case .insufficientFeatures: q = .limited(reason: "insufficientFeatures")
            case .initializing: q = .limited(reason: "initializing")
            case .relocalizing: q = .limited(reason: "relocalizing")
            @unknown default: q = .limited(reason: "unknown")
            }
        }
        guard q != tracking else { return }
        tracking = q
        guidanceState.updateTracking(q, at: ProcessInfo.processInfo.systemUptime)
        refreshGuidance()
    }

    fileprivate func sessionInterrupted() {
        worldOriginTrusted = false
        recorder.pause(hostTime: ProcessInfo.processInfo.systemUptime)
        guidance = GuidanceMessage(key: "guidance.interrupted", severity: .critical)
    }

    fileprivate func sessionInterruptionEnded() {
        recorder.resume(hostTime: ProcessInfo.processInfo.systemUptime, reason: "sessionInterrupted")
        refreshGuidance()
    }

    fileprivate func sessionFailed(_ error: Error) {
        roomError = error.localizedDescription
    }

    private func refreshGuidance() {
        let now = ProcessInfo.processInfo.systemUptime
        guidanceState.updateTracking(tracking, at: now)
        guidance = guidanceState.message(instruction: instruction, tracking: tracking, at: now)
    }

    private func handle(_ event: WalkthroughVideoRecorder.Event) {
        switch event {
        case .started: isRecording = true
        case .progress(let s, _, let d): recordingSeconds = s; framesDropped = d
        case .storageLow(let s): storageWarning = s
        case .stoppedEarly(let reason):
            isRecording = false
            videoProblem = Loc.t("capture.video.stopped.\(reason)")
        case .failed(let m):
            isRecording = false
            videoProblem = Loc.t("capture.video.failed", m)
        }
    }

    // MARK: - Frame delivery watchdog

    /// RoomPlan owns the AR session. If our `ARSessionDelegate` stops receiving
    /// frames while the session is running (e.g. the delegate was replaced),
    /// fall back to polling `currentFrame` on the display link. Frames are
    /// deduplicated by timestamp inside the recorder's admission logic.
    private func startWatchdog() {
        watchdog = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.watchdogTick() }
        }
    }

    private func watchdogTick() {
        guard case .scanning = phase else { return }
        refreshGuidance()
        let count = recorder.receivedCount()
        if count == lastSeenFrameCount, arSession.currentFrame != nil {
            staleTicks += 1
            if staleTicks >= 2, pump == nil { startPolling() }
        } else {
            staleTicks = 0
        }
        lastSeenFrameCount = count
    }

    private func startPolling() {
        let link = CADisplayLink(target: self, selector: #selector(pollFrame))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 30, maximum: 60, preferred: 60)
        link.add(to: .main, forMode: .common)
        pump = link
    }

    private var lastPolledTimestamp: TimeInterval = 0

    @objc private func pollFrame() {
        guard let frame = arSession.currentFrame, frame.timestamp > lastPolledTimestamp else { return }
        lastPolledTimestamp = frame.timestamp
        let buffer = frame.capturedImage, ts = frame.timestamp
        trackingChanged(frame.camera.trackingState)
        let recorder = self.recorder
        recorder.queue.async { recorder.ingest(buffer, hostTime: ts) }
    }

    private func stopTimers() {
        watchdog?.invalidate(); watchdog = nil
        pump?.invalidate(); pump = nil
    }

    static func interfaceRotationDegrees() -> Int {
        let orientation = UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.interfaceOrientation }.first ?? .portrait
        switch orientation {
        case .portrait: return 90
        case .landscapeRight: return 0
        case .landscapeLeft: return 180
        case .portraitUpsideDown: return 270
        default: return 90
        }
    }
}

// MARK: - RoomCaptureSessionDelegate

extension CaptureSessionController: RoomCaptureSessionDelegate {
    nonisolated func captureSession(_ session: RoomCaptureSession, didUpdate room: CapturedRoom) {
        Task { @MainActor in self.liveUpdate(room) }
    }

    nonisolated func captureSession(_ session: RoomCaptureSession, didProvide instruction: RoomCaptureSession.Instruction) {
        Task { @MainActor in self.instructionChanged(instruction) }
    }

    nonisolated func captureSession(_ session: RoomCaptureSession, didEndWith data: CapturedRoomData, error: Error?) {
        Task { @MainActor in self.roomEnded(data: data, error: error) }
    }
}

// MARK: - AR frame routing (runs on the recorder queue)

final class ARFrameRouter: NSObject, ARSessionDelegate {
    private let recorder: WalkthroughVideoRecorder
    private weak var owner: CaptureSessionController?
    private var lastTracking: ARCamera.TrackingState?

    init(recorder: WalkthroughVideoRecorder, owner: CaptureSessionController) {
        self.recorder = recorder
        self.owner = owner
    }

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        // Read what we need and let the frame go immediately.
        recorder.ingest(frame.capturedImage, hostTime: frame.timestamp)
    }

    func session(_ session: ARSession, cameraDidChangeTrackingState camera: ARCamera) {
        let state = camera.trackingState
        Task { @MainActor [weak owner] in owner?.trackingChanged(state) }
    }

    func sessionWasInterrupted(_ session: ARSession) {
        Task { @MainActor [weak owner] in owner?.sessionInterrupted() }
    }

    func sessionInterruptionEnded(_ session: ARSession) {
        Task { @MainActor [weak owner] in owner?.sessionInterruptionEnded() }
    }

    func sessionShouldAttemptRelocalization(_ session: ARSession) -> Bool { true }

    func session(_ session: ARSession, didFailWithError error: Error) {
        Task { @MainActor [weak owner] in owner?.sessionFailed(error) }
    }
}

/// RoomCaptureView delegate that declines the view's built-in post-processing
/// preview; rooms are processed with `RoomBuilder` in the controller so the
/// AR session can continue into the next room.
final class RoomCaptureViewDelegateStub: NSObject, RoomCaptureViewDelegate {
    override init() { super.init() }
    required init?(coder: NSCoder) { super.init() }
    func encode(with coder: NSCoder) {}

    func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: Error?) -> Bool { false }
    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {}
}
