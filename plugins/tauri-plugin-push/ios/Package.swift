// swift-tools-version:5.5
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

// Unlike this repo's other local plugins, no macOS platform is declared:
// push notifications are iOS/Android-only by design (see ../README.md), and
// PushShared uses CryptoKit APIs (HKDF, P256) that need macOS 10.15+ anyway.
let package = Package(
    name: "tauri-plugin-push",
    platforms: [
        .iOS(.v14)
    ],
    products: [
        .library(
            name: "tauri-plugin-push",
            type: .static,
            targets: ["tauri-plugin-push"]),
        // Shared with the NotifyService Notification Service Extension target
        // (see ../../../src-tauri/gen/apple/project.yml), which cannot depend
        // on the Tauri runtime itself.
        .library(
            name: "PushShared",
            type: .static,
            targets: ["PushShared"])
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-push",
            dependencies: [
                .byName(name: "Tauri"),
                "PushShared"
            ],
            path: "Sources/tauri-plugin-push"),
        .target(
            name: "PushShared",
            dependencies: [],
            path: "Sources/PushShared"),
        .testTarget(
            name: "PluginTests",
            dependencies: ["PushShared"],
            path: "Tests/PluginTests")
    ]
)
