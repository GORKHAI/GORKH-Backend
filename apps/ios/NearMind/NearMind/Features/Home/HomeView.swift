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
            .background(Color.black.ignoresSafeArea())
            .navigationTitle("NearMind")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    StatusPill(
                        text: appState.isAuthenticated ? "JWT saved" : "No JWT",
                        color: appState.isAuthenticated ? .green : .orange
                    )
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("GORKH Brain")
                .font(.title.weight(.bold))
            Text("Native SwiftUI scaffold for future live voice assistance.")
                .foregroundStyle(.secondary)
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
            .foregroundStyle(.secondary)
            .textSelection(.enabled)
        }
    }

    private var navigationCards: some View {
        VStack(spacing: 12) {
            NavigationLink {
                LiveAssistView()
            } label: {
                CardRow(title: "Live Assist", subtitle: "Typed WebSocket session prototype", systemImage: "message")
            }

            CardRow(title: "Daily Brief", subtitle: "Placeholder for daily brief APIs", systemImage: "sun.max")
                .opacity(0.65)

            CardRow(title: "Tasks", subtitle: "Placeholder for task APIs", systemImage: "checklist")
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
                .foregroundStyle(.teal)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.white)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(16)
        .background(Color.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 8))
    }
}
