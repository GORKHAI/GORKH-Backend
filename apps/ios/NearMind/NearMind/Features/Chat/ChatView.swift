import SwiftUI

struct ChatView: View {
    @EnvironmentObject private var appState: AppState
    @StateObject private var viewModel = ChatViewModel()
    @State private var relayComposerGoal = ""
    @State private var isShowingRelayComposer = false
    let openLive: () -> Void
    let openProfile: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            chatHeader

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(viewModel.messages) { message in
                            ChatMessageBubble(message: message)
                                .id(message.id)
                        }

                        if let approval = viewModel.pendingApproval {
                            ApprovalCardView(
                                approval: approval,
                                onConfirm: viewModel.confirmApproval,
                                onCancel: viewModel.cancelApproval
                            )
                            .padding(.top, 4)
                        }

                        if viewModel.isLoading {
                            HStack(spacing: 8) {
                                ProgressView()
                                    .tint(NearMindTheme.accentMint)
                                Text("NearMind is thinking")
                                    .font(.footnote)
                                    .foregroundStyle(NearMindTheme.textSecondary)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    .padding(.horizontal, NearMindTheme.pagePadding)
                    .padding(.top, 14)
                    .padding(.bottom, 14)
                }
                .onChange(of: viewModel.messages.count) { _, _ in
                    if let last = viewModel.messages.last {
                        withAnimation(.snappy) {
                            proxy.scrollTo(last.id, anchor: .bottom)
                        }
                    }
                }
            }

            ChatQuickActions(onSelect: viewModel.handleQuickAction)
                .padding(.bottom, 8)

            ChatInputBar(
                text: $viewModel.inputText,
                isLoading: viewModel.isLoading,
                onSend: viewModel.submitInput,
                onMic: viewModel.handleMicTapped
            )
        }
        .background(NearMindTheme.background.ignoresSafeArea())
        .navigationTitle("Chat")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            viewModel.configure(
                appState: appState,
                openLive: openLive,
                openProfile: openProfile,
                openRelayComposer: { goal in
                    relayComposerGoal = goal
                    isShowingRelayComposer = true
                }
            )
        }
        .sheet(isPresented: $isShowingRelayComposer) {
            NavigationStack {
                RelayComposerRootView(
                    client: APIClient(config: appState.environment.config, tokenStore: appState.environment.tokenStore),
                    initialGoal: relayComposerGoal
                )
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") {
                            isShowingRelayComposer = false
                        }
                    }
                }
            }
            .presentationDetents([.large])
        }
    }

    private var chatHeader: some View {
        HStack(spacing: 12) {
            NearMindLogoMark(size: 34)
            VStack(alignment: .leading, spacing: 2) {
                Text("NearMind")
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(NearMindTheme.textPrimary)
                Text(viewModel.statusText)
                    .font(.caption)
                    .foregroundStyle(NearMindTheme.textSecondary)
            }
            Spacer()
            MiniStatusBadge(text: "Private", color: NearMindTheme.success)
        }
        .padding(.horizontal, NearMindTheme.pagePadding)
        .padding(.top, 8)
        .padding(.bottom, 10)
        .background(NearMindTheme.background)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(NearMindTheme.border)
                .frame(height: 1)
        }
    }
}
