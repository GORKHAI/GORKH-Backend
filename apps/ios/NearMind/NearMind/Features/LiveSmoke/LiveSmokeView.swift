import SwiftUI

struct LiveSmokeView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = LiveSmokeViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                SectionCard(title: "Typed Live Smoke", subtitle: appState.environment.config.gatewayWebSocketURL.absoluteString) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(viewModel.status)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.teal)
                            .fixedSize(horizontal: false, vertical: true)
                        Text("Session: \(viewModel.lastSessionId ?? "none")")
                            .font(.caption.monospaced())
                            .foregroundStyle(.secondary)
                        Text("Gateway events: \(viewModel.gatewayEventCount)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .textSelection(.enabled)
                }

                SectionCard(title: "API") {
                    button("API health check", "stethoscope") {
                        viewModel.runAPIHealth()
                    }
                    button("Fetch mobile sync", "arrow.triangle.2.circlepath") {
                        viewModel.fetchMobileSync()
                    }
                    button("Fetch session state", "list.bullet.rectangle") {
                        viewModel.fetchSessionState()
                    }
                    button("Fetch latency summary", "speedometer") {
                        viewModel.fetchLatencySummary()
                    }
                }

                SectionCard(title: "Gateway") {
                    HStack {
                        button("Connect", "bolt.horizontal.circle") {
                            viewModel.connectGateway()
                        }
                        button("Disconnect", "xmark.circle", role: .destructive) {
                            viewModel.disconnectGateway()
                        }
                    }
                }

                SectionCard(title: "Conversation Agent") {
                    button("Start conversation_agent", "play.circle") {
                        viewModel.startConversationSession()
                    }
                    Text(LiveSmokeViewModel.bankPrepText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    button("Send bank prep user_text", "paperplane") {
                        viewModel.sendConversationText()
                    }
                    button("Stop save=false", "stop.circle", role: .destructive) {
                        viewModel.stopConversationWithoutSaving()
                    }
                }

                SectionCard(title: "Whisper Copilot") {
                    button("Start whisper_copilot", "play.circle") {
                        viewModel.startWhisperSession()
                    }
                    Text(LiveSmokeViewModel.aprTranscript)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    button("Send APR transcript", "text.bubble") {
                        viewModel.sendWhisperTranscript()
                    }
                    button("Stop save=false", "stop.circle", role: .destructive) {
                        viewModel.stopWhisperWithoutSaving()
                    }
                }

                SectionCard(title: "Checklist") {
                    VStack(spacing: 10) {
                        ForEach(viewModel.checks) { check in
                            LiveSmokeCheckRow(check: check)
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Color.black.ignoresSafeArea())
        .navigationTitle("Live Smoke Test")
        .onAppear {
            viewModel.configure(environment: appState.environment, appState: appState)
        }
    }

    private func button(
        _ title: String,
        _ systemImage: String,
        role: ButtonRole? = nil,
        action: @escaping () -> Void
    ) -> some View {
        Button(role: role, action: action) {
            Label(title, systemImage: systemImage)
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .disabled(viewModel.isBusy)
    }
}

private struct LiveSmokeCheckRow: View {
    let check: LiveSmokeCheck

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(color)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 3) {
                Text(check.title)
                    .font(.subheadline.weight(.semibold))
                Text(check.detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var icon: String {
        switch check.status {
        case .pending: return "circle"
        case .running: return "clock"
        case .passed: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        case .skipped: return "minus.circle"
        }
    }

    private var color: Color {
        switch check.status {
        case .pending: return .secondary
        case .running: return .yellow
        case .passed: return .green
        case .failed: return .red
        case .skipped: return .orange
        }
    }
}
