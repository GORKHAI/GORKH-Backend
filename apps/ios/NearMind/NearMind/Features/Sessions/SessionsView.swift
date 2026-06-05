import SwiftUI

struct SessionsView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = SessionsViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NearMindTheme.sectionSpacing) {
                AppHeader(
                    title: "Sessions",
                    subtitle: "Browse saved conversations, cues, and follow-ups."
                )

                if viewModel.content.isEmpty {
                    EmptyStateView(
                        title: "No saved sessions",
                        message: "Saved Live Assist sessions will appear here. Discarded sessions stay out of your history.",
                        systemImage: "tray"
                    )
                } else {
                    VStack(spacing: 10) {
                        ForEach(viewModel.content.sessions) { session in
                            NavigationLink {
                                SessionDetailView(session: session)
                            } label: {
                                SessionRow(item: session)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(NearMindTheme.pagePadding)
        }
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Sessions")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    viewModel.refresh()
                } label: {
                    Image(systemName: viewModel.isLoading ? "arrow.triangle.2.circlepath" : "arrow.clockwise")
                }
                .foregroundStyle(NearMindTheme.accentMint)
                .accessibilityLabel("Refresh Sessions")
            }
        }
        .onAppear {
            viewModel.configure(environment: appState.environment, appState: appState)
            viewModel.refresh()
        }
    }
}

struct SessionRow: View {
    let item: SessionListItem

    var body: some View {
        NativeCard {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: item.retentionStatus == .discarded ? "trash" : "waveform.circle")
                    .font(.title3)
                    .foregroundStyle(NearMindTheme.accentMint)
                    .frame(width: 32)

                VStack(alignment: .leading, spacing: 5) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(item.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(NearMindTheme.textPrimary)
                            .lineLimit(2)
                        Spacer()
                        MiniStatusBadge(
                            text: item.retentionStatus.title,
                            color: item.retentionStatus == .discarded ? NearMindTheme.warning : NearMindTheme.success
                        )
                    }
                    Text(item.formattedDate)
                        .font(.caption)
                        .foregroundStyle(NearMindTheme.textSecondary)
                    Text(item.preview)
                        .font(.footnote)
                        .foregroundStyle(NearMindTheme.textSecondary)
                        .lineLimit(3)
                }
            }
        }
    }
}

struct SessionDetailView: View {
    let session: SessionListItem
    @State private var showDiagnostics = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NearMindTheme.sectionSpacing) {
                AppHeader(title: session.title, subtitle: session.formattedDate)

                NativeCard {
                    Text(session.summary ?? session.preview)
                        .font(.subheadline)
                        .foregroundStyle(NearMindTheme.textPrimary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                DetailListSection(title: "Key Cues", rows: session.cues, emptyTitle: "No cues saved")
                DetailListSection(title: "Follow-ups", rows: session.followUps, emptyTitle: "No follow-ups saved")
                DetailListSection(title: "Transcript Snippets", rows: session.transcriptSnippets, emptyTitle: "No transcript snippets")

                DisclosureGroup(isExpanded: $showDiagnostics) {
                    DetailListSection(title: "Diagnostics", rows: session.diagnostics, emptyTitle: "No diagnostics available")
                        .padding(.top, 8)
                } label: {
                    Text("Diagnostics")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(NearMindTheme.textPrimary)
                }
                .padding(16)
                .background(NearMindTheme.cardSurface, in: RoundedRectangle(cornerRadius: NearMindTheme.radius))
                .overlay(RoundedRectangle(cornerRadius: NearMindTheme.radius).stroke(NearMindTheme.border, lineWidth: 1))
            }
            .padding(NearMindTheme.pagePadding)
        }
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Session")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct DetailListSection: View {
    let title: String
    let rows: [String]
    let emptyTitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ConsumerSectionHeader(title)
            if rows.isEmpty {
                EmptyStateView(title: emptyTitle, message: "Nothing has been saved for this section yet.", systemImage: "text.alignleft")
            } else {
                NativeCard {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(rows.indices, id: \.self) { index in
                            Label(rows[index], systemImage: "checkmark.circle")
                                .font(.footnote)
                                .foregroundStyle(NearMindTheme.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
        }
    }
}

private extension SessionListItem {
    var formattedDate: String {
        guard let date else {
            return "Date unavailable"
        }
        return Self.dateFormatter.string(from: date)
    }

    static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
}
