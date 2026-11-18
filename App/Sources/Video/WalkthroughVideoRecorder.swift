import AVFoundation
import CoreVideo
import CoreGraphics
import InspectionCore

/// Encodes ARKit camera frames (`ARFrame.capturedImage`) from the RoomPlan
/// AR session into a silent H.264 MP4, on its own serial queue.
///
/// Design notes
/// - ARKit cannot share the camera with an `AVCaptureSession`, so footage is
///   taken from the AR session's own frames (Apple DTS guidance).
/// - Frames are appended synchronously and never stored, so ARKit's frame
///   pool is never starved and memory stays flat during long walkthroughs.
///   If the encoder is busy the frame is dropped and counted.
/// - Presentation times come from `RecordingClock`, the same clock used for
///   bookmarks, so a bookmark always maps to the frame captured at that moment.
final class WalkthroughVideoRecorder: @unchecked Sendable {
    enum RecorderError: LocalizedError {
        case noFrames
        case writerFailed(String)
        case notPrepared

        var errorDescription: String? {
            switch self {
            case .noFrames: return "No camera frames were recorded."
            case .writerFailed(let m): return "Video encoder failed: \(m)"
            case .notPrepared: return "Recorder was not prepared."
            }
        }
    }

    enum Event {
        case started
        case progress(seconds: Double, written: Int, dropped: Int)
        case storageLow(secondsRemaining: Double)
        case stoppedEarly(reason: String)
        case failed(String)
    }

    private enum State { case idle, waitingForFirstFrame, recording, finishing, finished, failed }

    let queue = DispatchQueue(label: "inspection.video.recorder", qos: .userInitiated)
    /// Delivered on the main actor. Set before `prepare`.
    var onEvent: (@MainActor (Event) -> Void)?

    private func emit(_ event: Event) {
        let callback = onEvent
        Task { @MainActor in callback?(event) }
    }

    static let targetFrameRate = 30.0
    static let bitRate = 6_000_000

    private var state: State = .idle
    private var url: URL?
    private var writer: AVAssetWriter?
    private var input: AVAssetWriterInput?
    private var adaptor: AVAssetWriterInputPixelBufferAdaptor?
    private var clock = RecordingClock()
    private var admission = FrameAdmission(targetFrameRate: targetFrameRate)
    private var budget = StorageBudget(videoBitsPerSecond: bitRate)
    private var rotationDegrees = 90
    private var startedAt = Date()
    private var pixelSize = (width: 0, height: 0)
    private var stopReason: String?
    private var lastProgressHost: Double = 0
    private var lastStorageCheckHost: Double = 0
    private var failureMessage: String?
    private(set) var framesReceived = 0  // queue-confined; read through `receivedCount()`

    // MARK: Control (any thread)

    /// - Parameter rotationDegrees: clockwise rotation from sensor (landscape) to
    ///   the interface orientation; 90 for portrait.
    func prepare(url: URL, rotationDegrees: Int) throws {
        try queue.sync {
            try? FileManager.default.removeItem(at: url)
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            self.url = url
            self.rotationDegrees = rotationDegrees
            self.clock = RecordingClock()
            self.admission = FrameAdmission(targetFrameRate: Self.targetFrameRate)
            self.stopReason = nil
            self.failureMessage = nil
            self.framesReceived = 0
            self.state = .waitingForFirstFrame
        }
    }

    /// Media time for a host time on the AR clock (for bookmarks).
    func mediaTime(forHostTime host: Double) -> Double? {
        queue.sync { clock.mediaTime(forHostTime: host) }
    }

    func receivedCount() -> Int { queue.sync { framesReceived } }

    var isActive: Bool { queue.sync { state == .recording || state == .waitingForFirstFrame } }

    func pause(hostTime: Double) {
        queue.async { self.clock.pause(atHostTime: hostTime) }
    }

    func resume(hostTime: Double, reason: String) {
        queue.async { self.clock.resume(atHostTime: hostTime, reason: reason) }
    }

    // MARK: Frames (call on `queue`)

    func ingest(_ pixelBuffer: CVPixelBuffer, hostTime: Double) {
        dispatchPrecondition(condition: .onQueue(queue))
        framesReceived += 1
        switch state {
        case .waitingForFirstFrame:
            do { try startWriter(firstFrame: pixelBuffer, hostTime: hostTime) } catch { fail(error.localizedDescription); return }
        case .recording: break
        default: return
        }
        guard let input, let adaptor, let writer else { return }

        switch admission.decide(hostTime: hostTime, clock: clock) {
        case .write(let t):
            guard input.isReadyForMoreMediaData else { admission.didDropAtEncoder(); return }
            let pts = CMTime(seconds: t, preferredTimescale: 90_000)
            if adaptor.append(pixelBuffer, withPresentationTime: pts) {
                admission.didWrite(mediaTime: t)
            } else {
                fail(writer.error?.localizedDescription ?? "append failed (status \(writer.status.rawValue))")
                return
            }
        case .skipNonMonotonic, .skipRateLimit, .skipBeforeStart, .skipPaused:
            break
        }

        if hostTime - lastProgressHost > 0.25 {
            lastProgressHost = hostTime
            let s = admission.lastWrittenMediaTime ?? 0, w = admission.written, d = admission.droppedByEncoder
            emit(.progress(seconds: s, written: w, dropped: d))
        }
        if hostTime - lastStorageCheckHost > 2 {
            lastStorageCheckHost = hostTime
            checkStorage()
        }
    }

    private func startWriter(firstFrame: CVPixelBuffer, hostTime: Double) throws {
        guard let url else { throw RecorderError.notPrepared }
        let w = CVPixelBufferGetWidth(firstFrame), h = CVPixelBufferGetHeight(firstFrame)
        pixelSize = (w, h)
        let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
        writer.shouldOptimizeForNetworkUse = true
        let settings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: w,
            AVVideoHeightKey: h,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: Self.bitRate,
                AVVideoMaxKeyFrameIntervalDurationKey: 2.0,
                AVVideoExpectedSourceFrameRateKey: Int(Self.targetFrameRate),
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
                AVVideoAllowFrameReorderingKey: false,
            ] as [String: Any],
        ]
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        input.expectsMediaDataInRealTime = true
        input.transform = CGAffineTransform(rotationAngle: CGFloat(rotationDegrees) * .pi / 180)
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: nil)
        guard writer.canAdd(input) else { throw RecorderError.writerFailed("cannot add video input") }
        writer.add(input)
        guard writer.startWriting() else {
            throw RecorderError.writerFailed(writer.error?.localizedDescription ?? "startWriting failed")
        }
        writer.startSession(atSourceTime: .zero)
        clock.start(atHostTime: hostTime)
        startedAt = Date()
        self.writer = writer; self.input = input; self.adaptor = adaptor
        state = .recording
        emit(.started)
    }

    private func checkStorage() {
        switch budget.evaluate(freeBytes: DeviceSupport.freeBytes()) {
        case .ok: break
        case .low(let s): emit(.storageLow(secondsRemaining: s))
        case .mustStop: finishInternal(reason: "lowStorage", completion: nil)
        }
    }

    private func fail(_ message: String) {
        failureMessage = message
        state = .failed
        writer?.cancelWriting()
        emit(.failed(message))
    }

    // MARK: Finish

    /// Ends recording early but keeps a valid, playable file (low storage,
    /// app moved to background). Bookmarks remain valid.
    func stopEarly(reason: String) {
        queue.async { self.finishInternal(reason: reason, completion: nil) }
    }

    /// Finishes the file and returns its description. Safe to call after
    /// `stopEarly`; returns the already-finished result.
    func finish(relativePath: String, completion: @escaping (Result<VideoInfo, Error>) -> Void) {
        queue.async {
            self.finishInternal(reason: nil) { result in
                DispatchQueue.main.async { completion(result.map { self.makeInfo(relativePath: relativePath) }) }
            }
        }
    }

    func cancel() {
        queue.async {
            if self.state == .recording { self.writer?.cancelWriting() }
            if let url = self.url { try? FileManager.default.removeItem(at: url) }
            self.state = .idle
        }
    }

    private var pendingCompletions: [(Result<Void, Error>) -> Void] = []

    private func finishInternal(reason: String?, completion: ((Result<Void, Error>) -> Void)?) {
        dispatchPrecondition(condition: .onQueue(queue))
        switch state {
        case .finished:
            completion?(.success(()))
        case .failed:
            completion?(.failure(RecorderError.writerFailed(failureMessage ?? "unknown")))
        case .waitingForFirstFrame, .idle:
            state = .failed
            failureMessage = RecorderError.noFrames.localizedDescription
            completion?(.failure(RecorderError.noFrames))
        case .finishing:
            if let completion { pendingCompletions.append(completion) }
        case .recording:
            state = .finishing
            if let completion { pendingCompletions.append(completion) }
            if let reason {
                stopReason = reason
                emit(.stoppedEarly(reason: reason))
            }
            input?.markAsFinished()
            writer?.finishWriting { [weak self] in
                guard let self else { return }
                self.queue.async {
                    let result: Result<Void, Error>
                    if self.writer?.status == .completed {
                        self.state = .finished
                        result = .success(())
                    } else {
                        self.state = .failed
                        let m = self.writer?.error?.localizedDescription ?? "finishWriting failed"
                        self.failureMessage = m
                        result = .failure(RecorderError.writerFailed(m))
                    }
                    let callbacks = self.pendingCompletions
                    self.pendingCompletions = []
                    callbacks.forEach { $0(result) }
                }
            }
        }
    }

    private func makeInfo(relativePath: String) -> VideoInfo {
        // Called on main after finishing; reads immutable-after-finish state.
        queue.sync {
            let last = admission.lastWrittenMediaTime ?? 0
            return VideoInfo(relativePath: relativePath,
                             durationSeconds: last + 1.0 / Self.targetFrameRate,
                             framesWritten: admission.written,
                             framesDropped: admission.droppedByEncoder,
                             pixelWidth: pixelSize.width, pixelHeight: pixelSize.height,
                             rotationDegrees: rotationDegrees, codec: "h264",
                             nominalFrameRate: Self.targetFrameRate, startedAt: startedAt,
                             interruptions: clock.interruptions, stopReason: stopReason, isSynthetic: false)
        }
    }
}
