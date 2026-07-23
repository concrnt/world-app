// swift-tools-version:5.5
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "tauri-plugin-ageverify",
    platforms: [
        .macOS(.v10_13),
        // Keep in sync with the app's iOS deployment target (>= 15.0 so Swift
        // Concurrency links against /usr/lib/swift instead of the back-deploy
        // @rpath dylib, which never gets embedded in this Rust-staticlib setup).
        .iOS(.v15),
    ],
    products: [
        // Products define the executables and libraries a package produces, and make them visible to other packages.
        .library(
            name: "tauri-plugin-ageverify",
            type: .static,
            targets: ["tauri-plugin-ageverify"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        // Targets are the basic building blocks of a package. A target can define a module or a test suite.
        // Targets can depend on other targets in this package, and on products in packages this package depends on.
        .target(
            name: "tauri-plugin-ageverify",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources")
    ]
)
