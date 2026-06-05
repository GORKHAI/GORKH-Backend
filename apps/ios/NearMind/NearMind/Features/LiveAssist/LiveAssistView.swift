import SwiftUI

struct LiveAssistView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var viewModel = LiveAssistViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                statusSection
                sessionSection
                audioSection
                controlsSection
                logsSection
            }
            .padding(16)
        }
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Live Assist")
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
    }

    private var statusSection: some View {
        SectionCard(title: "Voice Session", subtitle: appState.environment.config.gatewayWebSocketURL.absoluteString) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    StatusPill(
                        text: viewModel.isConnected ? "Connected" : "Disconnected",
                        color: viewModel.isConnected ? NearMindTheme.success : NearMindTheme.warning
                    )
                    StatusPill(
                        text: viewModel.isSessionActive ? "Session active" : "No active session",
                        color: viewModel.isSessionActive ? NearMindTheme.success : NearMindTheme.textSecondary
                    )
                }
                Text(viewModel.status)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(NearMindTheme.accentMint)
                    .fixedSize(horizontal: false, vertical: true)
                if let warning = viewModel.lifecycleWarning {
                    Text(warning)
                        .font(.caption)
                        .foregroundStyle(NearMindTheme.warning)
                }
                Text("Session: \(viewModel.lastSessionId ?? "none")")
                    .font(.caption.monospaced())
                    .foregroundStyle(NearMindTheme.textSecondary)
                    .textSelection(.enabled)
            }
        }
    }

    private var sessionSection: some View {
        SectionCard(title: "Session Setup") {
            Picker("Policy", selection: $viewModel.policy) {
                ForEach(AssistPolicy.allCases) { policy in
                    Text(policy.rawValue).tag(policy)
                }
            }
            .pickerStyle(.segmented)

            TextField("Title", text: $viewModel.title)
                .textFieldStyle(.roundedBorder)

            TextField("Situation description", text: $viewModel.situationDescription, axis: .vertical)
                .lineLimit(3...5)
                .textFieldStyle(.roundedBorder)

            Toggle("I have consent to start this Live Assist voice session", isOn: $viewModel.hasConsent)
                .toggleStyle(.switch)
                .tint(NearMindTheme.accentMint)

            HStack {
                Label("JWT \(viewModel.hasStoredToken ? "stored" : "missing")", systemImage: "key")
                Spacer()
                Label("Mic \(viewModel.microphonePermissionStatus.rawValue)", systemImage: "mic")
            }
            .font(.caption)
            .foregroundStyle(NearMindTheme.textSecondary)
        }
    }

    private var audioSection: some View {
        SectionCard(title: "Audio") {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    StatusPill(
                        text: viewModel.isMicrophoneRunning ? "Mic streaming" : "Mic off",
                        color: viewModel.isMicrophoneRunning ? NearMindTheme.success : NearMindTheme.textSecondary
                    )
                    Spacer()
                    Toggle("Mute TTS", isOn: $viewModel.ttsMuted)
                        .labelsHidden()
                        .tint(NearMindTheme.accentMint)
                    Text("Mute TTS")
                        .font(.caption)
                        .foregroundStyle(NearMindTheme.textSecondary)
                }

                AudioLevelBar(level: viewModel.micLevel)

                HStack {
                    Label(viewModel.ttsStatus, systemImage: "speaker.wave.2")
                    Spacer()
                    Text(viewModel.ttsDeliveryTarget)
                }
                .font(.caption)
                .foregroundStyle(NearMindTheme.textSecondary)
            }
        }
    }

    private var controlsSection: some View {
        SectionCard(title: "Controls") {
            PrimaryButton(
                "Start Voice Session",
                systemImage: "mic.circle",
                isDisabled: !viewModel.canStartVoiceSession
            ) {
                viewModel.startVoiceSession()
            }

            HStack {
                controlButton("Stop save=false", "stop.circle", role: .destructive) {
                    viewModel.stopWithoutSaving()
                }
                controlButton("Stop save=true", "tray.and.arrow.down", role: nil) {
                    viewModel.stopAndSave()
                }
            }

            HStack {
                controlButton("Disconnect", "xmark.circle", role: .destructive) {
                    viewModel.disconnect()
                }
                controlButton("Simulate Barge-In", "person.wave.2") {
                    viewModel.simulateBargeIn()
                }
            }

            HStack {
                controlButton("Fetch Session State", "list.bullet.rectangle") {
                    viewModel.fetchSessionState()
                }
                controlButton("Fetch Latency", "speedometer") {
                    viewModel.fetchLatencySummary()
                }
            }
        }
    }

    private var logsSection: some View {
        SectionCard(title: "Decoded Events") {
            VStack(spacing: 12) {
                LogLane(title: "ASR", rows: viewModel.asrLog)
                LogLane(title: "Assistant", rows: viewModel.assistantLog)
                LogLane(title: "Cues", rows: viewModel.cueLog)
                LogLane(title: "Subagents", rows: viewModel.subagentLog)
            }
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
        .tint(role == .destructive ? NearMindTheme.error : NearMindTheme.primaryDarkGreen)
        .disabled(viewModel.isBusy)
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
