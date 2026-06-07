import SwiftUI

enum ProfileSection: String, CaseIterable {
    case account = "Account"
    case plan = "Plan"
    case profileMemory = "Profile & Memory"
    case preferences = "Preferences"
    case privacyData = "Privacy & Data"
    case audio = "Audio"
    case approvals = "Approvals"
    case diagnostics = "Diagnostics"
    case developer = "Developer"
}

struct ProfileView: View {
    @EnvironmentObject private var appState: AppState
    @State private var token = ""
    @State private var statusMessage: String?
    @State private var microphoneStatus = SystemMicrophonePermissionProvider().currentStatus()
    @State private var relayUpdateCount = 0

    var body: some View {
        List {
            accountSection
            planSection
            profileMemorySection
            preferencesSection
            privacySection
            audioSection
            approvalsSection
            diagnosticsSection
            developerSection
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .tint(NearMindTheme.accentMint)
        .navigationTitle("Profile")
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

    private var accountSection: some View {
        Section(ProfileSection.account.rawValue) {
            NavigationLink {
                AccountView()
            } label: {
                ProfileRow(
                    title: appState.account?.displayLabel ?? "NearMind account",
                    subtitle: appState.account?.email ?? "Account, sign out, and deletion request",
                    systemImage: "person.crop.circle"
                )
            }
            Button(role: .destructive) {
                Task { await appState.signOut() }
            } label: {
                ProfileRow(title: "Sign out", subtitle: "Clears the Keychain token from this device", systemImage: "rectangle.portrait.and.arrow.right")
            }
        }
        .listRowBackground(NearMindTheme.cardSurface)
    }

    private var planSection: some View {
        Section(ProfileSection.plan.rawValue) {
            PlanStatusView(plan: appState.account?.plan, billing: appState.billingStatus)
                .listRowInsets(EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16))
        }
        .listRowBackground(NearMindTheme.cardSurface)
    }

    private var profileMemorySection: some View {
        Section(ProfileSection.profileMemory.rawValue) {
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

            NavigationLink {
                RelayIdentityView(client: relayClient)
            } label: {
                ProfileRow(title: "Relay Identity", subtitle: "Private professional identity for agent requests", systemImage: "person.crop.circle")
            }
        }
        .listRowBackground(NearMindTheme.cardSurface)
    }

    private var preferencesSection: some View {
        Section(ProfileSection.preferences.rawValue) {
            Toggle(isOn: Binding(
                get: { appState.ttsMutedPreference },
                set: { appState.setTTSMutedPreference($0) }
            )) {
                ProfileRow(title: "Voice replies", subtitle: appState.ttsMutedPreference ? "Muted" : "Native TTS enabled", systemImage: "speaker.wave.2")
            }

            Picker("Default Live mode", selection: Binding(
                get: { appState.defaultAssistPolicy },
                set: { appState.setDefaultAssistPolicy($0) }
            )) {
                ForEach(AssistPolicy.allCases) { policy in
                    Text(policy.profileTitle).tag(policy)
                }
            }
        }
        .listRowBackground(NearMindTheme.cardSurface)
    }

    private var privacySection: some View {
        Section(ProfileSection.privacyData.rawValue) {
            NavigationLink {
                ProfilePrivacyDataView()
            } label: {
                ProfileRow(title: "Privacy controls", subtitle: "Consent, retention, logs, and local data", systemImage: "lock.shield")
            }

            NavigationLink {
                StorageView()
            } label: {
                ProfileRow(title: "Storage", subtitle: "Long-term storage, exports, and deletion requests", systemImage: "archivebox")
            }

            NavigationLink {
                DeleteAccountView()
            } label: {
                ProfileRow(title: "Request account deletion", subtitle: appState.account?.deletionStatus ?? "Sends a backend deletion request", systemImage: "person.crop.circle.badge.xmark")
            }

            Button(role: .destructive) {
                clearToken()
            } label: {
                ProfileRow(title: "Clear local token", subtitle: "Removes the test JWT from Keychain", systemImage: "key.slash")
            }

            Button(role: .destructive) {
                appState.clearEvents()
                statusMessage = "Local logs cleared."
            } label: {
                ProfileRow(title: "Clear local logs", subtitle: "Clears local debug entries only", systemImage: "trash")
            }
        }
        .listRowBackground(NearMindTheme.cardSurface)
    }

    private var audioSection: some View {
        Section(ProfileSection.audio.rawValue) {
            LabeledContent("Microphone", value: microphoneStatus.rawValue)
            ProfileRow(title: "Audio route", subtitle: "Native speech uses the current output route", systemImage: "speaker.wave.3")
            ProfileRow(title: "Recording", subtitle: "No hidden or background always-listening mode", systemImage: "mic.slash")
        }
        .listRowBackground(NearMindTheme.cardSurface)
    }

    private var approvalsSection: some View {
        Section(ProfileSection.approvals.rawValue) {
            NavigationLink {
                RelayInboxView(client: relayClient)
            } label: {
                ProfileRow(title: "Agent Requests", subtitle: relaySubtitle, systemImage: "arrow.left.arrow.right")
            }
            NavigationLink {
                RelayContactListView(client: relayClient)
            } label: {
                ProfileRow(title: "Trusted Contacts", subtitle: "People your agent can draft controlled requests for", systemImage: "person.2")
            }
            ProfileRow(title: "Sensitive changes", subtitle: "Chat proposes actions; you approve before changes happen", systemImage: "checkmark.shield")
            ProfileRow(title: "Memory deletion", subtitle: "Disabled from chat in v0.5; review is required", systemImage: "exclamationmark.triangle")
        }
        .listRowBackground(NearMindTheme.cardSurface)
    }

    private var diagnosticsSection: some View {
        Section(ProfileSection.diagnostics.rawValue) {
            NavigationLink {
                ProfileDiagnosticsView()
            } label: {
                ProfileRow(title: "Diagnostics", subtitle: "Backend endpoints, app version, and health context", systemImage: "stethoscope")
            }
        }
        .listRowBackground(NearMindTheme.cardSurface)
    }

    private var developerSection: some View {
        Section(ProfileSection.developer.rawValue) {
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

            if let statusMessage {
                Text(statusMessage)
                    .font(.footnote)
                    .foregroundStyle(NearMindTheme.textSecondary)
            }
        }
        .listRowBackground(NearMindTheme.elevatedBackground)
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
