import SwiftUI

struct TodayView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = TodayViewModel()
    let startAssist: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NearMindTheme.sectionSpacing) {
                AppHeader(
                    title: "NearMind",
                    subtitle: "A quiet overview before you step into the day."
                )

                primaryAction
                briefSection
                followUpSection
                upcomingSection
                recentSessionsSection
            }
            .padding(NearMindTheme.pagePadding)
        }
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

    private var primaryAction: some View {
        NativeCard {
            VStack(alignment: .leading, spacing: 12) {
                MiniStatusBadge(text: viewModel.statusText, color: NearMindTheme.accentMint)
                Text("Start Live Assist")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(NearMindTheme.textPrimary)
                Text("Use voice help when you choose. Stop, save, or discard the session at any time.")
                    .font(.subheadline)
                    .foregroundStyle(NearMindTheme.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                PrimaryButton("Start Live Assist", systemImage: "waveform") {
                    startAssist()
                }
            }
        }
    }

    private var briefSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            ConsumerSectionHeader("Today Brief")
            if let brief = viewModel.content.briefText {
                NativeCard {
                    Text(brief)
                        .font(.subheadline)
                        .foregroundStyle(NearMindTheme.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            } else {
                EmptyStateView(
                    title: "No brief yet",
                    message: "Start your first Live Assist session to build useful context.",
                    systemImage: "sun.max"
                )
            }
        }
    }

    private var followUpSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            ConsumerSectionHeader("Follow-ups")
            NativeCard {
                HStack(spacing: 12) {
                    Image(systemName: "checklist")
                        .font(.title3)
                        .foregroundStyle(NearMindTheme.accentMint)
                        .frame(width: 32)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(viewModel.content.hasTasks ? "\(viewModel.content.openTaskCount) open" : "No tasks yet")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(NearMindTheme.textPrimary)
                        Text(viewModel.content.hasTasks ? "Review follow-ups from recent sessions." : "Follow-ups will appear after saved sessions.")
                            .font(.footnote)
                            .foregroundStyle(NearMindTheme.textSecondary)
                    }
                    Spacer()
                }
            }
        }
    }

    private var upcomingSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            ConsumerSectionHeader("Upcoming")
            NativeCard {
                HStack(spacing: 12) {
                    Image(systemName: "calendar")
                        .font(.title3)
                        .foregroundStyle(NearMindTheme.accentMint)
                        .frame(width: 32)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(viewModel.content.upcomingTitle ?? "No upcoming context")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(NearMindTheme.textPrimary)
                        Text(viewModel.content.upcomingTitle == nil ? "NearMind will stay quiet until you start a session." : "Ready for your next moment.")
                            .font(.footnote)
                            .foregroundStyle(NearMindTheme.textSecondary)
                    }
                    Spacer()
                }
            }
        }
    }

    private var recentSessionsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            ConsumerSectionHeader("Recent Sessions")
            if viewModel.content.recentSessions.isEmpty {
                EmptyStateView(
                    title: "No recent sessions",
                    message: "Start your first Live Assist session when you want help in the moment.",
                    systemImage: "clock"
                )
            } else {
                VStack(spacing: 10) {
                    ForEach(viewModel.content.recentSessions) { session in
                        SessionRow(item: session)
                    }
                }
            }
        }
    }
}

