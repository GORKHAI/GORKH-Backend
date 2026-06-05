import SwiftUI

struct LiveAssistView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var viewModel = LiveAssistViewModel()
    @State private var situationType = "Meeting"
    @State private var showDiagnostics = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NearMindTheme.sectionSpacing) {
                AppHeader(
                    title: "Live Assist",
                    subtitle: isActiveExperience ? "Real-time help is active." : "Real-time help when you choose."
                )

                if isActiveExperience {
                    activeSessionView
                } else {
                    prepView
                }

                diagnosticsSection
            }
            .padding(NearMindTheme.pagePadding)
        }
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Live")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            viewModel.configure(environment: appState.environment, appState: appState)
        }
        .onDisappear {
            viewModel.endViewSession()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background {
                viewModel.stopForBackground()
            }
        }
        .onChange(of: viewModel.ttsMuted) { _, muted in
            appState.setTTSMutedPreference(muted)
        }
        .onChange(of: viewModel.policy) { _, policy in
            appState.setDefaultAssistPolicy(policy)
        }
    }

    private var isActiveExperience: Bool {
        viewModel.isSessionActive || viewModel.isMicrophoneRunning || viewModel.isConnected
    }

    private var prepView: some View {
        VStack(alignment: .leading, spacing: NearMindTheme.sectionSpacing) {
            NativeCard {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        MiniStatusBadge(
                            text: viewModel.hasStoredToken ? "Token stored" : "Token missing",
                            color: viewModel.hasStoredToken ? NearMindTheme.success : NearMindTheme.warning
                        )
                        MiniStatusBadge(
                            text: "Mic \(viewModel.microphonePermissionStatus.rawValue)",
                            color: viewModel.microphonePermissionStatus == .granted ? NearMindTheme.success : NearMindTheme.textSecondary
                        )
                    }

                    Picker("Situation", selection: $situationType) {
                        ForEach(["Meeting", "Decision", "Conversation", "Negotiation"], id: \.self) { value in
                            Text(value).tag(value)
                        }
                    }
                    .pickerStyle(.segmented)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Policy")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(NearMindTheme.textSecondary)
                        Picker("Policy", selection: $viewModel.policy) {
                            ForEach(AssistPolicy.allCases) { policy in
                                Text(policy.displayTitle).tag(policy)
                            }
                        }
                        .pickerStyle(.segmented)
                    }

                    labeledTextField("Title", text: $viewModel.title, prompt: "NearMind voice session")

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Context")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(NearMindTheme.textSecondary)
                        TextField("What is this moment about?", text: $viewModel.situationDescription, axis: .vertical)
                            .lineLimit(3...5)
                            .textFieldStyle(.roundedBorder)
                    }

                    Toggle("I consent to start Live Assist for this session", isOn: $viewModel.hasConsent)
                        .toggleStyle(.switch)
                        .tint(NearMindTheme.accentMint)
                        .font(.subheadline)
                        .foregroundStyle(NearMindTheme.textPrimary)
                }
            }

            NativeCard {
                PrimaryButton(
                    "Start Voice Session",
                    systemImage: "waveform.circle",
                    isDisabled: !viewModel.canStartVoiceSession
                ) {
                    viewModel.startVoiceSession()
                }
                Text(startDisabledReason)
                    .font(.footnote)
                    .foregroundStyle(NearMindTheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var activeSessionView: some View {
        VStack(alignment: .leading, spacing: NearMindTheme.sectionSpacing) {
            liveStatusCard
            liveTranscriptCard
            activeControlsCard
        }
    }

    private var liveStatusCard: some View {
        NativeCard {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        MiniStatusBadge(
                            text: viewModel.isConnected ? "Connected" : "Disconnected",
                            color: viewModel.isConnected ? NearMindTheme.success : NearMindTheme.warning
                        )
                        MiniStatusBadge(
                            text: viewModel.isMicrophoneRunning ? "Mic streaming" : "Mic off",
                            color: viewModel.isMicrophoneRunning ? NearMindTheme.success : NearMindTheme.textSecondary
                        )
                    }
                    Text(viewModel.status)
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(NearMindTheme.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                    if let warning = viewModel.lifecycleWarning {
                        Text(warning)
                            .font(.footnote)
                            .foregroundStyle(NearMindTheme.warning)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer()
                Toggle("Mute TTS", isOn: $viewModel.ttsMuted)
                    .labelsHidden()
                    .tint(NearMindTheme.accentMint)
            }

            AudioLevelBar(level: viewModel.micLevel)

            Label(viewModel.audioRouteText, systemImage: "speaker.wave.2")
                .font(.footnote)
                .foregroundStyle(NearMindTheme.textSecondary)
                .fixedSize(horizontal: false, vertical: true)

            HStack {
                Label(viewModel.ttsStatus, systemImage: "quote.bubble")
                Spacer()
                Text(viewModel.ttsDeliveryTarget)
            }
            .font(.caption)
            .foregroundStyle(NearMindTheme.textSecondary)
        }
    }

    private var liveTranscriptCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            ConsumerSectionHeader("Live Notes")
            NativeCard {
                LogLane(title: "Transcript", rows: viewModel.asrLog)
                Divider().overlay(NearMindTheme.border)
                LogLane(title: viewModel.policy == .whisperCopilot ? "Cues" : "Assistant", rows: viewModel.policy == .whisperCopilot ? viewModel.cueLog : viewModel.assistantLog)
                if !viewModel.subagentLog.isEmpty {
                    Divider().overlay(NearMindTheme.border)
                    LogLane(title: "Reports", rows: viewModel.subagentLog)
                }
            }
        }
    }

    private var activeControlsCard: some View {
        NativeCard {
            HStack {
                controlButton("Discard", "xmark.circle", role: .destructive) {
                    viewModel.stopWithoutSaving()
                }
                controlButton("Save", "tray.and.arrow.down") {
                    viewModel.stopAndSave()
                }
            }
            HStack {
                controlButton("Disconnect", "bolt.slash", role: .destructive) {
                    viewModel.disconnect()
                }
                controlButton("Barge-In", "person.wave.2") {
                    viewModel.simulateBargeIn()
                }
            }
        }
    }

    private var diagnosticsSection: some View {
        DisclosureGroup(isExpanded: $showDiagnostics) {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    controlButton("Session State", "list.bullet.rectangle") {
                        viewModel.fetchSessionState()
                    }
                    controlButton("Latency", "speedometer") {
                        viewModel.fetchLatencySummary()
                    }
                }

                controlButton("Verify Log Privacy", "eye.slash") {
                    viewModel.markLogPrivacyVerified()
                }

                LatencyLane(title: "Local latency", rows: viewModel.localLatencyRows)
                LatencyLane(title: "Backend latency", rows: viewModel.backendLatencyRows)
                smokeChecklist

                DisclosureGroup("Decoded Events") {
                    VStack(spacing: 12) {
                        LogLane(title: "ASR", rows: viewModel.asrLog)
                        LogLane(title: "Assistant", rows: viewModel.assistantLog)
                        LogLane(title: "Cues", rows: viewModel.cueLog)
                        LogLane(title: "Subagents", rows: viewModel.subagentLog)
                    }
                    .padding(.top, 8)
                }
                .foregroundStyle(NearMindTheme.textPrimary)
            }
            .padding(.top, 10)
        } label: {
            HStack {
                Image(systemName: "stethoscope")
                Text("Diagnostics")
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(NearMindTheme.textPrimary)
        }
        .padding(16)
        .background(NearMindTheme.cardSurface, in: RoundedRectangle(cornerRadius: NearMindTheme.radius))
        .overlay(RoundedRectangle(cornerRadius: NearMindTheme.radius).stroke(NearMindTheme.border, lineWidth: 1))
    }

    private var smokeChecklist: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Real Device Smoke")
                .font(.caption.weight(.semibold))
                .foregroundStyle(NearMindTheme.textPrimary)
            ForEach(viewModel.realDeviceChecks) { check in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: iconName(for: check.status))
                        .foregroundStyle(color(for: check.status))
                        .frame(width: 18)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(check.title)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(NearMindTheme.textPrimary)
                        if !check.detail.isEmpty {
                            Text(check.detail)
                                .font(.caption2)
                                .foregroundStyle(NearMindTheme.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    Spacer()
                }
            }
        }
    }

    private var startDisabledReason: String {
        if !viewModel.hasStoredToken {
            return "Paste a test JWT in Profile before starting."
        }
        if !viewModel.hasConsent {
            return "Consent is required before the microphone can start."
        }
        if viewModel.isBusy {
            return "Connecting to the gateway."
        }
        return "Microphone starts only after the gateway confirms the session."
    }

    private func labeledTextField(_ title: String, text: Binding<String>, prompt: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(NearMindTheme.textSecondary)
            TextField(prompt, text: text)
                .textFieldStyle(.roundedBorder)
        }
    }

    private func controlButton(
        _ title: String,
        _ systemImage: String,
        role: ButtonRole? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(role: role, action: action) {
            Label(title, systemImage: systemImage)
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(role == .destructive ? NearMindTheme.error : NearMindTheme.primaryCTA)
        .disabled(viewModel.isBusy)
    }

    private func iconName(for status: RealDeviceSmokeCheckStatus) -> String {
        switch status {
        case .pending:
            return "circle"
        case .running:
            return "clock"
        case .passed:
            return "checkmark.circle.fill"
        case .failed:
            return "xmark.circle.fill"
        case .skipped:
            return "minus.circle"
        }
    }

    private func color(for status: RealDeviceSmokeCheckStatus) -> Color {
        switch status {
        case .pending, .skipped:
            return NearMindTheme.textSecondary
        case .running:
            return NearMindTheme.warning
        case .passed:
            return NearMindTheme.success
        case .failed:
            return NearMindTheme.error
        }
    }
}

private struct AudioLevelBar: View {
    let level: Double

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(NearMindTheme.elevatedSurface)
                RoundedRectangle(cornerRadius: 4)
                    .fill(NearMindTheme.accentMint)
                    .frame(width: max(6, proxy.size.width * min(1, max(0, level))))
            }
        }
        .frame(height: 10)
        .accessibilityLabel("Microphone level")
        .accessibilityValue("\(Int(level * 100)) percent")
    }
}

private struct LogLane: View {
    let title: String
    let rows: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(NearMindTheme.textPrimary)
            if rows.isEmpty {
                Text("No events yet.")
                    .font(.caption)
                    .foregroundStyle(NearMindTheme.textSecondary)
            } else {
                ForEach(rows.indices, id: \.self) { index in
                    Text(rows[index])
                        .font(.caption)
                        .foregroundStyle(NearMindTheme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct LatencyLane: View {
    let title: String
    let rows: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(NearMindTheme.textPrimary)
            if rows.isEmpty {
                Text("No metrics yet.")
                    .font(.caption)
                    .foregroundStyle(NearMindTheme.textSecondary)
            } else {
                ForEach(rows.indices, id: \.self) { index in
                    Text(rows[index])
                        .font(.caption)
                        .foregroundStyle(NearMindTheme.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private extension AssistPolicy {
    var displayTitle: String {
        switch self {
        case .conversationAgent:
            return "Conversation"
        case .whisperCopilot:
            return "Whisper"
        }
    }
}
