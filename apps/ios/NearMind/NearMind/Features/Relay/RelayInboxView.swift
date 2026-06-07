import SwiftUI

struct RelayInboxView: View {
    @StateObject private var viewModel: RelayViewModel
    @State private var selectedTab: RelayListTab = .inbox

    init(client: RelayAPIClientProtocol) {
        _viewModel = StateObject(wrappedValue: RelayViewModel(client: client))
    }

    var body: some View {
        List {
            Picker("Relay list", selection: $selectedTab) {
                ForEach(RelayListTab.allCases) { tab in
                    Text(tab.title).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .listRowBackground(Color.clear)

            if viewModel.isLoading {
                ProgressView("Loading Relay requests")
                    .tint(NearMindTheme.accentMint)
                    .listRowBackground(NearMindTheme.cardSurface)
            }

            if visibleRequests.isEmpty && !viewModel.isLoading {
                NativeEmptyRow(
                    title: selectedTab.emptyTitle,
                    subtitle: "Private agent requests will appear here after a draft, approval, or reply."
                )
            } else {
                ForEach(visibleRequests) { request in
                    NavigationLink {
                        RelayRequestDetailView(viewModel: viewModel, request: request)
                    } label: {
                        RelayRequestRow(request: request)
                    }
                }
            }

            NavigationLink {
                RelayComposerView(viewModel: viewModel)
            } label: {
                ProfileRow(title: "Draft a request", subtitle: "Create a private request and approve before sending", systemImage: "square.and.pencil")
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
        .navigationTitle("Requests")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.load()
        }
        .refreshable {
            await viewModel.load()
        }
    }

    private var visibleRequests: [RelayRequestSummary] {
        switch selectedTab {
        case .inbox:
            return viewModel.inbox
        case .outbox:
            return viewModel.outbox
        case .drafts:
            return viewModel.outbox.filter { $0.status == RelayRequestStatus.draft.rawValue }
        case .pending:
            return viewModel.outbox.filter { $0.status == RelayRequestStatus.pendingSenderApproval.rawValue }
        }
    }
}

private enum RelayListTab: String, CaseIterable, Identifiable {
    case inbox
    case outbox
    case drafts
    case pending

    var id: String { rawValue }

    var title: String {
        switch self {
        case .inbox:
            return "From people"
        case .outbox:
            return "Sent"
        case .drafts:
            return "Drafts"
        case .pending:
            return "Needs approval"
        }
    }

    var emptyTitle: String {
        switch self {
        case .inbox:
            return "No requests from people"
        case .outbox:
            return "No sent requests"
        case .drafts:
            return "No drafts"
        case .pending:
            return "No approvals needed"
        }
    }
}

private struct RelayRequestRow: View {
    let request: RelayRequestSummary

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: iconName)
                .foregroundStyle(NearMindTheme.accentMint)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(request.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(NearMindTheme.textPrimary)
                    Spacer()
                    Text(request.displayStatus)
                        .font(.caption.weight(.medium))
                        .foregroundStyle(NearMindTheme.textSecondary)
                }
                Text(request.summary)
                    .font(.caption)
                    .foregroundStyle(NearMindTheme.textSecondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 3)
    }

    private var iconName: String {
        switch request.requestType {
        case RelayRequestType.meetingRequest.rawValue, RelayRequestType.availabilityRequest.rawValue:
            return "calendar.badge.clock"
        case RelayRequestType.investorInterestCheck.rawValue:
            return "chart.line.uptrend.xyaxis"
        case RelayRequestType.jobOpportunity.rawValue:
            return "briefcase"
        default:
            return "arrow.left.arrow.right"
        }
    }
}
