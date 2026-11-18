import Foundation

/// Length handling. Internally every scan-derived length is stored in meters
/// (RoomPlan's native unit, `Double`). Manually entered and manufacturing
/// dimensions are stored as integer millimeters, because that is what a
/// joiner writes down and orders against.
public enum LengthUnit: String, Codable, CaseIterable, Sendable {
    case millimeters
    case meters

    public var symbolKey: String {
        switch self {
        case .millimeters: return "unit.mm"
        case .meters: return "unit.m"
        }
    }
}

public enum Units {
    /// Converts meters to whole millimeters using "round half away from zero".
    public static func millimeters(fromMeters meters: Double) -> Int {
        Int((meters * 1000).rounded(.toNearestOrAwayFromZero))
    }

    public static func meters(fromMillimeters mm: Int) -> Double {
        Double(mm) / 1000.0
    }

    /// Formats a length for display. Millimeters are whole numbers, meters use
    /// two decimals (centimeter resolution) by default. Western digits are used
    /// in both languages because site drawings in the region use them.
    public static func format(meters: Double?, as unit: LengthUnit, decimals: Int = 2) -> String? {
        guard let meters, meters.isFinite else { return nil }
        switch unit {
        case .millimeters:
            return String(millimeters(fromMeters: meters))
        case .meters:
            return formatDecimal(meters, decimals: decimals)
        }
    }

    public static func format(millimeters mm: Int?, as unit: LengthUnit, decimals: Int = 3) -> String? {
        guard let mm else { return nil }
        switch unit {
        case .millimeters: return String(mm)
        case .meters: return formatDecimal(meters(fromMillimeters: mm), decimals: decimals)
        }
    }

    /// Square meters with two decimals.
    public static func formatArea(squareMeters: Double?) -> String? {
        guard let squareMeters, squareMeters.isFinite else { return nil }
        return formatDecimal(squareMeters, decimals: 2)
    }

    /// Parses an inspector's typed millimeter value. Accepts "2150", "2 150",
    /// "2,150", Arabic-Indic digits ("٢١٥٠") and a trailing "mm"/"مم".
    /// Rejects negatives, zero, decimals and values above 100 m.
    public static func parseMillimeters(_ text: String) -> Int? {
        var s = normalizeDigits(text)
        for suffix in ["mm", "MM", "مم"] where s.hasSuffix(suffix) {
            s = String(s.dropLast(suffix.count))
        }
        s = s.replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "\u{00A0}", with: "")
            .replacingOccurrences(of: ",", with: "")
            .replacingOccurrences(of: "٬", with: "")
        guard !s.isEmpty, s.allSatisfy({ $0.isASCII && $0.isNumber }), let value = Int(s) else { return nil }
        guard value > 0, value <= 100_000 else { return nil }
        return value
    }

    /// Parses meters typed as "2.45", "2,45" or "٢٫٤٥" and returns millimeters.
    public static func parseMetersToMillimeters(_ text: String) -> Int? {
        var s = normalizeDigits(text).trimmingCharacters(in: .whitespaces)
        for suffix in ["m", "M", "م"] where s.hasSuffix(suffix) {
            s = String(s.dropLast(suffix.count)).trimmingCharacters(in: .whitespaces)
        }
        s = s.replacingOccurrences(of: ",", with: ".").replacingOccurrences(of: "٫", with: ".")
        guard let value = Double(s), value > 0, value <= 100 else { return nil }
        return millimeters(fromMeters: value)
    }

    static func normalizeDigits(_ text: String) -> String {
        let arabicIndic: [Character: Character] = [
            "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
            "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
            "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
            "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
        ]
        return String(text.trimmingCharacters(in: .whitespacesAndNewlines).map { arabicIndic[$0] ?? $0 })
    }

    static func formatDecimal(_ value: Double, decimals: Int) -> String {
        let factor = pow(10.0, Double(decimals))
        let rounded = (value * factor).rounded(.toNearestOrAwayFromZero) / factor
        return String(format: "%.\(decimals)f", locale: Locale(identifier: "en_US_POSIX"), rounded)
    }
}

/// Formats a media time (seconds) as m:ss.t for bookmark lists.
public enum TimeFormat {
    public static func clock(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "--:--" }
        let tenths = Int((seconds * 10).rounded(.down))
        let minutes = tenths / 600
        let secs = (tenths / 10) % 60
        let t = tenths % 10
        return String(format: "%d:%02d.%d", minutes, secs, t)
    }
}
