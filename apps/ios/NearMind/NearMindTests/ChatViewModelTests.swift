import XCTest
@testable import NearMind

@MainActor
final class ChatViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        UserDefaults.standard.removeObject(forKey: "NearMind.ttsMutedPreference")
        UserDefaults.standard.removeObject(forKey: "NearMind.defaultAssistPolicy")
    }

    func testInitialAssistantMessageExists() {
        let viewModel = ChatViewModel()

        XCTAssertEqual(viewModel.messages.first?.role, .assistant)
        XCTAssertTrue(viewModel.messages.first?.text.contains("what needs attention today") == true)
    }

    func testStartLiveQuickActionCreatesApprovalAndConfirmOpensLive() async {
        let store = ChatTestTokenStore(token: "test.jwt")
        let appState = makeAppState(tokenStore: store)
        let service = MockChatService()
        let viewModel = ChatViewModel()
        var openedLive = false
        viewModel.configure(appState: appState, service: service, openLive: { openedLive = true })

        viewModel.handleQuickAction(.startLive)
        await Task.yield()

        XCTAssertEqual(viewModel.pendingApproval?.kind, .openLive)
        viewModel.confirmApproval()
        XCTAssertTrue(openedLive)
    }

    func testMuteVoiceRepliesRequiresApprovalAndStoresLocalPreference() async {
        let appState = makeAppState(tokenStore: ChatTestTokenStore(token: "test.jwt"))
        let viewModel = ChatViewModel()
        viewModel.configure(appState: appState, service: MockChatService())

        await viewModel.send("Mute voice replies")

        XCTAssertEqual(viewModel.pendingApproval?.kind, .muteVoiceReplies)
        XCTAssertFalse(appState.ttsMutedPreference)

        viewModel.confirmApproval()

        XCTAssertTrue(appState.ttsMutedPreference)
    }

    func testDeleteMemoryDoesNotCallBackendAndRoutesToProfileApproval() async {
        let service = MockChatService()
        let appState = makeAppState(tokenStore: ChatTestTokenStore(token: "test.jwt"))
        let viewModel = ChatViewModel()
        var openedProfile = false
        viewModel.configure(appState: appState, service: service, openProfile: { openedProfile = true })

        await viewModel.send("Delete my memory")

        XCTAssertEqual(viewModel.pendingApproval?.kind, .openProfileMemory)
        XCTAssertEqual(service.queryCallCount, 0)
        viewModel.confirmApproval()
        XCTAssertTrue(openedProfile)
    }

    func testChatRequiresTokenBeforeBackendCall() async {
        let service = MockChatService()
        let appState = makeAppState(tokenStore: ChatTestTokenStore(token: nil))
        let viewModel = ChatViewModel()
        viewModel.configure(appState: appState, service: service)

        await viewModel.send("Explain my day")

        XCTAssertEqual(service.queryCallCount, 0)
        XCTAssertEqual(viewModel.messages.last?.text, "Add a test token in Profile to chat with your assistant.")
    }

    func testAskIntentOpensRelayComposerWithoutBackendSend() async {
        let service = MockChatService()
        let appState = makeAppState(tokenStore: ChatTestTokenStore(token: "test.jwt"))
        let viewModel = ChatViewModel()
        var relayGoal: String?
        viewModel.configure(appState: appState, service: service, openRelayComposer: { relayGoal = $0 })

        await viewModel.send("Ask Steve's agent if he is available for an investor call next week.")

        XCTAssertEqual(service.queryCallCount, 0)
        XCTAssertEqual(relayGoal, "Ask Steve's agent if he is available for an investor call next week.")
        XCTAssertTrue(viewModel.messages.last?.text.contains("approve") == true)
    }

    func testUnknownQueryHandlesBackendErrorSafely() async {
        let service = MockChatService()
        service.error = APIClientError.invalidJSON
        let appState = makeAppState(tokenStore: ChatTestTokenStore(token: "test.jwt"))
        let viewModel = ChatViewModel()
        viewModel.configure(appState: appState, service: service)

        await viewModel.send("Something unusual")

        XCTAssertEqual(service.queryCallCount, 1)
        XCTAssertTrue(viewModel.messages.last?.text.contains("couldn’t answer") == true)
    }

    func testTokenIsRedactedFromChatLogs() async {
        let token = "eyJhbGciOiJ.fakePayload123.fakeSignature123"
        let appState = makeAppState(tokenStore: ChatTestTokenStore(token: nil))
        let viewModel = ChatViewModel()
        viewModel.configure(appState: appState, service: MockChatService())

        await viewModel.send("Here is \(token)")

        XCTAssertFalse(viewModel.messages.map(\.text).joined(separator: "\n").contains(token))
        XCTAssertTrue(viewModel.messages.map(\.text).joined(separator: "\n").contains("[redacted token]"))
    }

    func testTodayQuickActionUsesMobileSyncEmptyState() async {
        let appState = makeAppState(tokenStore: ChatTestTokenStore(token: "test.jwt"))
        let service = MockChatService()
        let viewModel = ChatViewModel()
        viewModel.configure(appState: appState, service: service)

        await viewModel.send("What should I do today?")

        XCTAssertEqual(service.todayCallCount, 1)
        XCTAssertTrue(viewModel.messages.last?.text.contains("I don’t have any tasks yet") == true)
    }

    private func makeAppState(tokenStore: TokenStoreProtocol) -> AppState {
        let config = AppConfig(
            apiBaseURL: URL(string: "https://api.gorkh.com")!,
            gatewayWebSocketURL: URL(string: "wss://voice.gorkh.com/gateway/voice")!,
            gatewayHTTPURL: URL(string: "https://voice.gorkh.com")!
        )
        return AppState(
            environment: AppEnvironment(
                config: config,
                tokenStore: tokenStore,
                apiClient: APIClient(config: config, tokenStore: tokenStore)
            )
        )
    }
}

private final class MockChatService: ChatAssistantServicing {
    var error: Error?
    var todayItems: [MobileSyncItem] = []
    var memorySummary = ChatMemorySummary(confirmedCount: 0, pendingCount: 0, sensitiveCount: 0, summary: nil)
    private(set) var todayCallCount = 0
    private(set) var queryCallCount = 0
    private(set) var memoryCallCount = 0

    func fetchTodayItems() async throws -> [MobileSyncItem] {
        todayCallCount += 1
        if let error { throw error }
        return todayItems
    }

    func fetchDashboard() async throws -> [String: JSONValue] {
        if let error { throw error }
        return [:]
    }

    func queryAssistant(text: String) async throws -> String {
        queryCallCount += 1
        if let error { throw error }
        return "Assistant answer"
    }

    func fetchMemorySummary() async throws -> ChatMemorySummary {
        memoryCallCount += 1
        if let error { throw error }
        return memorySummary
    }
}

private final class ChatTestTokenStore: TokenStoreProtocol {
    private var token: String?

    init(token: String?) {
        self.token = token
    }

    func saveToken(_ token: String) throws {
        self.token = token
    }

    func readToken() throws -> String? {
        token
    }

    func clearToken() throws {
        token = nil
    }
}
