import Foundation
import InspectionCore

/// Produces shareable files. Each export is independent: a failure marks only
/// that export as "retry needed" and never touches the others.
enum ExportKind: String, CaseIterable, Identifiable {
    case pdf, usdz, mp4, csv, json
    var id: String { rawValue }

    var outputKind: OutputKind {
        switch self {
        case .pdf: return .pdfPlan
        case .usdz: return .model3D
        case .mp4: return .video
        case .csv: return .csvMeasurements
        case .json: return .jsonReport
        }
    }

    /// PDF/CSV/JSON are generated on demand; USDZ/MP4 were saved during capture.
    var isGenerated: Bool { [.pdf, .csv, .json].contains(self) }
}

@MainActor
struct ExportService {
    let store: ProjectStore

    static func fileStem(_ project: SurveyProject) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_ "))
        let cleaned = String(project.name.unicodeScalars.map { allowed.contains($0) ? Character($0) : "_" })
        return String(cleaned.trimmingCharacters(in: .whitespaces).prefix(60)).replacingOccurrences(of: " ", with: "_")
    }

    /// Generates (or locates) the file for an export and returns its URL.
    func produce(_ kind: ExportKind, project: inout SurveyProject) throws -> URL {
        let stem = Self.fileStem(project)
        switch kind {
        case .pdf:
            let snapshot = project
            return try store.writeOutput(.pdfPlan, relativePath: "exports/\(stem)-plan.pdf", in: &project) { url in
                try PDFPlanRenderer.render(snapshot, to: url)
            }
        case .csv:
            let csv = MeasurementCSV.make(project)
            return try store.writeOutput(.csvMeasurements, relativePath: "exports/\(stem)-measurements.csv", in: &project) { url in
                try Data(csv.utf8).write(to: url)
            }
        case .json:
            let data = try ProjectReport(project: project, generator: "RoomScanInspector \(Bundle.main.appVersionString)").encoded()
            return try store.writeOutput(.jsonReport, relativePath: "exports/\(stem)-report-v\(ProjectReport.version).json", in: &project) { url in
                try data.write(to: url)
            }
        case .usdz, .mp4:
            guard let url = store.existingOutputURL(kind.outputKind, in: project) else {
                throw ProjectStore.StoreError.outputMissing(kind.outputKind)
            }
            return url
        }
    }
}
