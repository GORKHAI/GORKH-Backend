import Foundation

@MainActor
final class AppState: ObservableObject {
    private enum DefaultsKey {
        static let hasCompletedOnboarding = "NearMind.hasCompletedOnboarding"
        static let ttsMutedPreference = "NearMind.ttsMutedPreference"
        static let defaultAssistPolicy = "NearMind.defaultAssistPolicy"
        static let voiceOutputMode = "NearMind.voiceOutputMode"
        static let naturalVoiceCharacter = "NearMind.naturalVoiceCharacter"
        static let naturalVoiceFallbackEnabled = "NearMind.naturalVoiceFallbackEnabled"
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
    @Published var account: AccountProfile?
    @Published var billingStatus: BillingStatus?
    @Published var defaultAssistPolicy: AssistPolicy = .conversationAgent
    @Published private(set) var pendingLiveLaunchIntent: LiveLaunchIntent?
    @Published var voiceOutputMode: VoiceOutputMode = .native
    @Published var naturalVoiceCharacter: NaturalVoiceCharacterID = .calmGuide
    @Published var naturalVoiceFallbackEnabled = true

    let environment: AppEnvironment

    init(environment: AppEnvironment) {
        self.environment = environment
        hasCompletedOnboarding = UserDefaults.standard.bool(forKey: DefaultsKey.hasCompletedOnboarding)
        ttsMutedPreference = UserDefaults.standard.bool(forKey: DefaultsKey.ttsMutedPreference)
        if let policy = UserDefaults.standard.string(forKey: DefaultsKey.defaultAssistPolicy),
           let decoded = AssistPolicy(rawValue: policy) {
            defaultAssistPolicy = decoded
        }
        if let mode = UserDefaults.standard.string(forKey: DefaultsKey.voiceOutputMode),
           let decoded = VoiceOutputMode(rawValue: mode) {
            voiceOutputMode = decoded
        }
        if let character = UserDefaults.standard.string(forKey: DefaultsKey.naturalVoiceCharacter),
           let decoded = NaturalVoiceCharacterID(rawValue: character) {
            naturalVoiceCharacter = decoded
        }
        if UserDefaults.standard.object(forKey: DefaultsKey.naturalVoiceFallbackEnabled) != nil {
            naturalVoiceFallbackEnabled = UserDefaults.standard.bool(forKey: DefaultsKey.naturalVoiceFallbackEnabled)
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
        if !hasToken {
            account = nil
            billingStatus = nil
        }
    }

    func saveAuthenticatedToken(_ token: String) throws {
        try environment.tokenStore.saveToken(token)
        refreshAuthStatus()
    }

    func refreshAccount() async {
        refreshAuthStatus()
        guard isAuthenticated else { return }
        do {
            async let accountResponse = environment.apiClient.getAccountMe()
            async let billingResponse = environment.apiClient.getBillingStatus()
            account = try await accountResponse.decoded?.account
            billingStatus = try await billingResponse.decoded
        } catch {
            if (error as? APIClientError)?.mobileErrorCode == "auth_invalid" {
                markTokenInvalid()
            }
            appendLocal(message: "Account refresh failed: \(error.localizedDescription)")
        }
    }

    func signOut() async {
        do {
            _ = try? await environment.apiClient.signOut()
            try environment.tokenStore.clearToken()
            account = nil
            billingStatus = nil
            refreshAuthStatus()
            appendLocal(message: "Signed out.")
        } catch {
            appendLocal(message: "Sign out failed: \(error.localizedDescription)")
        }
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

    func setVoiceOutputMode(_ mode: VoiceOutputMode) {
        voiceOutputMode = mode
        UserDefaults.standard.set(mode.rawValue, forKey: DefaultsKey.voiceOutputMode)
    }

    func setNaturalVoiceCharacter(_ character: NaturalVoiceCharacterID) {
        naturalVoiceCharacter = character
        UserDefaults.standard.set(character.rawValue, forKey: DefaultsKey.naturalVoiceCharacter)
    }

    func setNaturalVoiceFallbackEnabled(_ enabled: Bool) {
        naturalVoiceFallbackEnabled = enabled
        UserDefaults.standard.set(enabled, forKey: DefaultsKey.naturalVoiceFallbackEnabled)
    }

    func requestLiveLaunch(_ intent: LiveLaunchIntent) {
        pendingLiveLaunchIntent = intent
    }

    func consumeLiveLaunchIntent() -> LiveLaunchIntent? {
        let intent = pendingLiveLaunchIntent
        pendingLiveLaunchIntent = nil
        return intent
    }
}

struct DebugEvent: Identifiable, Equatable {
    let id = UUID()
    let timestamp: Date
    let title: String
    let rawJSON: String?
}

enum LiveLaunchIntent: Equatable {
    case voiceChat
    case liveAssist
}
