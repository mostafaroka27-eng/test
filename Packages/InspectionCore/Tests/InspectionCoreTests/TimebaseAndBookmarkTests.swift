import XCTest
@testable import InspectionCore

final class TimebaseAndBookmarkTests: XCTestCase {
    func testMediaTimeIsRelativeToFirstFrame() {
        var c = RecordingClock()
        XCTAssertNil(c.mediaTime(forHostTime: 100))
        c.start(atHostTime: 1000.25)
        XCTAssertEqual(c.mediaTime(forHostTime: 1000.25)!, 0, accuracy: 1e-9)
        XCTAssertEqual(c.mediaTime(forHostTime: 1012.75)!, 12.5, accuracy: 1e-9)
        XCTAssertNil(c.mediaTime(forHostTime: 999), "before first frame")
    }

    func testInterruptionGapIsRemovedFromTimeline() {
        var c = RecordingClock()
        c.start(atHostTime: 0)
        c.pause(atHostTime: 10)
        XCTAssertEqual(c.mediaTime(forHostTime: 15)!, 10, accuracy: 1e-9, "clamped during pause")
        let gap = c.resume(atHostTime: 25, reason: "sessionInterrupted")
        XCTAssertEqual(gap, 15, accuracy: 1e-9)
        XCTAssertEqual(c.mediaTime(forHostTime: 30)!, 15, accuracy: 1e-9)
        XCTAssertEqual(c.interruptions.count, 1)
        XCTAssertEqual(c.interruptions[0].mediaTime, 10, accuracy: 1e-9)
        XCTAssertEqual(c.interruptions[0].pausedSeconds, 15, accuracy: 1e-9)
    }

    /// A bookmark and the frame captured at the same host time must map to the
    /// same media time, including after an interruption.
    func testBookmarkAndFrameShareTimebase() {
        var clock = RecordingClock()
        var admission = FrameAdmission(targetFrameRate: 30)
        var frameTimes: [Double: Double] = [:] // host → media
        var host = 5000.0
        clock.start(atHostTime: host)
        func feed(until end: Double) {
            while host < end {
                if case .write(let t) = admission.decide(hostTime: host, clock: clock) {
                    admission.didWrite(mediaTime: t); frameTimes[host] = t
                }
                host += 1.0 / 60.0   // ARKit-like 60 Hz delivery
            }
        }
        feed(until: 5010)
        clock.pause(atHostTime: host)
        host += 7 // interrupted
        clock.resume(atHostTime: host, reason: "test")
        feed(until: host + 5)

        let writtenHosts = frameTimes.keys.sorted()
        let bookmarkHost = writtenHosts[writtenHosts.count - 20]
        let b = BookmarkService.makeBookmark(hostTime: bookmarkHost, clock: clock, label: "Door", roomScanIndex: 1)!
        XCTAssertEqual(b.mediaTime, frameTimes[bookmarkHost]!, accuracy: 1e-9)
        XCTAssertEqual(b.mediaTime, (bookmarkHost - 5000) - 7, accuracy: 1e-6)
    }

    func testFrameAdmissionLimitsRateAndRejectsNonMonotonic() {
        var clock = RecordingClock()
        clock.start(atHostTime: 0)
        var a = FrameAdmission(targetFrameRate: 30)
        var written = 0
        var t = 0.0
        while t < 10 {
            if case .write(let m) = a.decide(hostTime: t, clock: clock) { a.didWrite(mediaTime: m); written += 1 }
            t += 1.0 / 60.0
        }
        XCTAssertEqual(Double(written), 300, accuracy: 3, "≈30 fps from 60 Hz input")
        XCTAssertEqual(a.decide(hostTime: 1.0, clock: clock), .skipNonMonotonic)
        clock.pause(atHostTime: 20)
        XCTAssertEqual(a.decide(hostTime: 21, clock: clock), .skipPaused)
        let b = FrameAdmission()
        XCTAssertEqual(b.decide(hostTime: 1, clock: RecordingClock()), .skipBeforeStart)
    }

    func testFrameAdmissionHandlesUnevenTiming() {
        var clock = RecordingClock()
        clock.start(atHostTime: 0)
        var a = FrameAdmission(targetFrameRate: 30)
        // Jittery delivery with a 400 ms stall.
        let hosts: [Double] = [0, 0.016, 0.035, 0.049, 0.07, 0.47, 0.48, 0.51, 0.55]
        var out: [Double] = []
        for h in hosts { if case .write(let m) = a.decide(hostTime: h, clock: clock) { a.didWrite(mediaTime: m); out.append(m) } }
        XCTAssertEqual(out, [0, 0.035, 0.07, 0.47, 0.51, 0.55])
        XCTAssertEqual(out, out.sorted())
    }

    func testAssignAndSeek() throws {
        var p = SampleProjectFactory.make()
        let door = p.openings.first { $0.name == "Door 1" }!
        XCTAssertEqual(BookmarkService.seekTime(for: .opening(door.id), in: p)!, 17.5, accuracy: 1e-9)
        XCTAssertEqual(BookmarkService.seekTime(for: .opening(door.id), in: p, preRoll: 2)!, 15.5, accuracy: 1e-9)

        // Reassign the unassigned bookmark to Door 1: the link moves.
        let free = p.bookmarks.first { $0.target == nil }!
        try BookmarkService.assign(free.id, to: .opening(door.id), in: &p)
        XCTAssertEqual(BookmarkService.seekTime(for: .opening(door.id), in: p)!, 50, accuracy: 1e-9)
        XCTAssertEqual(p.bookmarks.filter { $0.target == .opening(door.id) }.count, 1)

        XCTAssertThrowsError(try BookmarkService.assign(UUID(), to: nil, in: &p))
        XCTAssertThrowsError(try BookmarkService.assign(free.id, to: .wall(UUID()), in: &p))
    }

    func testSeekClampsToVideo() {
        XCTAssertEqual(BookmarkService.clampedSeek(0.5, preRoll: 1, duration: 60), 0)
        XCTAssertEqual(BookmarkService.clampedSeek(70, preRoll: 0, duration: 60), 60)
    }

    func testReviewBookmarkAndRetime() throws {
        var p = SampleProjectFactory.make()
        let b = try BookmarkService.addReviewBookmark(at: 12, label: "Skirting", in: &p)
        XCTAssertThrowsError(try BookmarkService.addReviewBookmark(at: 61, label: "x", in: &p))
        try BookmarkService.retime(b.id, to: 12.5, in: &p)
        XCTAssertEqual(p.bookmarks.first { $0.id == b.id }!.mediaTime, 12.5)
        try BookmarkService.retime(b.id, to: 99, in: &p)
        XCTAssertEqual(p.bookmarks.first { $0.id == b.id }!.mediaTime, 60)
        XCTAssertEqual(p.bookmarks.map(\.mediaTime), p.bookmarks.map(\.mediaTime).sorted())
    }

    func testStorageBudget() {
        let s = StorageBudget(reserveBytes: 500_000_000, videoBitsPerSecond: 8_000_000) // 1 MB/s
        XCTAssertEqual(s.evaluate(freeBytes: 400_000_000), .mustStop)
        if case .low(let sec) = s.evaluate(freeBytes: 600_000_000) { XCTAssertEqual(sec, 100, accuracy: 0.1) } else { XCTFail() }
        if case .ok = s.evaluate(freeBytes: 2_000_000_000) {} else { XCTFail() }
        XCTAssertFalse(s.canStart(freeBytes: 600_000_000))
        XCTAssertTrue(s.canStart(freeBytes: 700_000_000))
    }
}
