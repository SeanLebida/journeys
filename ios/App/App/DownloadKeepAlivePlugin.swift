import Capacitor
import UIKit

/// A short iOS background-task extension (about 30 seconds) and a native
/// sleep. iOS will still suspend the app after that window; we do not claim
/// a background mode, so a long NASB download cannot finish with the app
/// closed on iPhone the way it can on Android.
@objc(DownloadKeepAlivePlugin)
public class DownloadKeepAlivePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DownloadKeepAlivePlugin"
    public let jsName = "DownloadKeepAlive"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sleep", returnType: CAPPluginReturnPromise),
    ]

    private var bgTask: UIBackgroundTaskIdentifier = .invalid

    @objc func start(_ call: CAPPluginCall) {
        endTask()
        bgTask = UIApplication.shared.beginBackgroundTask(withName: "BibleDownload") { [weak self] in
            self?.endTask()
        }
        call.resolve()
    }

    @objc func update(_ call: CAPPluginCall) {
        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) {
        endTask()
        call.resolve()
    }

    @objc func sleep(_ call: CAPPluginCall) {
        let ms = call.getDouble("ms") ?? 0
        guard ms > 0 else {
            call.resolve()
            return
        }
        DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + ms / 1000.0) {
            call.resolve()
        }
    }

    private func endTask() {
        guard bgTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(bgTask)
        bgTask = .invalid
    }
}
