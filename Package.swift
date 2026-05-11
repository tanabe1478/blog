// swift-tools-version:5.5

import PackageDescription

let package = Package(
    name: "Blog",
    platforms: [
        .macOS(.v12)
    ],
    products: [
        .executable(
            name: "Blog",
            targets: ["Blog"]
        )
    ],
    dependencies: [
            .package(name: "Publish", url: "https://github.com/johnsundell/publish.git", from: "0.8.0"),
            .package(name: "YoutubePublishPlugin", url: "https://github.com/tanabe1478/YoutubePublishPlugin.git", from: "1.0.1"),
            .package(name: "HighlightJSPublishPlugin", url: "https://github.com/alex-ross/highlightjspublishplugin", from: "1.0.1"),
    ],
    targets: [
        .executableTarget(
            name: "Blog",
            dependencies: ["Publish", "HighlightJSPublishPlugin", "YoutubePublishPlugin"]
        )
    ]
)
