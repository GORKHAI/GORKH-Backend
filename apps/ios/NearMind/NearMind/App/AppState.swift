import Foundation

@MainActor
final class AppState: ObservableObject {
    @Published var hasCompletedOnboarding = false
    @Published private(set) var isAuthenticated = false
    @Published private(set) var eventLog: [DebugEvent] = []

    let environment: AppEnvironment

    init(environment: AppEnvironment) {
        self.environment = environment
    }

    func completeOnboarding() {
        hasCompletedOnboarding = true
    }

    func refreshAuthStatus() {
        isAuthenticated = (try? environment.tokenStore.readToken())?.isEmpty == false
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

    func clearEvents() {
        eventLog.removeAll()
    }
}

struct DebugEvent: Identifiable, Equatable {
    let id = UUID()
    let timestamp: Date
    let title: String
    let rawJSON: String?
}
