// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "BitwireConsumer",
    platforms: [.macOS(.v13)],
    dependencies: [.package(path: "../bitwire")],
    targets: [
        .executableTarget(
            name: "Smoke",
            dependencies: [.product(name: "Bitwire", package: "bitwire")]
        )
    ],
    swiftLanguageModes: [.v6]
)
