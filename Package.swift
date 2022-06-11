// swift-tools-version:5.2

import PackageDescription

let package = Package(
    name: "Blog",
    products: [
        .executable(
            name: "Blog",
            targets: ["Blog"]
        )
    ],
    dependencies: [
        .package(name: "Publish", url: "https://github.com/johnsundell/publish.git", from: "0.9.0"),
        .package(name: "HighlightJSPublishPlugin", url: "https://github.com/alex-ross/highlightjspublishplugin", from: "1.0.0"),
        .package(name: "TwitterPublishPlugin", url: "https://github.com/insidegui/TwitterPublishPlugin", from: "0.1.0"),
        .package(name: "YoutubePublishPlugin", url: "https://github.com/tanabe1478/YoutubePublishPlugin.git", from: "0.1.0"),
    ],
    targets: [
        .target(
            name: "Blog",
            dependencies: ["Publish", "HighlightJSPublishPlugin", "TwitterPublishPlugin", "YoutubePublishPlugin"]
        )
    ]
)
