import Foundation

struct TodayContent: Equatable {
    var briefText: String?
    var openTaskCount: Int
    var upcomingTitle: String?
    var recentSessions: [SessionListItem]

    var hasBrief: Bool {
        briefText?.isEmpty == false
    }

    var hasTasks: Bool {
        openTaskCount > 0
    }

    var hasRecentSessions: Bool {
        !recentSessions.isEmpty
    }

    static let empty = TodayContent(
        briefText: nil,
        openTaskCount: 0,
        upcomingTitle: nil,
        recentSessions: []
    )
}

@MainActor
final class TodayViewModel: ObservableObject {
    @Published private(set) var content = TodayContent.empty
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
            statusText = "Paste a test JWT in Profile to sync sessions."
            return
        }

        isLoading = true
        Task {
            defer { isLoading = false }
            do {
                let response = try await apiClient?.getMobileSync(cursor: nil)
                let items = response?.decoded?.items ?? []
                content = Self.makeContent(from: items)
                statusText = content.hasRecentSessions ? "Synced" : "No sessions yet"
            } catch {
                content = .empty
                statusText = "Sync unavailable"
                appState?.appendLocal(message: "Today sync failed: \(error.localizedDescription)")
            }
        }
    }

    static func makeContent(from items: [MobileSyncItem]) -> TodayContent {
        let sessions = items.compactMap(SessionListItem.from(syncItem:))
        let taskCount = items.filter { item in
            item.type.lowercased().contains("task")
                || item.type.lowercased().contains("follow")
                || item.type.lowercased().contains("commitment")
        }.count
        let brief = items.first { $0.type.lowercased().contains("brief") }?.item.string(for: "summary", "text", "brief")
        let upcoming = items.first { $0.type.lowercased().contains("upcoming") }?.item.string(for: "title", "summary", "text")

        return TodayContent(
            briefText: brief,
            openTaskCount: taskCount,
            upcomingTitle: upcoming,
            recentSessions: Array(sessions.prefix(3))
        )
    }
}
