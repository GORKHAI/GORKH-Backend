import SwiftUI

struct SessionsView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = SessionsViewModel()
    var startLive: () -> Void = {}

    var body: some View {
        List {
            if viewModel.content.isEmpty {
                Section {
                    NativeEmptyRow(
                        title: "No saved sessions",
                        subtitle: "Saved Live Assist sessions will appear here."
                    )
                    Button(action: startLive) {
                        Label("Start Live Assist", systemImage: "waveform")
                    }
                    .foregroundStyle(NearMindTheme.accentMint)
                } header: {
                    AppHeader(title: "Sessions", subtitle: "Review saved conversations and cues.")
                        .textCase(nil)
                        .padding(.bottom, 8)
                }
            } else {
                Section {
                    ForEach(viewModel.content.sessions) { session in
                        NavigationLink {
                            SessionDetailView(session: session)
                        } label: {
                            SessionRow(item: session)
                        }
                    }
                } header: {
                    AppHeader(title: "Sessions", subtitle: "Review saved conversations and cues.")
                        .textCase(nil)
                        .padding(.bottom, 8)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
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
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: item.retentionStatus == .discarded ? "trash" : "waveform.circle")
                .font(.title3)
                .foregroundStyle(NearMindTheme.accentMint)
                .frame(width: 30)

            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text(item.title)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(NearMindTheme.textPrimary)
                        .lineLimit(2)
                    Spacer(minLength: 8)
                    Text(item.retentionStatus.title)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(item.retentionStatus == .discarded ? NearMindTheme.warning : NearMindTheme.success)
                }
                Text(item.formattedDate)
                    .font(.caption)
                    .foregroundStyle(NearMindTheme.textSecondary)
                Text(item.preview)
                    .font(.footnote)
                    .foregroundStyle(NearMindTheme.textSecondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 4)
    }
}

struct SessionDetailView: View {
    let session: SessionListItem
    @State private var showDiagnostics = false

    var body: some View {
        List {
            Section {
                Text(session.summary ?? session.preview)
                    .foregroundStyle(NearMindTheme.textPrimary)
            } header: {
                AppHeader(title: session.title, subtitle: session.formattedDate)
                    .textCase(nil)
                    .padding(.bottom, 8)
            }

            DetailListSection(title: "Key Cues", rows: session.cues, emptyTitle: "No cues saved")
            DetailListSection(title: "Follow-ups", rows: session.followUps, emptyTitle: "No follow-ups saved")
            DetailListSection(title: "Transcript Snippets", rows: session.transcriptSnippets, emptyTitle: "No transcript snippets")

            Section("Diagnostics") {
                if session.diagnostics.isEmpty {
                    NativeEmptyRow(title: "No diagnostics available", subtitle: "Latency and technical details appear when available.")
                } else {
                    ForEach(session.diagnostics.indices, id: \.self) { index in
                        Text(session.diagnostics[index])
                            .font(.footnote)
                            .foregroundStyle(NearMindTheme.textSecondary)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
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
        Section(title) {
            if rows.isEmpty {
                NativeEmptyRow(title: emptyTitle, subtitle: "Nothing has been saved for this section yet.")
            } else {
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
