import Foundation

@MainActor
final class ChatViewModel: ObservableObject {
    @Published private(set) var messages: [ChatMessage] = [
        ChatMessage(role: .assistant, text: "Tell me what’s happening, or ask what needs attention.")
    ]
    @Published var inputText = ""
    @Published private(set) var pendingApproval: ChatApproval?
    @Published private(set) var briefing: ChatBriefingSummary?
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
        statusText = "Private assistant"
        if appState.tokenStatus == .stored {
            Task { await loadBriefing() }
        }
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
        pendingApproval = Self.openVoiceChatApproval()
        appendAssistant("Voice chat needs consent first. Open Talk to NearMind?")
    }

    func confirmApproval() {
        guard let approval = pendingApproval else { return }
        pendingApproval = nil
        switch approval.kind {
        case .openLive:
            appendAssistant("Opening Live Assist. The microphone will stay off until you consent and start a session.")
            appState?.requestLiveLaunch(.liveAssist)
            openLive?()
        case .openVoiceChat:
            appendAssistant("Opening Talk to NearMind. The microphone will stay off until you consent and tap Start.")
            appState?.requestLiveLaunch(.voiceChat)
            openLive?()
        case .muteVoiceReplies:
            appState?.setTTSMutedPreference(true)
            appendAssistant("Spoken responses are muted. I’ll keep showing text.")
        case .unmuteVoiceReplies:
            appState?.setTTSMutedPreference(false)
            appendAssistant("Spoken responses are back on. Live still requires consent before microphone use.")
        case .setVoiceOutputMode(let mode):
            appState?.setVoiceOutputMode(mode)
            appendAssistant("Voice output changed to \(mode.displayTitle).")
        case .setVoiceCharacter(let character):
            appState?.setNaturalVoiceCharacter(character)
            appendAssistant("Voice character changed to \(character.displayName).")
        case .openProfileMemory:
            appendAssistant("Opening You. Memory deletion still requires review; no memory was deleted.")
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

        if normalized.contains("voice chat") || normalized.contains("talk to nearmind") || normalized.contains("talk with nearmind") {
            pendingApproval = Self.openVoiceChatApproval()
            appendAssistant("Voice chat requires microphone consent. Open Talk to NearMind?")
            return
        }

        if Self.isUnsafeVoiceCloneIntent(normalized) {
            appendAssistant("NearMind does not clone or imitate real people’s voices. You can choose one of the built-in assistant voices.")
            return
        }

        if normalized.contains("make your voice more natural") || normalized.contains("natural voice") {
            pendingApproval = ChatApproval(
                kind: .setVoiceOutputMode(.natural),
                title: "Use Natural Voice Beta?",
                explanation: "Only assistant response text is sent to the Voice Gateway. Your microphone audio is not sent to the TTS provider.",
                confirmLabel: "Use Natural",
                cancelLabel: "Cancel",
                riskLevel: .low
            )
            return
        }

        if normalized.contains("native voice") {
            pendingApproval = ChatApproval(
                kind: .setVoiceOutputMode(.native),
                title: "Use Native Voice?",
                explanation: "NearMind will use local iOS speech output.",
                confirmLabel: "Use Native",
                cancelLabel: "Cancel",
                riskLevel: .low
            )
            return
        }

        if let character = Self.voiceCharacterIntent(normalized) {
            pendingApproval = ChatApproval(
                kind: .setVoiceCharacter(character),
                title: "Use \(character.displayName)?",
                explanation: "This changes the local NearMind voice preset. It is not voice cloning.",
                confirmLabel: "Change Voice",
                cancelLabel: "Cancel",
                riskLevel: .low
            )
            return
        }

        if normalized.contains("unmute voice") || normalized.contains("turn on spoken") || normalized.contains("speak responses") {
            pendingApproval = ChatApproval(
                kind: .unmuteVoiceReplies,
                title: "Unmute spoken responses?",
                explanation: "NearMind will use local iOS speech for short responses when Live or chat voice output supports it.",
                confirmLabel: "Unmute",
                cancelLabel: "Cancel",
                riskLevel: .low
            )
            return
        }

        if normalized.contains("mute voice") || normalized.contains("turn off spoken") || normalized.contains("mute spoken") {
            pendingApproval = ChatApproval(
                kind: .muteVoiceReplies,
                title: "Mute spoken responses?",
                explanation: "NearMind will keep showing text, but won’t speak responses aloud.",
                confirmLabel: "Mute",
                cancelLabel: "Cancel",
                riskLevel: .low
            )
            return
        }

        if normalized.contains("delete") && normalized.contains("memory") {
            pendingApproval = ChatApproval(
                kind: .openProfileMemory,
                title: "Memory deletion requires review",
                explanation: "NearMind will not delete memory from chat in this beta. Open You → Memory to review what exists.",
                confirmLabel: "Open You",
                cancelLabel: "Cancel",
                riskLevel: .sensitive
            )
            appendAssistant("Memory deletion requires review. Open You → Memory?")
            return
        }

        guard hasToken else {
            appendAssistant("Sign in or add a test token in You → Developer to chat with NearMind.")
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

    private func loadBriefing() async {
        guard let service else { return }
        do {
            let items = try await service.fetchTodayItems()
            let content = TodayViewModel.makeContent(from: items)
            let relayCount = items.filter { $0.type.hasPrefix("relay_") }.count
            let approvalCount = items.filter { $0.type == "relay_approval_needed" || $0.type.contains("approval") }.count
            let summary = ChatBriefingSummary(
                openTaskCount: content.openTaskCount,
                relayRequestCount: relayCount,
                pendingApprovalCount: approvalCount,
                recentSessionTitle: content.recentSessions.first?.title
            )
            briefing = summary.hasContent ? summary : nil
        } catch {
            briefing = nil
        }
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
                let title = recent.title.trimmingCharacters(in: .whitespacesAndNewlines)
                let displayTitle = title.lowercased() == "session" || title.isEmpty ? "your latest saved session" : title
                lines.append("Recent session: \(displayTitle).")
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
            explanation: "Live Assist needs microphone consent. Opening Live will not start recording.",
            confirmLabel: "Open Live",
            cancelLabel: "Cancel",
            riskLevel: .low
        )
    }

    private static func openVoiceChatApproval() -> ChatApproval {
        ChatApproval(
            kind: .openVoiceChat,
            title: "Talk to NearMind?",
            explanation: "This opens a general voice conversation. The microphone stays off until you consent and tap Start.",
            confirmLabel: "Open Voice",
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

    static func isUnsafeVoiceCloneIntent(_ normalizedText: String) -> Bool {
        normalizedText.contains("clone") && normalizedText.contains("voice") ||
        normalizedText.contains("sound like") ||
        normalizedText.contains("imitate") && normalizedText.contains("voice")
    }

    static func voiceCharacterIntent(_ normalizedText: String) -> NaturalVoiceCharacterID? {
        if normalizedText.contains("professional voice") || normalizedText.contains("business voice") {
            return .professional
        }
        if normalizedText.contains("warm support") || normalizedText.contains("warm voice") {
            return .warmSupport
        }
        if normalizedText.contains("focus whisper") || normalizedText.contains("whisper voice") {
            return .focusWhisper
        }
        if normalizedText.contains("briefing voice") {
            return .briefingVoice
        }
        if normalizedText.contains("calm guide") || normalizedText.contains("calm voice") {
            return .calmGuide
        }
        return nil
    }
}
