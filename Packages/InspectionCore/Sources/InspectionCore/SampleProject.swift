import Foundation

/// A clearly labeled synthetic inspection (two rooms + corridor) for previews,
/// the simulator, and tests. It is NOT a scan: geometry is hand-made and the
/// video is generated on the device by the app (`SampleVideoGenerator`).
public enum SampleProjectFactory {
    public static let sampleName = "SAMPLE – Two rooms and corridor (synthetic)"
    public static let videoDuration: Double = 60
    public static let videoSize = (width: 640, height: 480)
    public static let videoFrameRate: Double = 10

    /// Timeline captions burned into the synthetic footage.
    public static let videoSegments: [(start: Double, end: Double, caption: String)] = [
        (0, 20, "Room 1 – Bedroom"),
        (20, 32, "Corridor"),
        (32, 60, "Room 2 – Living"),
    ]

    public static func make(now: Date = Date()) -> SurveyProject {
        var p = SurveyProject(name: sampleName, createdAt: now, isSample: true)
        p.notes = "Synthetic sample for preview and simulator testing. Not measured on site."

        let roomA = RoomRecord(name: "Room 1 – Bedroom", scanIndex: 1, sectionLabel: "bedroom",
                               floorPolygon: rect(0, 0, 4.2, 3.6), maxWallHeightM: 2.71, minWallHeightM: 2.69,
                               captureStartMediaTime: 0, captureEndMediaTime: 20, alignment: .aligned)
        let corridor = RoomRecord(name: "Corridor", scanIndex: 2, sectionLabel: nil,
                                  floorPolygon: rect(4.3, 0, 5.5, 4.0), maxWallHeightM: 2.70, minWallHeightM: 2.68,
                                  captureStartMediaTime: 20, captureEndMediaTime: 32, alignment: .aligned)
        let roomB = RoomRecord(name: "Room 2 – Living", scanIndex: 3, sectionLabel: "livingRoom",
                               floorPolygon: rect(5.6, 0, 9.4, 3.4), maxWallHeightM: 2.72, minWallHeightM: 2.70,
                               captureStartMediaTime: 32, captureEndMediaTime: 60, alignment: .aligned)
        p.rooms = [roomA, corridor, roomB]

        func walls(for room: RoomRecord, height: Double, partialIndex: Int? = nil) -> [WallRecord] {
            let poly = room.floorPolygon
            return poly.indices.map { i in
                let a = poly[i], b = poly[(i + 1) % poly.count]
                let edges = (i == partialIndex) ? ["bottom", "left", "right"] : ["top", "bottom", "left", "right"]
                return WallRecord(roomID: room.id, name: "\(room.name) · Wall \(i + 1)", start: a, end: b,
                                  dimensions: DimensionRecord(scan: ScanDimensions(widthM: a.distance(to: b), heightM: height,
                                                                                   depthM: nil, confidence: i == partialIndex ? .medium : .high,
                                                                                   completedEdges: edges)))
            }
        }
        p.walls = walls(for: roomA, height: 2.71) + walls(for: corridor, height: 2.70, partialIndex: 2) + walls(for: roomB, height: 2.72)

        func wallID(_ room: RoomRecord, _ index: Int) -> UUID? {
            p.walls.filter { $0.roomID == room.id }[safe: index]?.id
        }
        func add(_ kind: OpeningKind, room: RoomRecord, wall: Int, from a: Point2D, to b: Point2D,
                 height: Double?, sill: Double?, confidence: ScanConfidence = .high, verified: ManualDimensions? = nil) -> OpeningRecord {
            let n = p.allocateOpeningNumber(for: kind)
            let o = OpeningRecord(roomID: room.id, wallID: wallID(room, wall), kind: kind,
                                  isOpenDoor: kind == .door ? false : nil, number: n, name: "\(kind.defaultEnglishPrefix) \(n)",
                                  start: a, end: b, sillHeightM: sill,
                                  dimensions: DimensionRecord(scan: ScanDimensions(widthM: a.distance(to: b), heightM: height, confidence: confidence),
                                                              verified: verified))
            p.openings.append(o)
            return o
        }

        // rect() corners: (minX,minY) → (maxX,minY) → (maxX,maxY) → (minX,maxY); wall i joins corner i and i+1.
        let door1 = add(.door, room: roomA, wall: 1, from: Point2D(x: 4.2, y: 1.0), to: Point2D(x: 4.2, y: 1.893), height: 2.095, sill: 0,
                        verified: ManualDimensions(widthMM: 905, heightMM: 2100, method: "laser", note: "Sample verified value", enteredAt: now))
        let door2 = add(.door, room: corridor, wall: 1, from: Point2D(x: 5.5, y: 2.2), to: Point2D(x: 5.5, y: 3.012), height: 2.09, sill: 0)
        let door3 = add(.door, room: corridor, wall: 2, from: Point2D(x: 5.35, y: 4.0), to: Point2D(x: 4.45, y: 4.0), height: nil, sill: 0, confidence: .low)
        let win1 = add(.window, room: roomA, wall: 0, from: Point2D(x: 1.2, y: 0), to: Point2D(x: 2.6, y: 0), height: 1.2, sill: 0.9)
        _ = add(.window, room: roomB, wall: 1, from: Point2D(x: 9.4, y: 1.0), to: Point2D(x: 9.4, y: 2.2), height: 1.4, sill: 0.8, confidence: .medium)
        _ = door3

        p.bookmarks = [
            Bookmark(mediaTime: 8.0, label: "Window", createdAt: now, roomScanIndex: 1, target: .opening(win1.id), origin: .sample),
            Bookmark(mediaTime: 17.5, label: "Door to corridor", createdAt: now, roomScanIndex: 1, target: .opening(door1.id), origin: .sample),
            Bookmark(mediaTime: 30.0, label: "Door to living", createdAt: now, roomScanIndex: 2, target: .opening(door2.id), origin: .sample),
            Bookmark(mediaTime: 40.0, label: "Living overview", createdAt: now, roomScanIndex: 3, target: .room(roomB.id), origin: .sample),
            Bookmark(mediaTime: 50.0, label: "Unassigned bookmark", createdAt: now, roomScanIndex: 3, target: nil, origin: .sample),
        ]
        p.video = VideoInfo(relativePath: "video.mp4", durationSeconds: videoDuration,
                            framesWritten: Int(videoDuration * videoFrameRate), framesDropped: 0,
                            pixelWidth: videoSize.width, pixelHeight: videoSize.height, rotationDegrees: 0,
                            codec: "h264", nominalFrameRate: videoFrameRate, startedAt: now, isSynthetic: true)
        p.alignment = AlignmentReport(overall: .connected, issues: [], structureMerged: false)
        return p
    }

    static func rect(_ x0: Double, _ y0: Double, _ x1: Double, _ y1: Double) -> [Point2D] {
        [Point2D(x: x0, y: y0), Point2D(x: x1, y: y0), Point2D(x: x1, y: y1), Point2D(x: x0, y: y1)]
    }
}

extension Array {
    subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}
