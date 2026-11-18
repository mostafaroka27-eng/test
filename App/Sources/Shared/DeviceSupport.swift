import ARKit
import RoomPlan
import AVFoundation
import UIKit

/// Runtime capability checks. RoomPlan needs a LiDAR-equipped iPhone/iPad
/// (iPhone 12 Pro and later Pro models) running iOS 17+ for multi-room capture.
enum DeviceSupport {
    enum Status: Equatable {
        case supported
        case simulator
        case noLiDAR
        case cameraDenied
    }

    static var isSimulator: Bool {
        #if targetEnvironment(simulator)
        return true
        #else
        return false
        #endif
    }

    static func captureStatus() -> Status {
        if isSimulator { return .simulator }
        guard RoomCaptureSession.isSupported,
              ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) else { return .noLiDAR }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .denied, .restricted: return .cameraDenied
        default: return .supported
        }
    }

    static func messageKey(for status: Status) -> String? {
        switch status {
        case .supported: return nil
        case .simulator: return "support.simulator"
        case .noLiDAR: return "support.noLidar"
        case .cameraDenied: return "support.cameraDenied"
        }
    }

    /// Hardware model identifier, e.g. "iPhone15,3".
    static var modelIdentifier: String {
        var info = utsname()
        uname(&info)
        return withUnsafeBytes(of: &info.machine) { buf in
            String(decoding: buf.prefix { $0 != 0 }, as: UTF8.self)
        }
    }

    static func freeBytes() -> Int64 {
        let url = URL(fileURLWithPath: NSHomeDirectory())
        let values = try? url.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
        return values?.volumeAvailableCapacityForImportantUsage ?? 0
    }
}

enum SettingsKeys {
    static let frameSource = "videoFrameSource"
}
