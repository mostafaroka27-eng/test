import AVFoundation
import UIKit
import InspectionCore

/// Generates the clearly labeled synthetic footage for the sample project so
/// bookmark playback can be exercised in the simulator. Each frame shows
/// "SAMPLE – synthetic footage", the media time, and which room the
/// timeline is in, so seeking accuracy is visible by eye.
enum SampleVideoGenerator {
    enum GenError: Error { case writer(String) }

    static func generate(to url: URL) async throws {
        try? FileManager.default.removeItem(at: url)
        let (w, h) = SampleProjectFactory.videoSize
        let fps = SampleProjectFactory.videoFrameRate
        let total = Int(SampleProjectFactory.videoDuration * fps)

        let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: w, AVVideoHeightKey: h,
        ])
        input.expectsMediaDataInRealTime = false
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: w, kCVPixelBufferHeightKey as String: h,
        ])
        writer.add(input)
        guard writer.startWriting() else { throw GenError.writer(writer.error?.localizedDescription ?? "start") }
        writer.startSession(atSourceTime: .zero)

        for i in 0..<total {
            while !input.isReadyForMoreMediaData { try await Task.sleep(nanoseconds: 2_000_000) }
            let t = Double(i) / fps
            guard let pool = adaptor.pixelBufferPool else { throw GenError.writer("no pool") }
            var pb: CVPixelBuffer?
            CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pb)
            guard let buffer = pb else { throw GenError.writer("no buffer") }
            draw(into: buffer, time: t, width: w, height: h)
            if !adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: CMTimeScale(fps))) {
                throw GenError.writer(writer.error?.localizedDescription ?? "append")
            }
        }
        input.markAsFinished()
        await writer.finishWriting()
        if writer.status != .completed { throw GenError.writer(writer.error?.localizedDescription ?? "finish") }
    }

    private static func draw(into buffer: CVPixelBuffer, time: Double, width: Int, height: Int) {
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height,
                                  bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
                                  space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)
        else { return }
        let segment = SampleProjectFactory.videoSegments.first { time >= $0.start && time < $0.end }
        let hue = CGFloat(SampleProjectFactory.videoSegments.firstIndex { $0.caption == segment?.caption } ?? 0) / 3.0
        ctx.setFillColor(UIColor(hue: hue, saturation: 0.35, brightness: 0.45, alpha: 1).cgColor)
        ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
        // Moving bar: makes frame-accurate seeking visible.
        let x = CGFloat(time / SampleProjectFactory.videoDuration) * CGFloat(width)
        ctx.setFillColor(UIColor.white.cgColor)
        ctx.fill(CGRect(x: x - 2, y: 0, width: 4, height: CGFloat(height)))

        // UIKit text drawing uses a flipped coordinate system.
        ctx.translateBy(x: 0, y: CGFloat(height)); ctx.scaleBy(x: 1, y: -1)
        UIGraphicsPushContext(ctx)
        let title: [NSAttributedString.Key: Any] = [.font: UIFont.boldSystemFont(ofSize: 30), .foregroundColor: UIColor.white]
        let body: [NSAttributedString.Key: Any] = [.font: UIFont.monospacedDigitSystemFont(ofSize: 54, weight: .semibold), .foregroundColor: UIColor.white]
        let small: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 22), .foregroundColor: UIColor.white]
        ("SAMPLE – synthetic footage" as NSString).draw(at: CGPoint(x: 24, y: 24), withAttributes: title)
        (TimeFormat.clock(time) as NSString).draw(at: CGPoint(x: 24, y: 160), withAttributes: body)
        ((segment?.caption ?? "") as NSString).draw(at: CGPoint(x: 24, y: 250), withAttributes: small)
        ("Not a real scan" as NSString).draw(at: CGPoint(x: 24, y: CGFloat(height) - 50), withAttributes: small)
        UIGraphicsPopContext()
    }
}
