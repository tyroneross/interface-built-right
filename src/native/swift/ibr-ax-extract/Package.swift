// swift-tools-version: 5.9

import Foundation
import PackageDescription

var targets: [Target] = [
    .executableTarget(
        name: "ibr-ax-extract",
        path: "Sources"
    ),
]

// Tests/ is not shipped in the npm package (package.json `files` lists only
// Package.swift + Sources), and SwiftPM rejects a target whose path is missing,
// so the test target is declared only when the directory exists.
let testsDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("Tests").path
if FileManager.default.fileExists(atPath: testsDir) {
    targets.append(.testTarget(name: "ibr-ax-extract-tests", dependencies: ["ibr-ax-extract"], path: "Tests"))
}

let package = Package(
    name: "ibr-ax-extract",
    platforms: [.macOS(.v13)],
    targets: targets
)
