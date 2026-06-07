import SwiftUI

struct RelayRequestDetailView: View {
    @ObservedObject var viewModel: RelayViewModel
    let request: RelayRequestSummary

    var body: some View {
        List {
            Section("Request") {
                VStack(alignment: .leading, spacing: 10) {
                    Text(request.title)
                        .font(.headline)
                        .foregroundStyle(NearMindTheme.textPrimary)
                    Text(request.summary)
                        .font(.subheadline)
                        .foregroundStyle(NearMindTheme.textSecondary)
                }
                LabeledContent("Type", value: RelayRequestType(rawValue: request.requestType)?.displayName ?? request.requestType)
                LabeledContent("Status", value: request.displayStatus)
                LabeledContent("Risk", value: request.riskLevel.capitalized)
            }
            .listRowBackground(NearMindTheme.cardSurface)

            if request.status == RelayRequestStatus.pendingSenderApproval.rawValue || request.status == RelayRequestStatus.draft.rawValue {
                Section("Sender approval") {
                    RelayApprovalCardView(
                        title: "Send this private request?",
                        summary: "No external email is sent. Existing NearMind users receive an in-app request; email-only contacts stay staged.",
                        riskLevel: request.riskLevel,
                        confirmLabel: "Send Request",
                        cancelLabel: "Cancel Draft",
                        onConfirm: { Task { await viewModel.approveSend(request) } },
                        onCancel: { Task { await viewModel.cancel(request) } }
                    )
                }
                .listRowBackground(Color.clear)
            }

            if request.direction == "inbox" {
                Section("Receiver decision") {
                    Button("Approve limited reply") {
                        Task { await viewModel.approveIncoming(request) }
                    }
                    Button("Reject", role: .destructive) {
                        Task { await viewModel.rejectIncoming(request) }
                    }
                    Button("Ignore") {
                        Task { await viewModel.ignoreIncoming(request) }
                    }
                    Button("Block sender", role: .destructive) {
                        Task { await viewModel.blockSender(request) }
                    }
                }
                .listRowBackground(NearMindTheme.cardSurface)
            }

            Section("Messages") {
                if viewModel.messages.isEmpty {
                    NativeEmptyRow(title: "No messages yet", subtitle: "Request messages are private and audited.")
                } else {
                    ForEach(viewModel.messages) { message in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(message.role.replacingOccurrences(of: "_", with: " ").capitalized)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(NearMindTheme.accentMint)
                            Text(message.body)
                                .font(.subheadline)
                                .foregroundStyle(NearMindTheme.textPrimary)
                        }
                    }
                }
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Section("Privacy") {
                ProfileRow(title: "No automatic sharing", subtitle: "Memory, calendar, email, and profile data are not shared automatically.", systemImage: "lock.shield")
                ProfileRow(title: "Audited actions", subtitle: "Drafts, approvals, rejects, and blocks are recorded for the owner.", systemImage: "list.bullet.clipboard")
            }
            .listRowBackground(NearMindTheme.cardSurface)

            if let statusMessage = viewModel.statusMessage {
                Text(statusMessage)
                    .font(.footnote)
                    .foregroundStyle(NearMindTheme.textSecondary)
                    .listRowBackground(NearMindTheme.elevatedBackground)
            }
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Request")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.select(request)
        }
    }
}
