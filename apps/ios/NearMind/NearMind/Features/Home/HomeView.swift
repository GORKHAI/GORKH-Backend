import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    environmentCard
                    navigationCards
                }
                .padding(16)
            }
            .background(NearMindTheme.background.ignoresSafeArea())
            .navigationTitle("NearMind")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    StatusPill(
                        text: appState.isAuthenticated ? "JWT saved" : "No JWT",
                        color: appState.isAuthenticated ? NearMindTheme.success : NearMindTheme.warning
                    )
                }
            }
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 14) {
            NearMindLogoMark(size: 70)
            VStack(alignment: .leading, spacing: 6) {
                Text("NearMind")
                    .font(.title.weight(.bold))
                    .foregroundStyle(NearMindTheme.textPrimary)
                Text("Private live help for real-life conversations.")
                    .foregroundStyle(NearMindTheme.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var environmentCard: some View {
        SectionCard(title: "Production Environment") {
            VStack(alignment: .leading, spacing: 8) {
                Label(appState.environment.config.apiBaseURL.absoluteString, systemImage: "server.rack")
                Label(appState.environment.config.gatewayWebSocketURL.absoluteString, systemImage: "waveform.path.ecg")
            }
            .font(.footnote)
            .foregroundStyle(NearMindTheme.textSecondary)
            .textSelection(.enabled)
        }
    }

    private var navigationCards: some View {
        VStack(spacing: 12) {
            NavigationLink {
                LiveAssistView()
            } label: {
                CardRow(title: "Live Assist", subtitle: "Real-device voice and TTS smoke", systemImage: "message")
            }

            NavigationLink {
                LiveSmokeView()
            } label: {
                CardRow(title: "Live Smoke Test", subtitle: "Production typed gateway verification", systemImage: "checkmark.seal")
            }

            CardRow(title: "Daily Brief", subtitle: "Placeholder for daily brief APIs", systemImage: "sun.max")
                .opacity(0.65)

            NavigationLink {
                SettingsView()
            } label: {
                CardRow(title: "Settings", subtitle: "JWT storage and environment", systemImage: "gearshape")
            }

            NavigationLink {
                DebugEventLogView()
            } label: {
                CardRow(title: "Debug Log", subtitle: "Decoded gateway events and raw JSON", systemImage: "terminal")
            }
        }
        .buttonStyle(.plain)
    }
}

private struct CardRow: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.title3)
                .foregroundStyle(NearMindTheme.accentMint)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(NearMindTheme.textPrimary)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(NearMindTheme.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(NearMindTheme.textSecondary.opacity(0.65))
        }
        .padding(16)
        .background(NearMindTheme.surface, in: RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(NearMindTheme.border, lineWidth: 1))
    }
}
