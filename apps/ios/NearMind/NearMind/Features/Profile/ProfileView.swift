import SwiftUI

enum YouSection: String, CaseIterable {
    case account = "Account"
    case memory = "Memory"
    case privacy = "Privacy"
    case requests = "Requests"
    case preferences = "Preferences"
    case audio = "Audio"
    case developer = "Developer"
}

struct YouView: View {
    @EnvironmentObject private var appState: AppState
    @State private var microphoneStatus = SystemMicrophonePermissionProvider().currentStatus()
    @State private var relayUpdateCount = 0

    var body: some View {
        List {
            Section {
                YouHeroRow(
                    title: appState.account?.displayLabel ?? "NearMind is yours",
                    subtitle: appState.account?.email ?? "Private assistant settings and memory live here."
                )
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))

            Section {
                NavigationLink {
                    YouAccountView()
                } label: {
                    ProfileRow(
                        title: "Account",
                        subtitle: accountSubtitle,
                        systemImage: "person.crop.circle"
                    )
                }

                NavigationLink {
                    YouMemoryView()
                } label: {
                    ProfileRow(
                        title: "Memory",
                        subtitle: "What NearMind knows and what still needs review",
                        systemImage: "person.text.rectangle"
                    )
                }

                NavigationLink {
                    YouPrivacyView()
                } label: {
                    ProfileRow(
                        title: "Privacy",
                        subtitle: "Storage, exports, retention, and deletion requests",
                        systemImage: "lock.shield"
                    )
                }

                NavigationLink {
                    YouRequestsView(client: relayClient)
                } label: {
                    ProfileRow(
                        title: "Requests",
                        subtitle: relaySubtitle,
                        systemImage: "arrow.left.arrow.right"
                    )
                }

                NavigationLink {
                    YouPreferencesView()
                } label: {
                    ProfileRow(
                        title: "Preferences",
                        subtitle: appState.ttsMutedPreference ? "Spoken responses muted" : "Spoken responses on",
                        systemImage: "slider.horizontal.3"
                    )
                }

                NavigationLink {
                    YouAudioView(microphoneStatus: microphoneStatus)
                } label: {
                    ProfileRow(
                        title: "Audio",
                        subtitle: "Microphone permission, output route, and local TTS",
                        systemImage: "speaker.wave.2"
                    )
                }
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Section {
                NavigationLink {
                    YouDeveloperView()
                } label: {
                    ProfileRow(
                        title: "Developer",
                        subtitle: "Internal tools",
                        systemImage: "hammer"
                    )
                }
            }
            .listRowBackground(NearMindTheme.elevatedBackground)
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .tint(NearMindTheme.accentMint)
        .navigationTitle("You")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            appState.refreshAuthStatus()
            microphoneStatus = SystemMicrophonePermissionProvider().currentStatus()
            Task {
                await appState.refreshAccount()
                await loadRelayUpdateCount()
            }
        }
    }

    private var accountSubtitle: String {
        if let plan = appState.account?.plan.displayName {
            return "\(plan) · Account and deletion request"
        }
        return "Account, plan, sign out, and deletion request"
    }

    private var relayClient: APIClient {
        APIClient(config: appState.environment.config, tokenStore: appState.environment.tokenStore)
    }

    private var relaySubtitle: String {
        relayUpdateCount > 0 ? "\(relayUpdateCount) recent Relay update\(relayUpdateCount == 1 ? "" : "s")" : "Inbox, outbox, drafts, and approvals"
    }

    private func loadRelayUpdateCount() async {
        guard appState.tokenStatus == .stored else {
            relayUpdateCount = 0
            return
        }
        do {
            let client = relayClient
            let items = try await client.getMobileSync(cursor: nil).decoded?.items ?? []
            relayUpdateCount = items.filter { $0.type.hasPrefix("relay_") }.count
        } catch {
            relayUpdateCount = 0
        }
    }
}

private struct YouHeroRow: View {
    let title: String
    let subtitle: String

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            NearMindLogoMark(size: 42)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(NearMindTheme.textPrimary)
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(NearMindTheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(NearMindTheme.cardSurface, in: RoundedRectangle(cornerRadius: NearMindTheme.radius, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

struct ProfileRow: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .foregroundStyle(NearMindTheme.accentMint)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(NearMindTheme.textPrimary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(NearMindTheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 2)
    }
}

private struct YouAccountView: View {
    var body: some View {
        AccountView()
            .navigationTitle("Account")
    }
}

private struct YouMemoryView: View {
    var body: some View {
        List {
            Section("Memory") {
                NavigationLink {
                    ProfileMemoryView()
                } label: {
                    ProfileRow(title: "What NearMind knows", subtitle: "Confirmed facts and profile context", systemImage: "person.text.rectangle")
                }
                NavigationLink {
                    PendingFactsView()
                } label: {
                    ProfileRow(title: "Pending facts", subtitle: "Review candidates before they become memory", systemImage: "tray.full")
                }
                ProfileRow(title: "Delete memory", subtitle: "Requires review. NearMind does not delete memory directly from chat.", systemImage: "exclamationmark.triangle")
            }
            .listRowBackground(NearMindTheme.cardSurface)
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Memory")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct YouPrivacyView: View {
    @EnvironmentObject private var appState: AppState
    @State private var statusMessage: String?

    var body: some View {
        List {
            Section("Privacy") {
                NavigationLink {
                    ProfilePrivacyDataView()
                } label: {
                    ProfileRow(title: "Consent-first design", subtitle: "Live Assist starts only when you choose.", systemImage: "hand.raised")
                }

                NavigationLink {
                    StorageView()
                } label: {
                    ProfileRow(title: "Storage", subtitle: "Saved data, exports, archived reports, and deletion requests", systemImage: "archivebox")
                }

                NavigationLink {
                    DeleteAccountView()
                } label: {
                    ProfileRow(title: "Account deletion", subtitle: appState.account?.deletionStatus ?? "Sends a backend deletion request", systemImage: "person.crop.circle.badge.xmark")
                }
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Section("Local data") {
                Button(role: .destructive) {
                    appState.clearEvents()
                    statusMessage = "Local logs cleared."
                } label: {
                    ProfileRow(title: "Clear local logs", subtitle: "Clears local debug entries only", systemImage: "trash")
                }

                if let statusMessage {
                    Text(statusMessage)
                        .font(.footnote)
                        .foregroundStyle(NearMindTheme.textSecondary)
                }
            }
            .listRowBackground(NearMindTheme.cardSurface)
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Privacy")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct YouRequestsView: View {
    let client: RelayAPIClientProtocol

    var body: some View {
        List {
            Section("Requests") {
                NavigationLink {
                    RelayInboxView(client: client)
                } label: {
                    ProfileRow(title: "Requests from people", subtitle: "Inbox, sent requests, drafts, and approvals", systemImage: "arrow.left.arrow.right")
                }
                NavigationLink {
                    RelayContactListView(client: client)
                } label: {
                    ProfileRow(title: "Trusted contacts", subtitle: "People your agent can draft controlled requests for", systemImage: "person.2")
                }
                NavigationLink {
                    RelayIdentityView(client: client)
                } label: {
                    ProfileRow(title: "Your request identity", subtitle: "Private professional identity for agent requests", systemImage: "person.crop.circle")
                }
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Section("Control") {
                ProfileRow(title: "Human approval required", subtitle: "NearMind drafts requests; you approve before anything is sent.", systemImage: "checkmark.shield")
                ProfileRow(title: "No external send in v0", subtitle: "Requests stay inside the controlled approval flow.", systemImage: "lock")
            }
            .listRowBackground(NearMindTheme.cardSurface)
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Requests")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct YouPreferencesView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        List {
            Section("Assistant") {
                Toggle(isOn: Binding(
                    get: { appState.ttsMutedPreference },
                    set: { appState.setTTSMutedPreference($0) }
                )) {
                    ProfileRow(title: "Spoken responses", subtitle: appState.ttsMutedPreference ? "Muted" : "Native TTS enabled", systemImage: "speaker.wave.2")
                }
                .accessibilityHint("Turns local spoken responses on or off")

                Picker("Default Live mode", selection: Binding(
                    get: { appState.defaultAssistPolicy },
                    set: { appState.setDefaultAssistPolicy($0) }
                )) {
                    ForEach(AssistPolicy.allCases) { policy in
                        Text(policy.profileTitle).tag(policy)
                    }
                }

                ProfileRow(title: "Answer length", subtitle: "NearMind will tune this later as a local preference.", systemImage: "text.alignleft")
            }
            .listRowBackground(NearMindTheme.cardSurface)
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Preferences")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct YouAudioView: View {
    let microphoneStatus: MicrophonePermissionStatus

    var body: some View {
        List {
            Section("Audio") {
                LabeledContent("Microphone", value: microphoneStatus.rawValue)
                ProfileRow(title: "Audio route", subtitle: "Native speech uses the current output route", systemImage: "speaker.wave.3")
                ProfileRow(title: "Recording", subtitle: "No hidden or background always-listening mode", systemImage: "mic.slash")
            }
            .listRowBackground(NearMindTheme.cardSurface)
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Audio")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct YouDeveloperView: View {
    @EnvironmentObject private var appState: AppState
    @State private var token = ""
    @State private var statusMessage: String?

    var body: some View {
        List {
            Section("Developer token") {
                LabeledContent("Token status", value: tokenStatusText)

                SecureField("Paste test JWT", text: $token)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()

                Text("Paste a test JWT generated by the backend. NearMind stores it in Keychain only.")
                    .font(.footnote)
                    .foregroundStyle(NearMindTheme.textSecondary)

                Button {
                    saveToken()
                } label: {
                    Label("Save token to Keychain", systemImage: "key")
                }
                .disabled(token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                Button(role: .destructive) {
                    clearToken()
                } label: {
                    Label("Clear local token", systemImage: "key.slash")
                }
            }
            .listRowBackground(NearMindTheme.elevatedBackground)

            Section("Internal tools") {
                NavigationLink {
                    LiveSmokeView()
                } label: {
                    ProfileRow(title: "Typed Live Smoke", subtitle: "Developer protocol test without microphone", systemImage: "keyboard")
                }

                NavigationLink {
                    DebugEventLogView()
                } label: {
                    ProfileRow(title: "Debug event log", subtitle: "Token and raw audio payloads are not logged", systemImage: "doc.text.magnifyingglass")
                }

                NavigationLink {
                    ProfileDiagnosticsView()
                } label: {
                    ProfileRow(title: "Diagnostics", subtitle: "Backend endpoints, app version, and health context", systemImage: "stethoscope")
                }

                if let statusMessage {
                    Text(statusMessage)
                        .font(.footnote)
                        .foregroundStyle(NearMindTheme.textSecondary)
                }
            }
            .listRowBackground(NearMindTheme.elevatedBackground)
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Developer")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            appState.refreshAuthStatus()
        }
    }

    private func saveToken() {
        do {
            try appState.environment.tokenStore.saveToken(token.trimmingCharacters(in: .whitespacesAndNewlines))
            token = ""
            statusMessage = "Token saved."
            appState.refreshAuthStatus()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private func clearToken() {
        do {
            try appState.environment.tokenStore.clearToken()
            statusMessage = "Token cleared."
            appState.refreshAuthStatus()
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    private var tokenStatusText: String {
        switch appState.tokenStatus {
        case .missing:
            return "missing"
        case .stored:
            return "stored"
        case .invalid:
            return "invalid"
        }
    }
}

private struct ProfileMemoryView: View {
    var body: some View {
        List {
            Section("Confirmed memory") {
                NativeEmptyRow(title: "No confirmed facts yet", subtitle: "NearMind will show approved memory here when backend profile data is available.")
            }
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Memory")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct PendingFactsView: View {
    var body: some View {
        List {
            Section("Pending facts") {
                NativeEmptyRow(title: "Nothing pending", subtitle: "Facts proposed by NearMind will require review before they become memory.")
            }
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Pending Facts")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct ProfilePrivacyDataView: View {
    var body: some View {
        List {
            Section("Privacy posture") {
                ProfileRow(title: "Consent-first", subtitle: "Live Assist starts only after you opt in for a session.", systemImage: "hand.raised")
                ProfileRow(title: "Stop or discard", subtitle: "Stop with save=false to discard session retention.", systemImage: "xmark.circle")
                ProfileRow(title: "Credential handling", subtitle: "Test JWTs stay in Keychain and never appear in logs.", systemImage: "lock")
            }
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Privacy")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct ProfileDiagnosticsView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        List {
            Section("Backend") {
                LabeledContent("API", value: appState.environment.config.apiBaseURL.absoluteString)
                LabeledContent("Gateway", value: appState.environment.config.gatewayWebSocketURL.absoluteString)
                LabeledContent("Gateway HTTP", value: appState.environment.config.gatewayHTTPURL.absoluteString)
            }

            Section("App") {
                LabeledContent("Version", value: shortVersionString)
                LabeledContent("Build", value: buildNumber)
            }
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Diagnostics")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var shortVersionString: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.1"
    }

    private var buildNumber: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "local"
    }
}

private extension AssistPolicy {
    var profileTitle: String {
        switch self {
        case .conversationAgent:
            return "Conversation"
        case .whisperCopilot:
            return "Whisper"
        }
    }
}
