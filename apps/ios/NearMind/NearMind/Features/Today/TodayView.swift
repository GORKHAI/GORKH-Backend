import SwiftUI

struct TodayView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = TodayViewModel()
    let startAssist: () -> Void

    var body: some View {
        List {
            Section {
                Button {
                    startAssist()
                } label: {
                    HStack(spacing: 14) {
                        NearMindLogoMark(size: 42)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Start Live Assist")
                                .font(.headline)
                                .foregroundStyle(NearMindTheme.textPrimary)
                            Text("Voice help when you choose.")
                                .font(.subheadline)
                                .foregroundStyle(NearMindTheme.textSecondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(NearMindTheme.textSecondary)
                    }
                    .padding(.vertical, 6)
                }
                .buttonStyle(.plain)
            } header: {
                AppHeader(title: "NearMind", subtitle: "Private help for real-life moments.")
                    .textCase(nil)
                    .padding(.bottom, 8)
            }

            Section("Today Brief") {
                if let brief = viewModel.content.briefText {
                    Text(brief)
                        .foregroundStyle(NearMindTheme.textPrimary)
                } else {
                    NativeEmptyRow(title: "No brief yet", subtitle: "Start your first Live Assist session.")
                }
            }

            Section("Follow-ups") {
                NativeInfoRow(
                    systemImage: "checklist",
                    title: viewModel.content.hasTasks ? "\(viewModel.content.openTaskCount) open" : "No tasks yet",
                    subtitle: viewModel.content.hasTasks ? "Review follow-ups from recent sessions." : "Follow-ups appear after saved sessions."
                )
            }

            Section("Upcoming") {
                NativeInfoRow(
                    systemImage: "calendar",
                    title: viewModel.content.upcomingTitle ?? "No upcoming context",
                    subtitle: viewModel.content.upcomingTitle == nil ? "NearMind stays quiet until you start a session." : "Ready for your next moment."
                )
            }

            Section("Recent Sessions") {
                if viewModel.content.recentSessions.isEmpty {
                    NativeEmptyRow(title: "No recent sessions", subtitle: "Saved sessions will show here.")
                } else {
                    ForEach(viewModel.content.recentSessions) { session in
                        SessionRow(item: session)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Today")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    viewModel.refresh()
                } label: {
                    Image(systemName: viewModel.isLoading ? "arrow.triangle.2.circlepath" : "arrow.clockwise")
                }
                .foregroundStyle(NearMindTheme.accentMint)
                .accessibilityLabel("Refresh Today")
            }
        }
        .onAppear {
            viewModel.configure(environment: appState.environment, appState: appState)
            viewModel.refresh()
        }
    }
}

struct NativeInfoRow: View {
    let systemImage: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.body)
                .foregroundStyle(NearMindTheme.accentMint)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.body)
                    .foregroundStyle(NearMindTheme.textPrimary)
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(NearMindTheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, 2)
    }
}

struct NativeEmptyRow: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.body)
                .foregroundStyle(NearMindTheme.textPrimary)
            Text(subtitle)
                .font(.footnote)
                .foregroundStyle(NearMindTheme.textSecondary)
        }
        .padding(.vertical, 4)
    }
}
