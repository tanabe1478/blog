import Foundation
import Publish

extension PublishingStep where Site == Blog {
    static func copyImagesPreservingPaths() -> Self {
        .step(named: "Copy images preserving paths") { _ in
            let fileManager = FileManager.default
            let source = URL(fileURLWithPath: "Resources/images", isDirectory: true)
            let destination = URL(fileURLWithPath: "Output/images", isDirectory: true)

            if fileManager.fileExists(atPath: destination.path) {
                try fileManager.removeItem(at: destination)
            }

            try fileManager.copyItem(at: source, to: destination)
        }
    }
}
