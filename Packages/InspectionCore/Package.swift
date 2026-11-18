// swift-tools-version:5.9
// InspectionCore holds all platform-independent logic of the app: the project
// model, units, storage, the shared video/bookmark timebase, plan geometry,
// alignment checks and CSV/JSON export. It depends only on Foundation so the
// tests run with `swift test` on macOS and on Linux.
import PackageDescription

let package = Package(
    name: "InspectionCore",
    platforms: [.iOS(.v17), .macOS(.v13)],
    products: [
        .library(name: "InspectionCore", targets: ["InspectionCore"]),
    ],
    targets: [
        .target(name: "InspectionCore"),
        .testTarget(name: "InspectionCoreTests", dependencies: ["InspectionCore"]),
    ]
)
