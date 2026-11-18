import SceneKit
import UIKit
import InspectionCore

/// Builds a simple extruded-wall USDZ for the synthetic sample project so the
/// 3D tab and USDZ export can be exercised in the simulator. Real projects use
/// RoomPlan's own USDZ export instead.
enum SampleModelBuilder {
    static func write(_ project: SurveyProject, to url: URL) throws {
        let scene = SCNScene()
        let wallMaterial = SCNMaterial(); wallMaterial.diffuse.contents = UIColor(white: 0.92, alpha: 1)
        let doorMaterial = SCNMaterial(); doorMaterial.diffuse.contents = UIColor.brown
        let windowMaterial = SCNMaterial(); windowMaterial.diffuse.contents = UIColor.systemTeal.withAlphaComponent(0.6)

        for w in project.walls {
            let length = CGFloat(w.start.distance(to: w.end))
            let height = CGFloat(w.dimensions.scan?.heightM ?? 2.7)
            let box = SCNBox(width: length, height: height, length: 0.1, chamferRadius: 0)
            box.materials = [wallMaterial]
            scene.rootNode.addChildNode(node(box, from: w.start, to: w.end, centerY: Float(height / 2)))
        }
        for o in project.openings {
            let width = CGFloat(o.start.distance(to: o.end))
            let height = CGFloat(o.dimensions.scan?.heightM ?? 2.0)
            let box = SCNBox(width: width, height: height, length: 0.14, chamferRadius: 0)
            box.materials = [o.kind == .window ? windowMaterial : doorMaterial]
            let sill = Float(o.sillHeightM ?? 0)
            scene.rootNode.addChildNode(node(box, from: o.start, to: o.end, centerY: sill + Float(height / 2)))
        }
        for r in project.rooms where r.floorPolygon.count >= 3 {
            let path = UIBezierPath()
            path.move(to: CGPoint(x: r.floorPolygon[0].x, y: r.floorPolygon[0].y))
            r.floorPolygon.dropFirst().forEach { path.addLine(to: CGPoint(x: $0.x, y: $0.y)) }
            path.close()
            let shape = SCNShape(path: path, extrusionDepth: 0.02)
            shape.firstMaterial?.diffuse.contents = UIColor.systemBlue.withAlphaComponent(0.25)
            let n = SCNNode(geometry: shape)
            n.eulerAngles.x = .pi / 2   // XY path → XZ floor (plan y = world z)
            scene.rootNode.addChildNode(n)
        }
        guard scene.write(to: url, options: nil, delegate: nil, progressHandler: nil) else {
            throw CocoaError(.fileWriteUnknown)
        }
    }

    private static func node(_ g: SCNGeometry, from a: Point2D, to b: Point2D, centerY: Float) -> SCNNode {
        let n = SCNNode(geometry: g)
        n.position = SCNVector3(Float((a.x + b.x) / 2), centerY, Float((a.y + b.y) / 2))
        n.eulerAngles.y = -Float(atan2(b.y - a.y, b.x - a.x))
        return n
    }
}
