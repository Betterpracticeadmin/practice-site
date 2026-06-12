import SwiftUI
import WebKit
import CoreLocation

// Practice Vision — native iPad/iPhone shell that loads the live cockpit fullscreen.
// Geolocation works because the native app holds the location authorization (LocationPrimer).
// NOTE: Web Bluetooth (OBD) is NOT available inside WKWebView — use the native CoreBluetooth
//       path (see ../README.md) or Bluefy for OBD on iOS.

@main
struct PracticeVisionApp: App {
    @StateObject private var loc = LocationPrimer()
    var body: some Scene {
        WindowGroup {
            CockpitView()
                .ignoresSafeArea()
                .preferredColorScheme(.dark)
                .statusBarHidden(true)
                .onAppear { loc.start() }
        }
    }
}

struct CockpitView: View {
    // Le cockpit complet. Pour ouvrir le HUD direct, remplace par "/hud.html".
    private let url = URL(string: "https://practice-site-five.vercel.app/os.html")!
    var body: some View {
        WebView(url: url).background(Color.black)
    }
}

struct WebView: UIViewRepresentable {
    let url: URL
    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        let wv = WKWebView(frame: .zero, configuration: cfg)
        wv.scrollView.bounces = false
        wv.scrollView.contentInsetAdjustmentBehavior = .never
        wv.isOpaque = false
        wv.backgroundColor = .black
        wv.allowsBackForwardNavigationGestures = false
        wv.load(URLRequest(url: url))
        return wv
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

// WKWebView's navigator.geolocation only resolves while the app itself has an active
// location authorization. We request it on launch so the cockpit gets real GPS speed/position.
final class LocationPrimer: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let mgr = CLLocationManager()
    func start() {
        mgr.delegate = self
        mgr.desiredAccuracy = kCLLocationAccuracyBest
        mgr.requestWhenInUseAuthorization()
        mgr.startUpdatingLocation()
    }
    func locationManager(_ m: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {}
    func locationManager(_ m: CLLocationManager, didUpdateLocations locations: [CLLocation]) {}
}
