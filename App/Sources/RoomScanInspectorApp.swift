import SwiftUI
import InspectionCore

@main
struct RoomScanInspectorApp: App {
    @StateObject private var language = LanguageSettings()
    @StateObject private var library = ProjectLibrary()

    var body: some Scene {
        WindowGroup {
            ProjectsScreen()
                .environmentObject(library)
                .environmentObject(language)
                .environment(\.layoutDirection, language.layoutDirection)
                .environment(\.locale, language.locale)
                // Rebuild the view tree when the language changes so every Loc.t() string refreshes.
                .id(language.language)
        }
    }
}
