import Foundation

enum AppTab: String, CaseIterable, Identifiable {
    case today
    case assist
    case sessions
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .today:
            return "Today"
        case .assist:
            return "Assist"
        case .sessions:
            return "Sessions"
        case .settings:
            return "Settings"
        }
    }

    var systemImage: String {
        switch self {
        case .today:
            return "sun.max"
        case .assist:
            return "waveform"
        case .sessions:
            return "clock"
        case .settings:
            return "gearshape"
        }
    }
}
