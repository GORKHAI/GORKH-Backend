import Foundation

@MainActor
final class ChatViewModel: ObservableObject {
    @Published private(set) var messages: [ChatMessage] = [
        ChatMessage(role: .assistant, text: "Tell me what’s happening, or ask me what needs attention today.")
    ]
    @Published var inputText = ""
    @Published private(set) var pendingApproval: ChatApproval?
    @Published private(set) var isLoading = false
    @Published private(set) var statusText = "Private assistant"

    private var appState: AppState?
    private var service: ChatAssistantServicing?
    private var openLive: (() -> Void)?
    private var openProfile: (() -> Void)?
    private var openRelayComposer: ((String) -> Void)?

    func configure(
        appState: AppState,
        service: ChatAssistantServicing? = nil,
        openLive: (() -> Void)? = nil,
        openProfile: (() -> Void)? = nil,
        openRelayComposer: ((String) -> Void)? = nil
    ) {
        self.appState = appState
        self.service = service ?? APIClient(config: appState.environment.config, tokenStore: appState.environment.tokenStore)
        self.openLive = openLive
        self.openProfile = openProfile
        self.openRelayComposer = openRelayComposer
        appState.refreshAuthStatus()
        statusText = appState.tokenStatus == .stored ? "Private assistant" : "Add token in Profile"
    }

    func submitInput() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        inputText = ""
        Task {
            await send(text)
        }
    }

    func handleQuickAction(_ action: ChatQuickAction) {
        Task {
            await send(action.rawValue)
        }
    }

    func handleMicTapped() {
        pendingApproval = Self.openLiveApproval()
        appendAssistant("Voice chat is coming next. Use Live for consented voice sessions.")
    }

    func confirmApproval() {
        guard let approval = pendingApproval else { return }
        pendingApproval = nil
        switch approval.kind {
        case .openLive:
            appendAssistant("Opening Live Assist. The microphone will stay off until you consent and start a session.")
            openLive?()
        case .muteVoiceReplies:
            appState?.setTTSMutedPreference(true)
            appendAssistant("Spoken responses are muted. You can turn them back on in Profile.")
        case .openProfileMemory:
            appendAssistant("Opening Profile & Memory. Deletion still requires review; no memory was deleted.")
            openProfile?()
        }
    }

    func cancelApproval() {
        pendingApproval = nil
        appendAssistant("Cancelled.")
    }

    func send(_ rawText: String) async {
        let text = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        appendUser(text)
        let normalized = text.lowercased()

        if normalized.contains("start live") || normalized.contains("live assist") {
            pendingApproval = Self.openLiveApproval()
            appendAssistant("Live Assist requires microphone consent. Open Live?")
            return
        }

        if normalized.contains("mute voice") || normalized.contains("turn off spoken") || normalized.contains("mute spoken") {
            pendingApproval = ChatApproval(
                kind: .muteVoiceReplies,
                title: "Turn off spoken responses?",
                explanation: "NearMind will keep showing text and cues, but native TTS will stay muted until you turn it back on.",
                confirmLabel: "Confirm",
                cancelLabel: "Cancel",
                riskLevel: .low
            )
            return
        }

        if normalized.contains("delete") && normalized.contains("memory") {
            pendingApproval = ChatApproval(
                kind: .openProfileMemory,
                title: "Memory deletion requires review",
                explanation: "NearMind will not delete memory from chat in this beta. Open Profile & Memory to review what exists.",
                confirmLabel: "Open Profile",
                cancelLabel: "Cancel",
                riskLevel: .sensitive
            )
            appendAssistant("Memory deletion requires review. Open Profile & Memory?")
            return
        }

        guard hasToken else {
            appendAssistant("Add a test token in Profile to chat with your assistant.")
            return
        }

        if Self.isRelayRequestIntent(normalized) {
            appendAssistant("I can draft that as a private Relay request. You’ll approve it before anything is sent.")
            openRelayComposer?(text)
            return
        }

        if normalized.contains("what should i do today") || normalized.contains("what did i promise") || normalized.contains("tasks") {
            await loadTodaySummary()
            return
        }

        if normalized.contains("remember about me") || normalized.contains("show my memory") || normalized.contains("what do you remember") {
            await loadMemorySummary()
            return
        }

        await runAssistantQuery(text)
    }

    private var hasToken: Bool {
        appState?.refreshAuthStatus()
        return appState?.tokenStatus == .stored
    }

    private func loadTodaySummary() async {
        guard let service else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let items = try await service.fetchTodayItems()
            let content = TodayViewModel.makeContent(from: items)
            if !content.hasBrief && !content.hasTasks && !content.hasRecentSessions {
                appendAssistant("I don’t have any tasks yet. Start a Live Assist session or add a task.")
                return
            }

            var lines: [String] = []
            if let brief = content.briefText {
                lines.append(brief)
            }
            if content.openTaskCount > 0 {
                lines.append("\(content.openTaskCount) open task\(content.openTaskCount == 1 ? "" : "s") need attention.")
            }
            if let recent = content.recentSessions.first {
                lines.append("Recent session: \(recent.title).")
            }
            appendAssistant(lines.joined(separator: "\n"))
        } catch {
            appendAssistant("I couldn’t load today’s context. \(safeError(error))")
        }
    }

    private func loadMemorySummary() async {
        guard let service else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let summary = try await service.fetchMemorySummary()
            if summary.confirmedCount == 0 && summary.pendingCount == 0 && summary.sensitiveCount == 0 {
                appendAssistant("I don’t have confirmed memory to show yet.")
                return
            }

            var lines = [
                "\(summary.confirmedCount) confirmed fact\(summary.confirmedCount == 1 ? "" : "s").",
                "\(summary.pendingCount) pending fact\(summary.pendingCount == 1 ? "" : "s")."
            ]
            if summary.sensitiveCount > 0 {
                lines.append("\(summary.sensitiveCount) sensitive candidate\(summary.sensitiveCount == 1 ? "" : "s") require review.")
            }
            if let profileSummary = summary.summary, !profileSummary.isEmpty {
                lines.append(profileSummary)
            }
            appendAssistant(lines.joined(separator: "\n"))
        } catch {
            appendAssistant("I couldn’t load memory review. \(safeError(error))")
        }
    }

    private func runAssistantQuery(_ text: String) async {
        guard let service else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            appendAssistant(try await service.queryAssistant(text: text))
        } catch {
            appendAssistant("I couldn’t answer that yet. \(safeError(error))")
        }
    }

    private func appendUser(_ text: String) {
        messages.append(ChatMessage(role: .user, text: Self.redactSecrets(text)))
    }

    private func appendAssistant(_ text: String) {
        messages.append(ChatMessage(role: .assistant, text: Self.redactSecrets(text)))
    }

    private func safeError(_ error: Error) -> String {
        if let localized = (error as? LocalizedError)?.errorDescription {
            return localized
        }
        return "The request failed safely."
    }

    private static func openLiveApproval() -> ChatApproval {
        ChatApproval(
            kind: .openLive,
            title: "Open Live Assist?",
            explanation: "Live Assist requires microphone consent. Opening Live will not start recording.",
            confirmLabel: "Open Live",
            cancelLabel: "Cancel",
            riskLevel: .low
        )
    }

    static func redactSecrets(_ text: String) -> String {
        let jwtPattern = #"[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"#
        return text.replacingOccurrences(of: jwtPattern, with: "[redacted token]", options: .regularExpression)
    }

    static func isRelayRequestIntent(_ normalizedText: String) -> Bool {
        normalizedText.hasPrefix("ask ") ||
        normalizedText.contains("ask investor") ||
        normalizedText.contains("ask candidate") ||
        normalizedText.contains("send a request to") ||
        normalizedText.contains("ask steve") ||
        normalizedText.contains("agent if")
    }
}
