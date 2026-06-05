import Foundation

enum AppTab: String, CaseIterable, Identifiable {
    case chat
    case live
    case sessions
    case profile

    var id: String { rawValue }

    var title: String {
        switch self {
        case .chat:
            return "Chat"
        case .live:
            return "Live"
        case .sessions:
            return "Sessions"
        case .profile:
            return "Profile"
        }
    }

    var systemImage: String {
        switch self {
        case .chat:
            return "message"
        case .live:
            return "waveform"
        case .sessions:
            return "clock"
        case .profile:
            return "person.crop.circle"
        }
    }
}
