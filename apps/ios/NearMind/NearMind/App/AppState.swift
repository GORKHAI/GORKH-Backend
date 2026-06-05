import Foundation

@MainActor
final class AppState: ObservableObject {
    private enum DefaultsKey {
        static let hasCompletedOnboarding = "NearMind.hasCompletedOnboarding"
        static let ttsMutedPreference = "NearMind.ttsMutedPreference"
        static let defaultAssistPolicy = "NearMind.defaultAssistPolicy"
    }

    enum TokenStatus: String {
        case missing
        case stored
        case invalid
    }

    @Published var hasCompletedOnboarding = false
    @Published var ttsMutedPreference = false
    @Published private(set) var isAuthenticated = false
    @Published private(set) var tokenStatus: TokenStatus = .missing
    @Published private(set) var eventLog: [DebugEvent] = []
    @Published var defaultAssistPolicy: AssistPolicy = .conversationAgent

    let environment: AppEnvironment

    init(environment: AppEnvironment) {
        self.environment = environment
        hasCompletedOnboarding = UserDefaults.standard.bool(forKey: DefaultsKey.hasCompletedOnboarding)
        ttsMutedPreference = UserDefaults.standard.bool(forKey: DefaultsKey.ttsMutedPreference)
        if let policy = UserDefaults.standard.string(forKey: DefaultsKey.defaultAssistPolicy),
           let decoded = AssistPolicy(rawValue: policy) {
            defaultAssistPolicy = decoded
        }
    }

    func completeOnboarding() {
        hasCompletedOnboarding = true
        UserDefaults.standard.set(true, forKey: DefaultsKey.hasCompletedOnboarding)
    }

    func refreshAuthStatus() {
        let hasToken = (try? environment.tokenStore.readToken())?.isEmpty == false
        isAuthenticated = hasToken
        tokenStatus = hasToken ? .stored : .missing
    }

    func markTokenInvalid() {
        isAuthenticated = false
        tokenStatus = .invalid
    }

    func append(event: GatewayServerEvent, rawJSON: String) {
        eventLog.insert(
            DebugEvent(
                timestamp: Date(),
                title: event.displayName,
                rawJSON: rawJSON
            ),
            at: 0
        )
    }

    func appendLocal(message: String) {
        eventLog.insert(
            DebugEvent(
                timestamp: Date(),
                title: message,
                rawJSON: nil
            ),
            at: 0
        )
    }

    func appendRaw(title: String, rawJSON: String) {
        eventLog.insert(
            DebugEvent(
                timestamp: Date(),
                title: title,
                rawJSON: rawJSON
            ),
            at: 0
        )
    }

    func clearEvents() {
        eventLog.removeAll()
    }

    func setTTSMutedPreference(_ muted: Bool) {
        ttsMutedPreference = muted
        UserDefaults.standard.set(muted, forKey: DefaultsKey.ttsMutedPreference)
    }

    func setDefaultAssistPolicy(_ policy: AssistPolicy) {
        defaultAssistPolicy = policy
        UserDefaults.standard.set(policy.rawValue, forKey: DefaultsKey.defaultAssistPolicy)
    }
}

struct DebugEvent: Identifiable, Equatable {
    let id = UUID()
    let timestamp: Date
    let title: String
    let rawJSON: String?
}
