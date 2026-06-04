// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "ibr-sim-driver",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "ibr-sim-driver",
            path: "Sources"
        ),
    ]
)
