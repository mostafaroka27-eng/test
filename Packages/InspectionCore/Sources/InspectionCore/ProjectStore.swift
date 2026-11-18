import Foundation

/// File-based local storage. Layout per project:
///
///     <root>/<project-uuid>/
///         project.json          – SurveyProject (schema-versioned)
///         project.json.bak      – previous good copy
///         rooms/room-<n>.json   – raw RoomPlan CapturedRoom data per scanned room
///         rooms/room-<n>.usdz   – per-room model (kept even if merging fails)
///         model.usdz            – merged structure, or the single room
///         video.mp4             – walkthrough footage
///         exports/              – PDF, CSV, JSON produced for sharing
///
/// All paths stored inside `project.json` are relative to the project folder,
/// so the app container moving between launches (which iOS does) never breaks
/// a reopened project.
public final class ProjectStore: @unchecked Sendable {
    public enum StoreError: Error, LocalizedError, Equatable {
        case projectNotFound(UUID)
        case invalidName
        case corruptProject(String)
        case outputMissing(OutputKind)

        public var errorDescription: String? {
            switch self {
            case .projectNotFound(let id): return "Project \(id) was not found."
            case .invalidName: return "Project name cannot be empty."
            case .corruptProject(let m): return "Project file could not be read: \(m)"
            case .outputMissing(let k): return "The \(k.rawValue) file is missing."
            }
        }
    }

    public static let projectFileName = "project.json"

    public let rootURL: URL
    private let fileManager: FileManager
    private let lock = NSLock()

    public init(rootURL: URL, fileManager: FileManager = .default) throws {
        self.rootURL = rootURL
        self.fileManager = fileManager
        try fileManager.createDirectory(at: rootURL, withIntermediateDirectories: true)
    }

    // MARK: Encoding

    public static func makeEncoder() -> JSONEncoder {
        let e = JSONEncoder()
        e.outputFormatting = [.prettyPrinted, .sortedKeys]
        e.dateEncodingStrategy = .iso8601
        return e
    }

    public static func makeDecoder() -> JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }

    // MARK: Paths

    public func directory(for id: UUID) -> URL {
        rootURL.appendingPathComponent(id.uuidString, isDirectory: true)
    }

    public func url(for relativePath: String, in id: UUID) -> URL {
        directory(for: id).appendingPathComponent(relativePath)
    }

    private func projectFile(_ id: UUID) -> URL { directory(for: id).appendingPathComponent(Self.projectFileName) }

    // MARK: CRUD

    @discardableResult
    public func create(name: String, isSample: Bool = false, now: Date = Date()) throws -> SurveyProject {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw StoreError.invalidName }
        let project = SurveyProject(name: trimmed, createdAt: now, isSample: isSample)
        let dir = directory(for: project.id)
        try fileManager.createDirectory(at: dir.appendingPathComponent("rooms"), withIntermediateDirectories: true)
        try fileManager.createDirectory(at: dir.appendingPathComponent("exports"), withIntermediateDirectories: true)
        try save(project, touch: false)
        return project
    }

    /// Atomically writes project.json, keeping the previous version as .bak.
    public func save(_ project: SurveyProject, touch: Bool = true) throws {
        lock.lock(); defer { lock.unlock() }
        var p = project
        if touch { p.updatedAt = Date() }
        let data = try Self.makeEncoder().encode(p)
        let file = projectFile(p.id)
        try fileManager.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        let backup = file.appendingPathExtension("bak")
        if fileManager.fileExists(atPath: file.path) {
            try? fileManager.removeItem(at: backup)
            try? fileManager.copyItem(at: file, to: backup)
        }
        try data.write(to: file, options: .atomic)
    }

    /// Loads a project. Falls back to the .bak copy if the main file is corrupt.
    public func load(_ id: UUID) throws -> SurveyProject {
        let file = projectFile(id)
        guard fileManager.fileExists(atPath: file.path) else { throw StoreError.projectNotFound(id) }
        do {
            return try Self.makeDecoder().decode(SurveyProject.self, from: Data(contentsOf: file))
        } catch {
            let backup = file.appendingPathExtension("bak")
            if let data = try? Data(contentsOf: backup),
               let p = try? Self.makeDecoder().decode(SurveyProject.self, from: data) {
                return p
            }
            throw StoreError.corruptProject(String(describing: error))
        }
    }

    public struct Listing: Sendable {
        public var projects: [ProjectSummary]
        /// Folders that exist but could not be read; shown to the user, never deleted silently.
        public var unreadable: [String]
    }

    public func list() -> Listing {
        let dirs = (try? fileManager.contentsOfDirectory(at: rootURL, includingPropertiesForKeys: nil)) ?? []
        var summaries: [ProjectSummary] = []
        var unreadable: [String] = []
        for dir in dirs {
            guard let id = UUID(uuidString: dir.lastPathComponent) else { continue }
            do { summaries.append(ProjectSummary(try load(id))) } catch { unreadable.append(dir.lastPathComponent) }
        }
        summaries.sort { $0.updatedAt > $1.updatedAt }
        return Listing(projects: summaries, unreadable: unreadable)
    }

    public func rename(_ id: UUID, to name: String) throws -> SurveyProject {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw StoreError.invalidName }
        var p = try load(id)
        p.name = trimmed
        try save(p)
        return try load(id)
    }

    public func delete(_ id: UUID) throws {
        let dir = directory(for: id)
        guard fileManager.fileExists(atPath: dir.path) else { throw StoreError.projectNotFound(id) }
        try fileManager.removeItem(at: dir)
    }

    // MARK: Outputs

    /// Runs `produce` to write one output file and records the result in the
    /// project. A failure marks only this output as failed — every other
    /// output and the project file itself stay intact — and is rethrown so the
    /// UI can offer "Retry".
    @discardableResult
    public func writeOutput(_ kind: OutputKind, relativePath: String, in project: inout SurveyProject,
                            produce: (URL) throws -> Void) throws -> URL {
        let target = url(for: relativePath, in: project.id)
        try? fileManager.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
        // Write to a temporary sibling first so a failed export never destroys a previous good file.
        let temp = target.deletingLastPathComponent()
            .appendingPathComponent(".tmp-\(UUID().uuidString)-\(target.lastPathComponent)")
        do {
            try produce(temp)
            guard fileManager.fileExists(atPath: temp.path) else { throw StoreError.outputMissing(kind) }
            if fileManager.fileExists(atPath: target.path) {
                _ = try fileManager.replaceItemAt(target, withItemAt: temp)
            } else {
                try fileManager.moveItem(at: temp, to: target)
            }
            project.outputs[kind] = OutputRecord(kind: kind, state: .ready, relativePath: relativePath)
            try save(project)
            return target
        } catch {
            try? fileManager.removeItem(at: temp)
            let previous = project.outputs[kind]
            project.outputs[kind] = OutputRecord(kind: kind, state: .failed,
                                                 relativePath: previous?.relativePath,
                                                 message: (error as? LocalizedError)?.errorDescription ?? String(describing: error))
            try? save(project)
            throw error
        }
    }

    /// Registers a file that another component already wrote in place (e.g.
    /// the MP4 finished by AVAssetWriter) after checking it exists.
    public func registerOutput(_ kind: OutputKind, relativePath: String, in project: inout SurveyProject) throws {
        let u = url(for: relativePath, in: project.id)
        guard fileManager.fileExists(atPath: u.path) else {
            project.outputs[kind] = OutputRecord(kind: kind, state: .failed, relativePath: relativePath,
                                                 message: StoreError.outputMissing(kind).errorDescription)
            try? save(project)
            throw StoreError.outputMissing(kind)
        }
        project.outputs[kind] = OutputRecord(kind: kind, state: .ready, relativePath: relativePath)
        try save(project)
    }

    public func markOutputFailed(_ kind: OutputKind, message: String, in project: inout SurveyProject) {
        project.outputs[kind] = OutputRecord(kind: kind, state: .failed, relativePath: project.outputs[kind]?.relativePath, message: message)
        try? save(project)
    }

    /// URL of a ready output whose file still exists on disk.
    public func existingOutputURL(_ kind: OutputKind, in project: SurveyProject) -> URL? {
        guard let rec = project.outputs[kind], rec.state == .ready, let rel = rec.relativePath else { return nil }
        let u = url(for: rel, in: project.id)
        return fileManager.fileExists(atPath: u.path) ? u : nil
    }

    /// Checks every recorded output against the disk after reopening. Outputs
    /// whose file disappeared are reported (not silently dropped).
    public func verifyOutputs(of project: SurveyProject) -> [OutputKind] {
        project.outputs.values.compactMap { rec in
            guard rec.state == .ready, let rel = rec.relativePath else { return nil }
            return fileManager.fileExists(atPath: url(for: rel, in: project.id).path) ? nil : rec.kind
        }.sorted { $0.rawValue < $1.rawValue }
    }
}
