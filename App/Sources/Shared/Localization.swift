import SwiftUI
import InspectionCore

/// In-app language switch (System / English / العربية). We resolve strings
/// from the chosen .lproj bundle ourselves so the switch applies instantly
/// without restarting, and we set the SwiftUI layout direction to match.
enum AppLanguage: String, CaseIterable, Identifiable {
    case system, english = "en", arabic = "ar"
    var id: String { rawValue }

    var resolvedCode: String {
        switch self {
        case .english: return "en"
        case .arabic: return "ar"
        case .system:
            let preferred = Bundle.main.preferredLocalizations.first ?? "en"
            return preferred.hasPrefix("ar") ? "ar" : "en"
        }
    }
    var isRTL: Bool { resolvedCode == "ar" }
}

final class LanguageSettings: ObservableObject {
    static let storageKey = "appLanguage"
    @Published var language: AppLanguage {
        didSet {
            UserDefaults.standard.set(language.rawValue, forKey: Self.storageKey)
            Loc.select(language.resolvedCode)
        }
    }

    init() {
        let saved = UserDefaults.standard.string(forKey: Self.storageKey).flatMap(AppLanguage.init(rawValue:)) ?? .system
        language = saved
        Loc.select(saved.resolvedCode)
    }

    var layoutDirection: LayoutDirection { language.isRTL ? .rightToLeft : .leftToRight }
    var locale: Locale { Locale(identifier: language.resolvedCode) }
}

enum Loc {
    private static var bundle: Bundle = .main
    private static var fallback: Bundle = .main
    private(set) static var code = "en"

    static func select(_ code: String) {
        self.code = code
        bundle = Bundle.main.path(forResource: code, ofType: "lproj").flatMap(Bundle.init(path:)) ?? .main
        fallback = Bundle.main.path(forResource: "en", ofType: "lproj").flatMap(Bundle.init(path:)) ?? .main
    }

    static func t(_ key: String) -> String {
        let english = fallback.localizedString(forKey: key, value: key, table: nil)
        return bundle.localizedString(forKey: key, value: english, table: nil)
    }

    static func t(_ key: String, _ args: CVarArg...) -> String {
        String(format: t(key), locale: Locale(identifier: "en_US_POSIX"), arguments: args)
    }
}

/// Text helpers that keep unit symbols and numbers left-to-right inside RTL text.
enum Fmt {
    static let lri = "\u{2066}", pdi = "\u{2069}"

    static func mm(_ value: Int?) -> String {
        guard let value else { return Loc.t("value.notDetected") }
        return lri + "\(value) " + Loc.t("unit.mm") + pdi
    }

    static func meters(_ value: Double?) -> String {
        guard let s = Units.format(meters: value, as: .meters) else { return Loc.t("value.notDetected") }
        return lri + s + " " + Loc.t("unit.m") + pdi
    }

    static func length(meters value: Double?, unit: LengthUnit) -> String {
        switch unit {
        case .meters: return meters(value)
        case .millimeters: return mm(value.map(Units.millimeters(fromMeters:)))
        }
    }

    static func area(_ value: Double?) -> String {
        guard let s = Units.formatArea(squareMeters: value) else { return Loc.t("value.notDetected") }
        return lri + s + " " + Loc.t("unit.m2") + pdi
    }

    static func time(_ seconds: Double) -> String { lri + TimeFormat.clock(seconds) + pdi }

    static func source(_ s: MeasurementSource) -> String { Loc.t("source.\(s.rawValue)") }

    static func confidence(_ c: ScanConfidence) -> String { Loc.t("confidence.\(c.rawValue)") }
}
