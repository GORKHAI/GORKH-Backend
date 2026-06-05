import AVFoundation

enum AudioRouteKind: String, Equatable {
    case builtInMic = "Built-in mic"
    case speaker = "Speaker"
    case receiver = "Receiver"
    case headphones = "Headphones"
    case bluetooth = "Bluetooth"
    case other = "Other"
}

struct AudioRouteInfo: Equatable {
    let inputKind: AudioRouteKind
    let inputName: String
    let outputKind: AudioRouteKind
    let outputName: String
    let hasInput: Bool

    var summary: String {
        "\(inputKind.rawValue): \(inputName) -> \(outputKind.rawValue): \(outputName)"
    }

    static let unavailable = AudioRouteInfo(
        inputKind: .other,
        inputName: "No input",
        outputKind: .other,
        outputName: "No output",
        hasInput: false
    )

    static func current(session: AVAudioSession = .sharedInstance()) -> AudioRouteInfo {
        let route = session.currentRoute
        let input = route.inputs.first
        let output = route.outputs.first
        return AudioRouteInfo(
            inputKind: kind(for: input?.portType.rawValue),
            inputName: input?.portName ?? "No input",
            outputKind: kind(for: output?.portType.rawValue),
            outputName: output?.portName ?? "No output",
            hasInput: input != nil
        )
    }

    static func kind(for rawPortType: String?) -> AudioRouteKind {
        guard let rawPortType else { return .other }
        switch rawPortType {
        case AVAudioSession.Port.builtInMic.rawValue:
            return .builtInMic
        case AVAudioSession.Port.builtInSpeaker.rawValue:
            return .speaker
        case AVAudioSession.Port.builtInReceiver.rawValue:
            return .receiver
        case AVAudioSession.Port.headphones.rawValue, AVAudioSession.Port.headsetMic.rawValue:
            return .headphones
        case AVAudioSession.Port.bluetoothA2DP.rawValue,
            AVAudioSession.Port.bluetoothHFP.rawValue,
            AVAudioSession.Port.bluetoothLE.rawValue:
            return .bluetooth
        default:
            return .other
        }
    }
}

enum AudioRouteChangeReason: String, Equatable {
    case unknown
    case newDeviceAvailable
    case oldDeviceUnavailable
    case categoryChange
    case routeConfigurationChange
    case noSuitableRouteForCategory
    case wakeFromSleep

    static func from(_ reason: AVAudioSession.RouteChangeReason) -> AudioRouteChangeReason {
        switch reason {
        case .newDeviceAvailable:
            return .newDeviceAvailable
        case .oldDeviceUnavailable:
            return .oldDeviceUnavailable
        case .categoryChange:
            return .categoryChange
        case .routeConfigurationChange:
            return .routeConfigurationChange
        case .noSuitableRouteForCategory:
            return .noSuitableRouteForCategory
        case .wakeFromSleep:
            return .wakeFromSleep
        default:
            return .unknown
        }
    }
}

struct AudioRouteChange: Equatable {
    let reason: AudioRouteChangeReason
    let route: AudioRouteInfo
}

enum AudioSessionRouteError: Error, LocalizedError, Equatable {
    case inputUnavailable

    var errorDescription: String? {
        "Microphone route became unavailable."
    }
}

protocol AudioSessionManaging: AnyObject {
    var currentRouteInfo: AudioRouteInfo { get }
    func configureForVoiceSession() throws
    func deactivate()
    func observeRouteChanges(_ handler: @escaping @MainActor (AudioRouteChange) -> Void) -> NSObjectProtocol
    func removeRouteObserver(_ token: NSObjectProtocol)
}

final class AudioSessionManager: AudioSessionManaging {
    var currentRouteInfo: AudioRouteInfo {
        AudioRouteInfo.current()
    }

    func configureForVoiceSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playAndRecord,
            mode: .voiceChat,
            options: [.allowBluetoothHFP, .allowBluetoothA2DP, .defaultToSpeaker]
        )
        try session.setPreferredSampleRate(16_000)
        try session.setPreferredInputNumberOfChannels(1)
        try session.setActive(true, options: [])
    }

    func deactivate() {
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }

    func observeRouteChanges(_ handler: @escaping @MainActor (AudioRouteChange) -> Void) -> NSObjectProtocol {
        NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { notification in
            let reasonValue = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
            let reason = reasonValue.flatMap(AVAudioSession.RouteChangeReason.init(rawValue:)) ?? .unknown
            let change = AudioRouteChange(
                reason: AudioRouteChangeReason.from(reason),
                route: AudioRouteInfo.current()
            )
            Task { @MainActor in
                handler(change)
            }
        }
    }

    func removeRouteObserver(_ token: NSObjectProtocol) {
        NotificationCenter.default.removeObserver(token)
    }
}
