// swift-tools-version: 5.9
// Practice Vision — Swift Playgrounds App (build & run directly on iPad, no Mac needed).
// Open this folder (PracticeVision.swiftpm) in Swift Playgrounds on the iPad → Run.
import PackageDescription
import AppleProductTypes

let package = Package(
    name: "Practice Vision",
    platforms: [ .iOS("16.0") ],
    products: [
        .iOSApplication(
            name: "Practice Vision",
            targets: ["AppModule"],
            bundleIdentifier: "fm.betterstate.practicevision",
            displayVersion: "1.0",
            bundleVersion: "1",
            accentColor: .presetColor(.orange),
            supportedDeviceFamilies: [ .pad, .phone ],
            supportedInterfaceOrientations: [
                .portrait,
                .landscapeRight,
                .landscapeLeft,
                .portraitUpsideDown(.when(deviceFamilies: [.pad]))
            ],
            capabilities: [
                .location(purposeString: "Affiche ta position et ta vitesse réelles dans le cockpit."),
                .microphone(purposeString: "Pour le copilote vocal."),
                .outgoingNetworkConnections()
            ]
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: "."
        )
    ]
)
