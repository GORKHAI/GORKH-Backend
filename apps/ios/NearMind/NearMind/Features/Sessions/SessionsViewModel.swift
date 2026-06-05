import Foundation

@MainActor
final class SessionsViewModel: ObservableObject {
    @Published private(set) var content = SessionsContent.empty
    @Published private(set) var isLoading = false
    @Published private(set) var statusText = "Ready"

    private var apiClient: APIClient?
    private weak var appState: AppState?

    func configure(environment: AppEnvironment, appState: AppState) {
        self.apiClient = environment.apiClient
        self.appState = appState
        appState.refreshAuthStatus()
    }

    func refresh() {
        guard appState?.tokenStatus == .stored else {
            content = .empty
            statusText = "Paste a test JWT in Settings to sync sessions."
            return
        }

        isLoading = true
        Task {
            defer { isLoading = false }
            do {
                let response = try await apiClient?.getMobileSync(cursor: nil)
                let sessions = (response?.decoded?.items ?? []).compactMap(SessionListItem.from(syncItem:))
                content = SessionsContent(sessions: sessions)
                statusText = sessions.isEmpty ? "No saved sessions yet" : "Synced"
            } catch {
                content = .empty
                statusText = "Sync unavailable"
                appState?.appendLocal(message: "Sessions sync failed: \(error.localizedDescription)")
            }
        }
    }
}
