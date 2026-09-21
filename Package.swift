// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Bitwire",
    platforms: [.macOS(.v13), .iOS(.v16), .tvOS(.v16), .watchOS(.v9)],
    products: [.library(name: "Bitwire", targets: ["Bitwire"])],
    targets: [
        .target(name: "Bitwire", path: "wire/swift/Sources/Bitwire"),
        .testTarget(
            name: "BitwireTests",
            dependencies: ["Bitwire"],
            path: "wire/swift/Tests/BitwireTests"
        )
    ],
    swiftLanguageModes: [.v6]
)
