import Capacitor
import UIKit

/// Registers the local DownloadKeepAlive plugin, which is not an npm package
/// and so is not added by `cap sync`.
class BridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(DownloadKeepAlivePlugin())
    }
}
