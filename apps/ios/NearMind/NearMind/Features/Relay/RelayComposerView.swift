import SwiftUI

struct RelayComposerRootView: View {
    @StateObject private var viewModel: RelayViewModel
    let initialGoal: String

    init(client: RelayAPIClientProtocol, initialGoal: String = "") {
        _viewModel = StateObject(wrappedValue: RelayViewModel(client: client))
        self.initialGoal = initialGoal
    }

    var body: some View {
        RelayComposerView(viewModel: viewModel, initialGoal: initialGoal)
    }
}

struct RelayComposerView: View {
    @ObservedObject var viewModel: RelayViewModel
    @State private var requestType: RelayRequestType = .generalRequest
    @State private var displayName = ""
    @State private var email = ""
    @State private var goal = ""
    @State private var createdRequest: RelayRequestSummary?

    init(viewModel: RelayViewModel, initialGoal: String = "") {
        self.viewModel = viewModel
        _goal = State(initialValue: initialGoal)
    }

    var body: some View {
        List {
            Section("Recipient") {
                TextField("Name", text: $displayName)
                    .textInputAutocapitalization(.words)
                TextField("Email optional", text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Section("Request") {
                Picker("Type", selection: $requestType) {
                    ForEach(RelayRequestType.allCases, id: \.rawValue) { type in
                        Text(type.displayName).tag(type)
                    }
                }
                TextField("What should NearMind ask?", text: $goal, axis: .vertical)
                    .lineLimit(3...6)
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Section("Privacy") {
                ProfileRow(title: "Draft first", subtitle: "NearMind creates a draft and waits for your approval before sending.", systemImage: "checkmark.shield")
                ProfileRow(title: "No external send", subtitle: "Email-only recipients stay staged in v0. No email is sent.", systemImage: "envelope.badge")
            }
            .listRowBackground(NearMindTheme.cardSurface)

            Button {
                Task {
                    createdRequest = await viewModel.draft(type: requestType, displayName: displayName, email: email, goal: goal)
                }
            } label: {
                Label("Create Draft", systemImage: "square.and.pencil")
            }
            .disabled(!canDraft || viewModel.isLoading)
            .listRowBackground(NearMindTheme.primaryCTA)
            .foregroundStyle(NearMindTheme.textPrimary)

            if let createdRequest {
                RelayApprovalCardView(
                    title: createdRequest.title,
                    summary: createdRequest.summary,
                    riskLevel: createdRequest.riskLevel,
                    confirmLabel: "Send Request",
                    cancelLabel: "Cancel",
                    onConfirm: { Task { await viewModel.approveSend(createdRequest) } },
                    onCancel: { Task { await viewModel.cancel(createdRequest) } }
                )
                .listRowBackground(Color.clear)
            }

            if let statusMessage = viewModel.statusMessage {
                Text(statusMessage)
                    .font(.footnote)
                    .foregroundStyle(NearMindTheme.textSecondary)
                    .listRowBackground(NearMindTheme.elevatedBackground)
            }
        }
        .scrollContentBackground(.hidden)
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("New Relay Request")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var canDraft: Bool {
        !displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !goal.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
