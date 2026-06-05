import AVFoundation

enum MicrophonePermissionStatus: String {
    case unknown
    case granted
    case denied
}

protocol MicrophonePermissionProviding {
    func currentStatus() -> MicrophonePermissionStatus
    func request() async -> MicrophonePermissionStatus
}

enum MicrophonePermission {
    static func from(_ permission: AVAudioApplication.recordPermission) -> MicrophonePermissionStatus {
        switch permission {
        case .granted:
            return .granted
        case .denied:
            return .denied
        case .undetermined:
            return .unknown
        @unknown default:
            return .unknown
        }
    }

    static func currentStatus() -> MicrophonePermissionStatus {
        from(AVAudioApplication.shared.recordPermission)
    }

    static func request() async -> MicrophonePermissionStatus {
        await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted ? .granted : .denied)
            }
        }
    }
}

struct SystemMicrophonePermissionProvider: MicrophonePermissionProviding {
    func currentStatus() -> MicrophonePermissionStatus {
        MicrophonePermission.currentStatus()
    }

    func request() async -> MicrophonePermissionStatus {
        await MicrophonePermission.request()
    }
}
