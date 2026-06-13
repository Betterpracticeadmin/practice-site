// PracticeWatchHR.swift — Apple Watch live heart-rate streamer for Practice
//
// THE ONLY way to read Apple Watch heart rate: a native watchOS app + HealthKit.
// A web page / PWA cannot access it. This streams live BPM to the iPhone (WatchConnectivity),
// which the iPhone app then relays to the web cockpit (local WebSocket / WKWebView bridge).
//
// Build: Xcode → watchOS App target. Add HealthKit capability + Info.plist usage strings
//   NSHealthShareUsageDescription, and "Workout Processing" background mode.

import HealthKit
import WatchConnectivity

final class HeartRateStreamer: NSObject, HKLiveWorkoutBuilderDelegate, WCSessionDelegate {
    private let store = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?

    func start() {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let hr = HKQuantityType(.heartRate)
        // also pertinent for driving wellness: HRV, respiratory rate, active energy
        let read: Set = [hr, HKQuantityType(.heartRateVariabilitySDNN), HKQuantityType(.respiratoryRate)]
        store.requestAuthorization(toShare: [], read: read) { ok, _ in if ok { self.startWorkout() } }
        if WCSession.isSupported() { WCSession.default.delegate = self; WCSession.default.activate() }
    }

    // a workout session keeps the HR sensor sampling at high rate while driving
    private func startWorkout() {
        let cfg = HKWorkoutConfiguration(); cfg.activityType = .other; cfg.locationType = .outdoor
        do {
            session = try HKWorkoutSession(healthStore: store, configuration: cfg)
            builder = session?.associatedWorkoutBuilder()
            builder?.dataSource = HKLiveWorkoutDataSource(healthStore: store, workoutConfiguration: cfg)
            builder?.delegate = self
            session?.startActivity(with: Date())
            builder?.beginCollection(withStart: Date()) { _, _ in }
        } catch { return }
    }

    func workoutBuilder(_ b: HKLiveWorkoutBuilder, didCollectDataOf types: Set<HKSampleType>) {
        for t in types {
            guard let q = t as? HKQuantityType, let s = b.statistics(for: q) else { continue }
            switch q {
            case HKQuantityType(.heartRate):
                let bpm = s.mostRecentQuantity()?.doubleValue(for: .init(from: "count/min")) ?? 0
                if bpm > 0 { sendToPhone(["hr": Int(bpm.rounded())]) }
            case HKQuantityType(.heartRateVariabilitySDNN):
                let ms = s.mostRecentQuantity()?.doubleValue(for: .secondUnit(with: .milli)) ?? 0
                if ms > 0 { sendToPhone(["hrv": Int(ms.rounded())]) }   // lower HRV = more stress
            default: break
            }
        }
    }
    func workoutBuilderDidCollectEvent(_ b: HKLiveWorkoutBuilder) {}

    private func sendToPhone(_ msg: [String: Any]) {
        guard WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(msg, replyHandler: nil, errorHandler: nil)
    }

    // WCSessionDelegate
    func session(_ s: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}
}

// On the iPhone side: receive these messages and expose them to the web cockpit, e.g.
//   window.postMessage({type:'hr', bpm: msg["hr"]}) into the WKWebView, or a localhost WebSocket.
// The cockpit's driver-twin then uses real Apple Watch HR exactly like a BLE sensor.
